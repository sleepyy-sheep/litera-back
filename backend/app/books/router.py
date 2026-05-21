import asyncio
import io
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
    Form,
    UploadFile,
    File,
)
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.storage import storage, MAX_FILE_SIZE_BYTES
from app.core.config import settings
from app.db import get_db
from app.models import Book, User, BookFormat, ReadingProgress, ReadingStatus, ReadingSession
from .schemas import BookOut, BooksPage, ReadingProgressCreate, ReadingProgressOut, ReadingSessionCreate, ReadingSessionOut

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


# ====================== ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ГЕНЕРАЦИИ cover_url ======================

async def get_cover_url(cover_key: Optional[str]) -> Optional[str]:
    """Генерирует presigned URL для обложки книги или возвращает None."""
    if not cover_key:
        return None
    try:
        return await storage.get_presigned_url(cover_key)
    except Exception:
        return None


# ====================== ВАЛИДАЦИЯ MAGIC BYTES ФАЙЛА КНИГИ ======================

# Magic bytes для поддерживаемых форматов книг
PDF_MAGIC = b"%PDF"
EPUB_MAGIC = b"PK\x03\x04"  # ZIP-заголовок (EPUB — это ZIP-архив)
FB2_MAGIC_XML = b"<?xml"
FB2_MAGIC_FICTION = b"<FictionBook"


def validate_file_magic(content: bytes, declared_format: BookFormat) -> None:
    """Проверяет первые 12 байт файла на соответствие заявленному формату.

    Raises:
        HTTPException(415): если реальный формат не соответствует заявленному.
    """
    header = content[:12]

    if declared_format == BookFormat.pdf:
        if not header.startswith(PDF_MAGIC):
            raise HTTPException(
                status_code=415,
                detail="Содержимое файла не соответствует указанному формату",
            )
    elif declared_format == BookFormat.epub:
        if not header.startswith(EPUB_MAGIC):
            raise HTTPException(
                status_code=415,
                detail="Содержимое файла не соответствует указанному формату",
            )
    elif declared_format == BookFormat.fb2:
        if not (header.startswith(FB2_MAGIC_XML) or header.startswith(FB2_MAGIC_FICTION)):
            raise HTTPException(
                status_code=415,
                detail="Содержимое файла не соответствует указанному формату",
            )
    # BookFormat.other — magic bytes не проверяются


# ====================== ДОБАВЛЕНИЕ КНИГИ ======================

