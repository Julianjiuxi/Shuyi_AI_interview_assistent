from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.db.base import Base
from app.db.session import engine
import app.models.entities  # noqa: F401

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Shuyi Biography Agent MVP", version="0.1.0")
app.include_router(router, prefix="/api")

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@app.get("/", include_in_schema=False)
def index():
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
