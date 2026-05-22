from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.books.schemas import BookOut
from app.db import get_db
from app.models import Book, Shelf, ShelfBook, User
from .schemas import AddBookToShelf, ShelfCreate, ShelfDetailOut, ShelfOut, ShelfUpdate

router = APIRouter(prefix="/shelves", tags=["shelves"])


@router.post("", response_model=ShelfOut, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=ShelfOut, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_shelf(
    shelf_data: ShelfCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ShelfOut:
    """Создание новой полки для текущего пользователя."""
    new_shelf = Shelf(
        user_id=current_user.id,
        name=shelf_data.name,
    )
    db.add(new_shelf)
    await db.commit()
    await db.refresh(new_shelf)

    return ShelfOut(
        id=new_shelf.id,
        user_id=new_shelf.user_id,
        name=new_shelf.name,
        created_at=new_shelf.created_at,
        book_count=0,
    )


@router.get("", response_model=List[ShelfOut])
@router.get("/", response_model=List[ShelfOut], include_in_schema=False)
async def list_shelves(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[ShelfOut]:
    """Список полок текущего пользователя с количеством книг на каждой."""
    # Subquery: count of ShelfBook records per shelf
    book_count_subq = (
        select(ShelfBook.shelf_id, func.count(ShelfBook.id).label("book_count"))
        .group_by(ShelfBook.shelf_id)
        .subquery()
    )

    result = await db.execute(
        select(Shelf, func.coalesce(book_count_subq.c.book_count, 0).label("book_count"))
        .outerjoin(book_count_subq, Shelf.id == book_count_subq.c.shelf_id)
        .where(Shelf.user_id == current_user.id)
        .order_by(Shelf.created_at)
    )

    rows = result.all()

    return [
        ShelfOut(
            id=shelf.id,
            user_id=shelf.user_id,
            name=shelf.name,
            created_at=shelf.created_at,
            book_count=book_count,
        )
        for shelf, book_count in rows
    ]


@router.get("/{shelf_id}", response_model=ShelfDetailOut)
async def get_shelf(
    shelf_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ShelfDetailOut:
    """Детали полки со списком книг на ней."""
    # Fetch the shelf
    result = await db.execute(select(Shelf).where(Shelf.id == shelf_id))
    shelf = result.scalar_one_or_none()

    if shelf is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Полка не найдена")

    if shelf.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к этой полке")

    # Fetch books on the shelf via ShelfBook join
    books_result = await db.execute(
        select(Book)
        .join(ShelfBook, ShelfBook.book_id == Book.id)
        .where(ShelfBook.shelf_id == shelf_id)
        .order_by(ShelfBook.id)
    )
    books = books_result.scalars().all()

    book_out_list = [
        BookOut(
            id=book.id,
            user_id=book.user_id,
            title=book.title,
            author=book.author,
            description=book.description,
            format=book.format,
            uploaded_at=book.uploaded_at,
            total_pages=book.total_pages,
            genre=book.genre,
            presigned_url=None,
            cover_url=None,
        )
        for book in books
    ]

    return ShelfDetailOut(
        id=shelf.id,
        user_id=shelf.user_id,
        name=shelf.name,
        created_at=shelf.created_at,
        book_count=len(book_out_list),
        books=book_out_list,
    )


@router.delete("/{shelf_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shelf(
    shelf_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Удаление полки текущего пользователя (ShelfBook записи удаляются каскадно, книги — нет)."""
    result = await db.execute(select(Shelf).where(Shelf.id == shelf_id))
    shelf = result.scalar_one_or_none()

    if shelf is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Полка не найдена")

    if shelf.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к этой полке")

    await db.delete(shelf)
    await db.commit()


@router.patch("/{shelf_id}", response_model=ShelfOut)
async def rename_shelf(
    shelf_id: int,
    shelf_data: ShelfUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ShelfOut:
    """Переименование полки текущего пользователя."""
    # Fetch the shelf
    result = await db.execute(select(Shelf).where(Shelf.id == shelf_id))
    shelf = result.scalar_one_or_none()

    if shelf is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Полка не найдена")

    if shelf.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к этой полке")

    # Update the name
    shelf.name = shelf_data.name
    await db.commit()
    await db.refresh(shelf)

    # Compute book_count via subquery (same pattern as list_shelves)
    book_count_subq = (
        select(ShelfBook.shelf_id, func.count(ShelfBook.id).label("book_count"))
        .group_by(ShelfBook.shelf_id)
        .subquery()
    )

    count_result = await db.execute(
        select(func.coalesce(book_count_subq.c.book_count, 0))
        .where(book_count_subq.c.shelf_id == shelf_id)
    )
    book_count = count_result.scalar_one_or_none() or 0

    return ShelfOut(
        id=shelf.id,
        user_id=shelf.user_id,
        name=shelf.name,
        created_at=shelf.created_at,
        book_count=book_count,
    )


@router.post(
    "/{shelf_id}/books",
    status_code=status.HTTP_201_CREATED,
)
async def add_book_to_shelf(
    shelf_id: int,
    body: AddBookToShelf,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Добавление книги на полку текущего пользователя."""
    # Fetch the shelf
    result = await db.execute(select(Shelf).where(Shelf.id == shelf_id))
    shelf = result.scalar_one_or_none()

    if shelf is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Полка не найдена")

    if shelf.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к этой полке")

    # Check if the book is already on this shelf
    existing = await db.execute(
        select(ShelfBook).where(
            ShelfBook.shelf_id == shelf_id,
            ShelfBook.book_id == body.book_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Книга уже на этой полке",
        )

    # Create the ShelfBook record
    shelf_book = ShelfBook(shelf_id=shelf_id, book_id=body.book_id)
    db.add(shelf_book)
    await db.commit()

    return {"message": "Книга добавлена на полку"}


@router.delete("/{shelf_id}/books/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_book_from_shelf(
    shelf_id: int,
    book_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Удаление книги с полки текущего пользователя."""
    # Fetch the shelf
    result = await db.execute(select(Shelf).where(Shelf.id == shelf_id))
    shelf = result.scalar_one_or_none()

    if shelf is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Полка не найдена")

    if shelf.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к этой полке")

    # Fetch the ShelfBook record
    shelf_book_result = await db.execute(
        select(ShelfBook).where(
            ShelfBook.shelf_id == shelf_id,
            ShelfBook.book_id == book_id,
        )
    )
    shelf_book = shelf_book_result.scalar_one_or_none()

    if shelf_book is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Книга не найдена на этой полке",
        )

    await db.delete(shelf_book)
    await db.commit()
