from datetime import datetime, timezone, timedelta
from typing import Annotated

from croniter import croniter
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func

from app.database import get_session
from app.models import Note, Reminder, ScheduledSummary, generate_ulid, utc_now
from app.schemas import ReminderCreate, ReminderResponse, ReminderWithNote, ScheduledSummaryFired

router = APIRouter(tags=["reminders"])
S = Annotated[Session, Depends(get_session)]


def _reminder_response(r: Reminder) -> ReminderResponse:
    return ReminderResponse(
        id=r.id,
        note_id=r.note_id,
        remind_at=r.remind_at,
        is_fired=r.is_fired,
        is_dismissed=r.is_dismissed,
        created_at=r.created_at,
    )


def _reminder_with_note(r: Reminder, note_title: str) -> ReminderWithNote:
    return ReminderWithNote(
        id=r.id,
        note_id=r.note_id,
        note_title=note_title,
        remind_at=r.remind_at,
        is_fired=r.is_fired,
        is_dismissed=r.is_dismissed,
    )


@router.post("/notes/{note_id}/reminders", response_model=ReminderResponse, status_code=201)
def create_reminder(note_id: str, data: ReminderCreate, session: S):
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(404, "Note not found")

    reminder = Reminder(
        id=generate_ulid(),
        note_id=note_id,
        remind_at=data.remind_at,
    )
    session.add(reminder)
    session.commit()
    session.refresh(reminder)
    return _reminder_response(reminder)


@router.get("/notes/{note_id}/reminders", response_model=list[ReminderResponse])
def list_reminders(note_id: str, session: S):
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(404, "Note not found")

    reminders = session.exec(
        select(Reminder)
        .where(Reminder.note_id == note_id)
        .order_by(Reminder.remind_at)
    ).all()
    return [_reminder_response(r) for r in reminders]


@router.delete("/reminders/{reminder_id}")
def delete_reminder(reminder_id: str, session: S):
    reminder = session.get(Reminder, reminder_id)
    if not reminder:
        raise HTTPException(404, "Reminder not found")
    session.delete(reminder)
    session.commit()
    return {"ok": True}


@router.post("/reminders/{reminder_id}/dismiss", response_model=ReminderResponse)
def dismiss_reminder(reminder_id: str, session: S):
    reminder = session.get(Reminder, reminder_id)
    if not reminder:
        raise HTTPException(404, "Reminder not found")
    reminder.is_dismissed = True
    session.add(reminder)
    session.commit()
    session.refresh(reminder)
    return _reminder_response(reminder)


@router.post("/reminders/{reminder_id}/snooze", response_model=ReminderResponse)
def snooze_reminder(reminder_id: str, data: dict, session: S):
    reminder = session.get(Reminder, reminder_id)
    if not reminder:
        raise HTTPException(404, "Reminder not found")

    minutes = data.get("minutes", 15)
    current = datetime.fromisoformat(reminder.remind_at.replace("Z", "+00:00"))
    new_time = current + timedelta(minutes=minutes)
    reminder.remind_at = new_time.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    reminder.is_fired = False
    reminder.is_dismissed = False
    session.add(reminder)
    session.commit()
    session.refresh(reminder)
    return _reminder_response(reminder)


@router.get("/reminders/pending", response_model=list[ReminderWithNote])
def get_pending_reminders(session: S):
    """All unfired, undismissed reminders (for frontend polling)."""
    reminders = session.exec(
        select(Reminder)
        .where(
            Reminder.is_fired == False,  # noqa: E712
            Reminder.is_dismissed == False,  # noqa: E712
        )
        .order_by(Reminder.remind_at)
    ).all()

    result = []
    for r in reminders:
        note = session.get(Note, r.note_id)
        title = note.title if note else "Deleted note"
        result.append(_reminder_with_note(r, title))
    return result


@router.post("/reminders/{reminder_id}/fire", response_model=ReminderResponse)
def mark_fired(reminder_id: str, session: S):
    """Mark a reminder as fired (called by frontend after showing notification)."""
    reminder = session.get(Reminder, reminder_id)
    if not reminder:
        raise HTTPException(404, "Reminder not found")
    reminder.is_fired = True
    session.add(reminder)
    session.commit()
    session.refresh(reminder)
    return _reminder_response(reminder)


@router.get("/reminders/summaries", response_model=list[ScheduledSummaryFired])
def get_due_summaries(session: S):
    """Return summaries that should fire now based on cron schedule."""
    summaries = session.exec(
        select(ScheduledSummary).where(ScheduledSummary.is_active == True)  # noqa: E712
    ).all()

    now = datetime.now(timezone.utc)
    result = []

    for s in summaries:
        cron = croniter(s.cron_expression, now)
        prev_fire = cron.get_prev(datetime)

        if s.last_fired_at:
            last = datetime.fromisoformat(s.last_fired_at.replace("Z", "+00:00"))
            if last >= prev_fire:
                continue

        count_query = select(func.count()).select_from(Note).where(
            Note.is_trashed == False,  # noqa: E712
            Note.is_completed == False,  # noqa: E712
            Note.parent_id == None,  # noqa: E711
        )
        if s.folder_id:
            count_query = count_query.where(Note.folder_id == s.folder_id)

        count = session.exec(count_query).one()
        if count == 0:
            s.last_fired_at = utc_now()
            session.add(s)
            session.commit()
            continue

        message = s.message_template.replace("{count}", str(count))
        s.last_fired_at = utc_now()
        session.add(s)
        session.commit()

        result.append(ScheduledSummaryFired(
            id=s.id, name=s.name, message=message, count=count,
        ))

    return result
