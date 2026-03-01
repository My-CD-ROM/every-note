from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import attachments, daily, export, folders, graph, notes, projects, search, tags


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Every Note", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(notes.router)
app.include_router(folders.router)
app.include_router(tags.router)
app.include_router(projects.router)
app.include_router(search.router)
app.include_router(daily.router)
app.include_router(export.router)
app.include_router(graph.router)
app.include_router(attachments.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
