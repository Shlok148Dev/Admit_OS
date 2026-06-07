"""
Database connectivity configuration for the analytics service.
"""

import os
import logging
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# Configure logger
logger: logging.Logger = logging.getLogger("analytics_service.database")

DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./admitos_prediction.db")
if DATABASE_URL.startswith("postgresql"):
    DATABASE_URL = DATABASE_URL.replace("?prepared_statement_cache_size=0", "").replace("&prepared_statement_cache_size=0", "")
connect_args = {}
engine_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine_args = {"pool_pre_ping": True}
else:
    engine_args = {
        "pool_size": 15,
        "max_overflow": 5,
        "pool_timeout": 30,
        "pool_recycle": 1800,
        "pool_pre_ping": True
    }

try:
    engine = create_engine(DATABASE_URL, connect_args=connect_args, **engine_args)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
except Exception as e:
    logger.error(f"Failed to create database engine: {e}", exc_info=True)
    raise

Base = declarative_base()

def init_db() -> None:
    """Initialize database tables."""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Analytics database tables initialized.")
    except Exception as e:
        logger.error(f"Failed to initialize analytics tables: {e}", exc_info=True)
        raise

def get_db() -> Generator[Session, None, None]:
    """Dependency injection for database sessions."""
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"Database session error: {e}", exc_info=True)
        raise
    finally:
        db.close()
