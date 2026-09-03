from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.schemas import ArchiveOut, ArchiveStatusOut, UsageOut
from app.services.archive_service import ArchiveService

router = APIRouter()


@router.get("/projects/{project_id}/archive", response_model=ArchiveOut)
def get_archive(
    project_id: int,
    language: str = Query(default="en"),
    include_transcript: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    try:
        return ArchiveService(db).get_archive(project_id, language, include_transcript)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/projects/{project_id}/archive/status", response_model=ArchiveStatusOut)
def get_archive_status(project_id: int, db: Session = Depends(get_db)):
    try:
        return ArchiveService(db).get_archive_status(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/projects/{project_id}/usage", response_model=UsageOut)
def get_usage(project_id: int, db: Session = Depends(get_db)):
    try:
        return ArchiveService(db).get_usage(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
