import logging
from typing import Generator
from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from neo4j import GraphDatabase, Driver, Session as Neo4jSession
from services.career.config import settings

logger = logging.getLogger("career_service.db")

# PostgreSQL Setup
DATABASE_URL = settings.DATABASE_URL
if DATABASE_URL.startswith("postgresql"):
    DATABASE_URL = DATABASE_URL.replace("?prepared_statement_cache_size=0", "").replace(
        "&prepared_statement_cache_size=0", ""
    )
    engine_args = {
        "pool_size": 20,
        "max_overflow": 40,
        "pool_timeout": 30,
        "pool_recycle": 3600,
        "pool_pre_ping": True,
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


# Neo4j Driver Setup
_neo4j_driver: Driver | None = None


def get_neo4j_driver() -> Driver:
    global _neo4j_driver
    if _neo4j_driver is None:
        try:
            _neo4j_driver = GraphDatabase.driver(
                settings.NEO4J_URI, auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
            )
            logger.info("Connected to Neo4j database successfully.")
        except Exception as e:
            logger.error(f"Failed to connect to Neo4j: {e}", exc_info=True)
            raise e
    return _neo4j_driver


def close_neo4j_driver() -> None:
    global _neo4j_driver
    if _neo4j_driver is not None:
        _neo4j_driver.close()
        _neo4j_driver = None
        logger.info("Closed Neo4j driver connection.")


@contextmanager
def get_neo4j_session() -> Generator[Neo4jSession, None, None]:
    driver = get_neo4j_driver()
    session = driver.session()
    try:
        yield session
    finally:
        session.close()
