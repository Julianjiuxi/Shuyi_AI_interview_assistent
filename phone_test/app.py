"""ShuYi 电话 demo - 火山引擎端到端实时语音（全双工 3.0 Seeduplex）后端中继。

浏览器侧连到本服务 ws://localhost:8765/ws/call，由本服务加 X-Api-Key 后再转接到
火山 wss://openspeech.bytedance.com/api/v3/duplex/realtime/dialogue，避免前端暴露 Key。

同时把 ShuYi 的 Interview 约束（承接讲述者、不做问卷式追问、不臆造情感等）注入
session.create 的 instructions 字段，让"电话里的 AI"与纯文字 RT 聊天保持同一套
口述历史访谈规则。
"""
from __future__ import annotations

import asyncio
import json
import os
import uuid
from pathlib import Path

import uvicorn
import websockets
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

API_KEY = os.getenv("VOLC_DUPLEX_API_KEY", "")
VOLC_URL = "wss://openspeech.bytedance.com/api/v3/duplex/realtime/dialogue"
DEFAULT_VOICE = os.getenv("VOLC_DUPLEX_VOICE", "zh_male_yunzhou_jupiter_bigtts")
MODEL_VERSION = "1.2.6.1"  # 全双工 3.0 Seeduplex

HERE = Path(__file__).resolve().parent
SUBJECT = {
    "name": "林美珍",
    "chinese_name": "林美珍",
    "birth_year": 1945,
    "birth_place": "山东临沂",
    "intro": "一位从农村走到县城、再到上海工作生活的长辈，家中排行第三，父亲坚持让她读书是她人生中最感激的事情之一。",
}

INTERVIEW_RULES = r"""
你是 ShuYi「书忆」口述历史智能访谈员。你正在做一场温暖、尊重、不催促的家族人生口述访谈。

核心访谈原则：
1. 讲述者主导对话。你只是顺着他的叙事动量承接，绝不在每轮都用直接问题硬把话题拉到问卷上。
2. 同一话题仍在自然展开时，不要因为想覆盖别的人生阶段就硬切题。阶段覆盖率只是次要参考。
3. 对话动作要多样，不要每轮都是问句。优先交替：承接 · 邀请继续 · 轻轻深挖一个具体细节 · 澄清歧义 · 自然过渡。
4. 严禁连环追问。如果最近两轮已经出现多次直接问句，本轮优先用陈述句承接或邀请继续。
5. 一轮只能说一件事。永远不要一句里塞两三个问句。
6. 绝不臆造情感：不要说"我能感受到您当时一定很难受"，只能说"您刚才反复提到那段经历现在还记得很清楚"。
7. 切题必须搭桥：从对方已经说过的内容自然带过去，绝不可"那您第一份工作是什么"这种直球跳题。
8. 语言：自然、口语化的简体中文，不过度使用敬语或官样文案。
9. 语气温度：像晚辈在认真倾听家里长辈回忆，而不是一个做问卷的调查员。
"""

INSTRUCTIONS_TEMPLATE = """{rules}

当前正在采访的讲述者：
- 姓名：{name}（{chinese_name}）
- 出生：{birth_year} 年，籍贯 {birth_place}
- 背景简介：{intro}

开场你的第一句话请简短、礼貌地问候并邀请对方开始回忆（不要问具体清单式问题），
例如："阿姨您好，今天我们随便聊聊，想到什么讲什么就好。您愿意从哪里开始呢？"。
之后严格遵守上方的 9 条访谈原则。"""


app = FastAPI(title="ShuYi Phone Demo")
if (HERE / "static").exists():
    app.mount("/static", StaticFiles(directory=str(HERE / "static")), name="static")


def build_instructions() -> str:
    return INSTRUCTIONS_TEMPLATE.format(
        rules=INTERVIEW_RULES.strip(),
        name=SUBJECT["name"],
        chinese_name=SUBJECT["chinese_name"],
        birth_year=SUBJECT["birth_year"],
        birth_place=SUBJECT["birth_place"],
        intro=SUBJECT["intro"],
    )


def build_session_create(session_id: str) -> dict:
    return {
        "type": "session.create",
        "session": {
            "id": session_id,
            "model": MODEL_VERSION,
            "instructions": build_instructions(),
            "audio": {
                "input": {"format": {"type": "speech_opus", "rate": 16000}},
                "output": {"format": {"type": "ogg_opus", "rate": 24000}},
            },
            "voice": DEFAULT_VOICE,
        },
    }


@app.get("/")
def index():
    return FileResponse(HERE / "index.html")


@app.websocket("/ws/call")
async def call_endpoint(ws: WebSocket):
    await ws.accept()
    session_id = str(uuid.uuid4())

    # 浏览器可以发的控制事件：在这些事件里统一补上 session id。
    CONTROL_EVENTS = {
        "session.update",
        "session.finish",
        "input_audio_commit",
        "input_audio_mute.commit",
        "input_audio_unmute.commit",
    }

    async def browser_to_volc(upstream):
        try:
            while True:
                data = await ws.receive()
                if "bytes" in data and data["bytes"] is not None:
                    await upstream.send(data["bytes"])
                elif "text" in data and data["text"] is not None:
                    try:
                        msg = json.loads(data["text"])
                    except json.JSONDecodeError:
                        continue
                    t = msg.get("type")
                    if t in CONTROL_EVENTS:
                        if "session" in msg and isinstance(msg["session"], dict):
                            msg["session"].setdefault("id", session_id)
                        elif "session_id" in msg:
                            msg["session_id"] = session_id
                        await upstream.send(json.dumps(msg, ensure_ascii=False))
        except WebSocketDisconnect:
            pass
        except Exception:
            pass

    async def volc_to_browser(upstream):
        try:
            async for evt in upstream:
                if isinstance(evt, bytes):
                    await ws.send_bytes(evt)
                elif isinstance(evt, str):
                    await ws.send_text(evt)
        except Exception:
            pass

    try:
        async with websockets.connect(
            VOLC_URL,
            additional_headers={"X-Api-Key": API_KEY},
            open_timeout=15,
        ) as upstream:
            await upstream.send(json.dumps(build_session_create(session_id), ensure_ascii=False))
            await asyncio.gather(
                browser_to_volc(upstream),
                volc_to_browser(upstream),
            )
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # noqa: BLE001 - demo 里把错误回显给前端方便看
        try:
            await ws.send_json({"type": "error", "detail": f"{type(exc).__name__}: {exc}"})
        except Exception:
            pass
    finally:
        try:
            await ws.close()
        except Exception:
            pass


if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="127.0.0.1",
        port=8765,
        reload=False,
        log_level="info",
    )
