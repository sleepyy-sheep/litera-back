from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db import get_db
from app.models import Book, BookNote, User
from .schemas import NoteCreate, NoteOut, NoteUpdate

router = APIRouter(prefix="/books", tags=["notes"])


# ====================== СОЗДАНИЕ ЗАМЕТКИ ======================

@router.post(
    "/{book_id}/notes",
    response_model=NoteOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_note(
    book_id: int,
    note_data: NoteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Создаёт заметку к книге. Книга должна принадлежать текущему пользователю (R7.1–R7.3)."""
    # Проверяем, что книга существует
    result = await db.execute(select(Book).where(Book.id == book_id))
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(status_code=404, detail="Книга не найдена")

    # Проверяем, что книга принадлежит текущему пользователю (R7.3)
    if book.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="У вас нет доступа к этой книге",
        )

    # Создаём заметку (R7.2)
    new_note = BookNote(
        user_id=current_user.id,
        book_id=book_id,
        text=note_data.text,
    )

    try:
        db.add(new_note)
        await db.commit()
        await db.refresh(new_note)
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка сохранения заметки: {str(e)}",
        )

    return new_note


# ====================== СПИСОК ЗАМЕТОК ======================

@router.get(
    "/{book_id}/notes",
    response_model=List[NoteOut],
    status_code=status.HTTP_200_OK,
)
async def list_notes(
    book_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает список заметок текущего пользователя к книге (R7.1–R7.3)."""
    # Проверяем, что книга существует
    result = await db.execute(select(Book).where(Book.id == book_id))
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(status_code=404, detail="Книга не найдена")

    # Проверяем, что книга принадлежит текущему пользователю (R7.3)
    if book.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="У вас нет доступа к этой книге",
        )

    # Получаем все заметки пользователя к этой книге (R7.1)
    notes_result = await db.execute(
        select(BookNote)
        .where(BookNote.book_id == book_id, BookNote.user_id == current_user.id)
        .order_by(BookNote.created_at)
    )
    notes = notes_result.scalars().all()

    return notes


# ====================== ОБНОВЛЕНИЕ ЗАМЕТКИ ======================

@router.patch(
    "/{book_id}/notes/{note_id}",
    response_model=NoteOut,
    status_code=status.HTTP_200_OK,
)
async def update_note(
    book_id: int,
    note_id: int,
    note_data: NoteUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Обновляет текст заметки. Заметка должна принадлежать текущему пользователю (R7.1–R7.3)."""
    # Проверяем, что заметка существует (R7.1)
    result = await db.execute(
        select(BookNote).where(BookNote.id == note_id, BookNote.book_id == book_id)
    )
    note = result.scalar_one_or_none()

    if not note:
        raise HTTPException(status_code=404, detail="Заметка не найдена")

    # Проверяем, что заметка принадлежит текущему пользователю (R7.3)
    if note.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="У вас нет доступа к этой заметке",
        )

    # Обновляем текст и временную метку (R7.2)
    note.text = note_data.text
    note.updated_at = datetime.now(timezone.utc)

    try:
        await db.commit()
        await db.refresh(note)
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка обновления заметки: {str(e)}",
        )

    return note


# ====================== УДАЛЕНИЕ ЗАМЕТКИ ======================

@router.delete(
    "/{book_id}/notes/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_note(
    book_id: int,
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Удаляет заметку. Заметка должна принадлежать текущему пользователю (R7.1)."""
    # Проверяем, что заметка существует и принадлежит данной книге (R7.1)
    result = await db.execute(
        select(BookNote).where(BookNote.id == note_id, BookNote.book_id == book_id)
    )
    note = result.scalar_one_or_none()

    if not note:
        raise HTTPException(status_code=404, detail="Заметка не найдена")

    # Проверяем, что заметка принадлежит текущему пользователю (R7.3)
    if note.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="У вас нет доступа к этой заметке",
        )

    try:
        await db.delete(note)
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка удаления заметки: {str(e)}",
        )
