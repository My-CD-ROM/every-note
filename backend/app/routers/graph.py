from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.database import get_session
from app.models import Note, NoteLink, NoteTag
from app.schemas import GraphData, GraphEdge, GraphNode

router = APIRouter(prefix="/graph", tags=["graph"])
S = Annotated[Session, Depends(get_session)]


@router.get("", response_model=GraphData)
def get_graph(session: S):
    """Return all nodes and edges for the graph view."""
    notes = session.exec(
        select(Note).where(Note.is_trashed == False)  # noqa: E712
    ).all()

    if not notes:
        return GraphData(nodes=[], edges=[])

    nodes = [GraphNode(id=n.id, title=n.title or "Untitled", folder_id=n.folder_id) for n in notes]
    note_ids = {n.id for n in notes}
    edges: list[GraphEdge] = []

    # Wiki-link edges
    links = session.exec(select(NoteLink)).all()
    for link in links:
        if link.source_id in note_ids and link.target_id in note_ids:
            edges.append(GraphEdge(source=link.source_id, target=link.target_id, type="link"))

    # Shared-tag edges (notes sharing any tag)
    note_tags = session.exec(select(NoteTag)).all()
    tag_to_notes: dict[str, list[str]] = {}
    for nt in note_tags:
        if nt.note_id in note_ids:
            tag_to_notes.setdefault(nt.tag_id, []).append(nt.note_id)

    seen_tag_edges: set[tuple[str, str]] = set()
    for tag_notes in tag_to_notes.values():
        for i, a in enumerate(tag_notes):
            for b in tag_notes[i + 1:]:
                pair = (min(a, b), max(a, b))
                if pair not in seen_tag_edges:
                    seen_tag_edges.add(pair)
                    edges.append(GraphEdge(source=pair[0], target=pair[1], type="tag"))

    # Same-folder edges
    folder_to_notes: dict[str, list[str]] = {}
    for n in notes:
        if n.folder_id:
            folder_to_notes.setdefault(n.folder_id, []).append(n.id)

    seen_folder_edges: set[tuple[str, str]] = set()
    for folder_notes in folder_to_notes.values():
        for i, a in enumerate(folder_notes):
            for b in folder_notes[i + 1:]:
                pair = (min(a, b), max(a, b))
                if pair not in seen_folder_edges:
                    seen_folder_edges.add(pair)
                    edges.append(GraphEdge(source=pair[0], target=pair[1], type="folder"))

    return GraphData(nodes=nodes, edges=edges)
