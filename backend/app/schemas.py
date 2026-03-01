from typing import Literal, Optional

from pydantic import BaseModel


# --- Recurrence ---
class RecurrenceRule(BaseModel):
    freq: Literal["daily", "weekly", "monthly", "yearly"]
    interval: int = 1


# --- Notes ---
class NoteCreate(BaseModel):
    title: str = ""
    content: str = ""
    folder_id: Optional[str] = None
    note_type: str = "note"
    parent_id: Optional[str] = None
    status: Optional[str] = None
    project_id: Optional[str] = None
    recurrence_rule: Optional[RecurrenceRule] = None


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    folder_id: Optional[str] = None
    position: Optional[float] = None
    is_pinned: Optional[bool] = None
    due_at: Optional[str] = None
    note_type: Optional[str] = None
    is_completed: Optional[bool] = None
    parent_id: Optional[str] = None
    status: Optional[str] = None
    project_id: Optional[str] = None
    recurrence_rule: Optional[RecurrenceRule] = None


class TagBrief(BaseModel):
    id: str
    name: str
    color: str


class NoteResponse(BaseModel):
    id: str
    title: str
    content: str
    folder_id: Optional[str]
    position: float
    is_pinned: bool
    is_trashed: bool
    trashed_at: Optional[str]
    is_completed: bool
    completed_at: Optional[str]
    note_type: str
    is_daily: bool
    daily_date: Optional[str]
    due_at: Optional[str]
    parent_id: Optional[str]
    status: Optional[str]
    project_id: Optional[str]
    recurrence_rule: Optional[RecurrenceRule]
    recurrence_source_id: Optional[str]
    created_at: str
    updated_at: str
    tags: list[TagBrief] = []
    subtask_count: int = 0
    subtask_completed: int = 0


# --- Folders ---
class FolderCreate(BaseModel):
    name: str
    icon: Optional[str] = None
    parent_id: Optional[str] = None


class FolderUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    parent_id: Optional[str] = None
    position: Optional[float] = None


class FolderResponse(BaseModel):
    id: str
    name: str
    icon: Optional[str]
    parent_id: Optional[str]
    position: float
    created_at: str
    updated_at: str
    note_count: int = 0


class FolderTree(BaseModel):
    id: str
    name: str
    icon: Optional[str]
    parent_id: Optional[str]
    position: float
    note_count: int = 0
    children: list["FolderTree"] = []


# --- Tags ---
class TagCreate(BaseModel):
    name: str
    color: str = "#6366f1"


class TagUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class TagResponse(BaseModel):
    id: str
    name: str
    color: str
    created_at: str
    note_count: int = 0


# --- Projects ---
class ProjectCreate(BaseModel):
    name: str
    icon: Optional[str] = None
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    icon: Optional[str]
    description: Optional[str]
    created_at: str
    updated_at: str
    note_count: int = 0


# --- Search ---
class SearchResult(BaseModel):
    id: str
    title: str
    snippet: str
    folder_id: Optional[str]
    folder_name: Optional[str]
    parent_id: Optional[str] = None
    parent_title: Optional[str] = None
    rank: float


# --- Version History ---
class NoteVersionBrief(BaseModel):
    id: str
    title: str
    created_at: str


class NoteVersionResponse(BaseModel):
    id: str
    note_id: str
    title: str
    content: str
    created_at: str


# --- Backlinks & Graph ---
class BacklinkResponse(BaseModel):
    id: str
    title: str
    updated_at: str


class GraphNode(BaseModel):
    id: str
    title: str
    folder_id: Optional[str]


class GraphEdge(BaseModel):
    source: str
    target: str
    type: str  # "link", "tag", "folder"


class GraphData(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


# --- Reminders ---
class ReminderCreate(BaseModel):
    remind_at: str


class ReminderResponse(BaseModel):
    id: str
    note_id: str
    remind_at: str
    is_fired: bool
    is_dismissed: bool
    created_at: str


class ReminderWithNote(BaseModel):
    id: str
    note_id: str
    note_title: str
    remind_at: str
    is_fired: bool
    is_dismissed: bool


# --- Attachments ---
class AttachmentResponse(BaseModel):
    id: str
    note_id: str
    filename: str
    original_filename: str
    mime_type: str
    size_bytes: int
    created_at: str
    url: str


# --- Reorder ---
class ReorderItem(BaseModel):
    id: str
    position: float


class ReorderRequest(BaseModel):
    items: list[ReorderItem]


# --- Finance: Spending ---
class SpendingCategoryCreate(BaseModel):
    name: str


class SpendingCategoryUpdate(BaseModel):
    name: Optional[str] = None
    position: Optional[float] = None


class SpendingCategoryResponse(BaseModel):
    id: str
    name: str
    position: float
    created_at: str


class SpendingEntryUpsert(BaseModel):
    category_id: str
    year: int
    month: int
    amount: float


class SpendingEntryResponse(BaseModel):
    id: str
    category_id: str
    year: int
    month: int
    amount: float


# --- Finance: Income ---
class IncomeEntryUpsert(BaseModel):
    year: int
    month: int
    gross: float


class IncomeEntryResponse(BaseModel):
    id: str
    year: int
    month: int
    gross: float


# --- Finance: Utilities ---
class UtilityAddressCreate(BaseModel):
    name: str


class UtilityAddressUpdate(BaseModel):
    name: Optional[str] = None
    position: Optional[float] = None


class UtilityAddressResponse(BaseModel):
    id: str
    name: str
    position: float
    created_at: str


class MeterReadingUpsert(BaseModel):
    address_id: str
    utility_type: str  # 'gas' | 'water'
    year: int
    month: int
    reading: float


class MeterReadingResponse(BaseModel):
    id: str
    address_id: str
    utility_type: str
    year: int
    month: int
    reading: float


# --- Finance: Balance ---
class BalanceEntryCreate(BaseModel):
    name: str


class BalanceEntryUpdate(BaseModel):
    name: Optional[str] = None
    position: Optional[float] = None
    uah: Optional[float] = None
    usd: Optional[float] = None
    eur: Optional[float] = None


class BalanceEntryResponse(BaseModel):
    id: str
    name: str
    position: float
    uah: float
    usd: float
    eur: float
    created_at: str
