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
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            icon TEXT,
            description TEXT,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

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

        CREATE TABLE IF NOT EXISTS reminders (
            id TEXT PRIMARY KEY,
            note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
            remind_at TEXT NOT NULL,
            is_fired INTEGER NOT NULL DEFAULT 0,
            is_dismissed INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

        CREATE INDEX IF NOT EXISTS idx_reminders_note ON reminders(note_id);

        CREATE TABLE IF NOT EXISTS attachments (
            id TEXT PRIMARY KEY,
            note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
            filename TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            size_bytes INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

        CREATE INDEX IF NOT EXISTS idx_attachments_note ON attachments(note_id);
        CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder_id);
        CREATE INDEX IF NOT EXISTS idx_notes_trashed ON notes(is_trashed);
        CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned) WHERE is_pinned = 1;
        CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
        CREATE INDEX IF NOT EXISTS idx_note_versions_note ON note_versions(note_id);
        CREATE INDEX IF NOT EXISTS idx_note_links_target ON note_links(target_id);
    """)

    # -- Finance: Spending --
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS spending_categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            position REAL DEFAULT 0,
            created_at TEXT NOT NULL
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS spending_entries (
            id TEXT PRIMARY KEY,
            category_id TEXT NOT NULL REFERENCES spending_categories(id) ON DELETE CASCADE,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
            amount REAL NOT NULL DEFAULT 0,
            UNIQUE(category_id, year, month)
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_spending_entries_cat ON spending_entries(category_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_spending_entries_year ON spending_entries(year)")

    # -- Finance: Income --
    cur.execute("""
        CREATE TABLE IF NOT EXISTS income_entries (
            id TEXT PRIMARY KEY,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
            gross REAL NOT NULL DEFAULT 0,
            UNIQUE(year, month)
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_income_entries_year ON income_entries(year)")

    # -- Finance: Utilities --
    cur.execute("""
        CREATE TABLE IF NOT EXISTS utility_addresses (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            position REAL DEFAULT 0,
            created_at TEXT NOT NULL
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS meter_readings (
            id TEXT PRIMARY KEY,
            address_id TEXT NOT NULL REFERENCES utility_addresses(id) ON DELETE CASCADE,
            utility_type TEXT NOT NULL,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
            reading REAL NOT NULL DEFAULT 0,
            UNIQUE(address_id, utility_type, year, month)
        )
    """)

    # Migration: remove CHECK constraint on utility_type for existing DBs
    has_check = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='meter_readings'"
    ).fetchone()
    if has_check and "CHECK (utility_type IN" in (has_check[0] or ""):
        conn.executescript("""
            CREATE TABLE meter_readings_new (
                id TEXT PRIMARY KEY,
                address_id TEXT NOT NULL REFERENCES utility_addresses(id) ON DELETE CASCADE,
                utility_type TEXT NOT NULL,
                year INTEGER NOT NULL,
                month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
                reading REAL NOT NULL DEFAULT 0,
                UNIQUE(address_id, utility_type, year, month)
            );
            INSERT INTO meter_readings_new SELECT * FROM meter_readings;
            DROP TABLE meter_readings;
            ALTER TABLE meter_readings_new RENAME TO meter_readings;
        """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_meter_readings_addr ON meter_readings(address_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_meter_readings_year ON meter_readings(year)")

    # -- Finance: Balance --
    cur.execute("""
        CREATE TABLE IF NOT EXISTS balance_entries (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            position REAL DEFAULT 0,
            uah REAL NOT NULL DEFAULT 0,
            usd REAL NOT NULL DEFAULT 0,
            eur REAL NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        )
    """)

    # Scheduled summaries
    cur.execute("""
        CREATE TABLE IF NOT EXISTS scheduled_summaries (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
            cron_expression TEXT NOT NULL,
            message_template TEXT NOT NULL DEFAULT 'You have {count} tasks',
            last_fired_at TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        )
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
        ("notes", "parent_id", "ALTER TABLE notes ADD COLUMN parent_id TEXT REFERENCES notes(id) ON DELETE CASCADE"),
        ("notes", "status", "ALTER TABLE notes ADD COLUMN status TEXT DEFAULT NULL"),
        ("notes", "project_id", "ALTER TABLE notes ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL"),
        ("notes", "recurrence_rule", "ALTER TABLE notes ADD COLUMN recurrence_rule TEXT DEFAULT NULL"),
        ("notes", "recurrence_source_id", "ALTER TABLE notes ADD COLUMN recurrence_source_id TEXT REFERENCES notes(id) ON DELETE SET NULL"),
        ("tags", "project_id", "ALTER TABLE tags ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE CASCADE"),
    ]
    for table, column, sql in migrations:
        try:
            conn.execute(sql)
        except sqlite3.OperationalError:
            pass  # Column already exists

    # Create indexes for migrated columns
    for idx_sql in [
        "CREATE INDEX IF NOT EXISTS idx_notes_daily_date ON notes(daily_date)",
        "CREATE INDEX IF NOT EXISTS idx_notes_parent ON notes(parent_id)",
        "CREATE INDEX IF NOT EXISTS idx_notes_project ON notes(project_id)",
    ]:
        try:
            conn.execute(idx_sql)
        except sqlite3.OperationalError:
            pass

    # Drop old unique constraint on tag name, replace with (name, project_id)
    try:
        conn.execute("DROP INDEX IF EXISTS ix_tags_name")
    except sqlite3.OperationalError:
        pass
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name_project ON tags(COALESCE(project_id, ''), name)")

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

    # Seed default scheduled summaries if table is empty
    count = conn.execute("SELECT COUNT(*) FROM scheduled_summaries").fetchone()[0]
    if count == 0:
        from app.models import generate_ulid
        now = conn.execute("SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now')").fetchone()[0]
        # Find the "weekend" folder
        weekend = conn.execute("SELECT id FROM folders WHERE LOWER(name) = 'weekend' LIMIT 1").fetchone()
        weekend_id = weekend[0] if weekend else None
        summaries = [
            # Weekend: Friday 18:00
            (generate_ulid(), "Weekend (Friday)", weekend_id, "0 18 * * 5", "You have {count} tasks for the weekend", now),
            # Weekend: Saturday 09:00
            (generate_ulid(), "Weekend (Saturday)", weekend_id, "0 9 * * 6", "You have {count} tasks for the weekend", now),
            # Weekend: Sunday 09:00
            (generate_ulid(), "Weekend (Sunday)", weekend_id, "0 9 * * 0", "You have {count} tasks for the weekend", now),
            # Daily: every day 09:00
            (generate_ulid(), "Daily", None, "0 9 * * *", "You have {count} tasks for today", now),
        ]
        conn.executemany(
            "INSERT INTO scheduled_summaries (id, name, folder_id, cron_expression, message_template, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            summaries,
        )

    conn.commit()
    conn.close()

    # Ensure attachments directory exists
    os.makedirs("data/attachments", exist_ok=True)
