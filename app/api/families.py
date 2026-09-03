from __future__ import annotations

import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import decode_cursor, encode_cursor, get_db
from app.api.errors import ApiError
from app.models.entities import BiographyProject, Family, MediaAsset, Relationship
from app.models.schemas import (
    FamilyCreate,
    FamilyListItem,
    FamilyOut,
    FamilyUpdate,
    RelationshipCreate,
    RelationshipOut,
    RelationshipUpdate,
    TreeOut,
    TreePerson,
)

router = APIRouter()

_ARCHIVE_FLOW = ["draft", "review", "approved", "published"]


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", name.lower()).strip("-")
    return slug or "family"


def _unique_slug(db: Session, name: str) -> str:
    base = _slugify(name)
    existing = db.scalars(select(Family).where(Family.slug == base)).first()
    if not existing:
        return base
    return f"{base}-{uuid.uuid4().hex[:6]}"


def _avatar_url(db: Session, project_id: int) -> str | None:
    asset = db.scalars(
        select(MediaAsset).where(
            MediaAsset.project_id == project_id,
            MediaAsset.asset_type == "avatar",
            MediaAsset.approved.is_(True),
        )
    ).first()
    return asset.url if asset else None


def _rel_dict(r: Relationship) -> dict:
    return {
        "id": r.id,
        "from_project_id": r.from_project_id,
        "to_project_id": r.to_project_id,
        "relation_type": r.relation_type,
        "label": r.label,
        "confirmed": r.confirmed,
    }


@router.post("/families", response_model=FamilyOut, status_code=201)
def create_family(payload: FamilyCreate, db: Session = Depends(get_db)):
    family = Family(
        name=payload.name,
        slug=_unique_slug(db, payload.name),
        description=payload.description,
        visibility=payload.visibility,
    )
    db.add(family)
    db.commit()
    db.refresh(family)
    return {
        "id": family.id,
        "name": family.name,
        "slug": family.slug,
        "description": family.description,
        "visibility": family.visibility,
        "created_at": family.created_at,
        "updated_at": family.updated_at,
    }


@router.get("/families")
def list_families(
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    families = db.scalars(select(Family).order_by(Family.id.desc())).all()
    start_idx = 0
    decoded = decode_cursor(cursor)
    if decoded is not None:
        for i, f in enumerate(families):
            if f.id == decoded:
                start_idx = i + 1
                break

    page = families[start_idx : start_idx + limit]
    items = []
    for f in page:
        member_count = len(
            db.scalars(select(BiographyProject).where(BiographyProject.family_id == f.id)).all()
        )
        items.append(
            FamilyListItem(
                id=f.id,
                name=f.name,
                slug=f.slug,
                description=f.description,
                visibility=f.visibility,
                member_count=member_count,
                cover_asset_id=f.cover_asset_id,
                updated_at=f.updated_at,
            )
        )
    next_cursor = encode_cursor(page[-1].id) if len(page) == limit and page else None
    return {"items": items, "next_cursor": next_cursor}


@router.get("/families/{family_id}", response_model=FamilyOut)
def get_family(family_id: int, db: Session = Depends(get_db)):
    family = db.get(Family, family_id)
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")
    return {
        "id": family.id,
        "name": family.name,
        "slug": family.slug,
        "description": family.description,
        "visibility": family.visibility,
        "created_at": family.created_at,
        "updated_at": family.updated_at,
    }


@router.patch("/families/{family_id}", response_model=FamilyOut)
def update_family(family_id: int, payload: FamilyUpdate, db: Session = Depends(get_db)):
    family = db.get(Family, family_id)
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(family, key, value)
    db.commit()
    db.refresh(family)
    return {
        "id": family.id,
        "name": family.name,
        "slug": family.slug,
        "description": family.description,
        "visibility": family.visibility,
        "created_at": family.created_at,
        "updated_at": family.updated_at,
    }


@router.get("/families/{family_id}/tree", response_model=TreeOut)
def get_tree(family_id: int, db: Session = Depends(get_db)):
    family = db.get(Family, family_id)
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")

    people = db.scalars(
        select(BiographyProject).where(BiographyProject.family_id == family_id).order_by(BiographyProject.id.asc())
    ).all()
    relationships = db.scalars(
        select(Relationship).where(Relationship.family_id == family_id).order_by(Relationship.id.asc())
    ).all()

    return TreeOut(
        family={"id": family.id, "name": family.name},
        people=[
            TreePerson(
                project_id=p.id,
                display_name=p.display_name,
                chinese_name=p.chinese_name,
                subject_name=p.subject_name,
                birth_year=p.birth_year,
                death_year=p.death_year,
                avatar_url=_avatar_url(db, p.id),
                archive_status=p.archive_status,
            )
            for p in people
        ],
        relationships=[RelationshipOut(**_rel_dict(r)) for r in relationships],
    )


@router.post("/families/{family_id}/relationships", response_model=RelationshipOut, status_code=201)
def create_relationship(family_id: int, payload: RelationshipCreate, db: Session = Depends(get_db)):
    family = db.get(Family, family_id)
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")

    from_project = db.get(BiographyProject, payload.from_project_id)
    to_project = db.get(BiographyProject, payload.to_project_id)
    if not from_project or not to_project:
        raise HTTPException(status_code=400, detail="Both members must exist")
    if from_project.family_id != family_id or to_project.family_id != family_id:
        raise ApiError(400, "CROSS_FAMILY", "两个成员必须属于同一家庭")

    relationship = Relationship(
        family_id=family_id,
        from_project_id=payload.from_project_id,
        to_project_id=payload.to_project_id,
        relation_type=payload.relation_type,
        label=payload.label,
        confirmed=payload.confirmed,
    )
    db.add(relationship)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ApiError(409, "DUPLICATE_RELATIONSHIP", "同一家庭中相同关系已存在") from exc
    db.refresh(relationship)
    return _rel_dict(relationship)


@router.patch("/relationships/{relationship_id}", response_model=RelationshipOut)
def update_relationship(relationship_id: int, payload: RelationshipUpdate, db: Session = Depends(get_db)):
    relationship = db.get(Relationship, relationship_id)
    if not relationship:
        raise HTTPException(status_code=404, detail="Relationship not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(relationship, key, value)
    db.commit()
    db.refresh(relationship)
    return _rel_dict(relationship)


@router.delete("/relationships/{relationship_id}")
def delete_relationship(relationship_id: int, db: Session = Depends(get_db)):
    relationship = db.get(Relationship, relationship_id)
    if not relationship:
        raise HTTPException(status_code=404, detail="Relationship not found")
    db.delete(relationship)
    db.commit()
    return {"status": "ok", "deleted": relationship_id}
