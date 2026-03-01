import json
import re
from datetime import datetime
from typing import Annotated, Optional

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlmodel import Session, select

from app.database import get_session
from app.models import Note, NoteLink, NoteTag, NoteVersion, Reminder, Tag, generate_ulid, utc_now
from app.schemas import (
    BacklinkResponse,
    NoteCreate,
    NoteResponse,
    NoteUpdate,
    NoteVersionBrief,
    NoteVersionResponse,
    RecurrenceRule,
    ReorderRequest,
    TagBrief,
)

router = APIRouter(prefix="/notes", tags=["notes"])
S = Annotated[Session, Depends(get_session)]

WIKILINK_RE = re.compile(r"\[\[([^\]]+)\]\]")


def _dismiss_pending_reminders(note_id: str, session: Session) -> None:
    """Auto-dismiss all pending reminders for a note."""
    pending = session.exec(
        select(Reminder).where(
            Reminder.note_id == note_id,
            Reminder.is_dismissed == False,  # noqa: E712
        )
    ).all()
    for r in pending:
        r.is_dismissed = True
        session.add(r)


def _subtask_counts(note_id: str, session: Session) -> tuple[int, int]:
    """Return (total, completed) subtask counts for a note."""
    total = session.exec(
        select(func.count()).where(Note.parent_id == note_id)
    ).one()
    completed = session.exec(
        select(func.count()).where(
            Note.parent_id == note_id, Note.is_completed == True  # noqa: E712
        )
    ).one()
    return total, completed


def _parse_recurrence_rule(raw: Optional[str]) -> Optional[RecurrenceRule]:
    if not raw:
        return None
    try:
        return RecurrenceRule(**json.loads(raw))
    except (json.JSONDecodeError, ValueError):
        return None


def _note_response(note: Note, session: Session) -> NoteResponse:
    tags = session.exec(
        select(Tag).join(NoteTag).where(NoteTag.note_id == note.id)
    ).all()
    subtask_count, subtask_completed = _subtask_counts(note.id, session)
    data = note.model_dump()
    data["recurrence_rule"] = _parse_recurrence_rule(data.get("recurrence_rule"))
    return NoteResponse(
        **data,
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
    status: Optional[str] = None,
    project_id: Optional[str] = None,
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

    if status is not None:
        if status == "none":
            query = query.where(Note.status == None)  # noqa: E711
        else:
            query = query.where(Note.status == status)

    if project_id is not None:
        query = query.where(Note.project_id == project_id)

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
    parent = None
    if data.parent_id:
        parent = session.get(Note, data.parent_id)
        if not parent:
            raise HTTPException(404, "Parent note not found")
        if parent.parent_id:
            raise HTTPException(400, "Cannot nest subtasks more than one level deep")
        if parent.is_daily:
            raise HTTPException(400, "Daily notes cannot have subtasks")

    note = Note(
        id=generate_ulid(),
        title=data.title,
        content=data.content,
        folder_id=parent.folder_id if parent else data.folder_id,
        note_type=data.note_type,
        parent_id=data.parent_id,
        status=data.status,
        project_id=data.project_id,
        recurrence_rule=data.recurrence_rule.model_dump_json() if data.recurrence_rule else None,
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

    # Validate parent_id changes (convert to subtask / promote to note)
    if "parent_id" in update_data:
        new_parent_id = update_data["parent_id"]
        if new_parent_id is not None:
            if new_parent_id == note_id:
                raise HTTPException(400, "A note cannot be its own parent")
            parent = session.get(Note, new_parent_id)
            if not parent:
                raise HTTPException(404, "Parent note not found")
            if parent.parent_id:
                raise HTTPException(400, "Cannot nest subtasks more than one level deep")
            if note.is_daily:
                raise HTTPException(400, "Daily notes cannot be subtasks")
            # Check note doesn't have its own subtasks
            sub_count = session.exec(
                select(func.count()).where(Note.parent_id == note_id)
            ).one()
            if sub_count > 0:
                raise HTTPException(400, "Notes with subtasks cannot become subtasks")

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

    # Serialize recurrence_rule to JSON string for storage
    if "recurrence_rule" in update_data:
        rule = update_data["recurrence_rule"]
        update_data["recurrence_rule"] = json.dumps(rule) if rule else None

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

    _dismiss_pending_reminders(note_id, session)

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


def _advance_due_date(due_at: Optional[str], rule: RecurrenceRule) -> str:
    """Calculate the next due date by advancing the current one by the recurrence interval."""
    if due_at:
        base = datetime.fromisoformat(due_at.replace("Z", "+00:00"))
    else:
        base = datetime.now()

    freq = rule.freq
    interval = rule.interval
    if freq == "daily":
        next_date = base + relativedelta(days=interval)
    elif freq == "weekly":
        next_date = base + relativedelta(weeks=interval)
    elif freq == "monthly":
        next_date = base + relativedelta(months=interval)
    else:  # yearly
        next_date = base + relativedelta(years=interval)

    return next_date.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


@router.post("/{note_id}/complete", response_model=NoteResponse)
def complete_note(note_id: str, session: S):
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(404, "Note not found")

    note.is_completed = True
    note.completed_at = utc_now()
    if note.status:
        note.status = "done"
    _dismiss_pending_reminders(note_id, session)
    session.add(note)

    # Generate next occurrence for recurring notes
    next_note = None
    rule = _parse_recurrence_rule(note.recurrence_rule)
    if rule:
        # Clone tags before flush
        tag_ids = [t.id for t in session.exec(
            select(Tag).join(NoteTag).where(NoteTag.note_id == note.id)
        ).all()]

        next_note = Note(
            id=generate_ulid(),
            title=note.title,
            content=note.content,
            folder_id=note.folder_id,
            note_type=note.note_type,
            status="todo" if note.status else None,
            project_id=note.project_id,
            recurrence_rule=note.recurrence_rule,
            recurrence_source_id=note.id,
            due_at=_advance_due_date(note.due_at, rule),
        )
        session.add(next_note)
        session.flush()

        # Copy tags to next occurrence
        for tag_id in tag_ids:
            session.add(NoteTag(note_id=next_note.id, tag_id=tag_id))

    session.commit()
    session.refresh(note)
    return _note_response(note, session)


@router.delete("/{note_id}/recurrence", response_model=NoteResponse)
def remove_recurrence(note_id: str, session: S):
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(404, "Note not found")

    note.recurrence_rule = None
    note.recurrence_source_id = None
    note.updated_at = utc_now()
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
    if note.status == "done":
        note.status = "todo"
    session.add(note)
    session.commit()
    session.refresh(note)
    return _note_response(note, session)


@router.patch("/{note_id}/status", response_model=NoteResponse)
def update_status(note_id: str, data: dict, session: S):
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(404, "Note not found")

    note.status = data.get("status")
    note.updated_at = utc_now()
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
