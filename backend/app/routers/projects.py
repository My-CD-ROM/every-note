from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func

from app.database import get_session
from app.models import Note, Project, generate_ulid, utc_now
from app.schemas import ProjectCreate, ProjectResponse, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])
S = Annotated[Session, Depends(get_session)]


@router.get("", response_model=list[ProjectResponse])
def list_projects(session: S):
    projects = session.exec(select(Project).order_by(Project.created_at)).all()
    result = []
    for p in projects:
        count = session.exec(
            select(func.count()).select_from(Note).where(
                Note.project_id == p.id, Note.is_trashed == False  # noqa: E712
            )
        ).one()
        result.append(ProjectResponse(**p.model_dump(), note_count=count))
    return result


@router.post("", response_model=ProjectResponse, status_code=201)
def create_project(data: ProjectCreate, session: S):
    project = Project(
        id=generate_ulid(),
        name=data.name,
        icon=data.icon,
        description=data.description,
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    return ProjectResponse(**project.model_dump(), note_count=0)


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: str, data: ProjectUpdate, session: S):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)
    project.updated_at = utc_now()

    session.add(project)
    session.commit()
    session.refresh(project)

    count = session.exec(
        select(func.count()).select_from(Note).where(
            Note.project_id == project_id, Note.is_trashed == False  # noqa: E712
        )
    ).one()
    return ProjectResponse(**project.model_dump(), note_count=count)


@router.delete("/{project_id}")
def delete_project(project_id: str, session: S):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    # Unset project_id on notes — notes survive deletion
    notes = session.exec(
        select(Note).where(Note.project_id == project_id)
    ).all()
    for note in notes:
        note.project_id = None
        session.add(note)

    session.delete(project)
    session.commit()
    return {"ok": True}
