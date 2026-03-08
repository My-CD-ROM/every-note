from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func

from app.database import get_session
from app.models import Note, NoteTag, Tag, generate_ulid
from app.schemas import TagCreate, TagResponse, TagUpdate

router = APIRouter(prefix="/tags", tags=["tags"])
S = Annotated[Session, Depends(get_session)]


@router.get("", response_model=list[TagResponse])
def list_tags(session: S, project_id: Optional[str] = None):
    query = select(Tag).order_by(Tag.name)
    if project_id is not None:
        query = query.where(Tag.project_id == project_id)
    else:
        query = query.where(Tag.project_id == None)  # noqa: E711
    tags = session.exec(query).all()
    result = []
    for t in tags:
        count = session.exec(
            select(func.count()).select_from(NoteTag).join(Note, NoteTag.note_id == Note.id).where(
                NoteTag.tag_id == t.id, Note.is_trashed == False, Note.is_completed == False  # noqa: E712
            )
        ).one()
        result.append(TagResponse(**t.model_dump(), note_count=count))
    return result


@router.get("/{tag_id}", response_model=TagResponse)
def get_tag(tag_id: str, session: S):
    tag = session.get(Tag, tag_id)
    if not tag:
        raise HTTPException(404, "Tag not found")
    count = session.exec(
        select(func.count()).select_from(NoteTag).join(Note, NoteTag.note_id == Note.id).where(
            NoteTag.tag_id == tag_id, Note.is_trashed == False, Note.is_completed == False  # noqa: E712
        )
    ).one()
    return TagResponse(**tag.model_dump(), note_count=count)


@router.post("", response_model=TagResponse, status_code=201)
def create_tag(data: TagCreate, session: S):
    query = select(Tag).where(Tag.name == data.name)
    if data.project_id:
        query = query.where(Tag.project_id == data.project_id)
    else:
        query = query.where(Tag.project_id == None)  # noqa: E711
    existing = session.exec(query).first()
    if existing:
        raise HTTPException(409, "Tag already exists")

    tag = Tag(id=generate_ulid(), name=data.name, color=data.color, project_id=data.project_id)
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return TagResponse(**tag.model_dump(), note_count=0)


@router.patch("/{tag_id}", response_model=TagResponse)
def update_tag(tag_id: str, data: TagUpdate, session: S):
    tag = session.get(Tag, tag_id)
    if not tag:
        raise HTTPException(404, "Tag not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(tag, key, value)

    session.add(tag)
    session.commit()
    session.refresh(tag)

    count = session.exec(
        select(func.count()).select_from(NoteTag).join(Note, NoteTag.note_id == Note.id).where(
            NoteTag.tag_id == tag_id, Note.is_trashed == False, Note.is_completed == False  # noqa: E712
        )
    ).one()
    return TagResponse(**tag.model_dump(), note_count=count)


@router.delete("/{tag_id}")
def delete_tag(tag_id: str, session: S):
    tag = session.get(Tag, tag_id)
    if not tag:
        raise HTTPException(404, "Tag not found")
    session.delete(tag)
    session.commit()
    return {"ok": True}
