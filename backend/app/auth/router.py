from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from starlette.requests import Request

from app.auth.dependencies import get_current_user
from app.auth.schemas import UserOut, Token, UserCreate, RefreshRequest, UserUpdate
from app.auth.service import authenticate_user, create_tokens
from app.db import get_db
from app.main import limiter
from app.models import User, RefreshToken, Book
from app.core.security import get_password_hash, hash_token, verify_password
from app.core.storage import storage


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
async def login(
    request: Request,
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

    tokens = await create_tokens(db, user)

    user.last_login = datetime.now(timezone.utc)
    await db.commit()

    return tokens


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register_user(
    request: Request,
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


@router.patch("/me", response_model=UserOut)
async def update_users_me(
    body: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Частичное обновление профиля текущего пользователя.
    Проверяет уникальность username/email и верифицирует current_password
    перед сменой пароля.
    """
    # Проверка уникальности username
    if body.username is not None and body.username != current_user.username:
        result = await db.execute(
            select(User).where(User.username == body.username)
        )
        if result.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь с таким именем уже существует",
            )
        current_user.username = body.username

    # Проверка уникальности email
    if body.email is not None and body.email != current_user.email:
        result = await db.execute(
            select(User).where(User.email == body.email)
        )
        if result.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь с таким email уже существует",
            )
        current_user.email = body.email

    # Смена пароля
    if body.new_password is not None:
        if not body.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Для смены пароля необходимо указать текущий пароль",
            )
        if not verify_password(body.current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неверный текущий пароль",
            )
        current_user.hashed_password = get_password_hash(body.new_password)

    try:
        await db.commit()
        await db.refresh(current_user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ошибка уникальности (возможно дубликат username/email)",
        )

    return current_user


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_users_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Удаляет аккаунт текущего пользователя:
    1. Удаляет все файлы книг из MinIO.
    2. Удаляет все refresh_tokens пользователя.
    3. Удаляет запись пользователя (каскадно удаляет книги и прочее).
    """
    # 1. Удаляем все файлы книг из MinIO
    books_result = await db.execute(
        select(Book).where(Book.user_id == current_user.id)
    )
    books = books_result.scalars().all()

    for book in books:
        try:
            await storage.delete_file(book.storage_key)
            if book.cover_key:
                await storage.delete_file(book.cover_key)
        except Exception as e:
            # Логируем, но не прерываем удаление
            print(f"⚠️ Не удалось удалить файл из MinIO ({book.storage_key}): {e}")

    # 2. Удаляем все refresh_tokens пользователя
    tokens_result = await db.execute(
        select(RefreshToken).where(RefreshToken.user_id == current_user.id)
    )
    tokens = tokens_result.scalars().all()
    for token in tokens:
        await db.delete(token)

    # 3. Удаляем пользователя (каскадное удаление книг, полок и т.д.)
    await db.delete(current_user)
    await db.commit()

    return None


@router.post("/refresh", response_model=Token)
async def refresh_tokens(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Принимает refresh_token, валидирует по БД, возвращает новую пару токенов.
    Старый refresh_token удаляется (rotation).
    """
    token_hash = hash_token(body.refresh_token)

    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    db_token = result.scalar_one_or_none()

    if db_token is None or db_token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Сессия истекла, войдите снова",
        )

    user_id = db_token.user_id

    # Удаляем старый токен (rotation)
    await db.delete(db_token)
    await db.flush()

    # Получаем пользователя для create_tokens
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Сессия истекла, войдите снова",
        )

    tokens = await create_tokens(db, user)
    return tokens


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Принимает refresh_token, удаляет запись из refresh_tokens.
    """
    token_hash = hash_token(body.refresh_token)

    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    db_token = result.scalar_one_or_none()

    if db_token is not None:
        await db.delete(db_token)
        await db.commit()

    return {"detail": "Выход выполнен успешно"}
