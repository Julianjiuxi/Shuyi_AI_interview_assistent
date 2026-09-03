from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.entities import BiographyProject, MediaAsset
from app.models.schemas import (
    AudioJobCreate,
    ImageJobCreate,
    MediaAssetOut,
    MediaAssetUpdate,
    MediaJobCreateResponse,
    MediaJobOut,
    VideoJobCreate,
)
from app.services.media_job_service import MediaJobService
from app.services.storage_service import StorageService
from app.workers.media_worker import run_media_job

router = APIRouter()


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


@router.post("/projects/{project_id}/media/images", response_model=MediaJobCreateResponse, status_code=202)
def create_image_job(
    project_id: int,
    payload: ImageJobCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    try:
        result = MediaJobService(db).create_image_job(project_id, payload, idempotency_key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if result["status"] == "queued":
        background_tasks.add_task(run_media_job, result["job_id"])
    return result


@router.post("/projects/{project_id}/media/audio", response_model=MediaJobCreateResponse, status_code=202)
def create_audio_job(
    project_id: int,
    payload: AudioJobCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    try:
        result = MediaJobService(db).create_audio_job(project_id, payload, idempotency_key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if result["status"] == "queued":
        background_tasks.add_task(run_media_job, result["job_id"])
    return result


@router.post("/projects/{project_id}/media/videos", response_model=MediaJobCreateResponse, status_code=202)
def create_video_job(
    project_id: int,
    payload: VideoJobCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    try:
        result = MediaJobService(db).create_video_job(project_id, payload, idempotency_key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if result["status"] == "queued":
        background_tasks.add_task(run_media_job, result["job_id"])
    return result


@router.get("/media/jobs/{job_id}", response_model=MediaJobOut)
def get_job(job_id: int, db: Session = Depends(get_db)):
    try:
        return MediaJobService(db).get_job(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/media/jobs/{job_id}/cancel", response_model=MediaJobOut)
def cancel_job(job_id: int, db: Session = Depends(get_db)):
    try:
        return MediaJobService(db).cancel_job(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/media/jobs/{job_id}/retry", response_model=MediaJobOut, status_code=202)
def retry_job(
    job_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    try:
        result = MediaJobService(db).retry_job(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    background_tasks.add_task(run_media_job, result["job_id"])
    return result


@router.get("/projects/{project_id}/media", response_model=list[MediaAssetOut])
def list_assets(
    project_id: int,
    type: str | None = Query(default=None),
    approved: bool | None = Query(default=None),
    db: Session = Depends(get_db),
):
    project = db.get(BiographyProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    query = select(MediaAsset).where(MediaAsset.project_id == project_id)
    if type:
        query = query.where(MediaAsset.asset_type == type)
    if approved is not None:
        query = query.where(MediaAsset.approved.is_(approved))
    assets = db.scalars(query.order_by(MediaAsset.sort_order.asc(), MediaAsset.id.asc())).all()
    return [_asset_dict(a) for a in assets]


@router.patch("/media/assets/{asset_id}", response_model=MediaAssetOut)
def update_asset(asset_id: int, payload: MediaAssetUpdate, db: Session = Depends(get_db)):
    asset = db.get(MediaAsset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(asset, key, value)
    db.commit()
    db.refresh(asset)
    return _asset_dict(asset)


@router.delete("/media/assets/{asset_id}")
def delete_asset(asset_id: int, db: Session = Depends(get_db)):
    asset = db.get(MediaAsset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    storage_key = asset.storage_key
    db.delete(asset)
    db.commit()
    StorageService().delete(storage_key)
    return {"status": "ok", "deleted": asset_id}
