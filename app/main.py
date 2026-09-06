import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.errors import register_error_handlers
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
import app.models.entities  # noqa: F401

logger = logging.getLogger("shuyi")

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Shuyi Biography Agent MVP", version="0.2.0")

# CORS：按逗号拆分允许来源；生产环境禁止 "*" 搭配 credentials。
origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
if "*" in origins and len(origins) == 1:
    logger.warning("ALLOWED_ORIGINS 配置为 '*'，生产环境请勿与 allow_credentials=True 搭配使用")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "Authorization", "Idempotency-Key", "X-Request-ID"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "Authorization", "Idempotency-Key", "X-Request-ID"],
    )

register_error_handlers(app)

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
UPLOAD_DIR = Path(settings.media_storage_dir).resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/", include_in_schema=False)
def index():
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


def _include_routers() -> None:
    from app.api import archives, documents, families, files, life, media, memories, routes, voice_ws

    app.include_router(routes.router, prefix="/api")
    app.include_router(families.router, prefix="/api")
    app.include_router(memories.router, prefix="/api")
    app.include_router(documents.router, prefix="/api")
    app.include_router(archives.router, prefix="/api")
    app.include_router(media.router, prefix="/api")
    app.include_router(files.router, prefix="/api")
    app.include_router(life.router, prefix="/api")
    app.include_router(voice_ws.router, prefix="/api")


_include_routers()
