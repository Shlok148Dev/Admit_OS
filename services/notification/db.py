import logging
from typing import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from services.notification.config import settings

logger = logging.getLogger("notification_service.db")

DATABASE_URL = settings.DATABASE_URL
connect_args = {}
if DATABASE_URL.startswith("postgresql"):
    DATABASE_URL = DATABASE_URL.replace("?prepared_statement_cache_size=0", "").replace("&prepared_statement_cache_size=0", "")
    engine_args = {
        "pool_size": 20,
        "max_overflow": 40,
        "pool_timeout": 30,
        "pool_recycle": 3600,
        "pool_pre_ping": True
    }
elif DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine_args = {"pool_pre_ping": True}
else:
    engine_args = {}

engine = create_engine(DATABASE_URL, connect_args=connect_args, **engine_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db() -> None:
    try:
        Base.metadata.create_all(bind=engine)
        if engine.dialect.name == "postgresql":
            with engine.begin() as conn:
                conn.execute(text(
                    "CREATE TABLE IF NOT EXISTS notification_log_default "
                    "PARTITION OF notification_log DEFAULT;"
                ))
        logger.info("Database tables initialized successfully.")
    except Exception as e:
        logger.error(f"Error initializing database: {e}", exc_info=True)
        raise
