from typing import Literal, Optional

from pydantic import BaseModel, Field


LifeStage = Literal[
    "childhood", "education", "early_adulthood", "career", "family",
    "later_life", "turning_point", "values", "historical_context", "unknown"
]


class ExtractedMemory(BaseModel):
    memory_type: Literal["person", "event", "place", "date", "value", "emotion", "relationship"]
    title: str = ""
    content: str
    life_stage: LifeStage = "unknown"
    approx_year: Optional[int] = None
    approx_age: Optional[int] = None
    location: Optional[str] = None
    people: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    importance: float = Field(default=0.5, ge=0, le=1)
    emotional_intensity: float = Field(default=0.0, ge=0, le=1)
    confidence: float = Field(default=0.7, ge=0, le=1)
    unresolved_points: list[str] = Field(default_factory=list)


class ExtractionResult(BaseModel):
    memories: list[ExtractedMemory] = Field(default_factory=list)
    response_summary: str = ""


class CandidateQuestion(BaseModel):
    question: str
    target_stage: LifeStage = "unknown"
    target_memory_id: Optional[int] = None
    reason: str
    information_gain: float = Field(ge=0, le=1)
    emotional_value: float = Field(ge=0, le=1)
    narrative_value: float = Field(ge=0, le=1)
    novelty: float = Field(ge=0, le=1)
    sensitivity_risk: float = Field(ge=0, le=1)
    repetition_risk: float = Field(ge=0, le=1)


class PlannerLLMResult(BaseModel):
    candidates: list[CandidateQuestion] = Field(default_factory=list)


class InterviewTurnRequest(BaseModel):
    project_id: int
    session_id: int
    answer: str


class InterviewTurnResponse(BaseModel):
    next_question: str
    extracted_memories: list[ExtractedMemory]
    planner_debug: dict


class CreateProjectRequest(BaseModel):
    subject_name: str = "Unknown"


class CreateProjectResponse(BaseModel):
    project_id: int
    session_id: int
    first_question: str


class ChapterRequest(BaseModel):
    project_id: int
    focus: str = "Create a coherent chapter from the most important available memories."


class ChapterResponse(BaseModel):
    title: str
    body: str
