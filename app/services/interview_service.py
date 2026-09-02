from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import BiographyProject, InterviewSession, Memory, Utterance
from app.models.schemas import ExtractionResult, PlannerLLMResult
from app.prompts.interview_planner import INTERVIEW_PLANNER_SYSTEM, build_interview_planner_user
from app.prompts.memory_extractor import MEMORY_EXTRACTOR_SYSTEM, build_memory_extractor_user
from app.services.deepseek_client import DeepSeekClient
from app.services.planner import InterviewPlanner


def _clean_text(text: str) -> str:
    """规范化对话文本：去掉首尾空白，把连续空白（含换行）压成一个空格。"""
    return " ".join(text.split())


class InterviewService:
    def __init__(self, db: Session, llm: DeepSeekClient | None = None) -> None:
        self.db = db
        self.llm = llm or DeepSeekClient()
        self.planner = InterviewPlanner()

    def create_project(self, subject_name: str) -> tuple[BiographyProject, InterviewSession, str]:
        project = BiographyProject(subject_name=subject_name)
        self.db.add(project)
        self.db.flush()

        session = InterviewSession(project_id=project.id)
        self.db.add(session)
        self.db.flush()

        first_question = "您想从哪里开始讲起呢？可以从您的童年、家庭，或者任何让您印象深刻的记忆开始。"
        self.db.add(Utterance(session_id=session.id, role="interviewer", text=first_question))
        self.db.commit()
        return project, session, first_question

    def handle_answer(self, project_id: int, session_id: int, answer: str) -> dict:
        project = self.db.get(BiographyProject, project_id)
        session = self.db.get(InterviewSession, session_id)
        if not project or not session or session.project_id != project_id:
            raise ValueError("Invalid project/session")

        user_utt = Utterance(session_id=session_id, role="storyteller", text=_clean_text(answer))
        self.db.add(user_utt)
        self.db.flush()

        raw_extraction = self.llm.json_completion(
            MEMORY_EXTRACTOR_SYSTEM,
            build_memory_extractor_user(answer),
            max_tokens=900,
            model=settings.deepseek_interview_model,
            thinking="disabled",
            task="memory",
        )
        # 容错：模型偶尔输出 schema 之外的 memory_type，归一化为 event
        for mem in raw_extraction.get("memories", []):
            if isinstance(mem, dict) and mem.get("memory_type") not in {
                "person", "event", "place", "date", "value", "emotion", "relationship",
            }:
                mem["memory_type"] = "event"
        extraction = ExtractionResult.model_validate(raw_extraction)

        for item in extraction.memories:
            self.db.add(
                Memory(
                    project_id=project_id,
                    source_utterance_id=user_utt.id,
                    memory_type=item.memory_type,
                    title=item.title,
                    content=item.content,
                    life_stage=item.life_stage,
                    approx_year=item.approx_year,
                    approx_age=item.approx_age,
                    location=item.location,
                    people_json=json.dumps(item.people, ensure_ascii=False),
                    tags_json=json.dumps(item.tags, ensure_ascii=False),
                    importance=item.importance,
                    emotional_intensity=item.emotional_intensity,
                    confidence=item.confidence,
                    unresolved_json=json.dumps(item.unresolved_points, ensure_ascii=False),
                )
            )
        self.db.flush()

        memories = list(self.db.scalars(select(Memory).where(Memory.project_id == project_id).order_by(Memory.id.desc()).limit(15)))
        memory_stages = [m.life_stage for m in memories]
        coverage = self.planner.compute_coverage(memory_stages)

        memories_text = "\n".join(
            f"- id={m.id}; stage={m.life_stage}; type={m.memory_type}; content={m.content}; "
            f"importance={m.importance:.2f}; unresolved={m.unresolved_json}"
            for m in reversed(memories)
        )

        recent = list(self.db.scalars(select(Utterance).where(Utterance.session_id == session_id).order_by(Utterance.id.desc()).limit(8)))
        recent_dialogue = "\n".join(f"{u.role.upper()}: {u.text}" for u in reversed(recent))

        raw_plan = self.llm.json_completion(
            INTERVIEW_PLANNER_SYSTEM,
            build_interview_planner_user(project.subject_name, coverage, memories_text, recent_dialogue),
            max_tokens=800,
            model=settings.deepseek_interview_model,
            thinking="disabled",
            task="planner",
        )
        plan = PlannerLLMResult.model_validate(raw_plan)
        winner, debug = self.planner.choose(plan.candidates, coverage)

        self.db.add(Utterance(session_id=session_id, role="interviewer", text=_clean_text(winner.question)))
        self.db.commit()

        return {
            "next_question": winner.question,
            "extracted_memories": extraction.memories,
            "planner_debug": {
                "coverage": coverage,
                "ranked_candidates": debug,
            },
        }
