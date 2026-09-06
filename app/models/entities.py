from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Family(Base):
    __tablename__ = "families"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    cover_asset_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    visibility: Mapped[str] = mapped_column(String(20), default="private")  # private/family/public
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    people: Mapped[list[BiographyProject]] = relationship(back_populates="family")
    relationships: Mapped[list[Relationship]] = relationship(
        back_populates="family", cascade="all, delete-orphan"
    )


class BiographyProject(Base):
    __tablename__ = "biography_projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    subject_name: Mapped[str] = mapped_column(String(120), default="Unknown")
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    pinned_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Everroot 扩展人物字段
    family_id: Mapped[Optional[int]] = mapped_column(ForeignKey("families.id"), nullable=True, index=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    chinese_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    gender: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    birth_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    death_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    birth_place: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    current_place: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    short_bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    avatar_asset_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    archive_status: Mapped[str] = mapped_column(String(20), default="draft")  # draft/review/approved/published
    visibility: Mapped[str] = mapped_column(String(20), default="private")  # private/family/public
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    family: Mapped[Optional[Family]] = relationship(back_populates="people")
    sessions: Mapped[list[InterviewSession]] = relationship(back_populates="project", cascade="all, delete-orphan")
    memories: Mapped[list[Memory]] = relationship(back_populates="project", cascade="all, delete-orphan")
    documents: Mapped[list[Document]] = relationship(back_populates="project", cascade="all, delete-orphan")
    media_jobs: Mapped[list[MediaJob]] = relationship(back_populates="project", cascade="all, delete-orphan")
    media_assets: Mapped[list[MediaAsset]] = relationship(back_populates="project", cascade="all, delete-orphan")
    life_profile: Mapped[Optional[LifeProfile]] = relationship(back_populates="project", cascade="all, delete-orphan", uselist=False)


class Relationship(Base):
    __tablename__ = "relationships"
    __table_args__ = (
        UniqueConstraint("family_id", "from_project_id", "to_project_id", "relation_type", name="uq_family_relation"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id"), index=True)
    from_project_id: Mapped[int] = mapped_column(ForeignKey("biography_projects.id"))
    to_project_id: Mapped[int] = mapped_column(ForeignKey("biography_projects.id"))
    relation_type: Mapped[str] = mapped_column(String(20))  # parent/child/spouse/sibling/grandparent/grandchild/other
    label: Mapped[str] = mapped_column(String(80), default="")
    confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    family: Mapped[Family] = relationship(back_populates="relationships")


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("biography_projects.id"), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    session_summary: Mapped[str] = mapped_column(Text, default="")

    project: Mapped[BiographyProject] = relationship(back_populates="sessions")
    utterances: Mapped[list[Utterance]] = relationship(back_populates="session", cascade="all, delete-orphan")


class Utterance(Base):
    __tablename__ = "utterances"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("interview_sessions.id"), index=True)
    role: Mapped[str] = mapped_column(String(20))  # interviewer | storyteller
    text: Mapped[str] = mapped_column(Text)
    audio_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped[InterviewSession] = relationship(back_populates="utterances")
    memories: Mapped[list[Memory]] = relationship(back_populates="source_utterance")


class Memory(Base):
    __tablename__ = "memories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("biography_projects.id"), index=True)
    source_utterance_id: Mapped[Optional[int]] = mapped_column(ForeignKey("utterances.id"), nullable=True, index=True)

    memory_type: Mapped[str] = mapped_column(String(40), index=True)  # person | event | place | date | value | emotion | relationship
    title: Mapped[str] = mapped_column(String(200), default="")
    content: Mapped[str] = mapped_column(Text)
    life_stage: Mapped[str] = mapped_column(String(40), default="unknown", index=True)

    approx_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    approx_age: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    people_json: Mapped[str] = mapped_column(Text, default="[]")
    tags_json: Mapped[str] = mapped_column(Text, default="[]")

    importance: Mapped[float] = mapped_column(Float, default=0.5)
    emotional_intensity: Mapped[float] = mapped_column(Float, default=0.0)
    confidence: Mapped[float] = mapped_column(Float, default=0.7)
    confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    unresolved_json: Mapped[str] = mapped_column(Text, default="[]")

    # Everroot 扩展：记忆审核状态
    status: Mapped[str] = mapped_column(String(20), default="extracted")  # extracted/review/confirmed/rejected
    review_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    confirmed_by: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project: Mapped[BiographyProject] = relationship(back_populates="memories")
    source_utterance: Mapped[Optional[Utterance]] = relationship(back_populates="memories")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("biography_projects.id"), index=True)
    document_type: Mapped[str] = mapped_column(String(40), index=True)  # biography/chapter/family_letter/summary/narration/storyboard
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    language: Mapped[str] = mapped_column(String(16), default="zh-CN")
    status: Mapped[str] = mapped_column(String(20), default="draft", index=True)  # draft/review/approved/published/deleted
    source_memory_ids_json: Mapped[str] = mapped_column(Text, default="[]")
    model_provider: Mapped[str] = mapped_column(String(60), default="deepseek")
    model_name: Mapped[str] = mapped_column(String(100), default="")
    prompt_version: Mapped[str] = mapped_column(String(40), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project: Mapped[BiographyProject] = relationship(back_populates="documents")


class MediaJob(Base):
    __tablename__ = "media_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("biography_projects.id"), index=True)
    document_id: Mapped[Optional[int]] = mapped_column(ForeignKey("documents.id"), nullable=True)
    media_type: Mapped[str] = mapped_column(String(20))  # image/audio/video
    provider: Mapped[str] = mapped_column(String(40), default="minimax")
    model_name: Mapped[str] = mapped_column(String(100), default="")
    provider_task_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)  # queued/processing/succeeded/failed/cancelled
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(200), nullable=True, index=True)
    prompt: Mapped[str] = mapped_column(Text, default="")
    request_json: Mapped[str] = mapped_column(Text, default="{}")
    parent_job_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    error_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project: Mapped[BiographyProject] = relationship(back_populates="media_jobs")
    assets: Mapped[list[MediaAsset]] = relationship(back_populates="job")


