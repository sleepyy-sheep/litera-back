from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.auth.dependencies import get_current_user
from app.auth.schemas import UserOut, Token, UserCreate
from app.auth.service import authenticate_user, create_tokens
from app.db import get_db
from app.models import User
from app.core.security import get_password_hash


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """
    Принимает username (может быть email или username) и password.
    Фронтенд передаёт email в поле username — это стандарт OAuth2 form.
    """
    user = await authenticate_user(db, form_data.username, form_data.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )

    tokens = create_tokens(user)

    user.last_login = datetime.now(timezone.utc)
    await db.commit()

    return tokens


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    # Проверяем уникальность username и email
    query = select(User).where(
        (User.username == user_data.username) | (User.email == user_data.email)
    )
    result = await db.execute(query)
    existing_user = result.scalar_one_or_none()

    if existing_user:
        if existing_user.username == user_data.username:
            detail = "Пользователь с таким именем уже существует"
        else:
            detail = "Пользователь с таким email уже существует"
        raise HTTPException(status_code=400, detail=detail)

    hashed_password = get_password_hash(user_data.password)

    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )

    try:
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Ошибка уникальности (возможно дубликат username/email)",
        )
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка при создании пользователя")

    return new_user


@router.get("/me", response_model=UserOut)
async def read_users_me(
    current_user: User = Depends(get_current_user),
):
    return current_user
