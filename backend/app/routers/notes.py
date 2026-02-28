import re
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.models import Note, NoteLink, NoteTag, NoteVersion, Tag, generate_ulid, utc_now
from app.schemas import (
    BacklinkResponse,
    NoteCreate,
    NoteResponse,
    NoteUpdate,
    NoteVersionBrief,
    NoteVersionResponse,
    ReorderRequest,
    TagBrief,
)

router = APIRouter(prefix="/notes", tags=["notes"])
S = Annotated[Session, Depends(get_session)]

WIKILINK_RE = re.compile(r"\[\[([^\]]+)\]\]")


def _subtask_counts(note_id: str, session: Session) -> tuple[int, int]:
    """Return (total, completed) subtask counts for a note."""
    from sqlalchemy import func

    total = session.exec(
        select(func.count()).where(Note.parent_id == note_id)
    ).one()
    completed = session.exec(
        select(func.count()).where(
            Note.parent_id == note_id, Note.is_completed == True  # noqa: E712
        )
    ).one()
    return total, completed


def _note_response(note: Note, session: Session) -> NoteResponse:
    tags = session.exec(
        select(Tag).join(NoteTag).where(NoteTag.note_id == note.id)
    ).all()
    subtask_count, subtask_completed = _subtask_counts(note.id, session)
    return NoteResponse(
        **note.model_dump(),
        tags=[TagBrief(id=t.id, name=t.name, color=t.color) for t in tags],
        subtask_count=subtask_count,
        subtask_completed=subtask_completed,
    )


def _sync_note_links(note_id: str, content: str, session: Session) -> None:
    """Parse [[title]] wiki-links from content and rebuild NoteLink rows."""
    titles = set(WIKILINK_RE.findall(content))
    # Delete existing outgoing links
    existing = session.exec(
        select(NoteLink).where(NoteLink.source_id == note_id)
    ).all()
    for link in existing:
        session.delete(link)

    if not titles:
        return

    # Resolve titles to note IDs (case-insensitive)
    for title in titles:
        target = session.exec(
            select(Note).where(Note.title == title, Note.is_trashed == False)  # noqa: E712
        ).first()
        if target and target.id != note_id:
            session.add(NoteLink(source_id=note_id, target_id=target.id))


@router.get("", response_model=list[NoteResponse])
def list_notes(
    session: S,
    folder_id: Optional[str] = None,
    tag_id: Optional[str] = None,
    trashed: bool = False,
    pinned: Optional[bool] = None,
    completed: Optional[bool] = None,
    parent_id: Optional[str] = None,
):
    query = select(Note).where(Note.is_trashed == trashed)

    # By default, only show top-level notes (no parent)
    if parent_id is not None:
        query = query.where(Note.parent_id == parent_id)
    else:
        query = query.where(Note.parent_id == None)  # noqa: E711

    if completed is True:
        query = query.where(Note.is_completed == True)  # noqa: E712
    elif not trashed:
        # Default: exclude completed notes from normal views
        query = query.where(Note.is_completed == False)  # noqa: E712

    if folder_id is not None:
        query = query.where(Note.folder_id == folder_id)

    if tag_id is not None:
        query = query.join(NoteTag).where(NoteTag.tag_id == tag_id)

    if pinned is True:
        query = query.where(Note.is_pinned == True)  # noqa: E712

    query = query.order_by(Note.is_pinned.desc(), Note.updated_at.desc())  # type: ignore[union-attr]
    notes = session.exec(query).all()
    return [_note_response(n, session) for n in notes]


@router.get("/{note_id}", response_model=NoteResponse)
def get_note(note_id: str, session: S):
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(404, "Note not found")
    return _note_response(note, session)


@router.post("", response_model=NoteResponse, status_code=201)
def create_note(data: NoteCreate, session: S):
    # Enforce one-level nesting: subtasks cannot have subtasks
    if data.parent_id:
        parent = session.get(Note, data.parent_id)
        if not parent:
            raise HTTPException(404, "Parent note not found")
        if parent.parent_id:
            raise HTTPException(400, "Cannot nest subtasks more than one level deep")

    note = Note(
        id=generate_ulid(),
        title=data.title,
        content=data.content,
        folder_id=data.folder_id,
        note_type=data.note_type,
        parent_id=data.parent_id,
    )
    session.add(note)
    session.flush()
    _sync_note_links(note.id, note.content, session)
    session.commit()
    session.refresh(note)
    return _note_response(note, session)


@router.patch("/{note_id}", response_model=NoteResponse)
def update_note(note_id: str, data: NoteUpdate, session: S):
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(404, "Note not found")

    update_data = data.model_dump(exclude_unset=True)
    content_or_title_changed = "title" in update_data or "content" in update_data

    # Snapshot previous state before applying changes (version history)
    if content_or_title_changed:
        version = NoteVersion(
            id=generate_ulid(),
            note_id=note_id,
            title=note.title,
            content=note.content,
        )
        session.add(version)

    for key, value in update_data.items():
        setattr(note, key, value)
    note.updated_at = utc_now()

    # Re-sync wiki-links if content changed
    if "content" in update_data:
        _sync_note_links(note_id, note.content, session)

    session.add(note)
    session.commit()
    session.refresh(note)
    return _note_response(note, session)


