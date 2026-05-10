from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

from app.models import BookFormat, ReadingStatus


class BookCreate(BaseModel):
    """Схема для создания новой книги."""

    title: str = Field(..., min_length=1, max_length=500, description="Название книги")
    author: Optional[str] = Field(None, max_length=255, description="Автор книги")
    description: Optional[str] = Field(
        None, max_length=2000, description="Краткое описание книги"
    )
    format: BookFormat = Field(..., description="Формат файла книги")

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Война и мир",
                "author": "Лев Толстой",
                "description": "Эпический роман о жизни русского общества во время Наполеоновских войн.",
                "format": "epub",
            }
        }


class BookOut(BaseModel):
    """Схема ответа при получении информации о книге."""

    id: int
    user_id: int
    title: str
    author: Optional[str] = None
    description: Optional[str] = None
    format: BookFormat
    storage_key: str
    uploaded_at: datetime
    total_pages: Optional[int] = None
    presigned_url: Optional[str] = None

    class Config:
        from_attributes = True


class ReadingProgressBase(BaseModel):
    current_page: int = Field(ge=0)
    percent: float = Field(ge=0.0, le=100.0)
    status: ReadingStatus = ReadingStatus.new


class ReadingProgressCreate(ReadingProgressBase):
    pass


class ReadingProgressOut(ReadingProgressBase):
    book_id: int
    last_read_at: datetime

    class Config:
        from_attributes = True
