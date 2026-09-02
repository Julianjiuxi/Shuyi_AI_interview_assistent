import json
from typing import Any

from openai import OpenAI

from app.core.config import settings


class DeepSeekClient:
    def __init__(self) -> None:
        if not settings.deepseek_api_key:
            raise RuntimeError("DEEPSEEK_API_KEY is missing. Copy .env.example to .env and set it.")
        self.client = OpenAI(api_key=settings.deepseek_api_key, base_url=settings.deepseek_base_url)
        self.model = settings.deepseek_model

    def json_completion(self, system_prompt: str, user_prompt: str, max_tokens: int = 1800) -> dict[str, Any]:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            max_tokens=max_tokens,
        )
        content = response.choices[0].message.content
        if not content:
            raise RuntimeError("DeepSeek returned empty content")
        return json.loads(content)
