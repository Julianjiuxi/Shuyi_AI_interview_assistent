"""ShuYi 电话 demo - 火山引擎端到端实时语音（全双工 3.0 Seeduplex）后端中继。

协议要点（以官方文档 2549778 为准）：
- URL: wss://openspeech.bytedance.com/api/v3/duplex/realtime/dialogue
- 鉴权: 请求头 X-Api-Key（新版控制台 API Key）
- model 固定 1.2.6.1
- 纯 JSON 文本帧，音频数据 Base64 编码内嵌于事件的 audio / delta 字段，不走二进制通道

本服务做的事：
1. 浏览器连 ws://127.0.0.1:8765/ws/call，本服务注入 X-Api-Key 后转接火山，避免 Key 暴露在前端。
2. 用 ShuYi 的 Interview 约束作为 session.create 的 instructions，让"电话里的 AI"与纯文字 RT 聊天同一套访谈人格。
3. 把浏览器发来的标准上行 JSON 事件透传给火山，把火山下行 JSON 事件透传回浏览器，并打印日志便于排错。
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from pathlib import Path

import uvicorn
import websockets
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger("phone_test")

API_KEY = os.getenv("VOLC_DUPLEX_API_KEY", "")
VOLC_URL = "wss://openspeech.bytedance.com/api/v3/duplex/realtime/dialogue"
DEFAULT_VOICE = os.getenv("VOLC_DUPLEX_VOICE", "zh_male_yunzhou_jupiter_bigtts")
MODEL_VERSION = "1.2.6.1"  # 全双工版本固定值

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

开场你的第一句话请简短、礼貌地问候并邀请对方开始回忆（不要问具体清单式问题）。
因为你还不知道对方希望被怎么称呼，绝对不要擅自用「阿姨」「叔叔」「奶奶」「爷爷」等亲属称谓，
第一句用中性、不冒犯的表述即可，
例如："您好，不知道怎么称呼您合适，就先不冒昧了。今天我们随便聊聊，想到什么讲什么就好，您愿意从哪里开始呢？"。
之后严格遵守上方的 9 条访谈原则。"""


app = FastAPI(title="ShuYi Phone Demo")


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
    """全双工 3.0 的 session.create（JSON 文本帧，无二进制封装）。"""
    return {
        "type": "session.create",
        "session": {
            "id": session_id,
            "model": MODEL_VERSION,
            "instructions": build_instructions(),
            "audio": {
                "input": {"format": {"type": "pcm", "rate": 16000}},
                "output": {"format": {"type": "ogg_opus", "rate": 24000}},
            },
            "voice": DEFAULT_VOICE,
        },
    }


# 浏览器需要透传给火山的标准上行事件（音频已 Base64 内嵌在 JSON，无需二进制处理）。
PASSTHROUGH_EVENTS = {
    "input_audio_buffer.append",
    "input_audio_buffer.commit",
    "input_audio_mute.commit",
    "input_audio_unmute.commit",
    "session.update",
    "session.close",
    "response.cancel",
    "speech_text_buffer.commit",
    "speech_text_buffer.replacement.append",
    "speech_text_buffer.replacement.commit",
    "conversation.item.create",
    "conversation.item.update",
    "conversation.item.delete",
}


@app.get("/")
def index():
    return FileResponse(HERE / "index.html")


@app.websocket("/ws/call")
async def call_endpoint(ws: WebSocket):
    await ws.accept()
    session_id = str(uuid.uuid4())

    async def browser_to_volc(upstream):
        try:
            while True:
                data = await ws.receive()
                text = None
                if "text" in data and data["text"] is not None:
                    text = data["text"]
                elif "bytes" in data and data["bytes"] is not None:
                    # 兼容：若前端误发二进制，按 UTF-8 尝试解析（正常路径不会走到这里）
                    text = data["bytes"].decode("utf-8", errors="ignore")
                if text is None:
                    continue
                try:
                    msg = json.loads(text)
                except json.JSONDecodeError:
                    logger.warning("browser 发来非法 JSON，已忽略")
                    continue
                t = msg.get("type")
                if t in PASSTHROUGH_EVENTS:
                    # 避免打印整段 base64 音频，只打印事件名和音频长度
                    preview = dict(msg)
                    if t == "input_audio_buffer.append" and "audio" in preview:
                        preview["audio"] = f"<{len(preview['audio'])} chars base64>"
                    logger.info("[Browser↑] %s", json.dumps(preview, ensure_ascii=False)[:400])
                    await upstream.send(json.dumps(msg, ensure_ascii=False))
        except WebSocketDisconnect:
            pass
        except Exception as exc:  # noqa: BLE001
            logger.exception("browser_to_volc failed")

    async def volc_to_browser(upstream):
        try:
            async for evt in upstream:
                if isinstance(evt, str):
                    logger.info("[Volc↓] %s", evt[:400])
                    await ws.send_text(evt)
                elif isinstance(evt, bytes):
                    # 新版协议音频内嵌 base64，理论上不会收到裸二进制；若有则透传
                    logger.info("[Volc↓] binary %d bytes", len(evt))
                    await ws.send_bytes(evt)
        except Exception as exc:  # noqa: BLE001
            logger.exception("volc_to_browser failed")

    try:
        if not API_KEY:
            await ws.send_json({"type": "error", "detail": "后端未配置 VOLC_DUPLEX_API_KEY 环境变量"})
            await ws.close()
            return

        async with websockets.connect(
            VOLC_URL,
            additional_headers={"X-Api-Key": API_KEY},
            open_timeout=15,
        ) as upstream:
            logger.info("[Volc] connected")
            create = build_session_create(session_id)
            logger.info("[Volc↑] %s", json.dumps(create, ensure_ascii=False)[:400])
            await upstream.send(json.dumps(create, ensure_ascii=False))
            await asyncio.gather(
                browser_to_volc(upstream),
                volc_to_browser(upstream),
            )
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # noqa: BLE001
        logger.exception("call failed")
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
