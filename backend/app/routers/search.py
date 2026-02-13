import re

from fastapi import APIRouter, Query
from sqlalchemy import text
from sqlmodel import Session

from app.database import engine
from app.schemas import SearchResult

router = APIRouter(prefix="/search", tags=["search"])


def sanitize_fts_query(raw: str) -> str:
    """Sanitize user input for FTS5 MATCH queries.

    Wraps each word in quotes and appends a prefix wildcard for autocomplete.
    This prevents FTS5 syntax errors from unmatched quotes/operators.
    """
    words = re.findall(r'\w+', raw)
    if not words:
        return ""
    return " ".join(f'"{w}"*' for w in words)


@router.get("", response_model=list[SearchResult])
def search_notes(q: str = Query(..., min_length=1), limit: int = Query(20, le=100)):
    fts_query = sanitize_fts_query(q)
    if not fts_query:
        return []

    with Session(engine) as session:
        stmt = text("""
            SELECT
                n.id,
                n.title,
                snippet(notes_fts, 1, '<mark>', '</mark>', '...', 48) as snippet,
                n.folder_id,
                f.name as folder_name,
                bm25(notes_fts, 10.0, 1.0) as rank
            FROM notes_fts
            JOIN notes n ON n.rowid = notes_fts.rowid
            LEFT JOIN folders f ON f.id = n.folder_id
            WHERE notes_fts MATCH :query
              AND n.is_trashed = 0
            ORDER BY bm25(notes_fts, 10.0, 1.0)
            LIMIT :limit
        """).bindparams(query=fts_query, limit=limit)
        rows = session.exec(stmt).all()

        return [
            SearchResult(
                id=row[0],
                title=row[1],
                snippet=row[2],
                folder_id=row[3],
                folder_name=row[4],
                rank=row[5],
            )
            for row in rows
        ]
