from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import BiographyProject, Document, Memory
from app.models.schemas import DocumentGenerateRequest
from app.prompts.biography_writer import BIOGRAPHY_WRITER_SYSTEM, build_biography_writer_user
from app.prompts.document_writer import DOCUMENT_WRITER_SYSTEM, build_document_writer_user
from app.services.deepseek_client import DeepSeekClient


def _load_json(text: str, default=None) -> list:
    if default is None:
        default = []
    try:
        data = json.loads(text or "[]")
        return data if isinstance(data, list) else default
    except (json.JSONDecodeError, TypeError):
        return default


def _build_evidence(memories: list[Memory]) -> tuple[str, list[int]]:
    lines = []
    ids = []
    for m in memories:
        source = m.source_utterance.text if m.source_utterance else ""
        lines.append(
            f"MEMORY {m.id}: {m.content}\n"
            f"metadata: year={m.approx_year}, age={m.approx_age}, location={m.location}, confidence={m.confidence}\n"
            f"source excerpt: {source}"
        )
        ids.append(m.id)
    return "\n\n".join(lines), ids


def _document_to_dict(doc: Document) -> dict:
    return {
        "id": doc.id,
        "project_id": doc.project_id,
        "document_type": doc.document_type,
        "title": doc.title,
        "body": doc.body,
        "language": doc.language,
        "status": doc.status,
        "source_memory_ids": _load_json(doc.source_memory_ids_json),
        "model_provider": doc.model_provider,
        "model_name": doc.model_name,
        "prompt_version": doc.prompt_version,
        "created_at": doc.created_at,
        "updated_at": doc.updated_at,
    }


class DocumentService:
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

        evidence, memory_ids = _build_evidence(memories)
        raw = self.llm.json_completion(
            BIOGRAPHY_WRITER_SYSTEM,
            build_biography_writer_user(focus, evidence),
            max_tokens=2600,
        )
        title = str(raw.get("title", "Untitled Chapter"))
        body = str(raw.get("body", ""))

        doc = Document(
            project_id=project_id,
            document_type="chapter",
            title=title,
            body=body,
            language="zh-CN",
            status="draft",
            source_memory_ids_json=json.dumps(memory_ids),
            model_provider="deepseek",
            model_name=settings.deepseek_model,
            prompt_version="biography_writer_v1",
        )
        self.db.add(doc)
        self.db.commit()
        self.db.refresh(doc)
        return {
            "id": doc.id,
            "project_id": doc.project_id,
            "document_type": doc.document_type,
            "title": doc.title,
            "body": doc.body,
            "language": doc.language,
            "status": doc.status,
            "source_memory_ids": memory_ids,
            "created_at": doc.created_at,
        }

    def generate_documents(self, project_id: int, request: DocumentGenerateRequest) -> list[dict]:
        project = self.db.get(BiographyProject, project_id)
        if not project:
            raise ValueError("Project not found")

        query = select(Memory).where(Memory.project_id == project_id)
        if request.only_confirmed_memories:
            query = query.where(Memory.status == "confirmed")
        memories = list(self.db.scalars(query.order_by(Memory.importance.desc(), Memory.id.asc())))
        if not memories:
            raise ValueError("No confirmed memories available")

        evidence, memory_ids = _build_evidence(memories)
        results: list[dict] = []

        for doc_type in request.document_types:
            raw = self.llm.json_completion(
                DOCUMENT_WRITER_SYSTEM,
                build_document_writer_user(
                    doc_type,
                    request.language,
                    request.tone,
                    request.focus,
                    evidence,
                ),
                max_tokens=2600,
                model=settings.deepseek_model,
            )
            title = str(raw.get("title", doc_type))
            body = str(raw.get("body", ""))
            doc = Document(
                project_id=project_id,
                document_type=doc_type,
                title=title,
                body=body,
                language=request.language,
                status="draft",
                source_memory_ids_json=json.dumps(memory_ids),
                model_provider="deepseek",
                model_name=settings.deepseek_model,
                prompt_version="document_writer_v1",
            )
            self.db.add(doc)
            self.db.flush()
            results.append(_document_to_dict(doc))

        self.db.commit()
        return results

    # ---- CRUD ----
    def list_documents(self, project_id: int, document_type: str | None, status: str | None) -> list[dict]:
        query = select(Document).where(Document.project_id == project_id, Document.status != "deleted")
        if document_type:
            query = query.where(Document.document_type == document_type)
        if status:
            query = query.where(Document.status == status)
        docs = self.db.scalars(query.order_by(Document.id.desc())).all()
        return [_document_to_dict(d) for d in docs]

    def get_document(self, document_id: int) -> dict:
        doc = self.db.get(Document, document_id)
        if not doc or doc.status == "deleted":
            raise ValueError("Document not found")
        return _document_to_dict(doc)

    def update_document(self, document_id: int, updates: dict) -> dict:
        doc = self.db.get(Document, document_id)
        if not doc or doc.status == "deleted":
            raise ValueError("Document not found")
        for key, value in updates.items():
            if value is not None:
                setattr(doc, key, value)
        self.db.commit()
        self.db.refresh(doc)
        return _document_to_dict(doc)

    def delete_document(self, document_id: int) -> None:
        doc = self.db.get(Document, document_id)
        if not doc or doc.status == "deleted":
            raise ValueError("Document not found")
        doc.status = "deleted"
        self.db.commit()

    def approve_document(self, document_id: int) -> dict:
        doc = self.db.get(Document, document_id)
        if not doc or doc.status == "deleted":
            raise ValueError("Document not found")
        doc.status = "approved"
        self.db.commit()
        self.db.refresh(doc)
        return _document_to_dict(doc)
