"""Alembic environment configuration with async support (asyncpg).

Uses run_async_migrations pattern with AsyncEngine so that migrations
run through the same asyncpg driver as the application itself.
"""

import asyncio
import os
from logging.config import fileConfig

from dotenv import load_dotenv
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# ---------------------------------------------------------------------------
# Load .env so DATABASE_URL is available when running alembic from the CLI
# ---------------------------------------------------------------------------
# Resolve the .env file relative to the backend root (one level up from alembic/)
_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(_backend_dir, ".env"))

# ---------------------------------------------------------------------------
# Import application Base and all models so that autogenerate can detect them
# ---------------------------------------------------------------------------
# Add the backend directory to sys.path so that `app.*` imports resolve
import sys
sys.path.insert(0, _backend_dir)

from app.models import Base  # noqa: E402  — must come after sys.path update
import app.models  # noqa: F401 — ensure all model classes are registered on Base

# ---------------------------------------------------------------------------
# Alembic Config object — gives access to values in alembic.ini
# ---------------------------------------------------------------------------
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadata for 'autogenerate' support
target_metadata = Base.metadata

# ---------------------------------------------------------------------------
# Override sqlalchemy.url from the DATABASE_URL environment variable
# ---------------------------------------------------------------------------
def get_database_url() -> str:
    """Return the async database URL, ensuring the asyncpg driver is used."""
    url = os.getenv("DATABASE_URL", config.get_main_option("sqlalchemy.url", ""))
    if not url:
        raise ValueError(
            "DATABASE_URL is not set. "
            "Add it to backend/.env or set it as an environment variable."
        )
    # Ensure asyncpg driver is specified
    if url.startswith("postgresql://") and "+asyncpg" not in url:
        url = url.replace("postgresql://", "postgresql+asyncpg://")
    return url


# ---------------------------------------------------------------------------
# Offline migrations (no live DB connection — generates SQL script)
# ---------------------------------------------------------------------------
def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL and not an Engine.
    Calls to context.execute() emit the given string to the script output.
    """
    url = get_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


# ---------------------------------------------------------------------------
# Online migrations (async, using AsyncEngine + asyncpg)
# ---------------------------------------------------------------------------
def do_run_migrations(connection: Connection) -> None:
    """Execute migrations using a synchronous connection wrapper."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Create an AsyncEngine and run migrations through a sync connection."""
    # Build configuration dict, overriding the URL from the environment
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = get_database_url()

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # NullPool is recommended for migration scripts
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode using asyncio."""
    asyncio.run(run_async_migrations())


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
