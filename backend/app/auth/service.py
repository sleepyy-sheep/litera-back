from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, create_refresh_token, verify_password
from app.models import RefreshToken, User


async def authenticate_user(
    db: AsyncSession,
    login: str,
    password: str,
) -> User | None:
    """
    Ищет пользователя по username ИЛИ email.
    Фронтенд отправляет email в поле username (стандарт OAuth2 form),
    поэтому проверяем оба поля.
    """
    result = await db.execute(
        select(User).where(
            or_(User.username == login, User.email == login)
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None

    return user


async def create_tokens(db: AsyncSession, user: User) -> dict:
    """Create an access token and a refresh token for *user*.

    Persists the refresh token hash to the database and returns a dict
    with ``access_token``, ``refresh_token`` (raw), and ``token_type``.
    """
    access_token = create_access_token(subject=user.id)

    raw_token, token_hash, expires_at = create_refresh_token(user.id)

    db_refresh_token = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(db_refresh_token)
    await db.commit()

    return {
        "access_token": access_token,
        "refresh_token": raw_token,
        "token_type": "bearer",
    }
