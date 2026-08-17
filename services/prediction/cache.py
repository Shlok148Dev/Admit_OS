import os
import json
import logging
import time
from typing import Any, Dict, Optional
import redis

logger: logging.Logger = logging.getLogger("prediction_service.cache")

REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
REDIS_DB: int = int(os.getenv("REDIS_DB", "0"))
REDIS_PASSWORD: Optional[str] = os.getenv("REDIS_PASSWORD", None)
REDIS_URL: Optional[str] = os.getenv("REDIS_URL", None)

_redis_client: Optional[redis.Redis] = None


def init_redis() -> None:
    global _redis_client
    try:
        if REDIS_URL:
            _redis_client = redis.Redis.from_url(
                REDIS_URL, decode_responses=True, socket_connect_timeout=2
            )
        else:
            _redis_client = redis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                db=REDIS_DB,
                password=REDIS_PASSWORD,
                decode_responses=True,
                socket_connect_timeout=2,
            )
        # Test connection
        _redis_client.ping()
        logger.info("Connected to Redis successfully.")
    except Exception as e:
        logger.warning(f"Redis connection failed: {e}. Falling back to mock cache.")
        _redis_client = None


init_redis()

# Mock in-memory cache for fallback
_in_memory_cache: Dict[str, Dict[str, Any]] = {}


def is_redis_healthy() -> bool:
    """Check if Redis connection is currently healthy."""
    if not _redis_client:
        return False
    try:
        _redis_client.ping()
        return True
    except Exception:
        return False


def get_redis_latency() -> float:
    """Measure Redis ping latency in milliseconds. Returns -1.0 if down."""
    if not _redis_client:
        return -1.0
    try:
        start = time.time()
        _redis_client.ping()
        return (time.time() - start) * 1000.0
    except Exception:
        return -1.0


def get_cached_prediction(key: str) -> Optional[Dict[str, Any]]:
    """Get prediction from Redis or in-memory fallback (auto-unwrapped)."""
    if _redis_client:
        try:
            val = _redis_client.get(key)
            if val:
                res: Dict[str, Any] = json.loads(val)
                if isinstance(res, dict) and "wrapped_response" in res:
                    return res["wrapped_response"]
                return res
        except Exception as e:
            logger.error(f"Redis get error: {e}", exc_info=True)

    val = _in_memory_cache.get(key)
    if val and isinstance(val, dict) and "wrapped_response" in val:
        return val["wrapped_response"]
    return val


def get_cached_wrapped(key: str) -> Optional[Dict[str, Any]]:
    """Get full wrapped cache item (including fresh_until and wrapped_response)."""
    if _redis_client:
        try:
            val = _redis_client.get(key)
            if val:
                res: Dict[str, Any] = json.loads(val)
                if isinstance(res, dict) and "wrapped_response" in res:
                    return res
                # Backward compatibility for unwrapped cache records
                return {"wrapped_response": res, "fresh_until": time.time() + 1800}
        except Exception as e:
            logger.error(f"Redis get error: {e}", exc_info=True)

    val = _in_memory_cache.get(key)
    if val and isinstance(val, dict) and "wrapped_response" in val:
        return val
    elif val:
        return {"wrapped_response": val, "fresh_until": time.time() + 1800}
    return None


def set_cached_prediction(key: str, value: Dict[str, Any], ttl: int = 1800) -> None:
    """Set prediction to Redis or in-memory fallback with wrapping."""
    wrapped = {"wrapped_response": value, "fresh_until": time.time() + ttl}
    if _redis_client:
        try:
            # We set actual cache expiration in Redis to 24 hours (86400s)
            _redis_client.setex(key, 86400, json.dumps(wrapped))
            return
        except Exception as e:
            logger.error(f"Redis set error: {e}", exc_info=True)

    _in_memory_cache[key] = wrapped
