# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for Windows (run on Windows with Python 3.10+).
# Prerequisite: `npm run build` in ../frontend so ../frontend/dist exists.
from pathlib import Path

block_cipher = None

spec_dir = Path(SPEC).resolve().parent
project_root = spec_dir.parent
frontend_dist = project_root / "frontend" / "dist"

if not frontend_dist.is_dir():
    raise SystemExit(
        f"Missing frontend build: {frontend_dist}\n"
        "Run: cd frontend && npm ci && npm run build"
    )

datas = [(str(frontend_dist), "frontend_dist")]

hiddenimports = [
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "uvicorn.lifespan.off",
    "websockets",
    "websockets.legacy",
    "websockets.legacy.server",
    "email_validator",
    "aiosqlite",
    "apscheduler",
    "apscheduler.schedulers.asyncio",
    "jose",
    "bcrypt",
    "cryptography",
    "httpx",
    "openai",
    "anyio._backends._asyncio",
]

a = Analysis(
    ["run_desktop.py"],
    pathex=[str(spec_dir)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="AITodoApp",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="AITodoApp",
)
