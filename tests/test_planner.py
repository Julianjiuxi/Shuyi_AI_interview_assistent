from app.models.schemas import CandidateQuestion
from app.services.planner import InterviewPlanner


def candidate(question, stage, info, emotion, narrative, novelty, sensitivity=0.0, repetition=0.0):
    return CandidateQuestion(
        question=question,
        target_stage=stage,
        reason="test",
        information_gain=info,
        emotional_value=emotion,
        narrative_value=narrative,
        novelty=novelty,
        sensitivity_risk=sensitivity,
        repetition_risk=repetition,
    )


def test_coverage_saturates():
    planner = InterviewPlanner()
    coverage = planner.compute_coverage(["childhood"] * 10 + ["career"])
    assert coverage["childhood"] == 1.0
    assert coverage["career"] == 0.25
    assert coverage["family"] == 0.0


def test_planner_prefers_uncovered_high_value_topic():
    planner = InterviewPlanner()
    coverage = {"childhood": 1.0, "career": 0.0}
    low_gap = candidate("More childhood?", "childhood", .8, .7, .8, .6)
    high_gap = candidate("How did your first job change you?", "career", .8, .7, .8, .6)
    winner, debug = planner.choose([low_gap, high_gap], coverage)
    assert winner.question == "How did your first job change you?"
    assert debug[0]["score"] > debug[1]["score"]


def test_sensitivity_and_repetition_are_penalized():
    planner = InterviewPlanner()
    coverage = {"family": 0.0}
    safe = candidate("Who supported you most at home?", "family", .7, .7, .7, .7, .1, .1)
    intrusive = candidate("Tell me the painful secret again.", "family", .9, .9, .9, .7, .9, .9)
    winner, _ = planner.choose([safe, intrusive], coverage)
    assert winner.question == "Who supported you most at home?"
