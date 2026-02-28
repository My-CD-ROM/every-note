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
    created_at: str = Field(default_factory=utc_now)
    updated_at: str = Field(default_factory=utc_now)

    folder: Optional[Folder] = Relationship(back_populates="notes")
    tags: list[Tag] = Relationship(back_populates="notes", link_model=NoteTag)


class NoteVersion(SQLModel, table=True):
    __tablename__ = "note_versions"
    id: str = Field(default_factory=generate_ulid, primary_key=True)
    note_id: str = Field(foreign_key="notes.id", index=True)
    title: str = Field(default="")
    content: str = Field(default="")
    created_at: str = Field(default_factory=utc_now)