@router.post("/", response_model=BookOut, status_code=status.HTTP_201_CREATED)
async def add_book(
    title: str = Form(..., min_length=1, max_length=500),
    author: Optional[str] = Form(None, max_length=255),
    description: Optional[str] = Form(None, max_length=2000),
    genre: Optional[str] = Form(None, max_length=100),
    format: BookFormat = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Добавляет книгу с подсчётом количества страниц."""

    # Проверяем расширение файла до чтения содержимого (R15.4)
    ALLOWED_EXTENSIONS = {".pdf", ".epub", ".fb2"}
    file_ext = os.path.splitext(file.filename or "")[1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail="Поддерживаются только форматы .pdf, .epub, .fb2",
        )

    # Читаем содержимое файла для подсчёта страниц и проверки размера
    file_content = await file.read()

    if len(file_content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Файл слишком большой. Максимальный размер: {MAX_FILE_SIZE_BYTES // (1024 * 1024)} МБ",
        )

    # Проверяем magic bytes файла на соответствие заявленному формату
    validate_file_magic(file_content, format)

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
        genre=genre,
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

    # 4. Генерация presigned URL для файла книги
    try:
        presigned_url = await storage.get_presigned_url(storage_key)
    except Exception:
        presigned_url = None

    # 5. Генерация cover_url из cover_key
    cover_url = await get_cover_url(new_book.cover_key)

    return BookOut(
        id=new_book.id,
        user_id=new_book.user_id,
        title=new_book.title,
        author=new_book.author,
        description=new_book.description,
        genre=new_book.genre,
        format=new_book.format,
        uploaded_at=new_book.uploaded_at,
        total_pages=new_book.total_pages,
        presigned_url=presigned_url,
        cover_url=cover_url,
    )


# ====================== СПИСОК СВОИХ КНИГ ======================

# Допустимые поля для сортировки
_SORT_FIELDS = {
    "title": Book.title,
    "author": Book.author,
    "uploaded_at": Book.uploaded_at,
}


@router.get("/my", response_model=BooksPage)
async def get_my_books(
    page: int = Query(1, ge=1, description="Номер страницы (начиная с 1)"),
    page_size: int = Query(20, ge=1, le=100, description="Количество книг на странице (макс. 100)"),
    genre: Optional[str] = Query(None, description="Фильтр по жанру (частичное совпадение)"),
    sort: Optional[str] = Query(None, description="Поле сортировки: title, author, uploaded_at"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает книги текущего пользователя с пагинацией, фильтрацией и сортировкой."""
    # Базовое условие — только книги текущего пользователя
    base_where = Book.user_id == current_user.id

    # Применяем фильтр по жанру (case-insensitive)
    if genre:
        base_where = base_where & Book.genre.ilike(f"%{genre}%")

    # Подсчёт общего количества книг, соответствующих фильтру
    count_result = await db.execute(
        select(func.count()).select_from(Book).where(base_where)
    )
    total = count_result.scalar_one()

    # Определяем порядок сортировки
    sort_column = _SORT_FIELDS.get(sort) if sort else None
    if sort_column is not None:
        order_clause = sort_column.asc()
    else:
        order_clause = Book.uploaded_at.desc()

    # Получаем страницу книг
    offset = (page - 1) * page_size
    result = await db.execute(
        select(Book)
        .where(base_where)
        .order_by(order_clause)
        .offset(offset)
        .limit(page_size)
    )
    books = result.scalars().all()

    # Вспомогательная корутина для параллельного обогащения одной книги
    async def enrich_book(book: Book) -> BookOut:
        book_out = BookOut.model_validate(book)
        try:
            book_out.presigned_url = await storage.get_presigned_url(book.storage_key)
        except Exception as e:
            print(f"Не удалось сгенерировать URL для книги {book.id}: {e}")
            book_out.presigned_url = None
        book_out.cover_url = await get_cover_url(book.cover_key)
        return book_out

    # Обогащаем все книги параллельно (R16.1, R16.2)
    enriched_books = list(await asyncio.gather(*[enrich_book(b) for b in books]))

    return BooksPage(items=enriched_books, total=total, page=page, page_size=page_size)


# ====================== ПОИСК КНИГ ======================

@router.get("/search", response_model=BooksPage)
async def search_books(
    q: str = Query(..., min_length=1, description="Строка поиска по названию или автору"),
    page: int = Query(1, ge=1, description="Номер страницы (начиная с 1)"),
    page_size: int = Query(20, ge=1, le=100, description="Количество книг на странице (макс. 100)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Поиск книг текущего пользователя по названию или автору (регистронезависимо), с пагинацией."""
    search_filter = (
        (Book.user_id == current_user.id)
        & or_(
            Book.title.ilike(f"%{q}%"),
            Book.author.ilike(f"%{q}%"),
        )
    )

    # Подсчёт общего количества совпадений
    count_result = await db.execute(
        select(func.count()).select_from(Book).where(search_filter)
    )
    total = count_result.scalar_one()

    # Получаем страницу результатов
    offset = (page - 1) * page_size
    result = await db.execute(
        select(Book)
        .where(search_filter)
        .order_by(Book.uploaded_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    books = result.scalars().all()

    # Обогащаем книги presigned URL и cover_url
    enriched_books = []
    for book in books:
        book_out = BookOut.model_validate(book)
        try:
            book_out.presigned_url = await storage.get_presigned_url(book.storage_key)
        except Exception as e:
            print(f"Не удалось сгенерировать URL для книги {book.id}: {e}")
            book_out.presigned_url = None
        book_out.cover_url = await get_cover_url(book.cover_key)
        enriched_books.append(book_out)

    return BooksPage(items=enriched_books, total=total, page=page, page_size=page_size)


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
    book_out.cover_url = await get_cover_url(book.cover_key)

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


# ====================== ЗАГРУЗКА ОБЛОЖКИ ======================

# Magic bytes для определения формата изображения
JPEG_MAGIC = b"\xff\xd8\xff"
PNG_MAGIC = b"\x89\x50\x4e\x47"
MAX_COVER_SIZE_BYTES = 5 * 1024 * 1024  # 5 МБ


@router.post("/{book_id}/cover", response_model=dict)
async def upload_book_cover(
    book_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Загружает обложку книги (JPEG или PNG, не более 5 МБ)."""
    # 1. Проверяем, что книга существует и принадлежит пользователю
    result = await db.execute(select(Book).where(Book.id == book_id))
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(status_code=404, detail="Книга не найдена")
    if book.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Это не ваша книга")

    # 2. Читаем содержимое файла
    file_content = await file.read()

    # 3. Проверяем размер файла (≤ 5 МБ)
    if len(file_content) > MAX_COVER_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Файл слишком большой. Максимальный размер обложки: {MAX_COVER_SIZE_BYTES // (1024 * 1024)} МБ",
        )

    # 4. Валидация magic bytes — определяем формат по первым байтам
    if file_content[:3] == JPEG_MAGIC:
        # JPEG — всё в порядке
        pass
    elif file_content[:4] == PNG_MAGIC:
        # PNG — всё в порядке
        pass
    else:
        raise HTTPException(
            status_code=415,
            detail="Поддерживаются только форматы JPEG и PNG",
        )

    # 5. Загружаем обложку в MinIO (метод будет добавлен в задаче 7.6)
    try:
        cover_key = await storage.upload_cover(file_content, current_user.id, book_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка загрузки обложки в хранилище: {str(e)}")

    # 6. Обновляем cover_key в БД
    try:
        book.cover_key = cover_key
        await db.commit()
        await db.refresh(book)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка обновления обложки в БД: {str(e)}")

    # 7. Генерируем presigned URL для обложки
    cover_url = await get_cover_url(cover_key)

    return {"cover_url": cover_url}


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


# ====================== СЕССИИ ЧТЕНИЯ ======================

@router.post("/{book_id}/sessions", response_model=ReadingSessionOut, status_code=status.HTTP_201_CREATED)
async def create_reading_session(
    book_id: int,
    session_data: ReadingSessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Создаёт новую сессию чтения для книги.

    Вычисляет duration_minutes как разницу между ended_at и started_at.
    Возвращает HTTP 422, если ended_at <= started_at.
    Возвращает HTTP 404, если книга не найдена.
    Возвращает HTTP 403, если книга не принадлежит текущему пользователю.
    """
    # Валидация: ended_at должен быть позже started_at (R8.4)
    if session_data.ended_at <= session_data.started_at:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Время окончания не может быть раньше времени начала",
        )

    # Проверяем, что книга существует и принадлежит пользователю
    book_result = await db.execute(select(Book).where(Book.id == book_id))
    book = book_result.scalar_one_or_none()

    if not book:
        raise HTTPException(status_code=404, detail="Книга не найдена")
    if book.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Это не ваша книга")

    # Вычисляем duration_minutes (R8.3)
    duration_seconds = (session_data.ended_at - session_data.started_at).total_seconds()
    duration_minutes = round(duration_seconds / 60)

    # Создаём запись сессии
    new_session = ReadingSession(
        user_id=current_user.id,
        book_id=book_id,
        started_at=session_data.started_at,
        ended_at=session_data.ended_at,
        pages_read=session_data.pages_read,
        duration_minutes=duration_minutes,
    )

    try:
        db.add(new_session)
        await db.commit()
        await db.refresh(new_session)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка сохранения сессии в БД: {str(e)}")

    return new_session
