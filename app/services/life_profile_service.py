from __future__ import annotations

import json
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import BiographyProject, LifeProfile, Memory
from app.models.schemas import LifeViewGenerateRequest
from app.prompts.life_profile import LIFE_PROFILE_SYSTEM, build_life_profile_user
from app.services.deepseek_client import DeepSeekClient

# 城市近似坐标（x: 西→东，y: 北→南，0-100）。仅用于人生地图打点，
# 避免让 LLM 自行估算坐标导致同一地点每次位置漂移。未收录的地点不画点。
CITY_COORDS: dict[str, tuple[int, int]] = {
    "北京": (55, 22), "Beijing": (55, 22),
    "上海": (68, 42), "Shanghai": (68, 42),
    "广州": (60, 78), "Guangzhou": (60, 78),
    "深圳": (62, 82), "Shenzhen": (62, 82),
    "临沂": (52, 40), "Linyi": (52, 40),
    "济南": (50, 34), "Jinan": (50, 34),
    "南京": (60, 46), "Nanjing": (60, 46),
    "杭州": (64, 50), "Hangzhou": (64, 50),
    "苏州": (66, 46), "Suzhou": (66, 46),
    "成都": (38, 55), "Chengdu": (38, 55),
    "武汉": (50, 55), "Wuhan": (50, 55),
    "西安": (42, 42), "Xi'an": (42, 42),
    "郑州": (48, 42), "Zhengzhou": (48, 42),
    "青岛": (58, 32), "Qingdao": (58, 32),
    "香港": (63, 86), "Hong Kong": (63, 86),
    "台北": (66, 62), "Taipei": (66, 62),
    "新加坡": (70, 95), "Singapore": (70, 95),
    "东京": (82, 48), "Tokyo": (82, 48),
    "首尔": (76, 34), "Seoul": (76, 34),
}


def _lookup_coord(city: str, chinese: str) -> tuple[int, int] | None:
    for key in (city, chinese):
        if key and key in CITY_COORDS:
            return CITY_COORDS[key]
    return None


def _build_evidence(memories: list[Memory]) -> str:
    lines = []
    for m in memories:
        source = m.source_utterance.text if m.source_utterance else ""
        lines.append(
            f"MEMORY {m.id}: {m.content}\n"
            f"metadata: year={m.approx_year}, age={m.approx_age}, location={m.location}, confidence={m.confidence}\n"
            f"source excerpt: {source}"
        )
    return "\n\n".join(lines)


def _as_str(value) -> str:
    return str(value).strip() if value is not None else ""


def _as_str_list(value) -> list[str]:
    if isinstance(value, list):
        return [str(x).strip() for x in value if str(x).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _normalize_perspectives(value) -> list[dict]:
    out: list[dict] = []
    if not isinstance(value, list):
        return out
    for p in value:
        if not isinstance(p, dict):
            continue
        speaker = _as_str(p.get("speaker"))
        text = _as_str(p.get("text"))
        if not speaker and not text:
            continue
        out.append(
            {
                "speaker": speaker,
                "relationship": _as_str(p.get("relationship")),
                "source": _as_str(p.get("source")),
                "text": text,
            }
        )
    return out


def _normalize_journey(value) -> list[dict]:
    out: list[dict] = []
    if not isinstance(value, list):
        return out
    for s in value:
        if not isinstance(s, dict):
            continue
        city = _as_str(s.get("city"))
        chinese = _as_str(s.get("chinese"))
        title = _as_str(s.get("title"))
        memory = _as_str(s.get("memory"))
        if not city and not title:
            continue
        coord = _lookup_coord(city, chinese)
        if coord is None:
            # 未收录的地点无法可靠定位，跳过不画点，避免错误坐标误导。
            continue
        kind = "family" if str(s.get("kind")) == "family" else "life"
        out.append(
            {
                "city": city,
                "chinese": chinese,
                "years": _as_str(s.get("years")),
                "kind": kind,
                "x": coord[0],
                "y": coord[1],
                "title": title,
                "memory": memory,
            }
        )
    return out


def _normalize(raw: dict, is_draft: bool = False) -> dict:
    return {
        "role": _as_str(raw.get("role")),
        "occupation": _as_str(raw.get("occupation")),
        "personality": _as_str(raw.get("personality")),
        "personality_note": _as_str(raw.get("personality_note")),
        "interests": _as_str_list(raw.get("interests")),
        "small_things": _as_str_list(raw.get("small_things")),
        "quote": _as_str(raw.get("quote")),
        "story_title": _as_str(raw.get("story_title")),
        "story_deck": _as_str(raw.get("story_deck")),
        "perspectives": _normalize_perspectives(raw.get("perspectives")),
        "journey": _normalize_journey(raw.get("journey")),
        "is_draft": is_draft,
        "generated_at": datetime.utcnow().isoformat(),
    }


class LifeProfileService:
    def __init__(self, db: Session, llm: DeepSeekClient | None = None) -> None:
        self.db = db
        self.llm = llm or DeepSeekClient()

    def get(self, project_id: int) -> dict | None:
        row = self.db.scalars(select(LifeProfile).where(LifeProfile.project_id == project_id)).first()
        if not row:
            return None
        try:
            data = json.loads(row.profile_json or "{}")
            return data if isinstance(data, dict) else None
        except (json.JSONDecodeError, TypeError):
            return None

    def generate(self, project_id: int, request: LifeViewGenerateRequest) -> dict:
        project = self.db.get(BiographyProject, project_id)
        if not project:
            raise ValueError("Project not found")

        query = select(Memory).where(Memory.project_id == project_id)
        if request.only_confirmed_memories:
            query = query.where(Memory.status == "confirmed")
        else:
            # RT 草稿预览：仅排除被明确否决的记忆，允许 extracted / review 阶段参与归纳。
            query = query.where(Memory.status != "rejected")
        memories = list(self.db.scalars(query.order_by(Memory.importance.desc(), Memory.id.asc())))
        if not memories:
            raise ValueError("暂无可用记忆，请先完成几轮访谈")

        evidence = _build_evidence(memories)
        raw = self.llm.json_completion(
            LIFE_PROFILE_SYSTEM,
            build_life_profile_user(request.language, "", evidence),
            max_tokens=1200,
            model=settings.deepseek_interview_model,
            thinking="disabled",
            task="life_profile",
        )
        is_draft = not request.only_confirmed_memories
        profile = _normalize(raw if isinstance(raw, dict) else {}, is_draft=is_draft)

        row = self.db.scalars(select(LifeProfile).where(LifeProfile.project_id == project_id)).first()
        if not row:
            row = LifeProfile(project_id=project_id)
            self.db.add(row)
        row.profile_json = json.dumps(profile, ensure_ascii=False)
        row.language = request.language
        row.model_provider = "deepseek"
        row.model_name = settings.deepseek_interview_model
        row.prompt_version = "life_profile_v1"
        self.db.commit()

        return profile
