from datetime import datetime, date
from typing import Optional
from sqlalchemy import (
    JSON,
    String,
    Text,
    Integer,
    Boolean,
    DateTime,
    Date,
    Enum,
    ForeignKey,
    Table,
    Column,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum


# ---------- Enums ----------

class TodoStatus(str, enum.Enum):
    in_progress = "in_progress"
    completed = "completed"


class ReportMethod(str, enum.Enum):
    auto = "auto"
    manual = "manual"


# ---------- Association Table ----------

todo_tag = Table(
    "todo_tag",
    Base.metadata,
    Column("todo_id", Integer, ForeignKey("todos.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


# ---------- Models ----------

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=None)
    # 用户同意写入、供定时日报/周报使用的 AI 凭据（与浏览器 localStorage 无关）
    ai_provider: Mapped[Optional[str]] = mapped_column(String(50), default=None)
    ai_model_name: Mapped[Optional[str]] = mapped_column(String(100), default=None)
    ai_api_key: Mapped[Optional[str]] = mapped_column(String(512), default=None)
    ai_base_url: Mapped[Optional[str]] = mapped_column(String(300), default=None)

    todos: Mapped[list["Todo"]] = relationship(back_populates="owner", lazy="selectin")
    tags: Mapped[list["Tag"]] = relationship(back_populates="owner", lazy="selectin")
    password_reset_tokens: Mapped[list["PasswordResetToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class AdminUser(Base):
    __tablename__ = "admin_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=None)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="password_reset_tokens")


class Todo(Base):
    __tablename__ = "todos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, default=None)
    status: Mapped[TodoStatus] = mapped_column(
        Enum(TodoStatus), default=TodoStatus.in_progress, nullable=False
    )
    location: Mapped[Optional[str]] = mapped_column(String(200), default=None)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=None)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    owner: Mapped["User"] = relationship(back_populates="todos")
    tags: Mapped[list["Tag"]] = relationship(
        secondary=todo_tag, back_populates="todos", lazy="selectin"
    )


class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_tag_user_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    color: Mapped[Optional[str]] = mapped_column(String(20), default="#3b82f6")

    owner: Mapped["User"] = relationship(back_populates="tags")
    todos: Mapped[list["Todo"]] = relationship(
        secondary=todo_tag, back_populates="tags", lazy="selectin"
    )


class DailyReport(Base):
    __tablename__ = "daily_reports"
    __table_args__ = (UniqueConstraint("user_id", "report_date", name="uq_daily_user_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    tomorrow_suggestions: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    method: Mapped[ReportMethod] = mapped_column(
        Enum(ReportMethod), default=ReportMethod.manual
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class WeeklyReport(Base):
    __tablename__ = "weekly_reports"
    __table_args__ = (UniqueConstraint("user_id", "week_start", name="uq_weekly_user_start"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    week_start: Mapped[date] = mapped_column(Date, nullable=False)
    week_end: Mapped[date] = mapped_column(Date, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    method: Mapped[ReportMethod] = mapped_column(
        Enum(ReportMethod), default=ReportMethod.manual
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AIConfig(Base):
    __tablename__ = "ai_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    api_key: Mapped[str] = mapped_column(String(200), nullable=False)
    base_url: Mapped[Optional[str]] = mapped_column(String(300), default=None)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class WritingSample(Base):
    """用户自写日报素材，用于学习语气。"""

    __tablename__ = "writing_samples"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class UserToneProfile(Base):
    """每人一行：从自写日报提炼的语气库摘要。"""

    __tablename__ = "user_tone_profiles"

    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    tone_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    profile_text: Mapped[Optional[str]] = mapped_column(Text, default=None)
    last_error: Mapped[Optional[str]] = mapped_column(Text, default=None)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=None)


class ReportScheduleConfig(Base):
    __tablename__ = "report_schedule_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Shanghai", nullable=False)
    daily_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    daily_hour: Mapped[int] = mapped_column(Integer, default=22, nullable=False)
    daily_minute: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    weekly_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    weekly_day_of_week: Mapped[int] = mapped_column(Integer, default=6, nullable=False)
    weekly_hour: Mapped[int] = mapped_column(Integer, default=22, nullable=False)
    weekly_minute: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
