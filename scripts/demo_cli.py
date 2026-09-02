from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.services.biography_service import BiographyService
from app.services.interview_service import InterviewService
import app.models.entities  # noqa: F401


Base.metadata.create_all(bind=engine)


def main():
    db = SessionLocal()
    try:
        service = InterviewService(db)
        name = input("Storyteller name (optional): ").strip() or "Unknown"
        project, session, question = service.create_project(name)
        print(f"\nAI: {question}")

        for turn in range(8):
            answer = input("YOU: ").strip()
            if answer.lower() in {"quit", "exit", "done"}:
                break
            result = service.handle_answer(project.id, session.id, answer)
            print("\n[coverage]", result["planner_debug"]["coverage"])
            print("[top candidate scores]")
            for row in result["planner_debug"]["ranked_candidates"][:3]:
                print(" ", row)
            print(f"\nAI: {result['next_question']}")

        if input("\nGenerate chapter? [y/N] ").strip().lower() == "y":
            chapter = BiographyService(db).generate_chapter(
                project.id,
                "Create a short first-person-neutral biography chapter based on the most important memories collected so far.",
            )
            print("\n===", chapter["title"], "===\n")
            print(chapter["body"])
    finally:
        db.close()


if __name__ == "__main__":
    main()
