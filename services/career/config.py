import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    NEO4J_URI: str = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    NEO4J_USER: str = os.getenv("NEO4J_USER", "neo4j")
    NEO4J_PASSWORD: str = os.getenv("NEO4J_PASSWORD", "")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    class Config:
        env_file = ".env"
        extra = "ignore"

    def model_post_init(self, __context):
        if not self.DATABASE_URL or "postgres:postgres@" in self.DATABASE_URL:
            raise RuntimeError("CRITICAL SECURITY ERROR: DATABASE_URL environment variable is missing or contains default credentials in career service.")


settings = Settings()

