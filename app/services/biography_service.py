from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import BiographyProject, Chapter, Memory
from app.prompts.biography_writer import BIOGRAPHY_WRITER_SYSTEM, build_biography_writer_user
from app.services.deepseek_client import DeepSeekClient


class BiographyService:
    def __init__(self, db: Session, llm: DeepSeekClient | None = None) -> None:
        self.db = db
        self.llm = llm or DeepSeekClient()

    def generate_chapter(self, project_id: int, focus: str) -> dict:
        project = self.db.get(BiographyProject, project_id)
        if not project:
            raise ValueError("Project not found")

        memories = list(
            self.db.scalars(
                select(Memory)
                .where(Memory.project_id == project_id)
                .order_by(Memory.importance.desc(), Memory.id.asc())
            )
        )
        if not memories:
            raise ValueError("No memories available")

        evidence_lines = []
        memory_ids = []
        for m in memories:
            source = m.source_utterance.text if m.source_utterance else ""
            evidence_lines.append(
                f"MEMORY {m.id}: {m.content}\n"
                f"metadata: year={m.approx_year}, age={m.approx_age}, location={m.location}, confidence={m.confidence}\n"
                f"source excerpt: {source}"
            )
            memory_ids.append(m.id)

        raw = self.llm.json_completion(
            BIOGRAPHY_WRITER_SYSTEM,
            build_biography_writer_user(focus, "\n\n".join(evidence_lines)),
            max_tokens=2600,
        )
        title = str(raw.get("title", "Untitled Chapter"))
        body = str(raw.get("body", ""))

        chapter = Chapter(
            project_id=project_id,
            title=title,
            body=body,
            source_memory_ids_json=json.dumps(memory_ids),
        )
        self.db.add(chapter)
        self.db.commit()
        return {"title": title, "body": body}
