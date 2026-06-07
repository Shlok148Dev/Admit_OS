from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from services.auth.config import settings

DATABASE_URL = settings.DATABASE_URL
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
    engine_args = {"pool_pre_ping": True}
else:
    engine_args = {}

engine = create_engine(DATABASE_URL, **engine_args)


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
