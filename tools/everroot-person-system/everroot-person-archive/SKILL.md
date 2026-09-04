---
name: everroot-person-archive
description: Create or update an Everroot family profile from approved conversation records, including a factual timeline, literary life story, cross-generational letter, portrait, voice, video, and installation into the reusable Everroot website. Use when a new person must be added to or substituted into the family archive; do not use for raw speech recognition or unreviewed biographical inference.
---

# Everroot Person Archive

Build a complete archive around one person without binding the workflow to Lin Meizhen or any other fixed name.

## Required input

Start from a person JSON matching [references/person-schema.md](references/person-schema.md). If the user provides conversation text instead, first separate confirmed facts, uncertain recollections, direct quotations, and passages the person has withheld. Never infer the content of a private or removed passage.

Use [assets/person-template.json](assets/person-template.json) when starting a new record. Use the Lin Meizhen example supplied beside this skill only as a structural example, never as a source of facts for another person.

## Workflow

1. Preserve the person's preferred display name and use one lowercase, hyphenated `id` consistently. Treat years, relationships, places, and direct quotations as factual claims that require support in the approved record.
2. Write the profile and timeline in clear, restrained language. Mark uncertainty openly. The complete story may be literary, but its events, dialogue, chronology, and relationships must not exceed the approved facts.
3. Write the family letter as an interpretation of confirmed memories, not as evidence that an unrecorded event occurred. Keep multiple relatives' perspectives separate and attributed.
4. If media must be generated, read [references/media-workflow.md](references/media-workflow.md). Obtain the user's authority before paid generation, voice cloning, or external publishing. Keep credentials out of the archive.
   Reuse [scripts/media-api-client.mjs](scripts/media-api-client.mjs) when direct DeepSeek or MiniMax calls are needed; its exported method names are stable and person-agnostic.
5. Install or replace the profile with the deterministic helper:

   `node scripts/install-person.mjs --input /absolute/path/person.json --site /absolute/path/website --featured`

   Add `--replace` only when the same `id` is intentionally being updated. The helper validates the record, copies declared media into `public/archive/<id>/`, rewrites browser paths, and updates `data/people.json`.
6. Build the website after installation. Fix schema or media-path errors; do not silently remove missing content. Deploy only when the user explicitly requests publishing.

## Output requirements

The selected person's page must change as a complete unit: portrait and status, relationships, factual profile, interests and small details, timeline, attributed family perspectives, full story, life film, cross-generational letter, and voice archive. A missing optional film or recording should show the website's honest empty state rather than another person's media.
