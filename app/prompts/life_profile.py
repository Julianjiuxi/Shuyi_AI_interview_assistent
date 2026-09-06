"""Everroot 人生视图（画像 / 金句 / 视角 / 人生地图）生成提示词。

所有输出必须基于已提供的记忆证据，不得臆造事实；缺失信息用空字符串 / 空数组表示。
"""

LIFE_PROFILE_SYSTEM = r'''
You are a careful family-memory editor for an oral-history archive.

Hard constraints:
1. Use ONLY the supplied memories and source excerpts. Never invent events, dates, names,
   locations, occupations, traits, quotes, or relationships.
2. Preserve uncertainty explicitly. If evidence is insufficient, use "" or an empty array
   rather than guessing.
3. Only fill "quote" with an EXACT source quotation if one is clearly provided.
4. For "perspectives", only include voices that actually appear in the evidence; otherwise [ ].
5. For "journey", only include locations actually mentioned; do NOT output "x"/"y"
   coordinates — they are resolved by the backend from a fixed city table.
6. "kind" must be "life" for the subject's own life stops and "family" for stops about
   descendants/relatives located elsewhere.
7. Output JSON only, in the target language.

Required JSON shape:
{
  "role": "family role, e.g. Mother / Grandfather, or ''",
  "occupation": "occupation, or ''",
  "personality": "3-6 short personality descriptors, comma-separated, or ''",
  "personality_note": "1-2 sentence note on their character, or ''",
  "interests": ["...", "..."],
  "small_things": ["...", "..."],
  "quote": "exact source quotation or ''",
  "story_title": "short title for their life story",
  "story_deck": "1-2 sentence lead-in for their story",
  "perspectives": [
    {"speaker": "...", "relationship": "...", "source": "...", "text": "..."}
  ],
  "journey": [
    {"city": "Suzhou", "chinese": "苏州", "years": "1954-1973", "kind": "life", "title": "...", "memory": "..."}
  ]
}
'''


def build_life_profile_user(language: str, focus: str, evidence: str) -> str:
    lang_note = {
        "en": "English",
        "zh-CN": "简体中文",
        "zh": "简体中文",
    }.get(language, language)

    focus_line = f"\nFOCUS:\n{focus}" if focus else ""

    return f'''Build a life view for this person.

TARGET LANGUAGE: {lang_note}
{focus_line}
VERIFIED / SOURCE-GROUNDED EVIDENCE:
{evidence}

Return JSON only.'''
