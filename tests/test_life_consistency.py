"""RT 模式数据一致性回归测试：关系方向 / 循环 / 对称 / 家族迁移 / 人生草稿门。"""

from sqlalchemy import delete

from app.models.entities import BiographyProject, Memory
from app.models.schemas import LifeViewGenerateRequest
from app.services.life_profile_service import LifeProfileService


class _FakeLLM:
    """不触发真实 DeepSeek，只返回最小合法 JSON。"""

    def json_completion(self, system, user, **kwargs):
        return {"role": "Mother", "occupation": "", "personality": "", "personality_note": ""}


def _make_project(client, name, family_id):
    return client.post("/api/projects", json={"subject_name": name, "family_id": family_id}).json()["project_id"]


def test_parent_cycle_rejected(client):
    fam = client.post("/api/families", json={"name": "Cycle Family"}).json()
    a = _make_project(client, "A", fam["id"])
    b = _make_project(client, "B", fam["id"])

    # A 是 B 的父
    assert client.post(
        f"/api/families/{fam['id']}/relationships",
        json={"from_project_id": a, "to_project_id": b, "relation_type": "parent"},
    ).status_code == 201

    # 再让 B 当 A 的父会形成代际循环，应 400
    resp = client.post(
        f"/api/families/{fam['id']}/relationships",
        json={"from_project_id": b, "to_project_id": a, "relation_type": "parent"},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "PARENT_CYCLE"


def test_child_relation_canonicalized_to_parent(client):
    fam = client.post("/api/families", json={"name": "Canon Family"}).json()
    a = _make_project(client, "A", fam["id"])
    b = _make_project(client, "B", fam["id"])

    # 用户选择 A child B，写库应反转为 B parent A
    assert client.post(
        f"/api/families/{fam['id']}/relationships",
        json={"from_project_id": a, "to_project_id": b, "relation_type": "child"},
    ).status_code == 201

    tree = client.get(f"/api/families/{fam['id']}/tree").json()
    assert len(tree["relationships"]) == 1
    rel = tree["relationships"][0]
    assert rel["relation_type"] == "parent"
    assert rel["from_project_id"] == b
    assert rel["to_project_id"] == a


def test_symmetric_spouse_duplicate_rejected(client):
    fam = client.post("/api/families", json={"name": "Spouse Family"}).json()
    a = _make_project(client, "A", fam["id"])
    b = _make_project(client, "B", fam["id"])

    assert client.post(
        f"/api/families/{fam['id']}/relationships",
        json={"from_project_id": a, "to_project_id": b, "relation_type": "spouse"},
    ).status_code == 201

    # 反向的相同 spouse 关系应判重，409
    resp = client.post(
        f"/api/families/{fam['id']}/relationships",
        json={"from_project_id": b, "to_project_id": a, "relation_type": "spouse"},
    )
    assert resp.status_code == 409


def test_family_migration_cleans_old_relationships(client):
    fam1 = client.post("/api/families", json={"name": "Old Family"}).json()
    fam2 = client.post("/api/families", json={"name": "New Family"}).json()
    a = _make_project(client, "A", fam1["id"])
    b = _make_project(client, "B", fam1["id"])

    client.post(
        f"/api/families/{fam1['id']}/relationships",
        json={"from_project_id": a, "to_project_id": b, "relation_type": "parent"},
    )

    # 将 A 迁到新家庭，旧家庭中与 A 相关的关系应被清理
    resp = client.patch(f"/api/projects/{a}", json={"family_id": fam2["id"]})
    assert resp.status_code == 200

    tree = client.get(f"/api/families/{fam1['id']}/tree").json()
    assert tree["relationships"] == []


def test_life_view_confirmed_gate_and_draft(db_session):
    project = BiographyProject(subject_name="张三")
    db_session.add(project)
    db_session.commit()

    # 仅有一条 extracted 记忆：confirmed-only 应拒绝
    db_session.add(Memory(project_id=project.id, memory_type="event", content="小时候住在临沂", status="extracted"))
    db_session.commit()

    svc = LifeProfileService(db_session, llm=_FakeLLM())
    try:
        svc.generate(project.id, LifeViewGenerateRequest(only_confirmed_memories=True))
        raise AssertionError("expected confirmed-only gate to reject")
    except ValueError as exc:
        assert "暂无可用记忆" in str(exc)

    # RT 草稿：允许 extracted，产出 is_draft=True
    result = svc.generate(project.id, LifeViewGenerateRequest(only_confirmed_memories=False))
    assert result["is_draft"] is True
    assert result["role"] == "Mother"

    # rejected 记忆不参与草稿归纳：仅剩 rejected 时应拒绝
    db_session.execute(delete(Memory))
    db_session.add(Memory(project_id=project.id, memory_type="event", content="被否决的记忆", status="rejected"))
    db_session.commit()
    try:
        svc.generate(project.id, LifeViewGenerateRequest(only_confirmed_memories=False))
        raise AssertionError("expected rejected-only draft to fail")
    except ValueError as exc:
        assert "暂无可用记忆" in str(exc)
