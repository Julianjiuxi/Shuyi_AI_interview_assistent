"""公共依赖与分页辅助。"""
from __future__ import annotations

import base64

from app.db.session import SessionLocal


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def encode_cursor(value: int | str) -> str:
    return base64.urlsafe_b64encode(str(value).encode()).decode()


def decode_cursor(cursor: str | None) -> int | None:
    if not cursor:
        return None
    try:
        return int(base64.urlsafe_b64decode(cursor.encode()).decode())
    except Exception:
        return None
