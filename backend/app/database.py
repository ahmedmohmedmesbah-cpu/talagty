from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


def _engine_options(database_url: str) -> dict:
    options = {"pool_pre_ping": True}
    if database_url.startswith("sqlite"):
        options["connect_args"] = {"check_same_thread": False}
    return options


database_url = get_settings().database_url
# Supabase may label its PostgreSQL URI with the legacy postgres:// scheme.
# SQLAlchemy requires the explicit postgresql:// dialect name.
if database_url.startswith("postgres://"):
    database_url = "postgresql://" + database_url[len("postgres://"):]

engine = create_engine(database_url, **_engine_options(database_url))
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
