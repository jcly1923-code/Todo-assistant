import os
import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AIConfig, User
from app.schemas import AIRuntimeConfig

logger = logging.getLogger(__name__)

_MISSING_AI_MSG = (
    "未配置有效的 AI。请任选其一："
    "（1）在「设置」中开启自动生成时同意将 API Key 保存到账户；"
    "（2）环境变量 LITELLM_API_KEY 等；"
    "（3）数据库 ai_configs 中 is_active=1 的全局配置。"
)


def _normalize_secret(value: Optional[str]) -> str:
    """Trim whitespace/quotes from copied credentials."""
    if not value:
        return ""
    return value.strip().strip('"').strip("'")


_DEFAULT_REPORT_SYSTEM = (
    "你是一位专业的职场效率专家和资深的工作报告撰写顾问。你擅长从杂乱的待办事项清单中提取关键信息，并将其转化为一份结构清晰、重点突出、具有反思价值的工作报告。"
    "你能够透过任务表象，分析出工作的核心价值、完成质量以及潜在的改进空间。"
)


async def _chat_with_model(
    *,
    provider: str,
    model_name: str,
    api_key: str,
    base_url: Optional[str],
    user_prompt: str,
    max_tokens: int,
    system_prompt: Optional[str] = None,
) -> str:
    cleaned_key = _normalize_secret(api_key)
    cleaned_base_url = base_url.strip() if base_url else None
    if not cleaned_key or cleaned_key.startswith("sk-your"):
        raise ValueError(
            "未配置有效的 AI API Key。请在请求中传入 ai_config，或在服务器配置 LITELLM_API_KEY / 数据库 ai_configs。"
        )

    # Prefer OpenAI-compatible call path to match third-party proxy gateways:
    # base_url + api_key + model_name.
    model = model_name.strip()
    if not model:
        raise ValueError("model_name 不能为空")

    logger.info(
        "Calling OpenAI-compatible API: provider=%s model=%s base_url=%s",
        provider,
        model,
        cleaned_base_url,
    )

    from openai import AsyncOpenAI
    import httpx

    async def _call(trust_env: bool) -> str:
        async with httpx.AsyncClient(trust_env=trust_env, timeout=60) as hc:
            client = AsyncOpenAI(
                api_key=cleaned_key,
                base_url=cleaned_base_url,
                http_client=hc,
            )
            resp = await client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt or _DEFAULT_REPORT_SYSTEM,
                    },
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.5,
                max_tokens=max_tokens,
            )
        return resp.choices[0].message.content or ""

    # Try with system proxy first; if proxy env vars are malformed, retry without.
    try:
        return await _call(trust_env=True)
    except (ValueError, httpx.InvalidURL) as exc:
        logger.warning("Proxy env seems broken (%s), retrying without proxy", exc)
        return await _call(trust_env=False)


async def validate_ai_config(
    *,
    provider: str,
    model_name: str,
    api_key: str,
    base_url: Optional[str],
) -> None:
    """Raise exception when config cannot complete a tiny request."""
    await _chat_with_model(
        provider=provider,
        model_name=model_name,
        api_key=api_key,
        base_url=base_url,
        user_prompt="请仅回复：ok",
        max_tokens=16,
    )


def _env_ai_tuple() -> tuple[str, str, str, Optional[str]]:
    raw_model = os.getenv("LITELLM_MODEL", "openai/gpt-3.5-turbo")
    if "/" in raw_model:
        provider, model_name = raw_model.split("/", 1)
    else:
        provider, model_name = "openai", raw_model
    api_key = os.getenv("LITELLM_API_KEY", "")
    base_url = (os.getenv("LITELLM_BASE_URL") or "").strip() or None
    return provider, model_name, api_key, base_url


def _api_key_usable(key: str) -> bool:
    k = _normalize_secret(key)
    return bool(k) and not k.startswith("sk-your")


def user_has_stored_automation_ai(user: User) -> bool:
    return _api_key_usable(user.ai_api_key or "")


async def _user_automation_ai_from_db(
    db: AsyncSession, user_id: int
) -> Optional[tuple[str, str, str, Optional[str]]]:
    user = await db.get(User, user_id)
    if user is None or not _api_key_usable(user.ai_api_key or ""):
        return None
    prov = (user.ai_provider or "").strip()
    model = (user.ai_model_name or "").strip()
    if not prov or not model:
        return None
    base = (user.ai_base_url or "").strip() or None
    return (prov, model, user.ai_api_key or "", base)


