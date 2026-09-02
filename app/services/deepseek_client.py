import json
import logging
import time
from typing import Any

import httpx
from openai import (
    APIConnectionError,
    APITimeoutError,
    APIStatusError,
    OpenAI,
    RateLimitError,
)

from app.core.config import settings

logger = logging.getLogger("deepseek")


class DeepSeekClient:
    def __init__(self, max_retries: int = 3) -> None:
        if not settings.deepseek_api_key:
            raise RuntimeError("DEEPSEEK_API_KEY is missing. Copy .env.example to .env and set it.")
        # 显式超时：连接 5s，读取 300s。大模型生成慢，避免 read 超时误判。
        # max_retries=0：关闭 SDK 内置重试，由本类统一退避，消除“双重重试雪崩”。
        self.client = OpenAI(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
            timeout=httpx.Timeout(300.0, connect=5.0),
            max_retries=0,
        )
        self.model = settings.deepseek_model
        self.max_retries = max_retries

    def json_completion(self, system_prompt: str, user_prompt: str, max_tokens: int = 1800) -> dict[str, Any]:
        last_error: Exception | None = None
        current_max_tokens = max_tokens

        for attempt in range(self.max_retries):
            t0 = time.time()
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    response_format={"type": "json_object"},
                    max_tokens=current_max_tokens,
                )
                elapsed = time.time() - t0
                content = response.choices[0].message.content
                finish_reason = response.choices[0].finish_reason
                usage = getattr(response, "usage", None)
                tokens = f"in={usage.prompt_tokens}/out={usage.completion_tokens}" if usage else "n/a"
                logger.info("deepseek ok: %.1fs finish=%s tokens=%s", elapsed, finish_reason, tokens)

                if not content:
                    last_error = RuntimeError("DeepSeek returned empty content")
                else:
                    try:
                        return json.loads(content)
                    except json.JSONDecodeError as exc:
                        last_error = exc

                # 空内容或 JSON 截断，多半是 max_tokens 不足，加大额度后重试
                if finish_reason == "length":
                    current_max_tokens = min(current_max_tokens * 2, 8192)
            except RateLimitError as exc:
                # 429 限流：指数退避，禁止无脑快速重试
                last_error = exc
                backoff = 2 ** attempt
                logger.warning("deepseek 429 rate-limited, backoff %.0fs", backoff)
                time.sleep(backoff)
            except APITimeoutError as exc:
                # 读取超时：重试大概率仍超时，直接放弃，避免时间雪崩
                last_error = exc
                logger.warning("deepseek read timeout after %.1fs, aborting", time.time() - t0)
                break
            except APIConnectionError as exc:
                # 网络瞬断：线性退避重试
                last_error = exc
                logger.warning("deepseek connection error, retrying")
                time.sleep(1.0 * (attempt + 1))
            except APIStatusError as exc:
                last_error = exc
                if exc.status_code >= 500:
                    logger.warning("deepseek 5xx (status=%s), retrying", exc.status_code)
                    time.sleep(1.0 * (attempt + 1))
                else:
                    # 4xx（非 429）为请求错误，重试无意义
                    logger.warning("deepseek 4xx (status=%s), aborting", exc.status_code)
                    break
            except Exception as exc:
                last_error = exc
                logger.warning("deepseek unexpected error: %s", exc)
                break

        raise RuntimeError(f"DeepSeek JSON completion failed after {self.max_retries} attempts: {last_error}")
