from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, verify_password
from app.models import User


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


def create_tokens(user: User) -> dict:
    access_token = create_access_token(subject=user.id)
    return {
        "access_token": access_token,
        "token_type": "bearer",
    }
