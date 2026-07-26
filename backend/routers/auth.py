"""User auth router — register, login, me, logout (JWT + MongoDB Atlas).

Endpoints:
  POST /auth/register   — create account (email + username + password)
  POST /auth/login      — returns JWT access token
  GET  /auth/me         — returns current user from token
  POST /auth/logout     — client-side token discard (stateless JWT)

Roles:
  - "teacher"  → accesses /dashboard, can trigger analytics, screen capture
  - "student"  → accesses /muffliato, sends pings

Passwords are hashed with bcrypt (passlib). JWTs are signed with HS256.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

import bcrypt as _bcrypt_lib
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, Field

from config import settings
from services.mongodb_client import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

# ─── Security primitives ─────────────────────────────────────────

_bearer = HTTPBearer(auto_error=False)


def _hash_password(plain: str) -> str:
    # Use bcrypt directly — passlib 1.7.4 is incompatible with bcrypt 4.x on Python 3.14
    return _bcrypt_lib.hashpw(plain.encode(), _bcrypt_lib.gensalt()).decode()


def _verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt_lib.checkpw(plain.encode(), hashed.encode())


def _create_access_token(payload: dict) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.jwt_access_expire_minutes
    )
    return jwt.encode(
        {**payload, "exp": expire},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


# ─── Pydantic models ─────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=2, max_length=32, pattern=r"^[a-zA-Z0-9_\-]+$")
    password: str = Field(..., min_length=6, max_length=128)
    role: Literal["teacher", "student"] = "student"
    full_name: Optional[str] = Field(None, max_length=64)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserPublic"


class UserPublic(BaseModel):
    id: str
    email: str
    username: str
    role: str
    full_name: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


TokenResponse.model_rebuild()


# ─── Dependency: get_current_user ────────────────────────────────

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> dict:
    """FastAPI dependency: validates Bearer JWT, returns user dict from MongoDB.

    Raises 401 if token is missing, expired, or invalid.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise JWTError("Missing sub claim")
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    db = get_db()
    from bson import ObjectId

    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = None

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


async def require_teacher(user: dict = Depends(get_current_user)) -> dict:
    """Dependency that additionally requires role == 'teacher'."""
    if user.get("role") != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher role required",
        )
    return user


# ─── Helpers ─────────────────────────────────────────────────────

def _user_to_public(user: dict) -> UserPublic:
    return UserPublic(
        id=str(user["_id"]),
        email=user["email"],
        username=user["username"],
        role=user.get("role", "student"),
        full_name=user.get("full_name"),
        created_at=user["created_at"],
    )


# ─── Endpoints ───────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest) -> TokenResponse:
    """Create a new account and return a JWT immediately (no extra login step)."""
    db = get_db()

    # Reject duplicates
    existing = await db.users.find_one(
        {"$or": [{"email": body.email}, {"username": body.username}]}
    )
    if existing:
        field = "email" if existing["email"] == body.email else "username"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An account with that {field} already exists",
        )

    now = datetime.now(timezone.utc)
    doc = {
        "email": body.email,
        "username": body.username,
        "hashed_password": _hash_password(body.password),
        "role": body.role,
        "full_name": body.full_name,
        "created_at": now,
        "last_login": now,
    }

    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id

    token = _create_access_token({"sub": str(result.inserted_id), "role": body.role})
    logger.info("New user registered: %s (%s)", body.username, body.role)

    return TokenResponse(access_token=token, user=_user_to_public(doc))


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest) -> TokenResponse:
    """Authenticate with email + password, return JWT."""
    db = get_db()

    user = await db.users.find_one({"email": body.email})
    if user is None or not _verify_password(body.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Update last_login
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_login": datetime.now(timezone.utc)}},
    )

    token = _create_access_token({"sub": str(user["_id"]), "role": user.get("role", "student")})
    logger.info("User logged in: %s", user["username"])

    return TokenResponse(access_token=token, user=_user_to_public(user))


@router.get("/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)) -> UserPublic:
    """Return the currently authenticated user's profile."""
    return _user_to_public(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout() -> None:
    """Stateless JWT logout — client discards the token.

    For production, implement a token denylist in Redis/MongoDB if needed.
    """
    return None
