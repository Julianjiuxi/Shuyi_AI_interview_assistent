from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.schemas import (
    ChapterRequest,
    ChapterResponse,
    CreateProjectRequest,
    CreateProjectResponse,
    InterviewTurnRequest,
    InterviewTurnResponse,
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
