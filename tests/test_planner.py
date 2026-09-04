from app.models.schemas import CandidateDialogueMove, ConversationState
from app.services.planner import InterviewPlanner


def move(
    utterance,
    act_type="deepen",
    form="question",
    topic_relation="same",
    stage="education",
    focus=0.9,
    storyteller=0.9,
    natural=0.9,
    info=0.7,
    emo=0.7,
    narrative=0.8,
    novelty=0.7,
    sensitivity=0.1,
    repetition=0.1,
):
    return CandidateDialogueMove(
        utterance=utterance,
        act_type=act_type,
        form=form,
        topic_relation=topic_relation,
        target_stage=stage,
        reason="test",
        focus_alignment=focus,
        storyteller_alignment=storyteller,
        conversational_naturalness=natural,
        information_gain=info,
        emotional_value=emo,
        narrative_value=narrative,
        novelty=novelty,
        sensitivity_risk=sensitivity,
        repetition_risk=repetition,
    )


def state(focus_strength=0.5, closure=0.5, focus_lock=False, storyteller_lead=0.5):
    return ConversationState(
        focus_strength=focus_strength,
        storyteller_lead=storyteller_lead,
        closure_signal=closure,
        user_focus_lock=focus_lock,
    )


def test_compute_coverage_never_saturates():
    planner = InterviewPlanner()
    coverage = planner.compute_coverage(["education"] * 10 + ["career"])
    # 宏观接触程度：established 不再等于 1.0，仍允许继续讲。
    assert coverage["education"] == 0.7
    assert coverage["career"] == 0.4
    assert coverage["childhood"] == 0.0


def test_focus_lock_filters_out_new_topics():
    planner = InterviewPlanner()
    same = move("继续讲讲父亲送您上学那段。", topic_relation="same")
    new = move("那您第一份工作是什么？", act_type="transition", topic_relation="new", stage="career")
    st = state(focus_strength=0.9, closure=0.1, focus_lock=True)
    eligible = planner.filter_candidates([same, new], st)
    assert eligible == [same]


def test_coverage_does_not_steer_when_focus_is_strong():
    planner = InterviewPlanner()
    coverage = {"education": 0.7, "career": 0.0}
    stay = move(
        "父亲那一路的沉默，您后来是怎么理解的？",
        act_type="deepen", form="question", topic_relation="same", stage="education",
        focus=0.95, storyteller=0.9, natural=0.9, info=0.8, emo=0.8, narrative=0.85,
    )
    jump = move(
        "那您第一份工作是什么？",
        act_type="transition", form="question", topic_relation="new", stage="career",
        focus=0.1, storyteller=0.1, natural=0.3, info=0.5, emo=0.4, narrative=0.5,
    )
    st = state(focus_strength=0.9, closure=0.1)
    eligible = planner.filter_candidates([stay, jump], st)
    # 硬门控已删除换题候选。
    assert eligible == [stay]
    winner, _ = planner.choose(eligible, coverage, st, 0)
    assert winner.utterance == stay.utterance


def test_coverage_helps_only_after_closure():
    planner = InterviewPlanner()
    coverage = {"education": 0.7, "career": 0.0}
    bridge = move(
        "从读书到工作，中间变化不小，愿意讲讲刚开始工作的日子吗？",
        act_type="bridge", form="invitation", topic_relation="adjacent", stage="career",
        focus=0.5, storyteller=0.6, natural=0.8, info=0.7, emo=0.5, narrative=0.7,
    )
    stay = move(
        "这件事就先讲到这里，您还有想补充的吗？",
        act_type="invite_continue", form="invitation", topic_relation="same", stage="education",
        focus=0.4, storyteller=0.4, natural=0.6, info=0.2, emo=0.3, narrative=0.3,
    )
    st = state(focus_strength=0.4, closure=0.9)
    winner, _ = planner.choose([bridge, stay], coverage, st, 0)
    assert winner.utterance == bridge.utterance


def test_question_streak_penalizes_more_questions():
    planner = InterviewPlanner()
    coverage = {"education": 0.4}
    q = move("后来呢？", act_type="deepen", form="question", topic_relation="same",
             focus=0.8, storyteller=0.8, natural=0.7, info=0.7, emo=0.7, narrative=0.7)
    invite = move("您想到哪里就讲到哪里。", act_type="invite_continue", form="invitation",
                  topic_relation="same", focus=0.85, storyteller=0.85, natural=0.9,
                  info=0.6, emo=0.6, narrative=0.6)
    st = state(focus_strength=0.7, closure=0.3)
    winner, _ = planner.choose([q, invite], coverage, st, question_streak=2)
    assert winner.utterance == invite.utterance


def test_non_question_winner_is_valid():
    planner = InterviewPlanner()
    coverage = {"family": 0.4}
    refl = move(
        "您刚才说，那段经历很多年以后仍然记得很清楚。",
        act_type="reflect", form="statement", topic_relation="same",
        focus=0.95, storyteller=0.95, natural=0.95, info=0.3, emo=0.8, narrative=0.7,
    )
    st = state(focus_strength=0.9, closure=0.2)
    winner, _ = planner.choose([refl], coverage, st, 0)
    assert winner.form == "statement"
    assert not winner.utterance.endswith(("?", "？"))


def test_sensitivity_and_repetition_are_penalized():
    planner = InterviewPlanner()
    coverage = {"family": 0.4}
    safe = move("家里谁对您影响最大？", act_type="deepen", form="question", topic_relation="same",
                stage="family", sensitivity=0.1, repetition=0.1)
    intrusive = move("再讲一遍那个痛苦的秘密。", act_type="deepen", form="question", topic_relation="same",
                     stage="family", sensitivity=0.9, repetition=0.9)
    st = state(focus_strength=0.6, closure=0.4)
    winner, _ = planner.choose([safe, intrusive], coverage, st, 0)
    assert winner.utterance == safe.utterance
