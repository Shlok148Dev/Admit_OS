"""
Redis caching layer with graceful fallback for Notification Service.
"""

import os
import json
import logging
from typing import Any, Optional
import redis

logger = logging.getLogger("notification_service.cache")

REDIS_URL = os.getenv("REDIS_URL", None)
_redis_client = None

if REDIS_URL:
    try:
        _redis_client = redis.Redis.from_url(
            REDIS_URL, decode_responses=True, socket_connect_timeout=2
        )
        _redis_client.ping()
        logger.info("Connected to Redis in Notification Service successfully.")
    except Exception as e:
        logger.warning(
            f"Redis connection failed in Notification Service: {e}. Falling back to in-memory."
        )
        _redis_client = None

_in_memory_cache = {}


def get_cached(key: str) -> Optional[Any]:
    """Retrieve item from cache."""
    if _redis_client:
        try:
            val = _redis_client.get(key)
            if val:
                return json.loads(val)
        except Exception as e:
            logger.error(f"Redis get error: {e}", exc_info=True)
    return _in_memory_cache.get(key)


def set_cached(key: str, value: Any, ttl: int) -> None:
    """Store item in cache with a specific TTL."""
    if _redis_client:
        try:
            _redis_client.setex(key, ttl, json.dumps(value))
            return
        except Exception as e:
            logger.error(f"Redis set error: {e}", exc_info=True)
    _in_memory_cache[key] = value
