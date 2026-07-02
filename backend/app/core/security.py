import logging
from datetime import datetime, timedelta
from typing import Any, Union
from jose import jwt
from passlib.context import CryptContext
from app.core.config import settings

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

ALGORITHM = "HS256"

def _get_secret_key() -> str:
    key = settings.SECRET_KEY
    if not key:
        logger.warning("SECRET_KEY is not set — using insecure fallback. Set SECRET_KEY in your .env file.")
        return "insecure-dev-secret-change-me"
    return key

def create_access_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=30)

    to_encode = {"exp": expire, "sub": str(subject)}
    return jwt.encode(to_encode, _get_secret_key(), algorithm=ALGORITHM)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)
