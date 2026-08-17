import os
from pydantic_settings import BaseSettings


import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "")

    class Config:
        env_file = ".env"
        extra = "ignore"

    def model_post_init(self, __context):
        if not self.JWT_SECRET or self.JWT_SECRET == "super-secret-access-key-12345":
            raise RuntimeError("CRITICAL SECURITY ERROR: JWT_SECRET environment variable is missing or set to insecure default in analytics service.")
        if not self.DATABASE_URL or "postgres:postgres@" in self.DATABASE_URL:
            raise RuntimeError("CRITICAL SECURITY ERROR: DATABASE_URL environment variable is missing or contains unconfigured default credentials in analytics service.")

        if not self.ADMIN_PASSWORD or self.ADMIN_PASSWORD == "admin_secure_pass123":
            raise RuntimeError("CRITICAL SECURITY ERROR: ADMIN_PASSWORD environment variable is missing or set to insecure default in analytics service.")


settings = Settings()

