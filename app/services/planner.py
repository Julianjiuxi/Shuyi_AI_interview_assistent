from __future__ import annotations

from collections import Counter
from dataclasses import dataclass

from app.models.schemas import CandidateDialogueMove, ConversationState


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
    # 连贯性优先：focus + storyteller 权重远高于 coverage。
    focus_alignment: float = 0.26
    narrative_value: float = 0.18
    emotional_value: float = 0.12
    information_gain: float = 0.12
    storyteller_alignment: float = 0.12
    conversational_naturalness: float = 0.10
    novelty: float = 0.05
    coverage_gap: float = 0.05

    sensitivity_penalty: float = 0.20
    repetition_penalty: float = 0.20
    forced_transition_penalty: float = 0.35
    interrogation_penalty: float = 0.15


class InterviewPlanner:
    """Deterministic control layer for LLM-generated candidate dialogue moves.

    DeepSeek proposes candidate moves and a conversation state, but this class
    decides which move wins. Coverage is only a navigation signal — it is gated
    by the current conversation state, never a hard steering force.
    """

    def __init__(self, weights: PlannerWeights | None = None) -> None:
        self.weights = weights or PlannerWeights()

    @staticmethod
    def compute_coverage(memory_stages: list[str]) -> dict[str, float]:
        """宏观接触程度，不再是"是否聊透/是否该停止"。

        0 = untouched, 0.4 = touched (1-2), 0.7 = established (3+).
        刻意不产生 1.0：再高也不能阻止讲述者继续讲这个阶段。
        """
        counts = Counter(stage for stage in memory_stages if stage in LIFE_STAGES)
        coverage: dict[str, float] = {}
        for stage in LIFE_STAGES:
            count = counts.get(stage, 0)
            if count == 0:
                coverage[stage] = 0.0
            elif count <= 2:
                coverage[stage] = 0.4
            else:
                coverage[stage] = 0.7
        return coverage

    @staticmethod
    def compute_question_streak(recent_utterances: list) -> int:
        """统计最近连续的 interviewer 问句数量（storyteller 回答不打断）。"""
        streak = 0
        for utterance in reversed(recent_utterances):
            if getattr(utterance, "role", None) != "interviewer":
                continue
            text = (getattr(utterance, "text", "") or "").strip()
            if text.endswith(("?", "？")):
                streak += 1
            else:
                break
        return streak

    def filter_candidates(
        self,
        candidates: list[CandidateDialogueMove],
        state: ConversationState,
    ) -> list[CandidateDialogueMove]:
        """硬门控：明显不该换话题时，直接剔除换题候选，不进入评分。"""
        eligible = list(candidates)

        # 用户明确想留在当前话题：禁止任何换新主题。
        if state.user_focus_lock:
            same_or_adjacent = [
                c
                for c in eligible
                if c.topic_relation in {"same", "adjacent"} and c.act_type != "transition"
            ]
            if same_or_adjacent:
                return same_or_adjacent

        # 当前故事仍有明显叙事动量：coverage 不准抢方向。
        if state.focus_strength >= 0.65 and state.closure_signal < 0.55:
            same_topic = [
                c
                for c in eligible
                if c.topic_relation != "new" and c.act_type != "transition"
            ]
            if same_topic:
                return same_topic

        return eligible

    def score(
        self,
        candidate: CandidateDialogueMove,
        coverage: dict[str, float],
        state: ConversationState,
        question_streak: int = 0,
    ) -> float:
        w = self.weights

        gap = 1.0 - coverage.get(candidate.target_stage, 0.0)
        # coverage 只有在当前话题自然收尾后才真正介入。
        transition_readiness = state.closure_signal
        coverage_bonus = gap * transition_readiness

        positive = (
            w.focus_alignment * candidate.focus_alignment
            + w.narrative_value * candidate.narrative_value
            + w.emotional_value * candidate.emotional_value
            + w.information_gain * candidate.information_gain
            + w.storyteller_alignment * candidate.storyteller_alignment
            + w.conversational_naturalness * candidate.conversational_naturalness
            + w.novelty * candidate.novelty
            + w.coverage_gap * coverage_bonus
        )

        # 第二层保险：硬门控漏网时，强行换题仍被重罚。
        forced_transition = 0.0
        if (
            candidate.topic_relation == "new"
            and state.focus_strength >= 0.65
            and state.closure_signal < 0.55
        ):
            forced_transition = 1.0

        # 连续问句后，避免再来一个纯问句（clarify 的必要澄清可减免）。
        interrogation_penalty = 0.0
        if question_streak >= 2 and candidate.form == "question":
            interrogation_penalty = 1.0
            if candidate.act_type == "clarify":
                interrogation_penalty *= 0.4

        negative = (
            w.sensitivity_penalty * candidate.sensitivity_risk
            + w.repetition_penalty * candidate.repetition_risk
            + w.forced_transition_penalty * forced_transition
            + w.interrogation_penalty * interrogation_penalty
        )

        return round(positive - negative, 4)

    def choose(
        self,
        candidates: list[CandidateDialogueMove],
        coverage: dict[str, float],
        state: ConversationState,
        question_streak: int = 0,
    ) -> tuple[CandidateDialogueMove, list[dict]]:
        if not candidates:
            fallback = CandidateDialogueMove(
                utterance="那段时间里，还有哪些让您印象特别深刻的记忆呢？",
                act_type="invite_continue",
                form="invitation",
                topic_relation="same",
                target_stage="unknown",
                reason="模型未返回有效候选时的兜底回应。",
                focus_alignment=0.7,
                storyteller_alignment=0.7,
                conversational_naturalness=0.7,
                information_gain=0.6,
                emotional_value=0.6,
                narrative_value=0.7,
                novelty=0.7,
                sensitivity_risk=0.1,
                repetition_risk=0.1,
            )
            return fallback, [{"utterance": fallback.utterance, "score": 0.0, "fallback": True}]

        ranked = sorted(
            [(c, self.score(c, coverage, state, question_streak)) for c in candidates],
            key=lambda x: x[1],
            reverse=True,
        )
        debug = [
            {
                "utterance": c.utterance,
                "act_type": c.act_type,
                "form": c.form,
                "topic_relation": c.topic_relation,
                "target_stage": c.target_stage,
                "reason": c.reason,
                "score": score,
            }
            for c, score in ranked
        ]
        return ranked[0][0], debug
