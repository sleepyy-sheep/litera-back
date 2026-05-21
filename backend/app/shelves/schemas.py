from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import List

from app.books.schemas import BookOut


class AddBookToShelf(BaseModel):
    """Схема для добавления книги на полку."""

    book_id: int = Field(..., description="ID книги для добавления на полку")




class ShelfCreate(BaseModel):
    """Схема для создания новой полки."""

    name: str = Field(..., min_length=1, max_length=100, description="Название полки")


class ShelfUpdate(BaseModel):
    """Схема для переименования полки."""

    name: str = Field(..., min_length=1, max_length=100, description="Новое название полки")


class ShelfOut(BaseModel):
    """Схема ответа при получении информации о полке."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    name: str
    created_at: datetime
    book_count: int


class ShelfDetailOut(ShelfOut):
    """Схема ответа с детальной информацией о полке, включая список книг."""

    books: List[BookOut]
