from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.errors import ApiError
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.models.entities import (
    BiographyProject,
    InterviewSession,
    MediaAsset,
    Memory,
    Relationship,
    Utterance,
)
from app.models.schemas import (
    ArchiveStatusUpdate,
    ChapterRequest,
    ChapterResponse,
    CreateProjectRequest,
    CreateProjectResponse,
    InterviewTurnRequest,
    InterviewTurnResponse,
    Message,
    PersonProfile,
    ProjectDetail,
    ProjectListItem,
    ProjectUpdate,
)
from app.services.document_service import DocumentService
from app.services.interview_service import InterviewService

router = APIRouter()


def _avatar_url(db: Session, project_id: int) -> str | None:
    asset = db.scalars(
        select(MediaAsset).where(
            MediaAsset.project_id == project_id,
            MediaAsset.asset_type == "avatar",
            MediaAsset.approved.is_(True),
        )
    ).first()
    return asset.url if asset else None


@router.get("/health")
def health():
    return {"status": "ok"}


@router.post("/reset")
def reset_database():
    """初始化：清空所有对话记录、记忆与章节，从头开始。生产环境应禁用。"""
    if not settings.enable_destructive_endpoints:
        raise ApiError(403, "DESTRUCTIVE_DISABLED", "破坏性接口已禁用（ENABLE_DESTRUCTIVE_ENDPOINTS=false）")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    return {"status": "ok", "message": "数据库已清空，从头开始"}


