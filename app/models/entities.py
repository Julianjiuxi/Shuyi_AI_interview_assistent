from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class BiographyProject(Base):
    __tablename__ = "biography_projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    subject_name: Mapped[str] = mapped_column(String(120), default="Unknown")
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    pinned_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    sessions: Mapped[list[InterviewSession]] = relationship(back_populates="project", cascade="all, delete-orphan")
    memories: Mapped[list[Memory]] = relationship(back_populates="project", cascade="all, delete-orphan")
    chapters: Mapped[list[Chapter]] = relationship(back_populates="project", cascade="all, delete-orphan")


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

    memory_type: Mapped[str] = mapped_column(String(40), index=True)  # person | event | place | date | value | emotion
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

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped[BiographyProject] = relationship(back_populates="memories")
    source_utterance: Mapped[Optional[Utterance]] = relationship(back_populates="memories")


class Chapter(Base):
    __tablename__ = "chapters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("biography_projects.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    source_memory_ids_json: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped[BiographyProject] = relationship(back_populates="chapters")
