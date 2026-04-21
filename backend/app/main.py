import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .config import settings

from .routers import projects, scripts, jobs, analysis, export, kb, analyze, feedback, extract_premise, find_angles, joke_to_premise, write


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize DB on startup."""
    init_db()
    logger.info("Database initialized")
    yield
    logger.info("Shutting down...")


app = FastAPI(
    title="喜剧分析工作台 API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(projects.router)
app.include_router(scripts.router)
app.include_router(jobs.router)
app.include_router(analysis.router)
app.include_router(export.router)
app.include_router(kb.router)
app.include_router(analyze.router)
app.include_router(feedback.router)
app.include_router(extract_premise.router)
app.include_router(find_angles.router)
app.include_router(joke_to_premise.router)
app.include_router(write.router)

@app.get("/health")
def health():
    return {"status": "ok"}
