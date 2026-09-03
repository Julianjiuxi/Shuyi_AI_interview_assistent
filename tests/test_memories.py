from app.models.entities import BiographyProject, Memory


def _make_project_memory(db_session):
    project = BiographyProject(subject_name="测试")
    db_session.add(project)
    db_session.commit()
    memory = Memory(
        project_id=project.id,
        memory_type="event",
        title="离乡",
        content="十九岁离开苏州去上海",
        status="extracted",
        importance=0.9,
    )
    db_session.add(memory)
    db_session.commit()
    return project.id, memory.id


def test_memory_confirm_and_reject(client, db_session):
    project_id, memory_id = _make_project_memory(db_session)

    resp = client.post(f"/api/memories/{memory_id}/confirm", json={"confirmed_by": "林美珍", "review_note": "年份确认"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "confirmed"
    assert body["confirmed"] is True
    assert body["confirmed_by"] == "林美珍"

    resp = client.post(f"/api/memories/{memory_id}/reject", json={"review_note": "信息有误"})
    body = resp.json()
    assert body["status"] == "rejected"
    assert body["confirmed"] is False


def test_memory_list_with_status_filter(client, db_session):
    project_id, memory_id = _make_project_memory(db_session)

    resp = client.get(f"/api/projects/{project_id}/memories")
    assert len(resp.json()) == 1

    resp = client.get(f"/api/projects/{project_id}/memories?status=confirmed")
    assert resp.json() == []


def test_bulk_review(client, db_session):
    project_id, memory_id = _make_project_memory(db_session)

    resp = client.post(
        f"/api/projects/{project_id}/memories/bulk-review",
        json={"confirm_ids": [memory_id], "reject_ids": []},
    )
    assert resp.json() == {"confirmed": 1, "rejected": 0}

    resp = client.get(f"/api/memories/{memory_id}")
    assert resp.json()["status"] == "confirmed"
