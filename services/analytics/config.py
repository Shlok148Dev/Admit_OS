import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "postgresql+psycopg2://postgres:postgres@localhost:5432/admitos"
    )
    JWT_SECRET: str = os.getenv("JWT_SECRET", "super-secret-access-key-12345")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "admin_secure_pass123")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
