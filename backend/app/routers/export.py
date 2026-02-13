import io
import zipfile
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlmodel import Session, select

from app.database import get_session
from app.models import Folder, Note

router = APIRouter(prefix="/export", tags=["export"])
S = Annotated[Session, Depends(get_session)]


def _safe_filename(title: str) -> str:
    """Make a title safe for use as a filename."""
    name = title.strip() or "Untitled"
    # Replace unsafe characters
    for ch in r'<>:"/\|?*':
        name = name.replace(ch, "_")
    return name[:100]


@router.get("/notes/{note_id}")
def export_note(note_id: str, session: S):
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(404, "Note not found")

    filename = f"{_safe_filename(note.title)}.md"
    content = note.content or ""

    return Response(
        content=content,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/folders/{folder_id}")
def export_folder(folder_id: str, session: S):
    folder = session.get(Folder, folder_id)
    if not folder:
        raise HTTPException(404, "Folder not found")

    notes = session.exec(
        select(Note).where(Note.folder_id == folder_id, Note.is_trashed == False)  # noqa: E712
    ).all()

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for note in notes:
            filename = f"{_safe_filename(note.title)}.md"
            zf.writestr(filename, note.content or "")

    buf.seek(0)
    folder_name = _safe_filename(folder.name)
    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{folder_name}.zip"'},
    )
