from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError(
        "DATABASE_URL не найден в переменных окружения. "
        "Проверьте наличие файла .env и строку DATABASE_URL=..."
    )

engine = create_async_engine(
    DATABASE_URL,
    echo=False,              
    pool_pre_ping=True,       
)

async_session = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def get_db():
    async with async_session() as session:
        yield session