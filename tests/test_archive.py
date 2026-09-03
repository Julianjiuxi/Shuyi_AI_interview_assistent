from app.models.entities import BiographyProject, Document, Family, MediaAsset, Memory
from app.services.archive_service import ArchiveService


def test_archive_only_exposes_confirmed_and_published(db_session):
    family = Family(name="Zhao-Lin Family", slug="zhao-lin-family")
    db_session.add(family)
    db_session.commit()

    project = BiographyProject(subject_name="林美珍", family_id=family.id, birth_year=1954)
    db_session.add(project)
    db_session.commit()

    confirmed = Memory(project_id=project.id, status="confirmed", approx_year=1973, location="Shanghai", title="离乡", content="第一次离开苏州", memory_type="event")
    unconfirmed = Memory(project_id=project.id, status="extracted", approx_year=1990, title="待确认", content="未确认内容", memory_type="event")
    db_session.add_all([confirmed, unconfirmed])
    db_session.commit()

    published_doc = Document(project_id=project.id, document_type="chapter", title="发布章节", body="正文", status="published")
    draft_doc = Document(project_id=project.id, document_type="chapter", title="草稿", body="正文", status="draft")
    db_session.add_all([published_doc, draft_doc])
    db_session.commit()

    approved_asset = MediaAsset(project_id=project.id, asset_type="image", title="已审核图", url="http://x/1.jpg", approved=True)
    unapproved_asset = MediaAsset(project_id=project.id, asset_type="image", title="未审核图", url="http://x/2.jpg", approved=False)
    db_session.add_all([approved_asset, unapproved_asset])
    db_session.commit()

    archive = ArchiveService(db_session).get_archive(project.id)

    # 时间线只含已确认且有年份的记忆
    assert len(archive["timeline"]) == 1
    assert archive["timeline"][0]["title"] == "离乡"

    # featured_story 选已发布章节
    assert archive["featured_story"]["title"] == "发布章节"

    # 媒体只含 approved
    assert len(archive["media"]["images"]) == 1
    assert archive["media"]["images"][0]["title"] == "已审核图"

    # 审核汇总
    assert archive["review"]["unconfirmed_memory_count"] == 1
    assert archive["family"]["name"] == "Zhao-Lin Family"


def test_archive_status(db_session):
    project = BiographyProject(subject_name="测试")
    db_session.add(project)
    db_session.commit()

    status = ArchiveService(db_session).get_archive_status(project.id)
    assert status["project_id"] == project.id
    assert status["archive_status"] == "draft"
    assert "memories" in status
