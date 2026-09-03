def test_relationship_cross_family_and_duplicate(client):
    # 两个家庭
    fam1 = client.post("/api/families", json={"name": "Zhao-Lin Family"}).json()
    fam2 = client.post("/api/families", json={"name": "Wang Family"}).json()

    p1 = client.post("/api/projects", json={"subject_name": "林美珍", "family_id": fam1["id"]}).json()
    p2 = client.post("/api/projects", json={"subject_name": "Leo", "family_id": fam1["id"]}).json()
    p3 = client.post("/api/projects", json={"subject_name": "Wang", "family_id": fam2["id"]}).json()

    # 跨家庭关系应被拒绝
    resp = client.post(
        f"/api/families/{fam1['id']}/relationships",
        json={"from_project_id": p1["project_id"], "to_project_id": p3["project_id"], "relation_type": "parent"},
    )
    assert resp.status_code == 400

    # 正常关系
    resp = client.post(
        f"/api/families/{fam1['id']}/relationships",
        json={"from_project_id": p1["project_id"], "to_project_id": p2["project_id"], "relation_type": "parent"},
    )
    assert resp.status_code == 201

    # 重复关系（同 family + 同 from/to/type）应 409
    resp = client.post(
        f"/api/families/{fam1['id']}/relationships",
        json={"from_project_id": p1["project_id"], "to_project_id": p2["project_id"], "relation_type": "parent"},
    )
    assert resp.status_code == 409


def test_tree_returns_people_and_relationships(client):
    fam = client.post("/api/families", json={"name": "Test Family"}).json()
    p1 = client.post("/api/projects", json={"subject_name": "A", "family_id": fam["id"]}).json()
    p2 = client.post("/api/projects", json={"subject_name": "B", "family_id": fam["id"]}).json()
    client.post(
        f"/api/families/{fam['id']}/relationships",
        json={"from_project_id": p1["project_id"], "to_project_id": p2["project_id"], "relation_type": "child"},
    )

    tree = client.get(f"/api/families/{fam['id']}/tree").json()
    assert len(tree["people"]) == 2
    assert len(tree["relationships"]) == 1
