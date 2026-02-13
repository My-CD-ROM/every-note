import os
import sqlite3

from sqlmodel import Session, create_engine

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///data/every_note.db")

# Ensure data directory exists
os.makedirs("data", exist_ok=True)

engine = create_engine(DATABASE_URL, echo=False)


def get_session():
    with Session(engine) as session:
        yield session


def init_db():
    """Initialize database schema, FTS5 virtual table, and triggers."""
    # Use raw sqlite3 for DDL that SQLModel/SQLAlchemy can't handle (FTS5, triggers)
    db_path = DATABASE_URL.replace("sqlite:///", "")
    os.makedirs(os.path.dirname(db_path) if os.path.dirname(db_path) else ".", exist_ok=True)

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")

    conn.executescript("""
        CREATE TABLE IF NOT EXISTS folders (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
            position REAL NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL DEFAULT '',
            folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
            position REAL NOT NULL DEFAULT 0,
            is_pinned INTEGER NOT NULL DEFAULT 0,
            is_trashed INTEGER NOT NULL DEFAULT 0,
            trashed_at TEXT,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

        CREATE TABLE IF NOT EXISTS tags (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            color TEXT NOT NULL DEFAULT '#6366f1',
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

        CREATE TABLE IF NOT EXISTS note_tags (
            note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
            tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
            PRIMARY KEY (note_id, tag_id)
        );

        CREATE TABLE IF NOT EXISTS note_versions (
            id TEXT PRIMARY KEY,
            note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
            title TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

        CREATE TABLE IF NOT EXISTS note_links (
            source_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
            target_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
            PRIMARY KEY (source_id, target_id)
        );

        CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder_id);
        CREATE INDEX IF NOT EXISTS idx_notes_trashed ON notes(is_trashed);
        CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned) WHERE is_pinned = 1;
        CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
        CREATE INDEX IF NOT EXISTS idx_note_versions_note ON note_versions(note_id);
        CREATE INDEX IF NOT EXISTS idx_note_links_target ON note_links(target_id);
    """)

    # ALTER TABLE migrations for new columns on existing tables
    migrations = [
        ("notes", "is_daily", "ALTER TABLE notes ADD COLUMN is_daily INTEGER NOT NULL DEFAULT 0"),
        ("notes", "daily_date", "ALTER TABLE notes ADD COLUMN daily_date TEXT"),
        ("notes", "due_at", "ALTER TABLE notes ADD COLUMN due_at TEXT"),
        ("folders", "icon", "ALTER TABLE folders ADD COLUMN icon TEXT"),
        ("notes", "note_type", "ALTER TABLE notes ADD COLUMN note_type TEXT NOT NULL DEFAULT 'note'"),
        ("notes", "is_completed", "ALTER TABLE notes ADD COLUMN is_completed INTEGER NOT NULL DEFAULT 0"),
        ("notes", "completed_at", "ALTER TABLE notes ADD COLUMN completed_at TEXT"),
    ]
    for table, column, sql in migrations:
        try:
            conn.execute(sql)
        except sqlite3.OperationalError:
            pass  # Column already exists

    # Create index for daily_date after migration
    try:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_notes_daily_date ON notes(daily_date)")
    except sqlite3.OperationalError:
        pass

    # Create FTS5 virtual table (must check separately since CREATE ... IF NOT EXISTS not supported for virtual tables)
    fts_exists = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='notes_fts'"
    ).fetchone()

    if not fts_exists:
        conn.execute("""
            CREATE VIRTUAL TABLE notes_fts USING fts5(
                title, content,
                content='notes',
                content_rowid='rowid',
                tokenize='porter unicode61 remove_diacritics 2'
            )
        """)

        # Sync triggers
        conn.executescript("""
            CREATE TRIGGER IF NOT EXISTS notes_fts_insert AFTER INSERT ON notes BEGIN
                INSERT INTO notes_fts(rowid, title, content)
                VALUES (new.rowid, new.title, new.content);
            END;

            CREATE TRIGGER IF NOT EXISTS notes_fts_delete AFTER DELETE ON notes BEGIN
                INSERT INTO notes_fts(notes_fts, rowid, title, content)
                VALUES ('delete', old.rowid, old.title, old.content);
            END;

            CREATE TRIGGER IF NOT EXISTS notes_fts_update AFTER UPDATE OF title, content ON notes BEGIN
                INSERT INTO notes_fts(notes_fts, rowid, title, content)
                VALUES ('delete', old.rowid, old.title, old.content);
                INSERT INTO notes_fts(rowid, title, content)
                VALUES (new.rowid, new.title, new.content);
            END;
        """)

    conn.commit()
    conn.close()
