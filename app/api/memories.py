from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.entities import BiographyProject, Memory
from app.models.schemas import BulkReview, MemoryConfirm, MemoryOut, MemoryReject, MemoryUpdate

router = APIRouter()


def _load_json(text: str) -> list:
    try:
        data = json.loads(text or "[]")
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def _mem_dict(m: Memory) -> dict:
    return {
        "id": m.id,
        "source_utterance_id": m.source_utterance_id,
        "memory_type": m.memory_type,
        "title": m.title,
        "content": m.content,
        "life_stage": m.life_stage,
        "approx_year": m.approx_year,
        "approx_age": m.approx_age,
        "location": m.location,
        "people": _load_json(m.people_json),
        "tags": _load_json(m.tags_json),
        "importance": m.importance,
        "emotional_intensity": m.emotional_intensity,
        "confidence": m.confidence,
        "unresolved_points": _load_json(m.unresolved_json),
        "status": m.status,
        "confirmed": m.confirmed,
        "source_excerpt": m.source_utterance.text if m.source_utterance else None,
        "review_note": m.review_note,
        "confirmed_by": m.confirmed_by,
        "created_at": m.created_at,
        "updated_at": m.updated_at,
    }


@router.get("/projects/{project_id}/memories", response_model=list[MemoryOut])
def list_memories(
    project_id: int,
    life_stage: str | None = Query(default=None),
    memory_type: str | None = Query(default=None),
    status: str | None = Query(default=None),
    min_importance: float | None = Query(default=None),
    sort: str = Query(default="created_at"),
    db: Session = Depends(get_db),
):
    project = db.get(BiographyProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    query = select(Memory).where(Memory.project_id == project_id)
    if life_stage:
        query = query.where(Memory.life_stage == life_stage)
    if memory_type:
        query = query.where(Memory.memory_type == memory_type)
    if status:
        query = query.where(Memory.status == status)
    if min_importance is not None:
        query = query.where(Memory.importance >= min_importance)

    if sort == "chronological":
        query = query.order_by(Memory.approx_year.asc(), Memory.id.asc())
    elif sort == "importance":
        query = query.order_by(Memory.importance.desc(), Memory.id.asc())
    else:
        query = query.order_by(Memory.created_at.desc(), Memory.id.desc())

    memories = db.scalars(query).all()
    return [_mem_dict(m) for m in memories]


@router.get("/memories/{memory_id}", response_model=MemoryOut)
def get_memory(memory_id: int, db: Session = Depends(get_db)):
    memory = db.get(Memory, memory_id)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    return _mem_dict(memory)


@router.patch("/memories/{memory_id}", response_model=MemoryOut)
def update_memory(memory_id: int, payload: MemoryUpdate, db: Session = Depends(get_db)):
    memory = db.get(Memory, memory_id)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    data = payload.model_dump(exclude_unset=True)
    if "people" in data:
        memory.people_json = json.dumps(data.pop("people"), ensure_ascii=False)
    if "tags" in data:
        memory.tags_json = json.dumps(data.pop("tags"), ensure_ascii=False)
    if "unresolved_points" in data:
        memory.unresolved_json = json.dumps(data.pop("unresolved_points"), ensure_ascii=False)

    for key, value in data.items():
        setattr(memory, key, value)

    db.commit()
    db.refresh(memory)
    return _mem_dict(memory)


@router.post("/memories/{memory_id}/confirm", response_model=MemoryOut)
def confirm_memory(memory_id: int, payload: MemoryConfirm, db: Session = Depends(get_db)):
    memory = db.get(Memory, memory_id)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    memory.status = "confirmed"
    memory.confirmed = True
    memory.confirmed_at = datetime.utcnow()
    memory.confirmed_by = payload.confirmed_by
    memory.review_note = payload.review_note
    db.commit()
    db.refresh(memory)
    return _mem_dict(memory)


@router.post("/memories/{memory_id}/reject", response_model=MemoryOut)
def reject_memory(memory_id: int, payload: MemoryReject, db: Session = Depends(get_db)):
    memory = db.get(Memory, memory_id)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    memory.status = "rejected"
    memory.confirmed = False
    memory.review_note = payload.review_note
    db.commit()
    db.refresh(memory)
    return _mem_dict(memory)


@router.post("/projects/{project_id}/memories/bulk-review")
def bulk_review(project_id: int, payload: BulkReview, db: Session = Depends(get_db)):
    project = db.get(BiographyProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    confirmed_count = 0
    rejected_count = 0

    for mid in payload.confirm_ids:
        memory = db.get(Memory, mid)
        if memory and memory.project_id == project_id:
            memory.status = "confirmed"
            memory.confirmed = True
            memory.confirmed_at = datetime.utcnow()
            confirmed_count += 1

    for mid in payload.reject_ids:
        memory = db.get(Memory, mid)
        if memory and memory.project_id == project_id:
            memory.status = "rejected"
            memory.confirmed = False
            rejected_count += 1

    db.commit()
    return {"confirmed": confirmed_count, "rejected": rejected_count}
