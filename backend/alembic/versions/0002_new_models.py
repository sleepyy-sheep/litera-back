"""New models: refresh_tokens, shelves, shelf_books, book_notes, reading_sessions, reading_goals;
   add genre and cover_key columns to books.

Revision ID: 0002_new_models
Revises: 0001_initial
Create Date: 2025-01-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0002_new_models"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. Add new columns to books
    # ------------------------------------------------------------------
    op.add_column("books", sa.Column("genre", sa.String(length=100), nullable=True))
    op.add_column("books", sa.Column("cover_key", sa.String(length=512), nullable=True))

    # ------------------------------------------------------------------
    # 2. Table: refresh_tokens
    # ------------------------------------------------------------------
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_refresh_tokens_user_id"), "refresh_tokens", ["user_id"], unique=False
    )

    # ------------------------------------------------------------------
    # 3. Table: shelves
    # ------------------------------------------------------------------
    op.create_table(
        "shelves",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_shelves_user_id"), "shelves", ["user_id"], unique=False
    )

    # ------------------------------------------------------------------
    # 4. Table: shelf_books
    # ------------------------------------------------------------------
    op.create_table(
        "shelf_books",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("shelf_id", sa.BigInteger(), nullable=False),
        sa.Column("book_id", sa.BigInteger(), nullable=False),
        sa.ForeignKeyConstraint(["shelf_id"], ["shelves.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("shelf_id", "book_id", name="unique_shelf_book"),
    )
    op.create_index(
        op.f("ix_shelf_books_shelf_id"), "shelf_books", ["shelf_id"], unique=False
    )
    op.create_index(
        op.f("ix_shelf_books_book_id"), "shelf_books", ["book_id"], unique=False
    )

    # ------------------------------------------------------------------
    # 5. Table: book_notes
    # ------------------------------------------------------------------
    op.create_table(
        "book_notes",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("book_id", sa.BigInteger(), nullable=False),
        sa.Column("text", sa.String(length=5000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_book_notes_user_id"), "book_notes", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_book_notes_book_id"), "book_notes", ["book_id"], unique=False
    )

    # ------------------------------------------------------------------
    # 6. Table: reading_sessions
    # ------------------------------------------------------------------
    op.create_table(
        "reading_sessions",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("book_id", sa.BigInteger(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("pages_read", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "duration_minutes", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_reading_sessions_user_id"), "reading_sessions", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_reading_sessions_book_id"), "reading_sessions", ["book_id"], unique=False
    )

    # ------------------------------------------------------------------
    # 7. GoalType enum + Table: reading_goals
    # ------------------------------------------------------------------
    # create_type=False prevents SQLAlchemy from issuing a second CREATE TYPE
    # inside create_table — we rely on PostgreSQL's implicit enum creation.
    op.create_table(
        "reading_goals",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "goal_type",
            sa.Enum("pages_per_day", "minutes_per_day", name="goaltype", create_type=True),
            nullable=False,
        ),
        sa.Column("target_value", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_reading_goals_user_id"), "reading_goals", ["user_id"], unique=False
    )


def downgrade() -> None:
    # Drop in reverse order to respect foreign key constraints

    # 7. reading_goals + GoalType enum
    op.drop_index(op.f("ix_reading_goals_user_id"), table_name="reading_goals")
    op.drop_table("reading_goals")
    goaltype_enum = sa.Enum("pages_per_day", "minutes_per_day", name="goaltype")
    goaltype_enum.drop(op.get_bind(), checkfirst=True)

    # 6. reading_sessions
    op.drop_index(op.f("ix_reading_sessions_book_id"), table_name="reading_sessions")
    op.drop_index(op.f("ix_reading_sessions_user_id"), table_name="reading_sessions")
    op.drop_table("reading_sessions")

    # 5. book_notes
    op.drop_index(op.f("ix_book_notes_book_id"), table_name="book_notes")
    op.drop_index(op.f("ix_book_notes_user_id"), table_name="book_notes")
    op.drop_table("book_notes")

    # 4. shelf_books
    op.drop_index(op.f("ix_shelf_books_book_id"), table_name="shelf_books")
    op.drop_index(op.f("ix_shelf_books_shelf_id"), table_name="shelf_books")
    op.drop_table("shelf_books")

    # 3. shelves
    op.drop_index(op.f("ix_shelves_user_id"), table_name="shelves")
    op.drop_table("shelves")

    # 2. refresh_tokens
    op.drop_index(op.f("ix_refresh_tokens_user_id"), table_name="refresh_tokens")
    op.drop_table("refresh_tokens")

    # 1. Remove columns from books
    op.drop_column("books", "cover_key")
    op.drop_column("books", "genre")
