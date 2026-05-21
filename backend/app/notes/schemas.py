from pydantic import BaseModel, Field
from datetime import datetime


class NoteCreate(BaseModel):
    """Схема для создания заметки к книге."""

    text: str = Field(..., min_length=1, max_length=5000, description="Текст заметки")

    class Config:
        json_schema_extra = {
            "example": {
                "text": "Очень интересная глава о войне и мире.",
            }
        }


class NoteUpdate(BaseModel):
    """Схема для обновления заметки к книге."""

    text: str = Field(..., min_length=1, max_length=5000, description="Новый текст заметки")

    class Config:
        json_schema_extra = {
            "example": {
                "text": "Обновлённый текст заметки.",
            }
        }


class NoteOut(BaseModel):
    """Схема ответа при получении заметки."""

    id: int
    book_id: int
    user_id: int
    text: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
