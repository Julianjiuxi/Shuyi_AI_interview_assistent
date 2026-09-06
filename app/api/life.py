from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.schemas import LifeViewGenerateRequest, LifeViewOut
from app.services.life_profile_service import LifeProfileService

router = APIRouter()


@router.post("/projects/{project_id}/life-view/generate", response_model=LifeViewOut)
def generate_life_view(
    project_id: int,
    payload: LifeViewGenerateRequest,
    db: Session = Depends(get_db),
):
    try:
        return LifeProfileService(db).generate(project_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