class MediaAsset(Base):
    __tablename__ = "media_assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("biography_projects.id"), index=True)
    job_id: Mapped[Optional[int]] = mapped_column(ForeignKey("media_jobs.id"), nullable=True)
    asset_type: Mapped[str] = mapped_column(String(20))  # avatar/image/audio/video/thumbnail
    title: Mapped[str] = mapped_column(String(200), default="")
    caption: Mapped[str] = mapped_column(Text, default="")
    url: Mapped[str] = mapped_column(String(1000), default="")
    storage_key: Mapped[str] = mapped_column(String(500), default="")
    mime_type: Mapped[str] = mapped_column(String(100), default="")
    duration_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    width: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    height: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    visibility: Mapped[str] = mapped_column(String(20), default="private")  # private/family/public
    approved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped[BiographyProject] = relationship(back_populates="media_assets")
    job: Mapped[Optional[MediaJob]] = relationship(back_populates="assets")


class LifeProfile(Base):
    """1:1 缓存由 LLM 归纳生成的人生视图（画像/金句/视角/地图）。"""

    __tablename__ = "life_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("biography_projects.id"), unique=True, index=True)
    profile_json: Mapped[str] = mapped_column(Text, default="{}")
    language: Mapped[str] = mapped_column(String(16), default="zh-CN")
    model_provider: Mapped[str] = mapped_column(String(60), default="deepseek")
    model_name: Mapped[str] = mapped_column(String(100), default="")
    prompt_version: Mapped[str] = mapped_column(String(40), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project: Mapped[BiographyProject] = relationship(back_populates="life_profile")
