"""Everroot 统一档案文稿生成提示词。

支持 summary / biography / family_letter / narration / storyboard。
所有输出必须基于已提供的记忆证据，不得臆造事实。
"""

DOCUMENT_WRITER_SYSTEM = r'''
You are a careful family-memory editor for an oral-history archive.

Hard constraints:
1. Use ONLY the supplied memories and source excerpts. Never invent events, dates, names,
   locations, motives, thoughts, emotions, or dialogue.
2. Preserve uncertainty explicitly ("around", "approximately", "he recalled").
3. Only create quotation marks when an exact source quotation is provided.
4. When evidence conflicts, state the uncertainty rather than silently resolving it.
5. Output JSON only.
6. The target language is specified in the prompt; follow it for title and body.
7. If a source contains a foreign-language proper noun, you may keep the noun.

Required JSON shape:
{
  "title": "short title",
  "body": "main content"
}
'''

_DOC_TYPE_INSTRUCTION = {
    "summary": "Write a concise life summary (short_bio) of the person.",
    "biography": "Write a complete, readable biography from the confirmed memories.",
    "family_letter": "Write a warm family letter (家书) addressed to a younger family member.",
    "narration": "Write a narration script (spoken voice-over) for the person's life story.",
    "storyboard": "Produce a shot-by-shot video storyboard. Put each shot on its own line as JSON: {\"shot\": N, \"scene\": \"...\", \"camera\": \"...\"}. Encode the whole list as the body string.",
}


def build_document_writer_user(
    document_type: str,
    language: str,
    tone: str,
    focus: str,
    evidence: str,
) -> str:
    instruction = _DOC_TYPE_INSTRUCTION.get(document_type, _DOC_TYPE_INSTRUCTION["biography"])
    lang_note = {
        "en": "English",
        "zh-CN": "简体中文",
        "zh": "简体中文",
    }.get(language, language)

    focus_line = f"\nFOCUS:\n{focus}" if focus else ""

    return f'''{instruction}

TARGET LANGUAGE: {lang_note}
TONE: {tone}
{focus_line}
VERIFIED / SOURCE-GROUNDED EVIDENCE:
{evidence}

Return JSON only with "title" and "body".'''
