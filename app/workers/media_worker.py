"""媒体生成后台任务（MVP 使用 FastAPI BackgroundTasks）。

生产并发场景应替换为 Redis + Celery/RQ 等可靠任务队列。
"""
from __future__ import annotations

import logging
import time
from typing import Any

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.entities import MediaAsset, MediaJob
from app.services.minimax_client import MiniMaxClient
from app.services.storage_service import StorageService

logger = logging.getLogger("media_worker")


def _extract_url(result: dict[str, Any], media_type: str) -> str | None:
    data = result.get("data") or {}
    if isinstance(data, list) and data:
        data = data[0]
    if isinstance(data, dict):
        for key in ("url", "video_file_url", "audio_file", "image_url"):
            if data.get(key):
                return str(data[key])
    for key in ("video_file_url", "audio_file", "image_url", "url"):
        if result.get(key):
            return str(result[key])
    return None


def _mock_asset(job: MediaJob, storage: StorageService, mime_type: str) -> None:
    # Mock：写入一个本地占位文件，走通「任务 -> 转存 -> 资源」流程。
    import uuid

    key = f"{uuid.uuid4().hex}.mock"
    (storage.dir / key).write_bytes(b"mock media")
    url = storage._public_url(key)
    job.assets.append(
        MediaAsset(
            project_id=job.project_id,
            job_id=job.id,
            asset_type=job.media_type,
            title="",
            caption="",
            url=url,
            storage_key=key,
            mime_type=mime_type,
            visibility="private",
            approved=False,
        )
    )


def run_media_job(job_id: int) -> None:
    """执行一个媒体生成任务（图片/语音/视频）。"""
    db = SessionLocal()
    try:
        job = db.get(MediaJob, job_id)
        if not job:
            return
        job.status = "processing"
        db.commit()

        storage = StorageService()

        if settings.enable_mock_media:
            _mock_asset(job, storage, {"image": "image/png", "audio": "audio/mpeg", "video": "video/mp4"}[job.media_type])
            job.status = "succeeded"
            db.commit()
            return

        client = MiniMaxClient()
        request = __import__("json").loads(job.request_json or "{}")

        if job.media_type == "image":
            result = client.create_image_task(job.prompt, request.get("aspect_ratio", "16:9"), request.get("count", 1))
            url = _extract_url(result, "image")
        elif job.media_type == "audio":
            result = client.create_audio_task(
                job.prompt,
                request.get("voice_id", ""),
                request.get("language", "en"),
                request.get("speed", 1.0),
                request.get("format", "mp3"),
            )
            url = _extract_url(result, "audio")
        else:  # video
            first_frame_url = None
            if request.get("first_frame_asset_id"):
                frame = db.get(MediaAsset, request["first_frame_asset_id"])
                if frame:
                    first_frame_url = frame.url
            result = client.create_video_task(
                job.prompt,
                request.get("mode", "image-to-video"),
                first_frame_url,
                request.get("duration_seconds", 6),
                request.get("resolution", "768P"),
                request.get("ratio", "adaptive"),
            )
            task_id = result.get("task_id") or result.get("data", {}).get("task_id")
            if task_id:
                job.provider_task_id = str(task_id)
                db.commit()
            # 轮询视频状态
            for _ in range(60):
                status_result = client.get_video_status(str(task_id))
                status = status_result.get("status") or status_result.get("data", {}).get("status", "")
                if status in ("Success", "success", "succeeded", "Completed"):
                    url = _extract_url(status_result, "video")
                    break
                if status in ("Failed", "failed", "error"):
                    raise RuntimeError(f"MiniMax video failed: {status_result}")
                time.sleep(10)
            else:
                raise RuntimeError("MiniMax video timed out")
            if not url:
                url = _extract_url(result, "video")

        if not url:
            raise RuntimeError("MiniMax returned no downloadable URL")

        stored = storage.download_and_store(url)
        job.assets.append(
            MediaAsset(
                project_id=job.project_id,
                job_id=job.id,
                asset_type=job.media_type,
                title="",
                caption="",
                url=stored["url"],
                storage_key=stored["storage_key"],
                mime_type=stored["mime_type"],
                visibility="private",
                approved=False,
            )
        )
        job.status = "succeeded"
        db.commit()
    except Exception as exc:  # noqa: BLE001
        logger.exception("media job %s failed", job_id)
        db.rollback()
        job = db.get(MediaJob, job_id)
        if job:
            job.status = "failed"
            job.error_code = "MINIMAX_ERROR"
            job.error_message = str(exc)
            db.commit()
    finally:
        db.close()
