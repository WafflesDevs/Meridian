from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

bearer = HTTPBearer()


def create_access_token(user_id: str, role: str) -> dict:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE
    )
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": expire,
    }
    token = jwt.encode(payload, settings.SECERET_KEY, algorithm=settings.ALGORITHM)
    return {"token": token, "type": "bearer"}


def decode_access_token(token: str) -> dict:
    return jwt.decode(
        token,
        settings.SECERET_KEY,
        algorithms=[settings.ALGORITHM],
    )


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> dict:
    try:
        payload = decode_access_token(creds.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("user_id")
    role = payload.get("role")
    if not user_id or not role:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    return {"user_id": user_id, "role": role}


def require_role(*allowed_roles: str):
    def checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
            )
        return user

    return checker
