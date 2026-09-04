# Media workflow

Use this only when the person needs generated or newly processed media.

## Editorial text

Give the writing model four separate inputs: confirmed facts, uncertain recollections, preserved quotations, and forbidden inventions. Request structured JSON before placing prose in the website. Review every date, place, relationship, and quotation against the approved source. DeepSeek may be used for drafting, but the reviewed record remains authoritative.

## Life film

Plan four to six chronological shots. Each shot should specify the person's age, stable facial features and clothing cues, period and location, physical actions, camera movement, and forbidden artifacts. For the warm New Chinese example, use restrained hand-painted 2.5D animation, warm ivory light, muted jade and tea-brown colours, fluid full-body action, and no text or watermark.

MiniMax H3 can create continuous animated shots. Use an earlier successful shot as a character and style reference when the service supports reference video. Generate short shots separately, inspect their beginning, middle, and end frames, then assemble them with narration, quiet environment sound, and captions. Stop on insufficient balance or repeated generation failure; do not spend again without the user's direction.

## Voice archive

Describe age, gender presentation, regional character, pace, intimacy, breath, and unwanted performance traits. Audition a short neutral passage before rendering the full narration. Voice A in the example is a warm elderly Mandarin voice: clear, slower, affectionate, lightly aged, and free of advertising or broadcast delivery.

Never clone or imitate an identifiable person's voice without their explicit consent. Store API keys only in `.env.local`; exclude that file from every handoff and archive.

## Upstream dialect recognition

Speech recognition and dialect transcription are upstream of this skill. Require a reviewed transcript before archival writing. Preserve the original audio, transcript, language label, confidence or correction notes, and the speaker's approval when Cantonese, Teochew, or another dialect is involved.
