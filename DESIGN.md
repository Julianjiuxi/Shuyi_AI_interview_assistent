# Shuyi MVP Technical Design

## 1. Database fields

### biography_projects
- id
- subject_name
- created_at

### interview_sessions
- id
- project_id
- started_at
- ended_at
- session_summary

### utterances
- id
- session_id
- role
- text
- audio_url
- created_at

### memories
- id
- project_id
- source_utterance_id
- memory_type
- title
- content
- life_stage
- approx_year
- approx_age
- location
- people_json
- tags_json
- importance
- emotional_intensity
- confidence
- confirmed
- unresolved_json
- created_at

### chapters
- id
- project_id
- title
- body
- source_memory_ids_json
- created_at

## 2. Why source_utterance_id matters

Every extracted fact should remain traceable to the storyteller's original answer. This supports:
- hallucination auditing;
- user correction;
- future citation/highlight UI;
- regenerating prose without losing provenance.

## 3. Three DeepSeek prompts

### Prompt A: Memory Extractor
Input: one storyteller answer.
Output: structured memories and unresolved points.

### Prompt B: Candidate Question Generator
Input: life-stage coverage, structured memories, recent dialogue.
Output: 3-5 candidate follow-up questions plus scores estimated by the LLM.

### Prompt C: Biography Writer
Input: selected memories plus source excerpts.
Output: one grounded chapter. No invented details.

## 4. Interview Planner algorithm

The LLM proposes candidate questions, but Python chooses the winner.

For candidate q:

score(q) =
0.28 * information_gain
+ 0.16 * emotional_value
+ 0.22 * narrative_value
+ 0.14 * novelty
+ 0.20 * coverage_gap
- 0.22 * sensitivity_risk
- 0.28 * repetition_risk

coverage_gap = 1 - coverage[target_stage]

Life-stage coverage is intentionally simple for V0:
- 0 memories -> 0.00
- 1 -> 0.25
- 2 -> 0.50
- 3 -> 0.75
- 4+ -> 1.00

Why this hybrid design:
- pure LLM follow-up generation is difficult to inspect;
- pure rules create robotic interviews;
- hybrid planning lets the LLM generate natural ideas while Python enforces product priorities.

## 5. Future planner improvements

V0.2 can add:
- unresolved-point bonus;
- entity novelty bonus;
- chronology-gap bonus;
- question semantic-similarity penalty using embeddings;
- user preference / skipped-topic penalties;
- topic cooldown;
- explicit confirmation questions when confidence is low;
- a separate safety/sensitivity classifier.

## 6. Recommended text-first milestone

Do not add speech until this passes a 10-turn manual interview test:
- no obvious repeated questions;
- at least 70% of questions refer to actual prior content;
- major events receive deeper follow-up;
- uncovered life stages gradually receive attention;
- no invented memories in generated chapters.
