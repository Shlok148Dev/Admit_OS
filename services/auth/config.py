import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "postgresql+psycopg2://postgres:postgres@localhost:5432/admitos"
    )
    JWT_SECRET: str = os.getenv("JWT_SECRET", "super-secret-access-key-12345")
    JWT_REFRESH_SECRET: str = os.getenv("JWT_REFRESH_SECRET", "super-secret-refresh-key-54321")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    GOOGLE_CLIENT_ID: str | None = os.getenv("GOOGLE_CLIENT_ID", None)
    APPLE_CLIENT_ID: str | None = os.getenv("APPLE_CLIENT_ID", None)
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
