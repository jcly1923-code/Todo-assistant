from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from app.auth.password_rules import validate_password_strength
from app.models import TodoStatus, ReportMethod


# ---------- Auth ----------

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return validate_password_strength(v)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    created_at: datetime
    is_active: bool = True
    last_login_at: Optional[datetime] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=72)

    @field_validator("new_password")
    @classmethod
    def new_password_strength(cls, v: str) -> str:
        return validate_password_strength(v)


class ClaimLegacyOut(BaseModel):
    orphan_todos_attached: int
    bootstrap_user_found: bool
    bootstrap_email: Optional[str] = None
    moved_todos_from_bootstrap: int = 0
    tags_reassigned_or_merged: int = 0
    removed_bootstrap_user: bool = False
    message: str


class ResetPasswordValidateOut(BaseModel):
    valid: bool


class ResetPasswordWithToken(BaseModel):
    token: str = Field(min_length=10)
    new_password: str = Field(min_length=6, max_length=72)

    @field_validator("new_password")
    @classmethod
    def new_password_strength(cls, v: str) -> str:
        return validate_password_strength(v)


# ---------- Admin (独立管理员，与业务 User 隔离) ----------

class AdminLogin(BaseModel):
    email: EmailStr
    password: str


class AdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    created_at: datetime
    is_active: bool = True
    last_login_at: Optional[datetime] = None


class AdminTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin: AdminOut


class AdminUserListItem(BaseModel):
    id: int
    email: str
    created_at: datetime
    last_login_at: Optional[datetime] = None
    is_active: bool


class AdminUserListResponse(BaseModel):
    items: list[AdminUserListItem]
    total: int


class AdminUserPatch(BaseModel):
    is_active: Optional[bool] = None


class RequestResetResponse(BaseModel):
    message: str


# ---------- Tag ----------

class TagBase(BaseModel):
    name: str
    color: Optional[str] = "#3b82f6"

class TagCreate(TagBase):
    pass

class TagOut(TagBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---------- Todo ----------

class TodoBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: TodoStatus = TodoStatus.in_progress
    location: Optional[str] = None
    due_date: Optional[datetime] = None

class TodoCreate(TodoBase):
    tag_ids: list[int] = []
    created_at: Optional[datetime] = None

class TodoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TodoStatus] = None
    location: Optional[str] = None
    due_date: Optional[datetime] = None
    created_at: Optional[datetime] = None
    tag_ids: Optional[list[int]] = None

class TodoOut(TodoBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    tags: list[TagOut] = []
    created_at: datetime
    completed_at: Optional[datetime] = None
    updated_at: datetime


# ---------- DailyReport ----------

class TomorrowSuggestionItem(BaseModel):
    title: str


class TomorrowSuggestionsUpdate(BaseModel):
    items: list[TomorrowSuggestionItem] = Field(default_factory=list)


class DailyReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    report_date: date
    content: str
    method: ReportMethod
    created_at: datetime
    tomorrow_suggestions: list[TomorrowSuggestionItem] = Field(default_factory=list)

    @field_validator("tomorrow_suggestions", mode="before")
    @classmethod
    def _coalesce_tomorrow(cls, v):
        return v if v is not None else []

class GenerateReportRequest(BaseModel):
    target_date: Optional[date] = None
    ai_config: Optional["AIRuntimeConfig"] = None


# ---------- WeeklyReport ----------

class WeeklyReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    week_start: date
    week_end: date
    content: str
    method: ReportMethod
    created_at: datetime

class GenerateWeeklyReportRequest(BaseModel):
    week_start: Optional[date] = None
    ai_config: Optional["AIRuntimeConfig"] = None


# ---------- AIConfig ----------

class AIConfigBase(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    provider: str
    model_name: str
    api_key: str
    base_url: Optional[str] = None

class AIConfigCreate(AIConfigBase):
    pass

class AIConfigUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    provider: Optional[str] = None
    model_name: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None

class AIConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())
    id: int
    provider: str
    model_name: str
    api_key: str
    base_url: Optional[str]
    is_active: bool
    created_at: datetime


class AIConfigValidateRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    provider: str
    model_name: str
    api_key: str
    base_url: Optional[str] = None


class AIConfigValidateResponse(BaseModel):
    ok: bool
    message: str


class AIAutomationStatusOut(BaseModel):
    has_stored_automation_ai: bool


class AIRuntimeConfig(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    provider: str
    model_name: str
    api_key: str
    base_url: Optional[str] = None


class ReportScheduleConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    timezone: str
    daily_enabled: bool
    daily_hour: int
    daily_minute: int
    weekly_enabled: bool
    weekly_day_of_week: int
    weekly_hour: int
    weekly_minute: int
    created_at: datetime
    updated_at: datetime


class ReportScheduleConfigUpdate(BaseModel):
    timezone: Optional[str] = None
    daily_enabled: Optional[bool] = None
    daily_hour: Optional[int] = None
    daily_minute: Optional[int] = None
    weekly_enabled: Optional[bool] = None
    weekly_day_of_week: Optional[int] = None
    weekly_hour: Optional[int] = None
    weekly_minute: Optional[int] = None


# ---------- Tone / writing samples ----------

TONE_SAMPLES_MAX = 30


class WritingSampleCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=20000)


class WritingSampleUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    body: Optional[str] = Field(default=None, min_length=1, max_length=20000)


class WritingSampleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    body: str
    created_at: datetime
    updated_at: datetime


class ToneStatusOut(BaseModel):
    tone_enabled: bool
    profile_text: Optional[str] = None
    last_error: Optional[str] = None
    sample_count: int
    samples_max: int = TONE_SAMPLES_MAX
    profile_updated_at: Optional[datetime] = None


class ToneSettingsPatch(BaseModel):
    tone_enabled: bool
