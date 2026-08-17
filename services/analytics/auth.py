"""
Authentication dependencies for the analytics service.
"""

import logging
import secrets
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import (
    HTTPBearer,
    HTTPAuthorizationCredentials,
    HTTPBasic,
    HTTPBasicCredentials,
)

from services.analytics.config import settings

logger: logging.Logger = logging.getLogger("analytics_service.auth")

bearer_scheme = HTTPBearer()
basic_scheme = HTTPBasic()


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> int:
    """Validate JWT token and return the student user_id."""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id or payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token or token type",
            )
        return int(user_id)
    except Exception as e:
        logger.error(f"JWT validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )


def authenticate_admin(
    credentials: HTTPBasicCredentials = Depends(basic_scheme),
) -> str:
    """Validate basic admin credentials."""
    correct_username = settings.ADMIN_USERNAME
    correct_password = settings.ADMIN_PASSWORD
    is_user_ok = secrets.compare_digest(credentials.username, correct_username)
    is_pass_ok = secrets.compare_digest(credentials.password, correct_password)
    if not (is_user_ok and is_pass_ok):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect admin username or password",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username
