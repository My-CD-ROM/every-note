from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlmodel import Session, select, func

from app.database import get_session
from app.models import Folder, Note, generate_ulid, utc_now
from app.schemas import FolderCreate, FolderResponse, FolderTree, FolderUpdate, ReorderRequest

router = APIRouter(prefix="/folders", tags=["folders"])
S = Annotated[Session, Depends(get_session)]


@router.get("", response_model=list[FolderResponse])
def list_folders(session: S, parent_id: Optional[str] = None):
    query = select(Folder).where(Folder.parent_id == parent_id).order_by(Folder.position)
    folders = session.exec(query).all()

    result = []
    for f in folders:
        count = session.exec(
            select(func.count()).select_from(Note).where(
                Note.folder_id == f.id, Note.is_trashed == False  # noqa: E712
            )
        ).one()
        result.append(FolderResponse(**f.model_dump(), note_count=count))
    return result


@router.get("/tree", response_model=list[FolderTree])
def get_folder_tree(session: S):
    """Return full folder tree using recursive CTE."""
    rows = session.exec(text("""
        WITH RECURSIVE tree AS (
            SELECT f.id, f.name, f.icon, f.parent_id, f.position,
                   (SELECT COUNT(*) FROM notes n WHERE n.folder_id = f.id AND n.is_trashed = 0) as note_count
            FROM folders f
        )
        SELECT * FROM tree ORDER BY position
    """)).all()

    folder_map: dict[str, FolderTree] = {}
    roots: list[FolderTree] = []

    for row in rows:
        node = FolderTree(
            id=row[0], name=row[1], icon=row[2], parent_id=row[3],
            position=row[4], note_count=row[5], children=[],
        )
        folder_map[node.id] = node

    for node in folder_map.values():
        if node.parent_id and node.parent_id in folder_map:
            folder_map[node.parent_id].children.append(node)
        else:
            roots.append(node)

    return roots


@router.get("/{folder_id}", response_model=FolderResponse)
def get_folder(folder_id: str, session: S):
    folder = session.get(Folder, folder_id)
    if not folder:
        raise HTTPException(404, "Folder not found")
    count = session.exec(
        select(func.count()).select_from(Note).where(
            Note.folder_id == folder_id, Note.is_trashed == False  # noqa: E712
        )
    ).one()
    return FolderResponse(**folder.model_dump(), note_count=count)


@router.post("", response_model=FolderResponse, status_code=201)
def create_folder(data: FolderCreate, session: S):
    folder = Folder(
        id=generate_ulid(),
        name=data.name,
        icon=data.icon,
        parent_id=data.parent_id,
    )
    session.add(folder)
    session.commit()
    session.refresh(folder)
    return FolderResponse(**folder.model_dump(), note_count=0)


@router.patch("/{folder_id}", response_model=FolderResponse)
def update_folder(folder_id: str, data: FolderUpdate, session: S):
    folder = session.get(Folder, folder_id)
    if not folder:
        raise HTTPException(404, "Folder not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(folder, key, value)
    folder.updated_at = utc_now()

    session.add(folder)
    session.commit()
    session.refresh(folder)

    count = session.exec(
        select(func.count()).select_from(Note).where(
            Note.folder_id == folder_id, Note.is_trashed == False  # noqa: E712
        )
    ).one()
    return FolderResponse(**folder.model_dump(), note_count=count)


@router.delete("/{folder_id}")
def delete_folder(folder_id: str, session: S):
    folder = session.get(Folder, folder_id)
    if not folder:
        raise HTTPException(404, "Folder not found")
    session.delete(folder)
    session.commit()
    return {"ok": True}


@router.post("/reorder")
def reorder_folders(data: ReorderRequest, session: S):
    for item in data.items:
        folder = session.get(Folder, item.id)
        if folder:
            folder.position = item.position
            session.add(folder)
    session.commit()
    return {"ok": True}
