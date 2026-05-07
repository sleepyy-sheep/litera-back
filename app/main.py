import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from sqlalchemy import text

from app.db import get_db, engine
from app.models import Base
from app.core.storage import storage

asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await storage.ensure_bucket_exists()
    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(title="Litera Backend", lifespan=lifespan)


@app.get("/health")
async def health_check(db=Depends(get_db)):
    result = await db.execute(text("SELECT 1"))
    return {
        "status": "ok",
        "db_connected": bool(result.scalar())
    }


from app.auth.router import router as auth_router

app.include_router(auth_router)

from app.books.router import router as books_router

app.include_router(books_router)

from fastapi.middleware.cors import CORSMiddleware


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],                    # Пока все адреса
    allow_credentials=True,
    allow_methods=["*"],                    # Разрешает GET, POST, DELETE и т.д.
    allow_headers=["*"],)