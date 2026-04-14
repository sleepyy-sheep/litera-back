from sqlalchemy import (
    Column,
    BigInteger,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Enum,
    Float,
    Integer,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from datetime import datetime
from enum import Enum as PyEnum


class Base(DeclarativeBase):
    pass


class BookFormat(str, PyEnum):
    epub = "epub"
    fb2 = "fb2"
    pdf = "pdf"
    other = "other"


class ReadingStatus(str, PyEnum):
    new = "new"
    reading = "reading"
    finished = "finished"
    abandoned = "abandoned"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    username: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    books = relationship("Book", back_populates="user", cascade="all, delete-orphan")


class Book(Base):
    __tablename__ = "books"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False, index=True)
    
    title: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    author: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)       
    description: Mapped[str | None] = mapped_column(String(2000), nullable=True)             
    
    format: Mapped[BookFormat] = mapped_column(Enum(BookFormat), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    
    total_pages: Mapped[int | None] = mapped_column(Integer, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="books")
    progress = relationship("ReadingProgress", back_populates="book", uselist=False)


class ReadingProgress(Base):
    __tablename__ = "reading_progress"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False)
    book_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("books.id"), nullable=False)

    current_page: Mapped[int] = mapped_column(Integer, default=0)
    percent: Mapped[float] = mapped_column(Float, default=0.0)           # 0.0 - 100.0
    status: Mapped[ReadingStatus] = mapped_column(Enum(ReadingStatus), default=ReadingStatus.new)
    
    last_read_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    user = relationship("User")
    book = relationship("Book", back_populates="progress")

    __table_args__ = (
        UniqueConstraint("user_id", "book_id", name="unique_user_book_progress"),
    )