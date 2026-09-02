from app.db.base import Base
from app.db.session import engine
import app.models.entities  # noqa: F401


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    print("Database initialized.")
