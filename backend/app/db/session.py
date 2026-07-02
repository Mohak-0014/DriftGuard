from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# Primary (write) engine
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Read-replica engine — falls back to the primary when no replica is configured
_read_url = settings.DATABASE_READ_URL or settings.DATABASE_URL
read_engine = create_engine(
    _read_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)
ReadSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=read_engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_read_db():
    """Yield a session bound to the read replica (or primary if none configured)."""
    db = ReadSessionLocal()
    try:
        yield db
    finally:
        db.close()
