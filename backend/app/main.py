# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Todo Assistant contributors

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.database import init_db
from app.routers import todos, tags, reports, settings, auth, admin, tone
from app.scheduler import start_scheduler


def _static_root() -> Path | None:
    p = os.getenv("FRONTEND_DIST", "").strip()
    if not p:
        return None
    r = Path(p).resolve()
    return r if r.is_dir() else None


STATIC_ROOT = _static_root()

app = FastAPI(title="待办助手")

# 开发默认 + 可选 CORS_ORIGINS（逗号分隔，用于服务器上前端与 API 不同域名等场景）
_cors_dev = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
]
_extra = [x.strip() for x in os.getenv("CORS_ORIGINS", "").split(",") if x.strip()]
_cors_origins = list(dict.fromkeys(_cors_dev + _extra))
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    await init_db()
    await start_scheduler()


app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(todos.router, prefix="/api/todos", tags=["Todos"])
app.include_router(tags.router, prefix="/api/tags", tags=["Tags"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(settings.router, prefix="/api/settings", tags=["Settings"])
app.include_router(tone.router, prefix="/api/tone", tags=["Tone"])

if STATIC_ROOT:
    _assets = STATIC_ROOT / "assets"
    if _assets.is_dir():
        app.mount("/assets", StaticFiles(directory=_assets), name="assets")

    @app.get("/", include_in_schema=False)
    async def spa_index():
        return FileResponse(STATIC_ROOT / "index.html")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        if full_path.startswith("api"):
            raise HTTPException(status_code=404, detail="Not found")
        candidate = STATIC_ROOT / full_path
        try:
            if candidate.is_file():
                resolved = candidate.resolve()
                if resolved.is_relative_to(STATIC_ROOT):
                    return FileResponse(candidate)
        except (ValueError, OSError):
            pass
        return FileResponse(STATIC_ROOT / "index.html")

else:

    @app.get("/")
    def read_root():
        return {"message": "Welcome to 待办助手 API"}