@router.delete("/{note_id}")
def trash_note(note_id: str, session: S, permanent: bool = False):
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(404, "Note not found")

    # Cascade to subtasks
    subtasks = session.exec(select(Note).where(Note.parent_id == note_id)).all()

    if permanent:
        for sub in subtasks:
            session.delete(sub)
        session.delete(note)
    else:
        now = utc_now()
        for sub in subtasks:
            sub.is_trashed = True
            sub.trashed_at = now
            session.add(sub)
        note.is_trashed = True
        note.trashed_at = now
        session.add(note)

    session.commit()
    return {"ok": True}


@router.post("/{note_id}/restore", response_model=NoteResponse)
def restore_note(note_id: str, session: S):
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(404, "Note not found")

    note.is_trashed = False
    note.trashed_at = None
    session.add(note)

    # Cascade restore to subtasks
    subtasks = session.exec(select(Note).where(Note.parent_id == note_id)).all()
    for sub in subtasks:
        sub.is_trashed = False
        sub.trashed_at = None
        session.add(sub)

    session.commit()
    session.refresh(note)
    return _note_response(note, session)


@router.post("/{note_id}/complete", response_model=NoteResponse)
def complete_note(note_id: str, session: S):
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(404, "Note not found")

    note.is_completed = True
    note.completed_at = utc_now()
    session.add(note)
    session.commit()
    session.refresh(note)
    return _note_response(note, session)


@router.post("/{note_id}/uncomplete", response_model=NoteResponse)
def uncomplete_note(note_id: str, session: S):
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(404, "Note not found")

    note.is_completed = False
    note.completed_at = None
    session.add(note)
    session.commit()
    session.refresh(note)
    return _note_response(note, session)


@router.post("/{note_id}/tags/{tag_id}")
def add_tag_to_note(note_id: str, tag_id: str, session: S):
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(404, "Note not found")
    tag = session.get(Tag, tag_id)
    if not tag:
        raise HTTPException(404, "Tag not found")

    existing = session.get(NoteTag, (note_id, tag_id))
    if not existing:
        session.add(NoteTag(note_id=note_id, tag_id=tag_id))
        session.commit()
    return {"ok": True}


@router.delete("/{note_id}/tags/{tag_id}")
def remove_tag_from_note(note_id: str, tag_id: str, session: S):
    link = session.get(NoteTag, (note_id, tag_id))
    if link:
        session.delete(link)
        session.commit()
    return {"ok": True}


# --- Version History ---

@router.get("/{note_id}/versions", response_model=list[NoteVersionBrief])
def list_versions(note_id: str, session: S):
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(404, "Note not found")
    versions = session.exec(
        select(NoteVersion)
        .where(NoteVersion.note_id == note_id)
        .order_by(NoteVersion.created_at.desc())  # type: ignore[union-attr]
        .limit(50)
    ).all()
    return [NoteVersionBrief(id=v.id, title=v.title, created_at=v.created_at) for v in versions]


@router.get("/{note_id}/versions/{version_id}", response_model=NoteVersionResponse)
def get_version(note_id: str, version_id: str, session: S):
    version = session.get(NoteVersion, version_id)
    if not version or version.note_id != note_id:
        raise HTTPException(404, "Version not found")
    return NoteVersionResponse(
        id=version.id,
        note_id=version.note_id,
        title=version.title,
        content=version.content,
        created_at=version.created_at,
    )


@router.post("/{note_id}/versions/{version_id}/restore", response_model=NoteResponse)
def restore_version(note_id: str, version_id: str, session: S):
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(404, "Note not found")
    version = session.get(NoteVersion, version_id)
    if not version or version.note_id != note_id:
        raise HTTPException(404, "Version not found")

    # Save current state as a version before restoring
    snapshot = NoteVersion(
        id=generate_ulid(),
        note_id=note_id,
        title=note.title,
        content=note.content,
    )
    session.add(snapshot)

    note.title = version.title
    note.content = version.content
    note.updated_at = utc_now()
    _sync_note_links(note_id, note.content, session)

    session.add(note)
    session.commit()
    session.refresh(note)
    return _note_response(note, session)


# --- Backlinks ---

@router.get("/{note_id}/backlinks", response_model=list[BacklinkResponse])
def get_backlinks(note_id: str, session: S):
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(404, "Note not found")

    sources = session.exec(
        select(Note)
        .join(NoteLink, NoteLink.source_id == Note.id)
        .where(NoteLink.target_id == note_id, Note.is_trashed == False)  # noqa: E712
    ).all()
    return [BacklinkResponse(id=n.id, title=n.title, updated_at=n.updated_at) for n in sources]


# --- Subtasks ---

@router.get("/{note_id}/subtasks", response_model=list[NoteResponse])
def list_subtasks(note_id: str, session: S):
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(404, "Note not found")
    subtasks = session.exec(
        select(Note)
        .where(Note.parent_id == note_id, Note.is_trashed == False)  # noqa: E712
        .order_by(Note.position, Note.created_at)
    ).all()
    return [_note_response(s, session) for s in subtasks]


# --- Reorder ---

@router.post("/reorder")
def reorder_notes(data: ReorderRequest, session: S):
    for item in data.items:
        note = session.get(Note, item.id)
        if note:
            note.position = item.position
            session.add(note)
    session.commit()
    return {"ok": True}
