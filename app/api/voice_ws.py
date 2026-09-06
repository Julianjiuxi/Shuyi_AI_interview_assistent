"""ShuYi 语音通话中继 —— 火山引擎端到端实时语音（全双工 3.0 Seeduplex）。

协议要点（以官方文档 2549778 为准）：
- URL: wss://openspeech.bytedance.com/api/v3/duplex/realtime/dialogue
- 鉴权: 请求头 X-Api-Key（新版控制台 API Key）
- model 固定 1.2.6.1
- 纯 JSON 文本帧，音频数据 Base64 编码内嵌于事件的 audio / delta 字段，不走二进制通道

本服务做的事：
1. 浏览器连 ws://host/api/ws/call/{project_id}，本服务注入 X-Api-Key 后转接火山，避免 Key 暴露在前端。
2. 从数据库读取该 project 的人物档案，动态拼出 ShuYi Interview 约束作为 session.create 的
   instructions，让「电话里的 AI」与纯文字 RT 聊天使用同一套访谈人格。
3. 把浏览器发来的标准上行 JSON 事件透传给火山，把火山下行 JSON 事件透传回浏览器，并打印日志便于排错。
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid

import websockets
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.entities import BiographyProject, InterviewSession, Memory, Utterance
from app.models.schemas import ExtractionResult
from app.prompts.memory_extractor import MEMORY_EXTRACTOR_SYSTEM, build_memory_extractor_user
from app.services.deepseek_client import DeepSeekClient

logger = logging.getLogger("shuyi.voice")

router = APIRouter()

VOLC_URL = "wss://openspeech.bytedance.com/api/v3/duplex/realtime/dialogue"
MODEL_VERSION = "1.2.6.1"  # 全双工版本固定值

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


def _load_project(project_id: int) -> BiographyProject | None:
    with SessionLocal() as db:
        return db.get(BiographyProject, project_id)


def _build_instructions(project: BiographyProject) -> str:
    name = project.chinese_name or project.display_name or project.subject_name or "这位讲述者"
    chinese_name = project.chinese_name or project.subject_name or name
    birth_year = str(project.birth_year) if project.birth_year else "年份不详"
    birth_place = project.birth_place or "不详"
    intro = project.short_bio or "背景信息暂缺，请在访谈中自然了解"
    return INSTRUCTIONS_TEMPLATE.format(
        rules=INTERVIEW_RULES.strip(),
        name=name,
        chinese_name=chinese_name,
        birth_year=birth_year,
        birth_place=birth_place,
        intro=intro,
    )


def _build_session_create(session_id: str, instructions: str) -> dict:
    """全双工 3.0 的 session.create（JSON 文本帧，无二进制封装）。"""
    return {
        "type": "session.create",
        "session": {
            "id": session_id,
            "model": MODEL_VERSION,
            "instructions": instructions,
            "audio": {
                "input": {"format": {"type": "pcm", "rate": 16000}},
                "output": {"format": {"type": "ogg_opus", "rate": 24000}},
            },
            "voice": settings.volc_duplex_voice,
        },
    }


VALID_MEMORY_TYPES = {
    "person", "event", "place", "date", "value", "emotion", "relationship",
}


def _clean(text: str) -> str:
    return " ".join(text.split())


def _latest_session(db, project_id: int) -> InterviewSession:
    session = db.scalars(
        select(InterviewSession)
        .where(InterviewSession.project_id == project_id)
        .order_by(InterviewSession.id.desc())
    ).first()
    if session is None:
        session = InterviewSession(project_id=project_id)
        db.add(session)
        db.flush()
    return session


def _store_memories(project_id: int, storyteller_utterances: list[tuple[int, str]]) -> None:
    """对语音里受访者说出的每段话做记忆抽取，复用文字访谈的 Memory Extractor。"""
    if not storyteller_utterances:
        return
    llm = DeepSeekClient()
    with SessionLocal() as db:
        for utterance_id, text in storyteller_utterances:
            try:
                raw = llm.json_completion(
                    MEMORY_EXTRACTOR_SYSTEM,
                    build_memory_extractor_user(text),
                    max_tokens=900,
                    model=settings.deepseek_interview_model,
                    thinking="disabled",
                    task="memory",
                )
                for mem in raw.get("memories", []):
                    if isinstance(mem, dict) and mem.get("memory_type") not in VALID_MEMORY_TYPES:
                        mem["memory_type"] = "event"
                extraction = ExtractionResult.model_validate(raw)
                for item in extraction.memories:
                    db.add(
                        Memory(
                            project_id=project_id,
                            source_utterance_id=utterance_id,
                            memory_type=item.memory_type,
                            title=item.title,
                            content=item.content,
                            life_stage=item.life_stage,
                            approx_year=item.approx_year,
                            approx_age=item.approx_age,
                            location=item.location,
                            people_json=json.dumps(item.people, ensure_ascii=False),
                            tags_json=json.dumps(item.tags, ensure_ascii=False),
                            importance=item.importance,
                            emotional_intensity=item.emotional_intensity,
                            confidence=item.confidence,
                            unresolved_json=json.dumps(item.unresolved_points, ensure_ascii=False),
                        )
                    )
            except Exception:  # noqa: BLE001
                logger.exception("voice memory extraction failed for utterance %s", utterance_id)
        db.commit()


def _persist_transcript(project_id: int, turns: list[tuple[str, str]]) -> None:
    """把通话期间收集到的 (role, text) 对话写入最新会话，并抽取记忆。

    turns 顺序即时间顺序；role 为 storyteller（受访者）或 interviewer（AI 访谈员）。
    先落库 Utterance 并 commit，再单独抽记忆，保证前端挂断后刷新能尽快看到对话记录。
    """
    if not turns:
        return

    storyteller_utterances: list[tuple[int, str]] = []
    with SessionLocal() as db:
        session = _latest_session(db, project_id)
        for role, text in turns:
            text = _clean(text)
            if not text:
                continue
            utter = Utterance(session_id=session.id, role=role, text=text)
            db.add(utter)
            db.flush()
            if role == "storyteller":
                storyteller_utterances.append((utter.id, text))
        db.commit()

    _store_memories(project_id, storyteller_utterances)


@router.websocket("/ws/call/{project_id}")
async def call_endpoint(ws: WebSocket, project_id: int):
    await ws.accept()
    session_id = str(uuid.uuid4())

    project = _load_project(project_id)
    if project is None:
        await ws.send_json({"type": "error", "detail": f"project {project_id} 不存在"})
        await ws.close()
        return

    instructions = _build_instructions(project)

    turns: list[tuple[str, str]] = []
    ai_parts: list[str] = []

    def _collect_transcript(raw: str) -> None:
        """从火山下行事件中抽取最终文本，按时间顺序沉淀为 (role, text) 轮次。"""
        try:
            obj = json.loads(raw)
        except Exception:
            return
        t = obj.get("type")
        if t == "conversation.item.input_audio_transcription.completed":
            text = (obj.get("text") or obj.get("delta") or "").strip()
            if text:
                if turns and turns[-1][0] == "storyteller":
                    turns[-1] = ("storyteller", _clean(turns[-1][1] + " " + text))
                else:
                    turns.append(("storyteller", text))
        elif t == "response.output_text.delta":
            ai_parts.append(obj.get("delta") or obj.get("text") or "")
        elif t == "response.output_text.done":
            text = "".join(ai_parts).strip()
            ai_parts.clear()
            if not text:
                text = (obj.get("text") or "").strip()
            if text:
                turns.append(("interviewer", text))

    async def browser_to_volc(upstream):
        try:
            while True:
                data = await ws.receive()
                text = None
                if "text" in data and data["text"] is not None:
                    text = data["text"]
                elif "bytes" in data and data["bytes"] is not None:
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
                    _collect_transcript(evt)
                    logger.info("[Volc↓] %s", evt[:400])
                    await ws.send_text(evt)
                elif isinstance(evt, bytes):
                    logger.info("[Volc↓] binary %d bytes", len(evt))
                    await ws.send_bytes(evt)
        except Exception as exc:  # noqa: BLE001
            logger.exception("volc_to_browser failed")

    try:
        if not settings.volc_duplex_api_key:
            await ws.send_json({"type": "error", "detail": "后端未配置 VOLC_DUPLEX_API_KEY 环境变量"})
            await ws.close()
            return

        async with websockets.connect(
            VOLC_URL,
            additional_headers={"X-Api-Key": settings.volc_duplex_api_key},
            open_timeout=15,
        ) as upstream:
            logger.info("[Volc] connected (project=%s)", project_id)
            create = _build_session_create(session_id, instructions)
            logger.info("[Volc↑] %s", json.dumps(create, ensure_ascii=False)[:400])
            await upstream.send(json.dumps(create, ensure_ascii=False))

            # 两条链路任一先结束（通常是浏览器挂断）就尽快收尾，否则 gather 会
            # 一直卡在 volc_to_browser 上等火山关闭，导致 finally 迟迟不落库。
            browser_task = asyncio.create_task(browser_to_volc(upstream))
            volc_task = asyncio.create_task(volc_to_browser(upstream))
            done, pending = await asyncio.wait(
                {browser_task, volc_task},
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()
            if pending:
                await asyncio.gather(*pending, return_exceptions=True)
            # 通知火山结束会话，并让 volc_to_browser 尽快退出
            try:
                await upstream.send(json.dumps({"type": "session.close"}, ensure_ascii=False))
            except Exception:
                pass
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # noqa: BLE001
        logger.exception("voice call failed")
        try:
            await ws.send_json({"type": "error", "detail": f"{type(exc).__name__}: {exc}"})
        except Exception:
            pass
    finally:
        # 兜底：若挂断时 AI 最后一句还没收到 done，也把已累积文本计入
        if ai_parts:
            text = "".join(ai_parts).strip()
            if text:
                turns.append(("interviewer", text))
        if turns:
            try:
                await asyncio.to_thread(_persist_transcript, project_id, turns)
            except Exception:  # noqa: BLE001
                logger.exception("persist voice transcript failed")
        try:
            await ws.close()
        except Exception:
            pass