@router.get("/projects", response_model=list[ProjectListItem])
def list_projects(
    family_id: int | None = Query(default=None),
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = select(BiographyProject).order_by(
        BiographyProject.pinned.desc(),
        BiographyProject.pinned_at.desc(),
        BiographyProject.id.desc(),
    )
    if family_id is not None:
        query = query.where(BiographyProject.family_id == family_id)
    if status:
        query = query.where(BiographyProject.archive_status == status)
    projects = db.scalars(query).all()
    return [
        ProjectListItem(
            id=p.id,
            subject_name=p.subject_name,
            pinned=p.pinned,
            created_at=p.created_at,
            family_id=p.family_id,
            display_name=p.display_name,
            chinese_name=p.chinese_name,
            birth_year=p.birth_year,
            death_year=p.death_year,
            avatar_url=_avatar_url(db, p.id),
            archive_status=p.archive_status,
            updated_at=p.updated_at,
        )
        for p in projects
    ]


@router.get("/projects/{project_id}", response_model=ProjectDetail)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.get(BiographyProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    session = db.scalars(
        select(InterviewSession)
        .where(InterviewSession.project_id == project_id)
        .order_by(InterviewSession.id.desc())
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="No session found")

    utterances = db.scalars(
        select(Utterance)
        .where(Utterance.session_id == session.id)
        .order_by(Utterance.id.asc())
    ).all()
    messages = [Message(role=u.role, text=u.text) for u in utterances]

    profile = PersonProfile(
        subject_name=project.subject_name,
        display_name=project.display_name,
        chinese_name=project.chinese_name,
        gender=project.gender,
        birth_year=project.birth_year,
        death_year=project.death_year,
        birth_place=project.birth_place,
        current_place=project.current_place,
        short_bio=project.short_bio,
        visibility=project.visibility,
    )

    return ProjectDetail(
        id=project.id,
        subject_name=project.subject_name,
        pinned=project.pinned,
        session_id=session.id,
        messages=messages,
        profile=profile,
        archive_status=project.archive_status,
    )


@router.post("/projects/{project_id}/pin")
def toggle_pin(project_id: int, db: Session = Depends(get_db)):
    project = db.get(BiographyProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.pinned = not project.pinned
    project.pinned_at = datetime.utcnow() if project.pinned else None
    db.commit()
    return {"id": project.id, "pinned": project.pinned}


@router.delete("/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.get(BiographyProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return {"status": "ok", "deleted": project_id}


@router.post("/projects", response_model=CreateProjectResponse)
def create_project(payload: CreateProjectRequest, db: Session = Depends(get_db)):
    try:
        project, session, question = InterviewService(db).create_project(
            subject_name=payload.subject_name,
            family_id=payload.family_id,
            display_name=payload.display_name,
            chinese_name=payload.chinese_name,
            gender=payload.gender,
            birth_year=payload.birth_year,
            death_year=payload.death_year,
            birth_place=payload.birth_place,
            current_place=payload.current_place,
            visibility=payload.visibility,
        )
        return CreateProjectResponse(project_id=project.id, session_id=session.id, first_question=question)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.patch("/projects/{project_id}")
def update_project(project_id: int, payload: ProjectUpdate, db: Session = Depends(get_db)):
    project = db.get(BiographyProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    updates = payload.model_dump(exclude_unset=True)
    new_family_id = updates.get("family_id")
    old_family_id = project.family_id

    for key, value in updates.items():
        setattr(project, key, value)

    # 人物迁移到新家庭后，清理其在旧家庭中遗留的关系，避免孤儿关系残留。
    if new_family_id is not None and new_family_id != old_family_id:
        stale = db.scalars(
            select(Relationship).where(
                Relationship.family_id == old_family_id,
                (
                    (Relationship.from_project_id == project_id)
                    | (Relationship.to_project_id == project_id)
                ),
            )
        ).all()
        for rel in stale:
            db.delete(rel)

    db.commit()
    db.refresh(project)
    return {
        "id": project.id,
        "subject_name": project.subject_name,
        "display_name": project.display_name,
        "chinese_name": project.chinese_name,
        "archive_status": project.archive_status,
        "updated_at": project.updated_at,
    }


@router.patch("/projects/{project_id}/archive-status")
def update_archive_status(project_id: int, payload: ArchiveStatusUpdate, db: Session = Depends(get_db)):
    project = db.get(BiographyProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    target = payload.status

    # 高重要度未确认记忆时，禁止推进到 approved/published。
    if target in ("approved", "published"):
        unconfirmed = list(
            db.scalars(
                select(Memory).where(
                    Memory.project_id == project_id,
                    Memory.status != "confirmed",
                    Memory.importance >= 0.8,
                )
            )
        )
        if unconfirmed:
            raise ApiError(
                409,
                "UNCONFIRMED_HIGH_IMPORTANCE",
                "存在高重要度未确认记忆，无法发布",
                details={"memory_ids": [m.id for m in unconfirmed]},
            )

    # 允许按状态机推进或管理员回退（MVP 无账户系统，直接允许设置）。
    project.archive_status = target
    db.commit()
    return {"id": project.id, "archive_status": project.archive_status}


@router.get("/projects/{project_id}/sessions")
def list_sessions(project_id: int, db: Session = Depends(get_db)):
    project = db.get(BiographyProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    sessions = db.scalars(
        select(InterviewSession)
        .where(InterviewSession.project_id == project_id)
        .order_by(InterviewSession.id.desc())
    ).all()
    return [
        {
            "id": s.id,
            "started_at": s.started_at,
            "ended_at": s.ended_at,
            "session_summary": s.session_summary,
        }
        for s in sessions
    ]


@router.get("/sessions/{session_id}/messages")
def get_session_messages(session_id: int, db: Session = Depends(get_db)):
    session = db.get(InterviewSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    utterances = db.scalars(
        select(Utterance).where(Utterance.session_id == session_id).order_by(Utterance.id.asc())
    ).all()
    return [
        {
            "id": u.id,
            "role": u.role,
            "text": u.text,
            "audio_url": u.audio_url,
            "created_at": u.created_at,
        }
        for u in utterances
    ]


@router.post("/sessions/{session_id}/complete")
def complete_session(session_id: int, db: Session = Depends(get_db)):
    try:
        return InterviewService(db).complete_session(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/interview/turn", response_model=InterviewTurnResponse)
def interview_turn(payload: InterviewTurnRequest, db: Session = Depends(get_db)):
    try:
        result = InterviewService(db).handle_answer(payload.project_id, payload.session_id, payload.answer)
        return InterviewTurnResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/chapters", response_model=ChapterResponse)
def generate_chapter(payload: ChapterRequest, db: Session = Depends(get_db)):
    try:
        return ChapterResponse(**DocumentService(db).generate_chapter(payload.project_id, payload.focus))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
