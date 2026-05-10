import asyncio
import io
from datetime import datetime, timezone
from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    Form,
    UploadFile,
    File,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.storage import storage, MAX_FILE_SIZE_BYTES
from app.core.config import settings
from app.db import get_db
from app.models import Book, User, BookFormat, ReadingProgress, ReadingStatus
from .schemas import BookOut, ReadingProgressCreate, ReadingProgressOut

router = APIRouter(prefix="/books", tags=["books"])


# ====================== ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ПОДСЧЁТА СТРАНИЦ ======================

async def calculate_total_pages(content: bytes, book_format: BookFormat) -> Optional[int]:
    """Подсчёт страниц на основе содержимого файла в памяти."""
    try:
        if book_format == BookFormat.pdf:
            from PyPDF2 import PdfReader
            reader = PdfReader(io.BytesIO(content))
            return len(reader.pages)

        elif book_format == BookFormat.epub:
            try:
                from ebooklib import epub
                book = epub.read_epub(io.BytesIO(content), options={"ignore_ncx": True})
                spine_length = len(book.spine) if hasattr(book, "spine") else 0
                if spine_length > 0:
                    estimated = int(spine_length * 7.5)
                    return max(60, min(estimated, 700))
                return 180
            except Exception as e:
                print(f"EPUB parsing error: {e}")
                return 200

        elif book_format == BookFormat.fb2:
            try:
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(content, "xml")
                paragraphs = len(soup.find_all(["p", "section", "title"]))
                return max(50, paragraphs // 5)
            except Exception as e:
                print(f"FB2 parsing error: {e}")
                return 150

        return None

    except Exception as e:
        print(f"Общая ошибка подсчёта страниц для {book_format}: {e}")
        return None


# ====================== ДОБАВЛЕНИЕ КНИГИ ======================

@router.post("/", response_model=BookOut, status_code=status.HTTP_201_CREATED)
async def add_book(
    title: str = Form(..., min_length=1, max_length=500),
    author: Optional[str] = Form(None, max_length=255),
    description: Optional[str] = Form(None, max_length=2000),
    format: BookFormat = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Добавляет книгу с подсчётом количества страниц."""

    # Читаем содержимое файла для подсчёта страниц и проверки размера
    file_content = await file.read()

    if len(file_content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Файл слишком большой. Максимальный размер: {MAX_FILE_SIZE_BYTES // (1024 * 1024)} МБ",
        )

    # Возвращаем указатель в начало для последующей загрузки
    await file.seek(0)

    # 1. Загружаем файл в MinIO
    try:
        storage_key = await storage.upload_file(file, current_user.id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка загрузки файла в MinIO: {str(e)}")

    # 2. Подсчёт страниц
    total_pages = await calculate_total_pages(file_content, format)

    # 3. Создаём запись в БД
    new_book = Book(
        user_id=current_user.id,
        title=title,
        author=author,
        description=description,
        format=format,
        storage_key=storage_key,
        total_pages=total_pages,
        uploaded_at=datetime.now(timezone.utc),
    )

    try:
        db.add(new_book)
        await db.commit()
        await db.refresh(new_book)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка сохранения книги в БД: {str(e)}")

    # 4. Генерация presigned URL
    try:
        presigned_url = await storage.get_presigned_url(storage_key)
    except Exception:
        presigned_url = None

    return BookOut(
        id=new_book.id,
        user_id=new_book.user_id,
        title=new_book.title,
        author=new_book.author,
        description=new_book.description,
        format=new_book.format,
        storage_key=new_book.storage_key,
        uploaded_at=new_book.uploaded_at,
        total_pages=new_book.total_pages,
        presigned_url=presigned_url,
    )


# ====================== СПИСОК СВОИХ КНИГ ======================

@router.get("/my", response_model=list[BookOut])
async def get_my_books(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает все книги текущего пользователя."""
    result = await db.execute(
        select(Book)
        .where(Book.user_id == current_user.id)
        .order_by(Book.uploaded_at.desc())
    )
    books = result.scalars().all()

    enriched_books = []
    for book in books:
        book_out = BookOut.model_validate(book)
        try:
            book_out.presigned_url = await storage.get_presigned_url(book.storage_key)
        except Exception as e:
            print(f"Не удалось сгенерировать URL для книги {book.id}: {e}")
            book_out.presigned_url = None
        enriched_books.append(book_out)

    return enriched_books


# ====================== ДЕТАЛЬНАЯ КАРТОЧКА КНИГИ ======================

@router.get("/{book_id}", response_model=BookOut)
async def get_book_detail(
    book_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает детальную информацию об одной книге."""
    result = await db.execute(select(Book).where(Book.id == book_id))
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(status_code=404, detail="Книга не найдена")
    if book.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Это не ваша книга")

    book_out = BookOut.model_validate(book)
    try:
        book_out.presigned_url = await storage.get_presigned_url(book.storage_key)
    except Exception as e:
        print(f"Не удалось сгенерировать URL для книги {book.id}: {e}")
        book_out.presigned_url = None

    return book_out


# ====================== ПОЛУЧЕНИЕ ССЫЛКИ ДЛЯ ЧТЕНИЯ ======================

@router.get("/{book_id}/read", response_model=dict)
async def get_book_read_url(
    book_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает ссылку для чтения + актуальный прогресс."""
    result = await db.execute(select(Book).where(Book.id == book_id))
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(404, "Книга не найдена")
    if book.user_id != current_user.id:
        raise HTTPException(403, "У вас нет доступа к этой книге")

    try:
        presigned_url = await storage.get_presigned_url(book.storage_key)
    except Exception:
        raise HTTPException(500, "Не удалось получить доступ к файлу")

    progress_result = await db.execute(
        select(ReadingProgress).where(
            ReadingProgress.user_id == current_user.id,
            ReadingProgress.book_id == book_id,
        )
    )
    progress = progress_result.scalar_one_or_none()

    progress_data = {
        "current_page": progress.current_page if progress else 0,
        "percent": progress.percent if progress else 0.0,
        "status": progress.status.value if progress else ReadingStatus.new.value,
    }

    return {
        "book_id": book.id,
        "title": book.title,
        "author": book.author or "",
        "description": book.description or "",
        "format": str(book.format),
        "total_pages": book.total_pages,
        "presigned_url": presigned_url,
        "progress": progress_data,
        "expires_in_minutes": settings.PRESIGNED_URL_EXPIRE_MINUTES,
    }


# ====================== УДАЛЕНИЕ КНИГИ ======================

@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book(
    book_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Удаляет книгу пользователя вместе с файлом из MinIO."""
    result = await db.execute(select(Book).where(Book.id == book_id))
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(status_code=404, detail="Книга не найдена")
    if book.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="У вас нет прав на удаление этой книги")

    # 1. Удаляем файл из MinIO
    try:
        await asyncio.to_thread(
            storage.s3_client.delete_object,
            Bucket=storage.bucket,
            Key=book.storage_key,
        )
        print(f"✅ Файл удалён из MinIO: {book.storage_key}")
    except Exception as e:
        print(f"⚠️ Не удалось удалить файл из MinIO: {e}")
        # Продолжаем удаление из БД даже если файл не удалился

    # 2. Удаляем запись из базы данных
    try:
        await db.delete(book)
        await db.commit()
        print(f"✅ Книга удалена из БД: ID {book.id}, Title: {book.title}")
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка при удалении книги из базы: {str(e)}",
        )

    return None


# ====================== ПРОГРЕСС ЧТЕНИЯ ======================

@router.post("/{book_id}/progress", response_model=ReadingProgressOut)
async def update_reading_progress(
    book_id: int,
    progress_data: ReadingProgressCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Обновляет прогресс чтения книги с автоматическим определением статуса."""
    book_result = await db.execute(select(Book).where(Book.id == book_id))
    book = book_result.scalar_one_or_none()

    if not book:
        raise HTTPException(404, "Книга не найдена")
    if book.user_id != current_user.id:
        raise HTTPException(403, "Это не ваша книга")

    # Автоматическое определение статуса по проценту
    if progress_data.percent >= 95.0:
        reading_status = ReadingStatus.finished
    elif progress_data.percent > 0.0:
        reading_status = ReadingStatus.reading
    else:
        reading_status = ReadingStatus.new

    progress_result = await db.execute(
        select(ReadingProgress).where(
            ReadingProgress.user_id == current_user.id,
            ReadingProgress.book_id == book_id,
        )
    )
    progress = progress_result.scalar_one_or_none()

    if progress:
        progress.current_page = progress_data.current_page
        progress.percent = progress_data.percent
        progress.status = reading_status
    else:
        progress = ReadingProgress(
            user_id=current_user.id,
            book_id=book_id,
            current_page=progress_data.current_page,
            percent=progress_data.percent,
            status=reading_status,
        )
        db.add(progress)

    await db.commit()
    await db.refresh(progress)

    return progress


@router.get("/{book_id}/progress", response_model=ReadingProgressOut)
async def get_reading_progress(
    book_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает текущий прогресс чтения книги."""
    result = await db.execute(
        select(ReadingProgress).where(
            ReadingProgress.user_id == current_user.id,
            ReadingProgress.book_id == book_id,
        )
    )
    progress = result.scalar_one_or_none()

    if not progress:
        # Возвращаем пустой прогресс, если книга ещё не читалась
        return ReadingProgressOut(
            book_id=book_id,
            current_page=0,
            percent=0.0,
            status=ReadingStatus.new,
            last_read_at=datetime.now(timezone.utc),
        )

    return progress
