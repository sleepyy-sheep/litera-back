"""Initial migration — tables: users, books, reading_progress

Revision ID: 0001_initial
Revises:
Create Date: 2025-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # Table: users
    # ------------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("username", sa.String(length=60), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
        sa.UniqueConstraint("email"),
    )

    # ------------------------------------------------------------------
    # Table: books
    # ------------------------------------------------------------------
    # Create the BookFormat enum type first
    bookformat_enum = sa.Enum("epub", "fb2", "pdf", "other", name="bookformat")
    bookformat_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "books",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("author", sa.String(length=255), nullable=True),
        sa.Column("description", sa.String(length=2000), nullable=True),
        sa.Column(
            "format",
            sa.Enum("epub", "fb2", "pdf", "other", name="bookformat"),
            nullable=False,
        ),
        sa.Column("storage_key", sa.String(length=512), nullable=False),
        sa.Column("total_pages", sa.Integer(), nullable=True),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_books_user_id"), "books", ["user_id"], unique=False)
    op.create_index(op.f("ix_books_title"), "books", ["title"], unique=False)
    op.create_index(op.f("ix_books_author"), "books", ["author"], unique=False)

    # ------------------------------------------------------------------
    # Table: reading_progress
    # ------------------------------------------------------------------
    # Create the ReadingStatus enum type first
    readingstatus_enum = sa.Enum(
        "new", "reading", "finished", "abandoned", name="readingstatus"
    )
    readingstatus_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "reading_progress",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("book_id", sa.BigInteger(), nullable=False),
        sa.Column("current_page", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("percent", sa.Float(), nullable=False, server_default=sa.text("0.0")),
        sa.Column(
            "status",
            sa.Enum("new", "reading", "finished", "abandoned", name="readingstatus"),
            nullable=False,
            server_default=sa.text("'new'"),
        ),
        sa.Column(
            "last_read_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "book_id", name="unique_user_book_progress"),
    )


def downgrade() -> None:
    # Drop in reverse order to respect foreign key constraints
    op.drop_table("reading_progress")

    readingstatus_enum = sa.Enum(
        "new", "reading", "finished", "abandoned", name="readingstatus"
    )
    readingstatus_enum.drop(op.get_bind(), checkfirst=True)

    op.drop_index(op.f("ix_books_author"), table_name="books")
    op.drop_index(op.f("ix_books_title"), table_name="books")
    op.drop_index(op.f("ix_books_user_id"), table_name="books")
    op.drop_table("books")

    bookformat_enum = sa.Enum("epub", "fb2", "pdf", "other", name="bookformat")
    bookformat_enum.drop(op.get_bind(), checkfirst=True)

    op.drop_table("users")
