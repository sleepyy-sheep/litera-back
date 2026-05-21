import asyncio
import logging
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.middleware import SlowAPIMiddleware
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from app.db import get_db, engine
from app.core.config import settings
from app.core.storage import storage

# Rate limiter — uses the client's remote IP as the key.
# Import `limiter` from this module in routers to apply per-route limits.
limiter = Limiter(key_func=get_remote_address)


async def rate_limit_handler(request, exc: RateLimitExceeded):
    """Return HTTP 429 with a Retry-After header (seconds until limit resets).

    R14.2: IF requests to POST /auth/login from one IP exceed 10/minute,
    THEN return HTTP 429 with Retry-After header containing seconds until reset.
    """
    # Try to get the window expiry from the limit object; fall back to 60 s.
    try:
        retry_after = exc.limit.limit.get_expiry()
    except Exception:
        retry_after = 60
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests"},
        headers={"Retry-After": str(retry_after)},
    )

logger = logging.getLogger(__name__)

# Устанавливаем политику цикла событий только для Windows
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


async def _check_migrations_applied() -> None:
    """Check that Alembic migrations have been applied.

    Verifies that the alembic_version table exists and contains at least one
    row. Logs a warning if not — the app will still start, because the
    Dockerfile runs ``alembic upgrade head`` before launching uvicorn.
    """
    try:
        async with engine.connect() as conn:
            result = await conn.execute(
                text(
                    "SELECT version_num FROM alembic_version LIMIT 1"
                )
            )
            row = result.fetchone()
            if row is None:
                logger.warning(
                    "alembic_version table is empty — "
                    "migrations may not have been applied yet."
                )
            else:
                logger.info("Migrations applied, current revision: %s", row[0])
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Could not verify migrations (alembic_version table missing or "
            "DB unreachable): %s. The app will continue — make sure "
            "'alembic upgrade head' has been executed before startup.",
            exc,
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await _check_migrations_applied()
    await storage.ensure_bucket_exists()
    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(title="Litera Backend", lifespan=lifespan)

# Attach limiter to app state so SlowAPIMiddleware can find it
app.state.limiter = limiter

# Register the 429 handler for rate-limit violations (R14.2: includes Retry-After)
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

# SlowAPIMiddleware must be added before CORS so it intercepts requests first
app.add_middleware(SlowAPIMiddleware)

# CORS должен быть зарегистрирован ДО роутеров
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.auth.router import router as auth_router
from app.books.router import router as books_router
from app.shelves.router import router as shelves_router
from app.notes.router import router as notes_router
from app.stats.router import router as stats_router
from app.goals.router import router as goals_router

app.include_router(auth_router)
app.include_router(books_router)
app.include_router(shelves_router)
app.include_router(notes_router)
app.include_router(stats_router)
app.include_router(goals_router)


@app.get("/health")
async def health_check(db=Depends(get_db)):
    result = await db.execute(text("SELECT 1"))
    return {
        "status": "ok",
        "db_connected": bool(result.scalar())
    }
