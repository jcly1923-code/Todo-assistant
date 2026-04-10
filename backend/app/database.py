import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./data/todo.db")

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def _pragma_cols(sync_conn, table: str) -> set[str]:
    rows = sync_conn.exec_driver_sql(f"PRAGMA table_info({table})").fetchall()
    return {row[1] for row in rows}


def _table_exists(sync_conn, name: str) -> bool:
    r = sync_conn.exec_driver_sql(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
        (name,),
    ).fetchone()
    return r is not None


def _migrate_sqlite_phase1(sync_conn) -> None:
    """用户表 + todos.user_id；不依赖 users 非空。"""
    if sync_conn.dialect.name != "sqlite":
        return

    cols = _pragma_cols(sync_conn, "todos")
    if "completed_at" not in cols:
        sync_conn.exec_driver_sql("ALTER TABLE todos ADD COLUMN completed_at DATETIME")

    sync_conn.exec_driver_sql(
        "UPDATE todos SET status = 'in_progress' WHERE status = 'pending'"
    )
    sync_conn.exec_driver_sql(
        "UPDATE todos SET status = 'completed' WHERE status = 'cancelled'"
    )

    sync_conn.exec_driver_sql(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email VARCHAR(255) NOT NULL UNIQUE,
            hashed_password VARCHAR(255) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    cols = _pragma_cols(sync_conn, "todos")
    if "user_id" not in cols:
        sync_conn.exec_driver_sql(
            "ALTER TABLE todos ADD COLUMN user_id INTEGER REFERENCES users(id)"
        )


def _migrate_sqlite_phase2(sync_conn) -> None:
    """依赖 users 中至少有一行（bootstrap 之后）。"""
    if sync_conn.dialect.name != "sqlite":
        return

    has_user = sync_conn.exec_driver_sql("SELECT 1 FROM users LIMIT 1").fetchone()
    if not has_user:
        return

    if _table_exists(sync_conn, "tags") and "user_id" not in _pragma_cols(sync_conn, "tags"):
        sync_conn.exec_driver_sql("PRAGMA foreign_keys=OFF")
        sync_conn.exec_driver_sql(
            """
            CREATE TABLE tags_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                name VARCHAR(50) NOT NULL,
                color VARCHAR(20),
                UNIQUE(user_id, name)
            )
            """
        )
        sync_conn.exec_driver_sql(
            """
            INSERT INTO tags_new (id, user_id, name, color)
            SELECT id, (SELECT id FROM users LIMIT 1), name, color FROM tags
            """
        )
        sync_conn.exec_driver_sql("DROP TABLE tags")
        sync_conn.exec_driver_sql("ALTER TABLE tags_new RENAME TO tags")
        sync_conn.exec_driver_sql("PRAGMA foreign_keys=ON")

    if _table_exists(sync_conn, "daily_reports") and "user_id" not in _pragma_cols(
        sync_conn, "daily_reports"
    ):
        sync_conn.exec_driver_sql("PRAGMA foreign_keys=OFF")
        sync_conn.exec_driver_sql(
            """
            CREATE TABLE daily_reports_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                report_date DATE NOT NULL,
                content TEXT NOT NULL,
                method VARCHAR(32) NOT NULL,
                created_at DATETIME,
                UNIQUE(user_id, report_date)
            )
            """
        )
        sync_conn.exec_driver_sql(
            """
            INSERT INTO daily_reports_new (id, user_id, report_date, content, method, created_at)
            SELECT id, (SELECT id FROM users LIMIT 1), report_date, content, method, created_at
            FROM daily_reports
            """
        )
        sync_conn.exec_driver_sql("DROP TABLE daily_reports")
        sync_conn.exec_driver_sql("ALTER TABLE daily_reports_new RENAME TO daily_reports")
        sync_conn.exec_driver_sql("PRAGMA foreign_keys=ON")

    if _table_exists(sync_conn, "weekly_reports") and "user_id" not in _pragma_cols(
        sync_conn, "weekly_reports"
    ):
        sync_conn.exec_driver_sql("PRAGMA foreign_keys=OFF")
        sync_conn.exec_driver_sql(
            """
            CREATE TABLE weekly_reports_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                week_start DATE NOT NULL,
                week_end DATE NOT NULL,
                content TEXT NOT NULL,
                method VARCHAR(32) NOT NULL,
                created_at DATETIME,
                UNIQUE(user_id, week_start)
            )
            """
        )
        sync_conn.exec_driver_sql(
            """
            INSERT INTO weekly_reports_new (id, user_id, week_start, week_end, content, method, created_at)
            SELECT id, (SELECT id FROM users LIMIT 1), week_start, week_end, content, method, created_at
            FROM weekly_reports
            """
        )
        sync_conn.exec_driver_sql("DROP TABLE weekly_reports")
        sync_conn.exec_driver_sql("ALTER TABLE weekly_reports_new RENAME TO weekly_reports")
        sync_conn.exec_driver_sql("PRAGMA foreign_keys=ON")

    if _table_exists(sync_conn, "todos") and "user_id" in _pragma_cols(sync_conn, "todos"):
        sync_conn.exec_driver_sql(
            """
            UPDATE todos SET user_id = (SELECT id FROM users LIMIT 1)
            WHERE user_id IS NULL
            """
        )


def _migrate_sqlite_phase3(sync_conn) -> None:
    """users.is_active / last_login_at；admin 与 reset 表由 metadata.create_all 创建。"""
    if sync_conn.dialect.name != "sqlite":
        return
    if not _table_exists(sync_conn, "users"):
        return
    cols = _pragma_cols(sync_conn, "users")
    if "is_active" not in cols:
        sync_conn.exec_driver_sql(
            "ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1"
        )
    if "last_login_at" not in cols:
        sync_conn.exec_driver_sql("ALTER TABLE users ADD COLUMN last_login_at DATETIME")


def _migrate_sqlite_phase4(sync_conn) -> None:
    """users 自动化 AI 凭据列"""
    if sync_conn.dialect.name != "sqlite":
        return
    if not _table_exists(sync_conn, "users"):
        return
    cols = _pragma_cols(sync_conn, "users")
    if "ai_provider" not in cols:
        sync_conn.exec_driver_sql("ALTER TABLE users ADD COLUMN ai_provider VARCHAR(50)")
    if "ai_model_name" not in cols:
        sync_conn.exec_driver_sql("ALTER TABLE users ADD COLUMN ai_model_name VARCHAR(100)")
    if "ai_api_key" not in cols:
        sync_conn.exec_driver_sql("ALTER TABLE users ADD COLUMN ai_api_key VARCHAR(512)")
    if "ai_base_url" not in cols:
        sync_conn.exec_driver_sql("ALTER TABLE users ADD COLUMN ai_base_url VARCHAR(300)")


def _migrate_sqlite_phase5(sync_conn) -> None:
    """daily_reports 明日建议 JSON（与手动生成一致，供列表接口返回）。"""
    if sync_conn.dialect.name != "sqlite":
        return
    if not _table_exists(sync_conn, "daily_reports"):
        return
    cols = _pragma_cols(sync_conn, "daily_reports")
    if "tomorrow_suggestions" not in cols:
        sync_conn.exec_driver_sql(
            "ALTER TABLE daily_reports ADD COLUMN tomorrow_suggestions JSON"
        )


async def _bootstrap_legacy_user() -> None:
    from sqlalchemy import func, select, text, update

    from app.models import User, Todo
    from app.auth.security import get_password_hash

    async with async_session() as session:
        async def _table_row_count(table: str) -> int:
            try:
                r = await session.execute(text(f"SELECT COUNT(*) FROM {table}"))
                return int(r.scalar() or 0)
            except Exception:
                return 0

        n_users = await session.scalar(select(func.count()).select_from(User))
        if n_users and n_users > 0:
            return
        orphan_todos = await session.scalar(
            select(func.count(Todo.id)).where(Todo.user_id.is_(None))
        )
        has_legacy_data = (orphan_todos or 0) > 0 or await _table_row_count("tags") > 0
        if not has_legacy_data:
            return
        from app.config import get_bootstrap_legacy_user_credentials

        creds = get_bootstrap_legacy_user_credentials()
        if creds is None:
            return
        email, password = creds
        user = User(email=email, hashed_password=get_password_hash(password))
        session.add(user)
        await session.commit()
        await session.refresh(user)
        uid = user.id
        await session.execute(update(Todo).where(Todo.user_id.is_(None)).values(user_id=uid))
        await session.commit()


async def _bootstrap_admin() -> None:
    from sqlalchemy import func, select

    from app.models import AdminUser
    from app.auth.security import get_password_hash

    async with async_session() as session:
        n = await session.scalar(select(func.count()).select_from(AdminUser))
        if n and n > 0:
            return
        from app.config import get_bootstrap_admin_credentials

        creds = get_bootstrap_admin_credentials()
        if creds is None:
            return
        email, password = creds
        admin = AdminUser(email=email, hashed_password=get_password_hash(password))
        session.add(admin)
        await session.commit()


async def init_db():
    from app import models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_migrate_sqlite_phase1)

    await _bootstrap_legacy_user()

    async with engine.begin() as conn:
        await conn.run_sync(_migrate_sqlite_phase2)
        await conn.run_sync(_migrate_sqlite_phase3)
        await conn.run_sync(_migrate_sqlite_phase4)
        await conn.run_sync(_migrate_sqlite_phase5)

    await _bootstrap_admin()


async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session
