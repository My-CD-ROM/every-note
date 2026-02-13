from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.database import get_session
from app.models import Note, NoteTag, Tag, generate_ulid, utc_now
from app.schemas import NoteResponse, TagBrief

router = APIRouter(prefix="/daily", tags=["daily"])
S = Annotated[Session, Depends(get_session)]


def _note_response(note: Note, session: Session) -> NoteResponse:
    tags = session.exec(
        select(Tag).join(NoteTag).where(NoteTag.note_id == note.id)
    ).all()
    return NoteResponse(
        **note.model_dump(),
        tags=[TagBrief(id=t.id, name=t.name, color=t.color) for t in tags],
    )


@router.get("/range", response_model=list[NoteResponse])
def get_range(
    session: S,
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
):
    """Return all notes within a date range, keyed by date.

    Returns both daily notes (by daily_date) and regular notes (by updated_at date).
    """
    try:
        date.fromisoformat(start)
        date.fromisoformat(end)
    except ValueError:
        raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD")

    # Get all non-trashed notes whose updated_at falls in range
    notes = session.exec(
        select(Note)
        .where(
            Note.is_trashed == False,  # noqa: E712
            Note.updated_at >= start,
            Note.updated_at < end + "T24",  # include the entire end date
        )
        .order_by(Note.updated_at.desc())  # type: ignore[union-attr]
    ).all()

    return [_note_response(n, session) for n in notes]


@router.get("", response_model=NoteResponse)
def get_today(session: S):
    """Get or create today's daily note."""
    return _get_or_create(date.today().isoformat(), session)


@router.get("/{date_str}", response_model=NoteResponse)
def get_daily(date_str: str, session: S):
    """Get or create a daily note for a specific date."""
    try:
        date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD")
    return _get_or_create(date_str, session)


def _get_or_create(date_str: str, session: Session) -> NoteResponse:
    note = session.exec(
        select(Note).where(Note.daily_date == date_str, Note.is_trashed == False)  # noqa: E712
    ).first()

    if note:
        return _note_response(note, session)

    # Parse the date for a nice title
    d = date.fromisoformat(date_str)
    title = d.strftime("%A, %B %-d, %Y")

    note = Note(
        id=generate_ulid(),
        title=title,
        content=f"# {title}\n\n",
        is_daily=True,
        daily_date=date_str,
    )
    session.add(note)
    session.commit()
    session.refresh(note)
    return _note_response(note, session)
