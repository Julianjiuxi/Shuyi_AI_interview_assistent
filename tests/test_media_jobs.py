from app.models.entities import BiographyProject
from app.models.schemas import ImageJobCreate
from app.services.media_job_service import MediaJobService


def test_image_job_idempotency(db_session):
    project = BiographyProject(subject_name="测试")
    db_session.add(project)
    db_session.commit()

    service = MediaJobService(db_session)
    payload = ImageJobCreate(prompt="一张温暖的家庭合影")

    first = service.create_image_job(project.id, payload, "key-123")
    second = service.create_image_job(project.id, payload, "key-123")

    assert first["job_id"] == second["job_id"]


def test_retry_creates_child_job(db_session):
    project = BiographyProject(subject_name="测试")
    db_session.add(project)
    db_session.commit()

    service = MediaJobService(db_session)
    payload = ImageJobCreate(prompt="重试测试")
    first = service.create_image_job(project.id, payload, None)

    retried = service.retry_job(first["job_id"])
    assert retried["job_id"] != first["job_id"]

    from app.models.entities import MediaJob

    child = db_session.get(MediaJob, retried["job_id"])
    assert child.parent_job_id == first["job_id"]


def test_cancel_terminal_state(db_session):
    project = BiographyProject(subject_name="测试")
    db_session.add(project)
    db_session.commit()

    service = MediaJobService(db_session)
    payload = ImageJobCreate(prompt="取消测试")
    job = service.create_image_job(project.id, payload, None)

    cancelled = service.cancel_job(job["job_id"])
    assert cancelled["status"] == "cancelled"
