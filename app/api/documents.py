from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import decode_cursor, encode_cursor, get_db
from app.models.entities import BiographyProject
from app.models.schemas import (
    DocumentApprove,
    DocumentGenerateRequest,
    DocumentOut,
    DocumentUpdate,
)
from app.services.document_service import DocumentService

router = APIRouter()


@router.post("/projects/{project_id}/documents/generate", response_model=list[DocumentOut])
def generate_documents(
    project_id: int,
    payload: DocumentGenerateRequest,
    db: Session = Depends(get_db),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    try:
        return DocumentService(db).generate_documents(project_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/projects/{project_id}/documents")
def list_documents(
    project_id: int,
    type: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    project = db.get(BiographyProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    docs = DocumentService(db).list_documents(project_id, type, status)

    # cursor 分页（按 id 倒序）
    start_idx = 0
    decoded = decode_cursor(cursor)
    if decoded is not None:
        for i, d in enumerate(docs):
            if d["id"] == decoded:
                start_idx = i + 1
                break

    page = docs[start_idx : start_idx + limit]
    next_cursor = encode_cursor(page[-1]["id"]) if len(page) == limit and page else None
    return {"items": page, "next_cursor": next_cursor}


@router.get("/documents/{document_id}", response_model=DocumentOut)
def get_document(document_id: int, db: Session = Depends(get_db)):
    try:
        return DocumentService(db).get_document(document_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/documents/{document_id}", response_model=DocumentOut)
def update_document(document_id: int, payload: DocumentUpdate, db: Session = Depends(get_db)):
    try:
        return DocumentService(db).update_document(document_id, payload.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/documents/{document_id}")
def delete_document(document_id: int, db: Session = Depends(get_db)):
    try:
        DocumentService(db).delete_document(document_id)
        return {"status": "ok", "deleted": document_id}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/documents/{document_id}/approve", response_model=DocumentOut)
def approve_document(document_id: int, db: Session = Depends(get_db)):
    try:
        return DocumentService(db).approve_document(document_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/documents/{document_id}/publish", response_model=DocumentOut)
def publish_document(document_id: int, db: Session = Depends(get_db)):
    try:
        return DocumentService(db).publish_document(document_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
