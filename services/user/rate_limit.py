import time
import json
import logging
import jwt
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from sqlalchemy.orm import Session
import redis.asyncio as aioredis
from services.user.config import settings
from services.user.db import SessionLocal
from services.user.models import User

logger = logging.getLogger("rate_limit")
redis_client = aioredis.from_url(
    settings.REDIS_URL,
    decode_responses=True,
    socket_timeout=1.0,
    socket_connect_timeout=1.0,
)

# In-memory fallback if Redis is down
fallback_storage: dict[str, list[float]] = {}


def get_user_tier_from_db(user_id: int) -> str:
    db: Session = SessionLocal()
    try:
        user = (
            db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
        )
        return user.tier if user else "FREE"
    finally:
        db.close()


async def get_user_tier(user_id: int) -> str:
    try:
        cache_key = f"user_tier:{user_id}"
        tier = await redis_client.get(cache_key)
        if not tier:
            tier = get_user_tier_from_db(user_id)
            await redis_client.setex(cache_key, 300, tier)
        return tier
    except Exception as e:
        logger.error(json.dumps({"event": "redis_tier_cache_failed", "error": str(e)}))
        return get_user_tier_from_db(user_id)


def get_limit_for_tier(tier: str) -> int:
    return 1000 if tier == "PAID" else 100


async def check_redis_limit(key: str, limit: int) -> bool:
    try:
        current_minute = int(time.time() / 60)
        redis_key = f"rl:{key}:{current_minute}"
        count = await redis_client.incr(redis_key)
        if count == 1:
            await redis_client.expire(redis_key, 60)
        return count <= limit
    except Exception as e:
        logger.error(json.dumps({"event": "redis_rate_limit_failed", "error": str(e)}))
        return check_memory_limit(key, limit)


def check_memory_limit(key: str, limit: int) -> bool:
    now = time.time()
    if key not in fallback_storage:
        fallback_storage[key] = []
    # Clean up old entries
    fallback_storage[key] = [t for t in fallback_storage[key] if now - t < 60]
    if len(fallback_storage[key]) >= limit:
        return False
    fallback_storage[key].append(now)
    return True


def extract_user_from_token(token: str) -> tuple[int | None, str]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        user_id = int(payload.get("sub", 0))
        tier = payload.get("tier", "FREE")  # Look for tier in token first
        return user_id, tier
    except jwt.PyJWTError:
        return None, "FREE"


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if request.url.path == "/health" or request.url.path.endswith("/health"):
            return await call_next(request)

        auth_header = request.headers.get("Authorization")
        user_id, token_tier = None, "FREE"

        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            user_id, token_tier = extract_user_from_token(token)

        if user_id:
            tier = token_tier if token_tier != "FREE" else await get_user_tier(user_id)
            limit = get_limit_for_tier(tier)
            key = f"user:{user_id}"
        else:
            limit = 100  # unauthenticated rate limit
            key = f"ip:{request.client.host if request.client else 'unknown'}"

        allowed = await check_redis_limit(key, limit)
        if not allowed:
            return Response(
                content=json.dumps({"detail": "Rate limit exceeded"}),
                status_code=429,
                media_type="application/json",
            )

        return await call_next(request)
