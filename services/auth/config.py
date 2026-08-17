import os
from pydantic_settings import BaseSettings


import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "")
    JWT_REFRESH_SECRET: str = os.getenv("JWT_REFRESH_SECRET", "")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    GOOGLE_CLIENT_ID: str | None = os.getenv("GOOGLE_CLIENT_ID", None)
    APPLE_CLIENT_ID: str | None = os.getenv("APPLE_CLIENT_ID", None)
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    class Config:
        env_file = ".env"
        extra = "ignore"

    def model_post_init(self, __context):
        if not self.JWT_SECRET or self.JWT_SECRET == "super-secret-access-key-12345":
            raise RuntimeError("CRITICAL SECURITY ERROR: JWT_SECRET environment variable is missing or set to insecure default.")
        if not self.JWT_REFRESH_SECRET or self.JWT_REFRESH_SECRET == "super-secret-refresh-key-54321":
            raise RuntimeError("CRITICAL SECURITY ERROR: JWT_REFRESH_SECRET environment variable is missing or set to insecure default.")
        if not self.DATABASE_URL or "postgres:postgres@" in self.DATABASE_URL:
            raise RuntimeError("CRITICAL SECURITY ERROR: DATABASE_URL environment variable is missing or contains unconfigured default credentials.")


settings = Settings()

