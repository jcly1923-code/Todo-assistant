# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Todo Assistant contributors

"""Runtime configuration: environment detection and secrets policy."""

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)


def is_production() -> bool:
    return os.getenv("APP_ENV", "").strip().lower() in ("production", "prod")


def get_jwt_secret() -> str:
    raw = os.getenv("JWT_SECRET", "").strip()
    if is_production():
        if not raw:
            raise RuntimeError(
                "JWT_SECRET must be set when APP_ENV is production (or prod)."
            )
        return raw
    return raw or "dev-change-me-in-production"


def get_admin_jwt_secret() -> str:
    raw = os.getenv("ADMIN_JWT_SECRET", "").strip()
    if is_production():
        if not raw:
            raise RuntimeError(
                "ADMIN_JWT_SECRET must be set when APP_ENV is production (or prod)."
            )
        return raw
    return raw or "dev-admin-jwt-change-me"


def get_bootstrap_admin_credentials() -> Optional[tuple[str, str]]:
    """
    (email, plain_password) for first admin user, or None to skip auto-creation.
    In production, both ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD are required.
    """
    if is_production():
        email = os.getenv("ADMIN_BOOTSTRAP_EMAIL", "").strip().lower()
        password = os.getenv("ADMIN_BOOTSTRAP_PASSWORD", "")
        if not email or not password:
            logger.warning(
                "No initial admin created: set ADMIN_BOOTSTRAP_EMAIL and "
                "ADMIN_BOOTSTRAP_PASSWORD when APP_ENV is production."
            )
            return None
        return email, password
    email = os.getenv("ADMIN_BOOTSTRAP_EMAIL", "admin@local.dev").lower().strip()
    password = os.getenv("ADMIN_BOOTSTRAP_PASSWORD", "AdminPass123")
    return email, password


def get_bootstrap_legacy_user_credentials() -> Optional[tuple[str, str]]:
    """
    For migration-only first user when legacy orphan data exists.
    In production, both BOOTSTRAP_USER_EMAIL and BOOTSTRAP_USER_PASSWORD are required.
    """
    if is_production():
        email = os.getenv("BOOTSTRAP_USER_EMAIL", "").strip().lower()
        password = os.getenv("BOOTSTRAP_USER_PASSWORD", "")
        if not email or not password:
            logger.warning(
                "Legacy migration user not created: set BOOTSTRAP_USER_EMAIL and "
                "BOOTSTRAP_USER_PASSWORD when APP_ENV is production and orphan data exists."
            )
            return None
        return email, password
    email = os.getenv("BOOTSTRAP_USER_EMAIL", "owner@local.dev").lower().strip()
    password = os.getenv("BOOTSTRAP_USER_PASSWORD", "changeme123")
    return email, password


def get_bootstrap_user_email_for_claim() -> Optional[str]:
    """Email used when merging legacy bootstrap user (claim flow)."""
    raw = os.getenv("BOOTSTRAP_USER_EMAIL", "").strip()
    if is_production():
        return raw.lower() if raw else None
    return (raw or "owner@local.dev").lower().strip()
