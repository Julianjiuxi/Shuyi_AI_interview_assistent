"""本地文件存储：上传保存、远程下载转存、删除。

MVP 使用本地 uploads/ 目录；部署版本应替换为对象存储。
数据库只保存 storage_key 与受控 URL，不保存大文件或 Base64。
"""
from __future__ import annotations

import logging
import uuid
from pathlib import Path

import httpx
from fastapi import UploadFile

from app.core.config import settings

logger = logging.getLogger("storage")

_EXT_BY_MIME = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/mp4": ".m4a",
    "video/mp4": ".mp4",
}


class StorageService:
    def __init__(self) -> None:
        self.dir = Path(settings.media_storage_dir)
        self.dir.mkdir(parents=True, exist_ok=True)

    def _public_url(self, key: str) -> str:
        return f"{settings.public_base_url.rstrip('/')}/uploads/{key}"

    def _ext_for(self, mime_type: str | None, filename: str | None) -> str:
        if mime_type and mime_type in _EXT_BY_MIME:
            return _EXT_BY_MIME[mime_type]
        if filename and "." in filename:
            return Path(filename).suffix.lower()
        return ""

    def save_upload(self, file: UploadFile) -> dict:
        content = file.file.read()
        return self.save_bytes(content, file.content_type, file.filename)

    def save_bytes(self, content: bytes, mime_type: str | None, filename: str | None) -> dict:
        ext = self._ext_for(mime_type, filename)
        key = f"{uuid.uuid4().hex}{ext}"
        (self.dir / key).write_bytes(content)
        return {
            "storage_key": key,
            "url": self._public_url(key),
            "mime_type": mime_type or "application/octet-stream",
        }

    def download_and_store(self, url: str, mime_type: str | None = None) -> dict:
        with httpx.Client(timeout=120.0) as client:
            resp = client.get(url)
            resp.raise_for_status()
            content = resp.content

        ext = self._ext_for(mime_type or resp.headers.get("content-type"), None)
        key = f"{uuid.uuid4().hex}{ext}"
        (self.dir / key).write_bytes(content)
        return {
            "storage_key": key,
            "url": self._public_url(key),
            "mime_type": mime_type or resp.headers.get("content-type", "application/octet-stream"),
        }

    def delete(self, storage_key: str) -> None:
        if not storage_key:
            return
        path = self.dir / storage_key
        try:
            if path.exists():
                path.unlink()
        except OSError as exc:
            # 进入待清理队列（MVP 记录日志）
            logger.warning("failed to delete %s: %s", storage_key, exc)
