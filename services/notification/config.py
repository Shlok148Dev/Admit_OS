import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "postgresql+psycopg2://postgres:postgres@localhost:5432/admitos"
    )
    JWT_SECRET: str = os.getenv("JWT_SECRET", "super-secret-access-key-12345")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    KAFKA_GROUP_ID: str = os.getenv("KAFKA_GROUP_ID", "notification-service-group")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
