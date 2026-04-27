import json
import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from .database import init_db
from .config import settings

from .routers import projects, scripts, jobs, analysis, export, kb, analyze, feedback, extract_premise, find_angles, joke_to_premise, write, auth, write_stream, detect_input, stage_version, workflow
from .utils.logging import set_request_context, get_request_id


class JsonFormatter(logging.Formatter):
    """输出 JSON 兼容的结构化日志，extra.struct 字段作为顶级 JSON 字段输出。"""
    def format(self, record):
        base = {
            "time": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if hasattr(record, "struct"):
            base.update(record.struct)
        return json.dumps(base, ensure_ascii=False)


def setup_logging():
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    # Remove default handler
    for h in root.handlers[:]:
        root.removeHandler(h)
    # Console handler with JSON output
    ch = logging.StreamHandler()
    ch.setFormatter(JsonFormatter())
    root.addHandler(ch)
    # uvicorn access logs -> same format
    for logger_name in ["uvicorn", "uvicorn.error", "uvicorn.access"]:
        l = logging.getLogger(logger_name)
        l.setLevel(logging.WARNING)
        for h in l.handlers[:]:
            l.removeHandler(h)
        h = logging.StreamHandler()
        h.setFormatter(JsonFormatter())
        l.addHandler(h)


setup_logging()
logger = logging.getLogger(__name__)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """为每个请求注入 request_id，所有日志可串联。"""
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = request_id
        route = f"{request.method} {request.url.path}"
        set_request_context(request_id, route)
        # 响应头也透传回去
        response: Response = await call_next(request)
        response.headers["x-request-id"] = request_id
        return response


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

app.add_middleware(RequestIDMiddleware)

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
app.include_router(auth.router)
app.include_router(write_stream.router)
app.include_router(detect_input.router)
app.include_router(stage_version.router)
app.include_router(workflow.router)

@app.get("/health")
def health():
    return {"status": "ok"}
