"""MiniMax 媒体生成客户端（图片/语音/视频）。

注意：MINIMAX_API_KEY 由前端同学提供。key 为空时调用会抛出 RuntimeError，
请在 .env 中配置后再联调真实生成。
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger("minimax")

# MiniMax 各能力的 API 路径（如与官方文档不一致，前端同学联调时可调整）。
IMAGE_PATH = "/v1/image_generation"
AUDIO_PATH = "/v1/t2a_v2"
VIDEO_PATH = "/v1/video_generation"
VIDEO_QUERY_PATH = "/v1/query/video_generation"


class MiniMaxClient:
    def __init__(self) -> None:
        if not settings.minimax_api_key:
            raise RuntimeError("MINIMAX_API_KEY is missing. Set it in .env to enable MiniMax generation.")
        self.base_url = settings.minimax_base_url.rstrip("/")
        self.headers = {
            "Authorization": f"Bearer {settings.minimax_api_key}",
            "Content-Type": "application/json",
        }

    def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        try:
            with httpx.Client(timeout=60.0) as client:
                resp = client.post(url, headers=self.headers, json=payload)
                resp.raise_for_status()
                return resp.json()
        except httpx.HTTPStatusError as exc:
            logger.error("minimax http error: %s %s", exc.response.status_code, exc.response.text)
            raise RuntimeError(f"MiniMax HTTP {exc.response.status_code}: {exc.response.text}") from exc

    def _get(self, path: str, params: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.get(url, headers=self.headers, params=params)
                resp.raise_for_status()
                return resp.json()
        except httpx.HTTPStatusError as exc:
            logger.error("minimax http error: %s %s", exc.response.status_code, exc.response.text)
            raise RuntimeError(f"MiniMax HTTP {exc.response.status_code}: {exc.response.text}") from exc

    def create_image_task(self, prompt: str, aspect_ratio: str = "16:9", count: int = 1) -> dict[str, Any]:
        payload = {
            "model": settings.minimax_image_model,
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "n": count,
        }
        return self._post(IMAGE_PATH, payload)

    def create_audio_task(
        self,
        text: str,
        voice_id: str,
        language: str = "en",
        speed: float = 1.0,
        audio_format: str = "mp3",
    ) -> dict[str, Any]:
        payload = {
            "model": settings.minimax_speech_model,
            "text": text,
            "voice_setting": {
                "voice_id": voice_id,
                "speed": speed,
            },
            "language_boost": language,
            "audio_setting": {"format": audio_format},
        }
        return self._post(AUDIO_PATH, payload)

    def create_video_task(
        self,
        prompt: str,
        mode: str = "image-to-video",
        first_frame_asset_url: str | None = None,
        duration_seconds: int = 6,
        resolution: str = "768P",
        ratio: str = "adaptive",
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": settings.minimax_video_model,
            "prompt": prompt,
            "duration": duration_seconds,
            "resolution": resolution,
            "ratio": ratio,
        }
        if mode == "image-to-video" and first_frame_asset_url:
            payload["first_frame_image"] = first_frame_asset_url
        return self._post(VIDEO_PATH, payload)

    def get_video_status(self, provider_task_id: str) -> dict[str, Any]:
        return self._get(VIDEO_QUERY_PATH, {"task_id": provider_task_id})
