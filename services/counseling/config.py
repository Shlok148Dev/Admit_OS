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
    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"
import os
import logging
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

load_dotenv()

logger = logging.getLogger("counseling.config")


class Settings(BaseSettings):
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str = ""
    REDIS_URL: str = ""
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    ANTHROPIC_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

    def model_post_init(self, __context):
        if not self.ADMIN_PASSWORD or self.ADMIN_PASSWORD == "admin_secure_pass123":
            raise RuntimeError("CRITICAL SECURITY ERROR: ADMIN_PASSWORD environment variable is missing or set to insecure default in counseling service.")


try:
    settings = Settings()
except Exception as e:
    print(f"[FATAL SECURITY ERROR] Failed to load counseling settings: {e}")
    raise RuntimeError(f"CRITICAL SECURITY ERROR in counseling config: {e}")

if not getattr(settings, "ANTHROPIC_API_KEY", None) or settings.ANTHROPIC_API_KEY == "":
    logger.warning("[WARNING] ANTHROPIC_API_KEY is not configured! Anthropic failover will not work.")
    print("[WARNING] ANTHROPIC_API_KEY is not configured! Anthropic failover will not work.")
