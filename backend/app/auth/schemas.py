from pydantic import BaseModel, EmailStr, StringConstraints
from datetime import datetime
from typing import Annotated


ShortUsername = Annotated[
    str,
    StringConstraints(
        min_length=3,
        max_length=60,
        strip_whitespace=True,
    ),
]

# Минимум 8 символов — согласовано с валидацией на фронтенде
StrongPassword = Annotated[
    str,
    StringConstraints(min_length=8),
]


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: int | None = None


class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    is_active: bool
    created_at: datetime
    last_login: datetime | None

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: ShortUsername
    email: EmailStr
    password: StrongPassword


class RefreshRequest(BaseModel):
    refresh_token: str


class UserUpdate(BaseModel):
    username: ShortUsername | None = None
    email: EmailStr | None = None
    current_password: str | None = None
    new_password: StrongPassword | None = None
