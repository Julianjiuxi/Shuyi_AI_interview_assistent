from fastapi import FastAPI

from app.api.routes import router
from app.db.base import Base
from app.db.session import engine
import app.models.entities  # noqa: F401

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Shuyi Biography Agent MVP", version="0.1.0")
app.include_router(router, prefix="/api")
