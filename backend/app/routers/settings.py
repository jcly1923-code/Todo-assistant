from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas import (
    AIConfigValidateRequest,
    AIConfigValidateResponse,
    AIAutomationStatusOut,
)
from app.services.ai_service import validate_ai_config, user_has_stored_automation_ai

router = APIRouter()


def _normalize_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip().strip('"').strip("'")
    return cleaned or None


@router.post("/ai-configs/validate", response_model=AIConfigValidateResponse)
async def validate_ai_config_payload(
    payload: AIConfigValidateRequest,
    _: User = Depends(get_current_user),
):
    provider = _normalize_text(payload.provider)
    model_name = _normalize_text(payload.model_name)
    api_key = _normalize_text(payload.api_key)
    base_url = _normalize_text(payload.base_url)
    if not provider or not model_name or not api_key:
        raise HTTPException(status_code=400, detail="provider、model_name、api_key 不能为空")
    try:
        await validate_ai_config(
            provider=provider,
            model_name=model_name,
            api_key=api_key,
            base_url=base_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"配置不可用：{e}") from e
    return AIConfigValidateResponse(ok=True, message="配置可用")


@router.get("/ai-automation/status", response_model=AIAutomationStatusOut)
async def ai_automation_status(current_user: User = Depends(get_current_user)):
    return AIAutomationStatusOut(has_stored_automation_ai=user_has_stored_automation_ai(current_user))


@router.put("/ai-automation")
async def save_ai_automation_for_schedule(
    payload: AIConfigValidateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """将 AI 凭据写入当前用户账户，供定时日报/周报使用（需用户在前端明确同意）。"""
    provider = _normalize_text(payload.provider)
    model_name = _normalize_text(payload.model_name)
    api_key = _normalize_text(payload.api_key)
    base_url = _normalize_text(payload.base_url)
    if not provider or not model_name or not api_key:
        raise HTTPException(status_code=400, detail="provider、model_name、api_key 不能为空")
    try:
        await validate_ai_config(
            provider=provider,
            model_name=model_name,
            api_key=api_key,
            base_url=base_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"配置不可用：{e}") from e
    current_user.ai_provider = provider
    current_user.ai_model_name = model_name
    current_user.ai_api_key = api_key
    current_user.ai_base_url = base_url
    await db.commit()
    return {"ok": True}


@router.delete("/ai-automation")
async def clear_ai_automation(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """清除账户内为自动化保存的 AI 凭据（不影响浏览器本地配置）。"""
    current_user.ai_provider = None
    current_user.ai_model_name = None
    current_user.ai_api_key = None
    current_user.ai_base_url = None
    await db.commit()
    return {"ok": True}
