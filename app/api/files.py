"""文件上传（人物参考照片、声音样本、家族旧照片等）。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.entities import MediaAsset
from app.models.schemas import FileUploadOut
from app.services.storage_service import StorageService

router = APIRouter()

# 类型 -> (允许 MIME, 大小上限)
_ALLOWED = {
    "image": ({"image/jpeg", "image/png", "image/webp"}, 20 * 1024 * 1024),
    "audio": ({"audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a"}, 50 * 1024 * 1024),
    "video": ({"video/mp4"}, 100 * 1024 * 1024),
}


def _asset_type(content_type: str | None) -> str:
    if content_type:
        if content_type.startswith("image/"):
            return "image"
        if content_type.startswith("audio/"):
            return "audio"
        if content_type.startswith("video/"):
            return "video"
    return "image"


@router.post("/files", response_model=FileUploadOut)
def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content_type = file.content_type or ""
    asset_type = _asset_type(content_type)
    allowed_mimes, max_size = _ALLOWED.get(asset_type, (set(), 20 * 1024 * 1024))

    if content_type not in allowed_mimes:
        raise HTTPException(status_code=400, detail=f"Unsupported MIME type: {content_type or 'unknown'}")

    content = file.file.read()
    if len(content) > max_size:
        raise HTTPException(status_code=400, detail=f"File exceeds {max_size // (1024 * 1024)}MB limit")

    stored = StorageService().save_bytes(content, content_type, file.filename)

    asset = MediaAsset(
        project_id=0,  # 文件上传暂不关联具体项目，由前端后续绑定
        asset_type=asset_type,
        title=file.filename or "",
        url=stored["url"],
        storage_key=stored["storage_key"],
        mime_type=stored["mime_type"],
        visibility="private",
        approved=False,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    return FileUploadOut(
        file_id=asset.id,
        asset_type=asset_type,
        mime_type=stored["mime_type"],
        url=stored["url"],
        created_at=asset.created_at,
    )
