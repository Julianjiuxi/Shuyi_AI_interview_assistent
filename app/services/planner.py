from __future__ import annotations

from collections import Counter
from dataclasses import dataclass

from app.models.schemas import CandidateQuestion


LIFE_STAGES = [
    "childhood",
    "education",
    "early_adulthood",
    "career",
    "family",
    "later_life",
    "turning_point",
    "values",
    "historical_context",
]


@dataclass(frozen=True)
class PlannerWeights:
    information_gain: float = 0.28
    emotional_value: float = 0.16
    narrative_value: float = 0.22
    novelty: float = 0.14
    coverage_gap: float = 0.20
    sensitivity_penalty: float = 0.22
    repetition_penalty: float = 0.28


class InterviewPlanner:
    """Deterministic ranking layer for LLM-generated candidate questions.

    DeepSeek proposes candidates, but this class controls which candidate wins.
    This makes planner behavior inspectable and tunable.
    """

    def __init__(self, weights: PlannerWeights | None = None) -> None:
        self.weights = weights or PlannerWeights()

    @staticmethod
    def compute_coverage(memory_stages: list[str]) -> dict[str, float]:
        counts = Counter(stage for stage in memory_stages if stage in LIFE_STAGES)
        # A deliberately simple saturation curve for MVP:
        # 0 records -> 0.0, 1 -> .25, 2 -> .50, 3 -> .75, >=4 -> 1.0
        return {stage: min(counts.get(stage, 0) / 4.0, 1.0) for stage in LIFE_STAGES}

    def score(self, candidate: CandidateQuestion, coverage: dict[str, float]) -> float:
        w = self.weights
        gap = 1.0 - coverage.get(candidate.target_stage, 0.0)
        positive = (
            w.information_gain * candidate.information_gain
            + w.emotional_value * candidate.emotional_value
            + w.narrative_value * candidate.narrative_value
            + w.novelty * candidate.novelty
            + w.coverage_gap * gap
        )
        negative = (
            w.sensitivity_penalty * candidate.sensitivity_risk
            + w.repetition_penalty * candidate.repetition_risk
        )
        return round(positive - negative, 4)

    def choose(self, candidates: list[CandidateQuestion], coverage: dict[str, float]) -> tuple[CandidateQuestion, list[dict]]:
        if not candidates:
            fallback = CandidateQuestion(
                question="What is one memory from that period that still feels vivid to you?",
                target_stage="unknown",
                reason="Fallback because the model returned no valid candidates.",
                information_gain=0.6,
                emotional_value=0.6,
                narrative_value=0.7,
                novelty=0.7,
                sensitivity_risk=0.1,
                repetition_risk=0.1,
            )
            return fallback, [{"question": fallback.question, "score": 0.0, "fallback": True}]

        ranked = sorted(
            [(candidate, self.score(candidate, coverage)) for candidate in candidates],
            key=lambda x: x[1],
            reverse=True,
        )
        debug = [
            {
                "question": c.question,
                "target_stage": c.target_stage,
                "reason": c.reason,
                "score": score,
            }
            for c, score in ranked
        ]
        return ranked[0][0], debug
