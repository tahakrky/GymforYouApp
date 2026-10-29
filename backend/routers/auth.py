"""Email/password authentication with signed, HTTP-only session cookies."""
import os
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field

from lib.db import db

router = APIRouter(prefix="/auth", tags=["auth"])
COOKIE_NAME = "gymforyou_session"

# 🆕 Admin paneline erişebilecek e-postalar (küçük harfle).
ADMIN_EMAILS: set[str] = {
    "tahakarakaya777@gmail.com",
}

# SABİT secret — restart'ta değişmez, cookie'ler geçerli kalır.
# Production'a çıkarken bunu os.environ["JWT_SECRET"] ile değiştir.
JWT_SECRET = os.environ.get("JWT_SECRET") or "lnOGeOh6FPJWvp0N6vreRyjVVAWjlY9uYgR8d8jw_dvsoFu9Cx8pE8AEVMkjEysX"
JWT_ALGORITHM = "HS256"
SESSION_DAYS = int(os.environ.get("SESSION_DAYS", "14"))
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() == "true"


class RegisterInput(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ChangePasswordInput(BaseModel):
    # Mevcut şifre istenmiyor — kullanıcı unutmuş olabilir.
    new_password: str = Field(min_length=8, max_length=128)


def public_user(user: dict) -> dict:
    email = (user.get("email") or "").strip().lower()
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "is_admin": email in ADMIN_EMAILS,
    }


def set_session(response: Response, user: dict) -> str:
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {"sub": user["id"], "iat": now, "exp": now + timedelta(days=SESSION_DAYS)},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )
    response.set_cookie(
        COOKIE_NAME,
        token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=SESSION_DAYS * 86400,
        path="/",
    )
    return token


async def require_user(request: Request) -> dict:
    token = request.cookies.get(COOKIE_NAME)
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Giriş yapmalısınız.")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("missing subject")
    except (jwt.InvalidTokenError, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Oturumunuz sona erdi. Tekrar giriş yapın.",
        )
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı.")
    return user


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: RegisterInput, response: Response):
    email = str(body.email).strip().lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="Bu e-posta adresi zaten kayıtlı.")
    user = {
        "id": secrets.token_urlsafe(18),
        "name": body.name.strip(),
        "email": email,
        "password_hash": bcrypt.hashpw(
            body.password.encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    token = set_session(response, user)
    return {"user": public_user(user), "token": token}


@router.post("/login")
async def login(body: LoginInput, response: Response):
    email = str(body.email).strip().lower()
    user = await db.users.find_one({"email": email})
    if not user or not bcrypt.checkpw(
        body.password.encode("utf-8"), user["password_hash"].encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="E-posta veya şifre hatalı.")
    token = set_session(response, user)
    return {"user": public_user(user), "token": token}


@router.get("/me")
async def me(user: dict = Depends(require_user)):
    return {"user": public_user(user)}


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: ChangePasswordInput,
    user: dict = Depends(require_user),
) -> None:
    """Yeni şifreyi hash'leyip kaydet. Mevcut şifre istenmez."""
    full = await db.users.find_one({"id": user["id"]})
    if not full:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    # Aynı şifreyi tekrar koymasın
    if bcrypt.checkpw(
        body.new_password.encode("utf-8"),
        full["password_hash"].encode("utf-8"),
    ):
        raise HTTPException(
            status_code=400,
            detail="Yeni şifre mevcut şifreyle aynı olamaz.",
        )

    new_hash = bcrypt.hashpw(
        body.new_password.encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")

    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "password_hash": new_hash,
                "password_changed_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    return None


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> None:
    response.delete_cookie(
        COOKIE_NAME,
        path="/",
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
    )
    return None