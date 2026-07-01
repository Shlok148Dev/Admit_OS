import os
import logging
from pydantic_settings import BaseSettings

logger = logging.getLogger("counseling.config")

class Settings(BaseSettings):
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str = ""
    REDIS_URL: str = ""
    ANTHROPIC_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin_secure_pass123"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

try:
    settings = Settings()
    print("[DEBUG] Loaded config from settings:")
    print(f"[DEBUG] REDIS_HOST: {settings.REDIS_HOST}")
    print(f"[DEBUG] REDIS_PORT: {settings.REDIS_PORT}")
    print(f"[DEBUG] REDIS_URL length: {len(settings.REDIS_URL) if settings.REDIS_URL else 0}")
    print(f"[DEBUG] ANTHROPIC_API_KEY configured: {bool(settings.ANTHROPIC_API_KEY)}")
    print(f"[DEBUG] GROQ_API_KEY configured: {bool(settings.GROQ_API_KEY)}")
except Exception as e:
    print(f"[DEBUG] Error loading settings with Pydantic: {e}")
    class FallbackSettings:
        REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
        REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
        REDIS_DB = int(os.getenv("REDIS_DB", "0"))
        REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")
        REDIS_URL = os.getenv("REDIS_URL", "")
        ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
        GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
        ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
        ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin_secure_pass123")
    settings = FallbackSettings()
    print("[DEBUG] Loaded config via fallback settings:")
    print(f"[DEBUG] REDIS_HOST: {settings.REDIS_HOST}")
    print(f"[DEBUG] ANTHROPIC_API_KEY configured: {bool(settings.ANTHROPIC_API_KEY)}")
