from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func

from app.database import get_session
from app.models import NoteTag, Tag, generate_ulid
from app.schemas import TagCreate, TagResponse, TagUpdate

router = APIRouter(prefix="/tags", tags=["tags"])
S = Annotated[Session, Depends(get_session)]


@router.get("", response_model=list[TagResponse])
def list_tags(session: S):
    tags = session.exec(select(Tag).order_by(Tag.name)).all()
    result = []
    for t in tags:
        count = session.exec(
            select(func.count()).select_from(NoteTag).where(NoteTag.tag_id == t.id)
        ).one()
        result.append(TagResponse(**t.model_dump(), note_count=count))
    return result


@router.get("/{tag_id}", response_model=TagResponse)
def get_tag(tag_id: str, session: S):
    tag = session.get(Tag, tag_id)
    if not tag:
        raise HTTPException(404, "Tag not found")
    count = session.exec(
        select(func.count()).select_from(NoteTag).where(NoteTag.tag_id == tag_id)
    ).one()
    return TagResponse(**tag.model_dump(), note_count=count)


@router.post("", response_model=TagResponse, status_code=201)
def create_tag(data: TagCreate, session: S):
    existing = session.exec(select(Tag).where(Tag.name == data.name)).first()
    if existing:
        raise HTTPException(409, "Tag already exists")

    tag = Tag(id=generate_ulid(), name=data.name, color=data.color)
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
        select(func.count()).select_from(NoteTag).where(NoteTag.tag_id == tag_id)
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
