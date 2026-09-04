from app.models.entities import BiographyProject, Document, Memory
from app.models.schemas import DocumentGenerateRequest
from app.services.document_service import DocumentService


class RecordingLLM:
    def __init__(self, result):
        self.result = result
        self.user_prompts = []

    def json_completion(self, system_prompt, user_prompt, **kwargs):
        self.user_prompts.append(user_prompt)
        return self.result


def test_generate_documents_only_uses_confirmed_memories(db_session):
    project = BiographyProject(subject_name="测试")
    db_session.add(project)
    db_session.commit()

    confirmed = Memory(project_id=project.id, status="confirmed", content="已确认的事实", memory_type="event")
    unconfirmed = Memory(project_id=project.id, status="extracted", content="未确认的猜测", memory_type="event")
    db_session.add_all([confirmed, unconfirmed])
    db_session.commit()

    llm = RecordingLLM({"title": "标题", "body": "正文"})
    service = DocumentService(db_session, llm=llm)
    results = service.generate_documents(
        project.id,
        DocumentGenerateRequest(document_types=["summary"], only_confirmed_memories=True),
    )

    assert len(results) == 1
    prompt = llm.user_prompts[0]
    assert "已确认的事实" in prompt
    assert "未确认的猜测" not in prompt


def test_generate_chapter_creates_document(db_session):
    project = BiographyProject(subject_name="测试")
    db_session.add(project)
    db_session.commit()
    memory = Memory(project_id=project.id, status="confirmed", content="一段记忆", memory_type="event")
    db_session.add(memory)
    db_session.commit()

    llm = RecordingLLM({"title": "章节", "body": "章节正文"})
    service = DocumentService(db_session, llm=llm)
    result = service.generate_chapter(project.id, "写一章")

    assert result["document_type"] == "chapter"
    assert result["title"] == "章节"
    assert result["source_memory_ids"] == [memory.id]


def test_publish_document_moves_to_published(db_session):
    project = BiographyProject(subject_name="测试")
    db_session.add(project)
    db_session.commit()
    doc = Document(project_id=project.id, document_type="chapter", title="标题", body="正文", status="approved")
    db_session.add(doc)
    db_session.commit()

    service = DocumentService(db_session, llm=RecordingLLM({"title": "x", "body": "y"}))
    result = service.publish_document(doc.id)

    assert result["status"] == "published"
