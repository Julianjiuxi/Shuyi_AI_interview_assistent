# -*- coding: utf-8 -*-
"""分步交互访谈测试。

用法：
  python _run_interview.py init                 # 创建会话，打印开场问题
  python _run_interview.py turn "讲述人的回答"   # 处理本轮回答，打印新问题与耗时
  python _run_interview.py export               # 导出对话记录 + 耗时统计
"""
import json
import logging
import sys
import time
from pathlib import Path

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.entities import Utterance
from app.services.interview_service import InterviewService

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

STATE_FILE = Path("_interview_state.json")


def load_state() -> dict:
    return json.loads(STATE_FILE.read_text(encoding="utf-8"))


def save_state(state: dict) -> None:
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def export_transcript(db, session_id: int, path: str) -> None:
    utterances = list(db.scalars(select(Utterance).where(Utterance.session_id == session_id).order_by(Utterance.id)))
    lines = ["# 陈建国 · 传记访谈对话记录", ""]
    for u in utterances:
        role = "**AI（访谈者）**" if u.role == "interviewer" else "**陈建国（讲述人）**"
        lines.append(f"{role}：{u.text}")
        lines.append("")
    Path(path).write_text("\n".join(lines), encoding="utf-8")
    print(f"\n对话记录已导出到 {path}")


def cmd_init() -> None:
    db = SessionLocal()
    try:
        svc = InterviewService(db)
        project, session, first_q = svc.create_project("陈建国")
        save_state({"project_id": project.id, "session_id": session.id, "turn": 0, "times": []})
        print(f"已创建会话 project={project.id} session={session.id}")
        print(f"【第 1 问】AI: {first_q}")
    finally:
        db.close()


def cmd_turn(answer: str) -> None:
    state = load_state()
    db = SessionLocal()
    try:
        svc = InterviewService(db)
        t0 = time.time()
        result = svc.handle_answer(state["project_id"], state["session_id"], answer)
        elapsed = time.time() - t0
        state["turn"] += 1
        state["times"].append(elapsed)
        save_state(state)

        mems = result["extracted_memories"]
        print(f"【第 {state['turn']} 答】陈建国: {answer}")
        print(f"  ▸ 抽取记忆 {len(mems)} 条，本轮耗时 {elapsed:.1f}s")
        for m in mems:
            print(f"    - [{m.life_stage}/{m.memory_type}] {m.title}")
        print(f"【第 {state['turn'] + 1} 问】AI: {result['next_question']}")
    finally:
        db.close()


def cmd_export() -> None:
    state = load_state()
    db = SessionLocal()
    try:
        export_transcript(db, state["session_id"], "interview_transcript.md")
        times = state["times"]
        print("\n耗时统计（每轮 = 记忆抽取 + 追问生成）：")
        for i, t in enumerate(times, 1):
            print(f"  第 {i:>2} 轮：{t:6.1f}s")
        if times:
            print(f"  合计：{sum(times):.1f}s  平均：{sum(times) / len(times):.1f}s/轮")
    finally:
        db.close()


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "init"
    if cmd == "init":
        cmd_init()
    elif cmd == "turn":
        cmd_turn(sys.argv[2] if len(sys.argv) > 2 else "")
    elif cmd == "export":
        cmd_export()
