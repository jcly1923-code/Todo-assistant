"""
Desktop / PyInstaller entry: set paths before importing the app, then run uvicorn.

Run from repo: cd backend && ./venv/bin/python run_desktop.py
Windows .exe: build with PyInstaller (see build_windows.ps1).
"""
from __future__ import annotations

import multiprocessing
import os
import sys
import webbrowser
from pathlib import Path


def _bootstrap_env() -> None:
    if not getattr(sys, "frozen", False):
        return
    meipass = Path(sys._MEIPASS)
    os.environ.setdefault("FRONTEND_DIST", str(meipass / "frontend_dist"))
    if sys.platform == "win32":
        base = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
        data = Path(base) / "AITodoApp"
    elif sys.platform == "darwin":
        data = Path.home() / "Library" / "Application Support" / "AITodoApp"
    else:
        data = Path.home() / ".local" / "share" / "aitodoapp"
    data.mkdir(parents=True, exist_ok=True)
    db_path = data / "todo.db"
    os.environ.setdefault("DATABASE_URL", f"sqlite+aiosqlite:///{db_path.as_posix()}")


_bootstrap_env()

from app.main import app  # noqa: E402


def main() -> None:
    import uvicorn

    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    url = f"http://{host}:{port}"
    if os.environ.get("TODO_OPEN_BROWSER", "1") != "0":
        webbrowser.open(url)
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
