from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, Relationship, SQLModel
from ulid import ULID


def generate_ulid() -> str:
    return str(ULID())


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


class NoteTag(SQLModel, table=True):
    __tablename__ = "note_tags"
    note_id: str = Field(foreign_key="notes.id", primary_key=True)
    tag_id: str = Field(foreign_key="tags.id", primary_key=True)


class NoteLink(SQLModel, table=True):
    __tablename__ = "note_links"
    source_id: str = Field(foreign_key="notes.id", primary_key=True)
    target_id: str = Field(foreign_key="notes.id", primary_key=True)


class Tag(SQLModel, table=True):
    __tablename__ = "tags"
    id: str = Field(default_factory=generate_ulid, primary_key=True)
    name: str = Field(index=True, unique=True)
    color: str = Field(default="#6366f1")
    created_at: str = Field(default_factory=utc_now)

    notes: list["Note"] = Relationship(back_populates="tags", link_model=NoteTag)


class Folder(SQLModel, table=True):
    __tablename__ = "folders"
    id: str = Field(default_factory=generate_ulid, primary_key=True)
    name: str
    icon: Optional[str] = Field(default=None)
    parent_id: Optional[str] = Field(default=None, foreign_key="folders.id")
    position: float = Field(default=0)
    created_at: str = Field(default_factory=utc_now)
    updated_at: str = Field(default_factory=utc_now)

    notes: list["Note"] = Relationship(back_populates="folder")


class Project(SQLModel, table=True):
    __tablename__ = "projects"
    id: str = Field(default_factory=generate_ulid, primary_key=True)
    name: str
    icon: Optional[str] = Field(default=None)
    description: Optional[str] = Field(default=None)
    created_at: str = Field(default_factory=utc_now)
    updated_at: str = Field(default_factory=utc_now)


class Note(SQLModel, table=True):
    __tablename__ = "notes"
    id: str = Field(default_factory=generate_ulid, primary_key=True)
    title: str = Field(default="")
    content: str = Field(default="")
    folder_id: Optional[str] = Field(default=None, foreign_key="folders.id")
    position: float = Field(default=0)
    is_pinned: bool = Field(default=False)
    is_trashed: bool = Field(default=False)
    trashed_at: Optional[str] = Field(default=None)
    is_completed: bool = Field(default=False)
    completed_at: Optional[str] = Field(default=None)
    note_type: str = Field(default="note")  # "note" | "checklist"
    is_daily: bool = Field(default=False)
    daily_date: Optional[str] = Field(default=None)
    due_at: Optional[str] = Field(default=None)
    parent_id: Optional[str] = Field(default=None, foreign_key="notes.id")
    status: Optional[str] = Field(default=None)
    project_id: Optional[str] = Field(default=None, foreign_key="projects.id")
    recurrence_rule: Optional[str] = Field(default=None)  # JSON: {"freq": "daily|weekly|monthly|yearly", "interval": 1}
    recurrence_source_id: Optional[str] = Field(default=None, foreign_key="notes.id")
    created_at: str = Field(default_factory=utc_now)
    updated_at: str = Field(default_factory=utc_now)

    folder: Optional[Folder] = Relationship(back_populates="notes")
    tags: list[Tag] = Relationship(back_populates="notes", link_model=NoteTag)


class Reminder(SQLModel, table=True):
    __tablename__ = "reminders"
    id: str = Field(default_factory=generate_ulid, primary_key=True)
    note_id: str = Field(foreign_key="notes.id", index=True)
    remind_at: str
    is_fired: bool = Field(default=False)
    is_dismissed: bool = Field(default=False)
    created_at: str = Field(default_factory=utc_now)


class Attachment(SQLModel, table=True):
    __tablename__ = "attachments"
    id: str = Field(default_factory=generate_ulid, primary_key=True)
    note_id: str = Field(foreign_key="notes.id", index=True)
    filename: str
    original_filename: str
    mime_type: str
    size_bytes: int
    created_at: str = Field(default_factory=utc_now)


class NoteVersion(SQLModel, table=True):
    __tablename__ = "note_versions"
    id: str = Field(default_factory=generate_ulid, primary_key=True)
    note_id: str = Field(foreign_key="notes.id", index=True)
    title: str = Field(default="")
    content: str = Field(default="")
    created_at: str = Field(default_factory=utc_now)


class SpendingCategory(SQLModel, table=True):
    __tablename__ = "spending_categories"
    id: str = Field(default_factory=generate_ulid, primary_key=True)
    name: str
    position: float = Field(default=0)
    created_at: str = Field(default_factory=utc_now)


class SpendingEntry(SQLModel, table=True):
    __tablename__ = "spending_entries"
    id: str = Field(default_factory=generate_ulid, primary_key=True)
    category_id: str = Field(foreign_key="spending_categories.id", index=True)
    year: int
    month: int
    amount: float = Field(default=0)


class IncomeEntry(SQLModel, table=True):
    __tablename__ = "income_entries"
    id: str = Field(default_factory=generate_ulid, primary_key=True)
    year: int
    month: int
    gross: float = Field(default=0)


class UtilityAddress(SQLModel, table=True):
    __tablename__ = "utility_addresses"
    id: str = Field(default_factory=generate_ulid, primary_key=True)
    name: str
    position: float = Field(default=0)
    created_at: str = Field(default_factory=utc_now)


class MeterReading(SQLModel, table=True):
    __tablename__ = "meter_readings"
    id: str = Field(default_factory=generate_ulid, primary_key=True)
    address_id: str = Field(foreign_key="utility_addresses.id", index=True)
    utility_type: str  # 'gas' | 'water'
    year: int
    month: int
    reading: float = Field(default=0)


class BalanceEntry(SQLModel, table=True):
    __tablename__ = "balance_entries"
    id: str = Field(default_factory=generate_ulid, primary_key=True)
    name: str
    position: float = Field(default=0)
    uah: float = Field(default=0)
    usd: float = Field(default=0)
    eur: float = Field(default=0)
    created_at: str = Field(default_factory=utc_now)
