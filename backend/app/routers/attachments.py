import os
import shutil
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlmodel import Session, select

from app.database import get_session
from app.models import Attachment, Note, generate_ulid
from app.schemas import AttachmentResponse

router = APIRouter(tags=["attachments"])
S = Annotated[Session, Depends(get_session)]

ATTACHMENTS_DIR = "data/attachments"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

ALLOWED_MIME_TYPES = {
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/zip",
}


def _attachment_response(att: Attachment) -> AttachmentResponse:
    return AttachmentResponse(
        id=att.id,
        note_id=att.note_id,
        filename=att.filename,
        original_filename=att.original_filename,
        mime_type=att.mime_type,
        size_bytes=att.size_bytes,
        created_at=att.created_at,
        url=f"/api/attachments/{att.id}/file",
    )


@router.post("/notes/{note_id}/attachments", response_model=AttachmentResponse, status_code=201)
async def upload_attachment(note_id: str, file: UploadFile, session: S):
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(404, "Note not found")

    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(400, f"File type {file.content_type} not allowed")

    # Read file and check size
    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(400, f"File too large (max {MAX_FILE_SIZE // 1024 // 1024}MB)")

    # Generate unique filename
    ext = os.path.splitext(file.filename or "file")[1] or ""
    att_id = generate_ulid()
    stored_filename = f"{att_id}{ext}"

    # Store file
    note_dir = os.path.join(ATTACHMENTS_DIR, note_id)
    os.makedirs(note_dir, exist_ok=True)
    filepath = os.path.join(note_dir, stored_filename)
    with open(filepath, "wb") as f:
        f.write(data)

    # Create DB record
    attachment = Attachment(
        id=att_id,
        note_id=note_id,
        filename=stored_filename,
        original_filename=file.filename or "file",
        mime_type=file.content_type or "application/octet-stream",
        size_bytes=len(data),
    )
    session.add(attachment)
    session.commit()
    session.refresh(attachment)
    return _attachment_response(attachment)


@router.get("/notes/{note_id}/attachments", response_model=list[AttachmentResponse])
def list_attachments(note_id: str, session: S):
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(404, "Note not found")

    attachments = session.exec(
        select(Attachment)
        .where(Attachment.note_id == note_id)
        .order_by(Attachment.created_at.desc())  # type: ignore[union-attr]
    ).all()
    return [_attachment_response(a) for a in attachments]


@router.get("/attachments/{attachment_id}/file")
def serve_attachment(attachment_id: str, session: S):
    attachment = session.get(Attachment, attachment_id)
    if not attachment:
        raise HTTPException(404, "Attachment not found")

    filepath = os.path.join(ATTACHMENTS_DIR, attachment.note_id, attachment.filename)
    if not os.path.exists(filepath):
        raise HTTPException(404, "File not found on disk")

    return FileResponse(
        filepath,
        media_type=attachment.mime_type,
        filename=attachment.original_filename,
        headers={"Content-Security-Policy": "sandbox"},
    )


@router.delete("/attachments/{attachment_id}")
def delete_attachment(attachment_id: str, session: S):
    attachment = session.get(Attachment, attachment_id)
    if not attachment:
        raise HTTPException(404, "Attachment not found")

    # Remove file from disk
    filepath = os.path.join(ATTACHMENTS_DIR, attachment.note_id, attachment.filename)
    if os.path.exists(filepath):
        os.remove(filepath)

    # Clean up empty note directory
    note_dir = os.path.join(ATTACHMENTS_DIR, attachment.note_id)
    if os.path.isdir(note_dir) and not os.listdir(note_dir):
        os.rmdir(note_dir)

    session.delete(attachment)
    session.commit()
    return {"ok": True}
