from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import (
    BiographyProject,
    Document,
    InterviewSession,
    MediaAsset,
    MediaJob,
    Memory,
    Relationship,
    Utterance,
)


def _load_json(text: str) -> list:
    try:
        data = json.loads(text or "[]")
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def _memory_to_dict(m: Memory) -> dict:
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


def _asset_to_dict(a: MediaAsset) -> dict:
    return {
        "id": a.id,
        "project_id": a.project_id,
        "job_id": a.job_id,
        "asset_type": a.asset_type,
        "title": a.title,
        "caption": a.caption,
        "url": a.url,
        "mime_type": a.mime_type,
        "duration_seconds": a.duration_seconds,
        "width": a.width,
        "height": a.height,
        "sort_order": a.sort_order,
        "visibility": a.visibility,
        "approved": a.approved,
        "created_at": a.created_at,
    }


class ArchiveService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_archive(self, project_id: int, language: str = "en", include_transcript: bool = False) -> dict:
        project = self.db.get(BiographyProject, project_id)
        if not project:
            raise ValueError("Project not found")

        # 人物资料
        avatar_url = None
        approved_assets = list(
            self.db.scalars(
                select(MediaAsset)
                .where(MediaAsset.project_id == project_id, MediaAsset.approved.is_(True))
                .order_by(MediaAsset.sort_order.asc(), MediaAsset.id.asc())
            )
        )
        avatar = next((a for a in approved_assets if a.asset_type == "avatar"), None)
        if avatar:
            avatar_url = avatar.url

        project_dict = {
            "id": project.id,
            "family_id": project.family_id,
            "subject_name": project.subject_name,
            "display_name": project.display_name,
            "chinese_name": project.chinese_name,
            "birth_year": project.birth_year,
            "death_year": project.death_year,
            "birth_place": project.birth_place,
            "current_place": project.current_place,
            "short_bio": project.short_bio,
            "avatar_url": avatar_url,
            "archive_status": project.archive_status,
            "visibility": project.visibility,
        }

        # 家庭与关系
        family_dict = None
        relationships: list[dict] = []
        if project.family_id:
            from app.models.entities import Family

            family = self.db.get(Family, project.family_id)
            if family:
                family_dict = {"id": family.id, "name": family.name}
            rels = self.db.scalars(
                select(Relationship).where(Relationship.family_id == project.family_id)
            ).all()
            relationships = [
                {
                    "id": r.id,
                    "from_project_id": r.from_project_id,
                    "to_project_id": r.to_project_id,
                    "relation_type": r.relation_type,
                    "label": r.label,
                    "confirmed": r.confirmed,
                }
                for r in rels
            ]

        # 时间线：已确认且有年份的记忆
        confirmed_memories = list(
            self.db.scalars(
                select(Memory)
                .where(Memory.project_id == project_id, Memory.status == "confirmed")
                .order_by(Memory.approx_year.asc(), Memory.id.asc())
            )
        )
        timeline = [
            {
                "memory_id": m.id,
                "year": m.approx_year,
                "place": m.location,
                "title": m.title,
                "detail": m.content,
                "confidence": m.confidence,
                "confirmed": True,
            }
            for m in confirmed_memories
            if m.approx_year is not None
        ]

        # Featured Story / 家书
        def _latest_published(types: list[str]) -> dict | None:
            doc = self.db.scalars(
                select(Document)
                .where(
                    Document.project_id == project_id,
                    Document.document_type.in_(types),
                    Document.status == "published",
                )
                .order_by(Document.id.desc())
            ).first()
            if not doc:
                return None
            return {"document_id": doc.id, "title": doc.title, "body": doc.body}

        featured_story = _latest_published(["biography", "chapter"])
        family_letter = _latest_published(["family_letter"])

        # 媒体分组
        media = {
            "avatar": avatar_url,
            "images": [_asset_to_dict(a) for a in approved_assets if a.asset_type == "image"],
            "audio": [_asset_to_dict(a) for a in approved_assets if a.asset_type == "audio"],
            "videos": [_asset_to_dict(a) for a in approved_assets if a.asset_type == "video"],
        }

        # 审核汇总
        all_memories = list(self.db.scalars(select(Memory).where(Memory.project_id == project_id)))
        unresolved_points: list[dict] = []
        for m in all_memories:
            for point in _load_json(m.unresolved_json):
                unresolved_points.append({"memory_id": m.id, "point": point})
        review = {
            "unconfirmed_memory_count": sum(1 for m in all_memories if m.status != "confirmed"),
            "unresolved_points": unresolved_points,
        }

        result: dict = {
            "project": project_dict,
            "family": family_dict,
            "relationships": relationships,
            "timeline": timeline,
            "featured_story": featured_story,
            "family_letter": family_letter,
            "preserved_quotes": [],
            "media": media,
            "review": review,
            "updated_at": project.updated_at,
        }

        if include_transcript:
            utterances = list(
                self.db.scalars(
                    select(Utterance)
                    .join(InterviewSession, Utterance.session_id == InterviewSession.id)
                    .where(InterviewSession.project_id == project_id)
                    .order_by(Utterance.id.asc())
                )
            )
            result["transcript"] = [
                {"id": u.id, "role": u.role, "text": u.text, "created_at": u.created_at}
                for u in utterances
            ]

        return result

    def get_archive_status(self, project_id: int) -> dict:
        project = self.db.get(BiographyProject, project_id)
        if not project:
            raise ValueError("Project not found")

        sessions = list(self.db.scalars(select(InterviewSession).where(InterviewSession.project_id == project_id)))
        if sessions:
            utterances = self.db.scalars(
                select(Utterance).where(Utterance.session_id.in_([s.id for s in sessions]))
            ).all()
            message_count = len(utterances)
        else:
            message_count = 0
        completed = any(s.ended_at is not None for s in sessions)

        memories = list(self.db.scalars(select(Memory).where(Memory.project_id == project_id)))
        confirmed = sum(1 for m in memories if m.status == "confirmed")
        unresolved = sum(1 for m in memories if _load_json(m.unresolved_json))

        docs = list(self.db.scalars(select(Document).where(Document.project_id == project_id, Document.status != "deleted")))
        jobs = list(self.db.scalars(select(MediaJob).where(MediaJob.project_id == project_id)))
        assets = list(self.db.scalars(select(MediaAsset).where(MediaAsset.project_id == project_id, MediaAsset.approved.is_(True))))

        next_action = "Review unresolved memories"
        if unresolved:
            next_action = f"Review {unresolved} unresolved memories"
        elif confirmed < len(memories):
            next_action = "Confirm extracted memories"
        elif not docs:
            next_action = "Generate biography documents"
        else:
            next_action = "Ready to publish"

        return {
            "project_id": project_id,
            "archive_status": project.archive_status,
            "interview": {"sessions": len(sessions), "messages": message_count, "completed": completed},
            "memories": {"total": len(memories), "confirmed": confirmed, "unresolved": unresolved},
            "documents": {
                "draft": sum(1 for d in docs if d.status == "draft"),
                "approved": sum(1 for d in docs if d.status in ("approved", "published")),
            },
            "media": {
                "queued": sum(1 for j in jobs if j.status == "queued"),
                "processing": sum(1 for j in jobs if j.status == "processing"),
                "approved": len(assets),
            },
            "next_action": next_action,
        }

    def get_usage(self, project_id: int) -> dict:
        project = self.db.get(BiographyProject, project_id)
        if not project:
            raise ValueError("Project not found")

        docs = list(self.db.scalars(select(Document).where(Document.project_id == project_id)))
        jobs = list(self.db.scalars(select(MediaJob).where(MediaJob.project_id == project_id)))

        deepseek_calls = len(docs)
        minimax_jobs = len(jobs)
        minimax_succeeded = sum(1 for j in jobs if j.status == "succeeded")

        return {
            "project_id": project_id,
            "deepseek": {"calls": deepseek_calls, "tokens": 0},
            "minimax": {"jobs": minimax_jobs, "succeeded": minimax_succeeded},
            "summary": f"{deepseek_calls} DeepSeek generations, {minimax_jobs} MiniMax jobs",
        }
