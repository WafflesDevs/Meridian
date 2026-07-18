from passlib.context import CryptContext
from app.core.config import settings

pwd = CryptContext(schemes=[settings.decoder], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd.hash(password)


def verify_password(plain: str, hashed_pass: str) -> bool:
    return pwd.verify(plain, hashed_pass)