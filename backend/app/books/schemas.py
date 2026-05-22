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
    genre: Optional[str] = Field(None, max_length=100, description="Жанр книги")

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Война и мир",
                "author": "Лев Толстой",
                "description": "Эпический роман о жизни русского общества во время Наполеоновских войн.",
                "format": "epub",
                "genre": "Роман",
            }
        }


class ReadingProgressBrief(BaseModel):
    """Краткий прогресс чтения для списка книг."""

    current_page: int = 0
    percent: float = 0.0
    status: ReadingStatus = ReadingStatus.new


class BookUpdate(BaseModel):
    """Схема частичного обновления метаданных книги."""

    title: Optional[str] = Field(None, min_length=1, max_length=500)
    author: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    genre: Optional[str] = Field(None, max_length=100)


def book_orm_to_out(
    book: "Book",
    *,
    progress: Optional["ReadingProgressBrief"] = None,
    presigned_url: Optional[str] = None,
    cover_url: Optional[str] = None,
) -> "BookOut":
    """Собирает BookOut из ORM без доступа к relationship ``Book.progress`` (async-safe)."""
    from app.models import Book  # noqa: PLC0415

    if not isinstance(book, Book):
        raise TypeError("book must be a Book instance")

    return BookOut(
        id=book.id,
        user_id=book.user_id,
        title=book.title,
        author=book.author,
        description=book.description,
        format=book.format,
        uploaded_at=book.uploaded_at,
        total_pages=book.total_pages,
        genre=book.genre,
        presigned_url=presigned_url,
        cover_url=cover_url,
        progress=progress,
    )


class BookOut(BaseModel):
    """Схема ответа при получении информации о книге."""

    id: int
    user_id: int
    title: str
    author: Optional[str] = None
    description: Optional[str] = None
    format: BookFormat
    uploaded_at: datetime
    total_pages: Optional[int] = None
    genre: Optional[str] = None
    presigned_url: Optional[str] = None
    cover_url: Optional[str] = None
    progress: Optional[ReadingProgressBrief] = None

    class Config:
        from_attributes = True


class BooksPage(BaseModel):
    """Схема ответа для пагинированного списка книг."""

    items: list[BookOut]
    total: int
    page: int
    page_size: int


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


class ReadingSessionCreate(BaseModel):
    """Схема для создания новой сессии чтения."""

    started_at: datetime = Field(..., description="Время начала сессии чтения")
    ended_at: datetime = Field(..., description="Время окончания сессии чтения")
    pages_read: int = Field(..., ge=0, description="Количество прочитанных страниц (≥ 0)")


class ReadingSessionOut(BaseModel):
    """Схема ответа при получении информации о сессии чтения."""

    id: int
    book_id: int
    user_id: int
    started_at: datetime
    ended_at: datetime
    pages_read: int
    duration_minutes: int

    class Config:
        from_attributes = True
