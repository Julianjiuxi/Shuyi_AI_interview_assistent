from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.entities import BiographyProject, InterviewSession, Utterance
from app.models.schemas import (
    ChapterRequest,
    ChapterResponse,
    CreateProjectRequest,
    CreateProjectResponse,
    InterviewTurnRequest,
    InterviewTurnResponse,
    Message,
    ProjectDetail,
    ProjectListItem,
)
from app.services.biography_service import BiographyService
from app.services.interview_service import InterviewService

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/health")
def health():
    return {"status": "ok"}


@router.post("/reset")
def reset_database():
    """初始化：清空所有对话记录、记忆与章节，从头开始。"""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    return {"status": "ok", "message": "数据库已清空，从头开始"}


@router.get("/projects", response_model=list[ProjectListItem])
def list_projects(db: Session = Depends(get_db)):
    projects = db.scalars(
        select(BiographyProject).order_by(
            BiographyProject.pinned.desc(),
            BiographyProject.pinned_at.desc(),
            BiographyProject.id.desc(),
        )
    ).all()
    return [
        ProjectListItem(
            id=p.id,
            subject_name=p.subject_name,
            pinned=p.pinned,
            created_at=p.created_at,
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

    return ProjectDetail(
        id=project.id,
        subject_name=project.subject_name,
        pinned=project.pinned,
        session_id=session.id,
        messages=messages,
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
        project, session, question = InterviewService(db).create_project(payload.subject_name)
        return CreateProjectResponse(project_id=project.id, session_id=session.id, first_question=question)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


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
        return ChapterResponse(**BiographyService(db).generate_chapter(payload.project_id, payload.focus))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
