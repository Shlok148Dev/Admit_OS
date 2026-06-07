"""
Redis and in-memory caching client helpers.
"""

import logging
from typing import Dict, Optional
import redis

from services.analytics.config import settings

logger: logging.Logger = logging.getLogger("analytics_service.cache")

redis_client: Optional[redis.Redis] = None
try:
    if settings.REDIS_URL:
        redis_client = redis.Redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=2
        )
        redis_client.ping()
        logger.info("Connected to Redis successfully in analytics service.")
except Exception as e:
    logger.warning(f"Redis connection failed in analytics service: {e}. Falling back to in-memory cache.")
    redis_client = None

_in_memory_cache: Dict[str, str] = {}

def get_cached_data(key: str) -> Optional[str]:
    """Retrieve data from Redis or in-memory fallback."""
    if redis_client:
        try:
            return redis_client.get(key)
        except Exception as e:
            logger.error(f"Redis get error: {e}")
    return _in_memory_cache.get(key)

def set_cached_data(key: str, value: str, ttl: int = 3600) -> None:
    """Save data to Redis or in-memory fallback."""
    if redis_client:
        try:
            redis_client.setex(key, ttl, value)
            return
        except Exception as e:
            logger.error(f"Redis set error: {e}")
    _in_memory_cache[key] = value

def delete_cached_data(key: str) -> None:
    """Delete a key from Redis or in-memory fallback."""
    if redis_client:
        try:
            redis_client.delete(key)
        except Exception as e:
            logger.error(f"Redis delete error: {e}")
    _in_memory_cache.pop(key, None)
