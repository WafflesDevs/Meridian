from fastapi import APIRouter, HTTPException, status, Depends, Request
from slowapi.util import get_remote_address

from app.core.rag import get_supabase
from app.schemas.schemas import Createuser, ReturnCreate, LoginUser, TokenReturn, CurrentUser
from app.core.utils import hash_password, verify_password
from app.core import oauth2
from app.core.oauth2 import get_current_user
from app.core.config import settings
from app.core.ratelimit import limiter

router = APIRouter(tags=["Users"])


def get_db():
    return get_supabase()


@router.post("/createuser", response_model=ReturnCreate, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.AUTH_RATE_LIMIT, key_func=get_remote_address)
def create_user(request: Request, info: Createuser, db=Depends(get_db)):
    res = db.table("users").select("*").eq("email", info.email).limit(1).execute()
    if res.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email {info.email} already in use",
        )

    hashed_password = hash_password(info.password)
    insert = db.table("users").insert({
        "email": info.email,
        "password_hash": hashed_password,
        "role": "Explorer",
    }).execute()

    return insert.data[0]


@router.post("/login", status_code=status.HTTP_200_OK, response_model=TokenReturn)
@limiter.limit(settings.AUTH_RATE_LIMIT, key_func=get_remote_address)
def login(request: Request, info: LoginUser, db=Depends(get_db)):
    checker = (
        db.table("users")
        .select("id, email, password_hash, role")
        .eq("email", info.email)
        .limit(1)
        .execute()
    )
    user = checker.data[0] if checker.data else None
    if not user or not verify_password(info.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Login",
        )
    return oauth2.create_access_token(str(user["id"]), user["role"])


@router.get("/me", response_model=CurrentUser, status_code=status.HTTP_200_OK)
def me(user: dict = Depends(get_current_user), db=Depends(get_db)):
    email = None
    try:
        res = (
            db.table("users")
            .select("email")
            .eq("id", user["user_id"])
            .limit(1)
            .execute()
        )
        if res.data:
            email = res.data[0].get("email")
    except Exception:
        email = None
    return CurrentUser(user_id=user["user_id"], role=user["role"], email=email)
