"""媒体生成任务管理：创建、查询、取消、重试、幂等。"""
from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import BiographyProject, MediaAsset, MediaJob
from app.models.schemas import AudioJobCreate, ImageJobCreate, VideoJobCreate


def _asset_dict(a: MediaAsset) -> dict:
    return {
        "id": a.id,
        "project_id": a.project_id,
        "job_id": a.job_id,
        "asset_type": a.asset_type,
        "title": a.title,
        "caption": a.caption,
        "url": a.url,
        "mime_type": a.mime_type,
        "duration_seconds": a.duration_seconds,
        "width": a.width,
        "height": a.height,
        "sort_order": a.sort_order,
        "visibility": a.visibility,
        "approved": a.approved,
        "created_at": a.created_at,
    }


class MediaJobService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _get_job(self, job_id: int) -> MediaJob:
        job = self.db.get(MediaJob, job_id)
        if not job:
            raise ValueError("Job not found")
        return job

    def _find_idempotent(self, key: str | None) -> MediaJob | None:
        if not key:
            return None
        return self.db.scalars(
            select(MediaJob)
            .where(MediaJob.idempotency_key == key, MediaJob.status.notin_(["failed", "cancelled"]))
            .order_by(MediaJob.id.desc())
        ).first()

    def create_image_job(self, project_id: int, payload: ImageJobCreate, idempotency_key: str | None) -> dict:
        project = self.db.get(BiographyProject, project_id)
        if not project:
            raise ValueError("Project not found")

        existing = self._find_idempotent(idempotency_key)
        if existing:
            return self._job_dict(existing)

        job = MediaJob(
            project_id=project_id,
            document_id=payload.document_id,
            media_type="image",
            provider="minimax",
            model_name=payload.model,
            status="queued",
            prompt=payload.prompt,
            idempotency_key=idempotency_key,
            request_json=json.dumps(payload.model_dump(), ensure_ascii=False),
        )
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return self._job_dict(job)

    def create_audio_job(self, project_id: int, payload: AudioJobCreate, idempotency_key: str | None) -> dict:
        project = self.db.get(BiographyProject, project_id)
        if not project:
            raise ValueError("Project not found")

        existing = self._find_idempotent(idempotency_key)
        if existing:
            return self._job_dict(existing)

        job = MediaJob(
            project_id=project_id,
            document_id=payload.document_id,
            media_type="audio",
            provider="minimax",
            model_name=payload.model,
            status="queued",
            prompt=payload.text,
            idempotency_key=idempotency_key,
            request_json=json.dumps(payload.model_dump(), ensure_ascii=False),
        )
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return self._job_dict(job)

    def create_video_job(self, project_id: int, payload: VideoJobCreate, idempotency_key: str | None) -> dict:
        project = self.db.get(BiographyProject, project_id)
        if not project:
            raise ValueError("Project not found")

        if not (5 <= payload.duration_seconds <= 8):
            raise ValueError("duration_seconds must be between 5 and 8")

        if payload.first_frame_asset_id:
            frame = self.db.get(MediaAsset, payload.first_frame_asset_id)
            if not frame or not frame.approved:
                raise ValueError("first_frame_asset_id must reference an approved asset")

        existing = self._find_idempotent(idempotency_key)
        if existing:
            return self._job_dict(existing)

        job = MediaJob(
            project_id=project_id,
            document_id=payload.document_id,
            media_type="video",
            provider="minimax",
            model_name=payload.model,
            status="queued",
            prompt=payload.prompt,
            idempotency_key=idempotency_key,
            request_json=json.dumps(payload.model_dump(), ensure_ascii=False),
        )
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return self._job_dict(job)

    def _job_dict(self, job: MediaJob) -> dict:
        asset = None
        if job.status == "succeeded" and job.assets:
            asset = _asset_dict(job.assets[-1])
        error = None
        if job.status == "failed":
            error = {"code": job.error_code, "message": job.error_message}
        return {
            "job_id": job.id,
            "media_type": job.media_type,
            "provider": job.provider,
            "model": job.model_name,
            "status": job.status,
            "progress": None,
            "asset": asset,
            "error": error,
            "created_at": job.created_at,
            "updated_at": job.updated_at,
        }

    def get_job(self, job_id: int) -> dict:
        return self._job_dict(self._get_job(job_id))

    def cancel_job(self, job_id: int) -> dict:
        job = self._get_job(job_id)
        if job.status in ("succeeded", "failed", "cancelled"):
            raise ValueError("Job is already in a terminal state")
        job.status = "cancelled"
        self.db.commit()
        self.db.refresh(job)
        return self._job_dict(job)

    def retry_job(self, job_id: int) -> dict:
        job = self._get_job(job_id)
        new_job = MediaJob(
            project_id=job.project_id,
            document_id=job.document_id,
            media_type=job.media_type,
            provider=job.provider,
            model_name=job.model_name,
            status="queued",
            prompt=job.prompt,
            request_json=job.request_json,
            parent_job_id=job.id,
        )
        self.db.add(new_job)
        self.db.commit()
        self.db.refresh(new_job)
        return self._job_dict(new_job)