async def _active_ai_config_from_db(db: AsyncSession) -> Optional[tuple[str, str, str, Optional[str]]]:
    row = await db.scalar(
        select(AIConfig)
        .where(AIConfig.is_active.is_(True))
        .order_by(AIConfig.id.desc())
    )
    if row is None:
        return None
    return (row.provider, row.model_name, row.api_key, row.base_url)


async def generate_report_content(
    prompt: str,
    runtime_config: Optional[AIRuntimeConfig] = None,
    db: Optional[AsyncSession] = None,
    user_id: Optional[int] = None,
) -> str:
    """
    调用 AI 生成报告内容。
    优先级：请求体 runtime_config → 用户账户保存的自动化凭据（user_id+db）
    → 环境变量 → 全局 ai_configs（is_active=1）。
    """
    if runtime_config:
        provider = runtime_config.provider
        model_name = runtime_config.model_name
        api_key = runtime_config.api_key
        base_url = runtime_config.base_url
    else:
        provider, model_name, api_key, base_url = "", "", "", None
        if user_id is not None and db is not None:
            user_tup = await _user_automation_ai_from_db(db, user_id)
            if user_tup:
                provider, model_name, api_key, base_url = user_tup
                logger.info("使用用户账户保存的自动化 AI 凭据 user_id=%s", user_id)
        if not _api_key_usable(api_key):
            provider, model_name, api_key, base_url = _env_ai_tuple()
        if not _api_key_usable(api_key) and db is not None:
            db_row = await _active_ai_config_from_db(db)
            if db_row:
                provider, model_name, api_key, base_url = db_row
                logger.info("使用数据库 ai_configs（is_active）作为 AI 凭据")
        if not _api_key_usable(api_key):
            raise ValueError(_MISSING_AI_MSG)

    return await _chat_with_model(
        provider=provider,
        model_name=model_name,
        api_key=api_key,
        base_url=base_url,
        user_prompt=prompt,
        max_tokens=2000,
        system_prompt=None,
    )


_LEARN_STYLE_SYSTEM = (
    "你是文风分析助手。从用户提供的多篇「工作日报」原文中，提炼出可用于指导后续写作的「语气风格说明」。"
    "只总结：常用衔接语、句式与详略习惯、段落与列表偏好、称谓与收尾方式等表达特征。"
    "不要复述工作事实或成果，不要编造原文中未出现的习惯。"
    "输出使用简洁的中文 Markdown（可加小标题与列表），总字数不超过 900 字。"
)


async def learn_writing_style_from_samples(
    combined_text: str,
    *,
    db: AsyncSession,
    user_id: int,
    runtime_config: Optional[AIRuntimeConfig] = None,
) -> str:
    """调用 AI 从合并后的自写日报文本中提炼语气库摘要。"""
    if runtime_config:
        provider = runtime_config.provider
        model_name = runtime_config.model_name
        api_key = runtime_config.api_key
        base_url = runtime_config.base_url
    else:
        provider, model_name, api_key, base_url = "", "", "", None
        user_tup = await _user_automation_ai_from_db(db, user_id)
        if user_tup:
            provider, model_name, api_key, base_url = user_tup
        if not _api_key_usable(api_key):
            provider, model_name, api_key, base_url = _env_ai_tuple()
        if not _api_key_usable(api_key):
            db_row = await _active_ai_config_from_db(db)
            if db_row:
                provider, model_name, api_key, base_url = db_row
        if not _api_key_usable(api_key):
            raise ValueError(_MISSING_AI_MSG)

    user_prompt = (
        "以下是同一用户撰写的多篇工作日报原文（可能含标题）。请提炼语气风格说明。\n\n---\n"
        + combined_text[:28000]
    )
    return (
        await _chat_with_model(
            provider=provider,
            model_name=model_name,
            api_key=api_key,
            base_url=base_url,
            user_prompt=user_prompt,
            max_tokens=1200,
            system_prompt=_LEARN_STYLE_SYSTEM,
        )
    ).strip()
