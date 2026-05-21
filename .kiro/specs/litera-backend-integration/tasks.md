# Tasks: litera-backend-integration (Backend Only)

## Task 1: Настройка Alembic-миграций

**Requirements:** R2

- [x] 1.1 Создать `backend/alembic.ini` и `backend/alembic/env.py` с async-поддержкой (asyncpg)
- [x] 1.2 Написать начальную миграцию `0001_initial.py` — таблицы `users`, `books`, `reading_progress`
- [x] 1.3 Убрать `Base.metadata.create_all` из `main.py` lifespan; заменить на проверку что миграции применены
- [x] 1.4 Обновить `docker/Dockerfile.api` — добавить `alembic upgrade head` перед запуском uvicorn
- [x] 1.5 Добавить `alembic` в `requirements.txt` (уже есть, проверить версию)

## Task 2: Новые модели БД

**Requirements:** R1.8, R4.2, R5.1, R7.2, R8.2, R10.3, R11.1

- [x] 2.1 Добавить в `models.py` модель `RefreshToken` (id, user_id FK, token_hash VARCHAR(64), expires_at, created_at)
- [x] 2.2 Добавить в `models.py` модель `Shelf` (id, user_id FK, name VARCHAR(100), created_at) + relationship к User
- [x] 2.3 Добавить в `models.py` модель `ShelfBook` (id, shelf_id FK, book_id FK, UniqueConstraint)
- [x] 2.4 Добавить в `models.py` модель `BookNote` (id, user_id FK, book_id FK, text VARCHAR(5000), created_at, updated_at)
- [x] 2.5 Добавить в `models.py` модель `ReadingSession` (id, user_id FK, book_id FK, started_at, ended_at, pages_read, duration_minutes)
- [x] 2.6 Добавить в `models.py` модель `ReadingGoal` (id, user_id FK, goal_type Enum[pages_per_day/minutes_per_day], target_value Integer, created_at)
- [x] 2.7 Добавить поля `genre VARCHAR(100)` и `cover_key VARCHAR(512)` в модель `Book`
- [x] 2.8 Написать Alembic-миграцию `0002_new_models.py` для всех новых таблиц и полей

## Task 3: Система Refresh-токенов

**Requirements:** R1.1–R1.8

- [x] 3.1 В `core/security.py` добавить `create_refresh_token(user_id)` — генерирует случайный токен, хэширует SHA-256, возвращает (raw_token, token_hash, expires_at)
- [x] 3.2 В `core/security.py` добавить `hash_token(token: str) -> str` (SHA-256 hex)
- [x] 3.3 В `auth/service.py` обновить `create_tokens` — сохранять RefreshToken в БД, возвращать `{access_token, refresh_token, token_type}`
- [x] 3.4 В `auth/schemas.py` обновить `Token` — добавить поле `refresh_token: str`; уменьшить `ACCESS_TOKEN_EXPIRE_MINUTES` до 30 в `config.py`; добавить `REFRESH_TOKEN_EXPIRE_DAYS: int = 30`
- [x] 3.5 В `auth/router.py` добавить `POST /auth/refresh` — принимает `{refresh_token}`, валидирует по БД, возвращает новую пару токенов (rotation), инвалидирует старый
- [x] 3.6 В `auth/router.py` добавить `POST /auth/logout` — принимает `{refresh_token}`, удаляет запись из `refresh_tokens`, возвращает HTTP 200

## Task 4: Управление профилем пользователя

**Requirements:** R3.1–R3.4

- [x] 4.1 В `auth/schemas.py` добавить `UserUpdate` (Optional username, email, current_password, new_password)
- [x] 4.2 В `auth/router.py` добавить `PATCH /auth/me` — частичное обновление полей пользователя, проверка уникальности, смена пароля с верификацией current_password
- [x] 4.3 В `auth/router.py` добавить `DELETE /auth/me` — удаление аккаунта: файлы из MinIO, все refresh_tokens, каскадное удаление через БД

## Task 5: CORS и конфигурация безопасности

**Requirements:** R13.1–R13.3

- [x] 5.1 В `core/config.py` добавить поле `ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5500,http://127.0.0.1:5500"`
- [x] 5.2 В `main.py` заменить `allow_origins=["*"]` на `settings.ALLOWED_ORIGINS.split(",")`
- [x] 5.3 В `docker-compose.yml` добавить переменную `ALLOWED_ORIGINS` в секцию `api.environment`

## Task 6: Rate Limiting

**Requirements:** R14.1–R14.4

- [x] 6.1 Добавить `slowapi==0.1.9` в `requirements.txt`
- [x] 6.2 В `main.py` инициализировать `Limiter` из slowapi, добавить `SlowAPIMiddleware`
- [x] 6.3 В `auth/router.py` добавить декоратор `@limiter.limit("10/minute")` на `POST /auth/login`
- [x] 6.4 В `auth/router.py` добавить декоратор `@limiter.limit("5/minute")` на `POST /auth/register`
- [x] 6.5 Добавить обработчик `RateLimitExceeded` — возвращать HTTP 429 с заголовком `Retry-After`

## Task 7: Жанры и обложки книг + устранение storage_key

**Requirements:** R5.1–R5.2, R11.1–R11.5, R12.1–R12.3

- [x] 7.1 В `books/schemas.py` добавить поле `genre: Optional[str]` в `BookCreate` и `BookOut`
- [x] 7.2 В `books/schemas.py` добавить поле `cover_url: Optional[str]` в `BookOut`; удалить `storage_key` из `BookOut`
- [x] 7.3 В `books/router.py` в `add_book` добавить параметр `genre: Optional[str] = Form(None, max_length=100)` и сохранять в БД
- [x] 7.4 В `books/router.py` во всех эндпоинтах убрать `storage_key` из ответов; добавить генерацию `cover_url` из `book.cover_key`
- [x] 7.5 В `books/router.py` добавить `POST /books/{book_id}/cover` — загрузка обложки (JPEG/PNG ≤5MB), валидация magic bytes, сохранение в MinIO `covers/{user_id}/{book_id}.jpg`, обновление `cover_key`
- [x] 7.6 В `core/storage.py` добавить метод `upload_cover(file_content: bytes, user_id: int, book_id: int) -> str`

## Task 8: Валидация файлов по magic bytes

**Requirements:** R15.1–R15.4

- [x] 8.1 В `books/router.py` добавить функцию `validate_file_magic(content: bytes, declared_format: BookFormat) -> None` — проверяет первые 12 байт, бросает HTTP 415 при несоответствии
- [x] 8.2 Вызвать `validate_file_magic` в `add_book` после чтения файла, до загрузки в MinIO
- [x] 8.3 Проверять расширение файла до magic bytes — HTTP 415 если не `.pdf/.epub/.fb2`

## Task 9: Пагинация и поиск книг

**Requirements:** R6.1–R6.4

- [x] 9.1 В `books/schemas.py` добавить `BooksPage` (items: list[BookOut], total: int, page: int, page_size: int)
- [x] 9.2 В `books/router.py` обновить `GET /books/my` — добавить query-параметры `page`, `page_size` (default 20, max 100), `genre`, `sort`; вернуть `BooksPage`
- [x] 9.3 В `books/router.py` добавить `GET /books/search` — поиск по `q` в `title` и `author` (ILIKE), с пагинацией, возвращает `BooksPage`

## Task 10: Параллельная генерация Presigned URL

**Requirements:** R16.1–R16.2

- [x] 10.1 В `books/router.py` в `GET /books/my` заменить последовательный цикл на `asyncio.gather` для генерации presigned URL всех книг одновременно
- [x] 10.2 Обернуть каждый вызов в `try/except` — при ошибке устанавливать `presigned_url=None`, не прерывать обработку остальных

## Task 11: API полок (Shelf)

**Requirements:** R4.1–R4.8

- [x] 11.1 Создать `backend/app/shelves/` — `__init__.py`, `router.py`, `schemas.py`
- [x] 11.2 В `shelves/schemas.py` создать `ShelfCreate`, `ShelfUpdate`, `ShelfOut` (id, user_id, name, created_at, book_count), `ShelfDetailOut` (+ books: list[BookOut])
- [x] 11.3 В `shelves/router.py` реализовать `POST /shelves/` — создание полки
- [x] 11.4 В `shelves/router.py` реализовать `GET /shelves/` — список полок пользователя с количеством книг
- [x] 11.5 В `shelves/router.py` реализовать `GET /shelves/{shelf_id}` — детали полки со списком книг
- [x] 11.6 В `shelves/router.py` реализовать `PATCH /shelves/{shelf_id}` — переименование полки
- [x] 11.7 В `shelves/router.py` реализовать `DELETE /shelves/{shelf_id}` — удаление полки и ShelfBook записей (книги не удалять)
- [x] 11.8 В `shelves/router.py` реализовать `POST /shelves/{shelf_id}/books` — добавление книги на полку (HTTP 409 если уже есть)
- [x] 11.9 В `shelves/router.py` реализовать `DELETE /shelves/{shelf_id}/books/{book_id}` — удаление книги с полки
- [x] 11.10 Подключить `shelves_router` в `main.py`

## Task 12: Заметки к книгам (BookNote)

**Requirements:** R7.1–R7.3

- [x] 12.1 Создать `backend/app/notes/` — `__init__.py`, `router.py`, `schemas.py`
- [x] 12.2 В `notes/schemas.py` создать `NoteCreate` (text 1–5000), `NoteUpdate` (text), `NoteOut` (id, book_id, user_id, text, created_at, updated_at)
- [x] 12.3 В `notes/router.py` реализовать `POST /books/{book_id}/notes` — создание заметки (проверка владельца книги)
- [x] 12.4 В `notes/router.py` реализовать `GET /books/{book_id}/notes` — список заметок пользователя к книге
- [x] 12.5 В `notes/router.py` реализовать `PATCH /books/{book_id}/notes/{note_id}` — обновление заметки
- [x] 12.6 В `notes/router.py` реализовать `DELETE /books/{book_id}/notes/{note_id}` — удаление заметки
- [x] 12.7 Подключить `notes_router` в `main.py`

## Task 13: Сессии чтения (ReadingSession)

**Requirements:** R8.1–R8.4

- [x] 13.1 В `books/schemas.py` добавить `ReadingSessionCreate` (started_at, ended_at, pages_read ≥0), `ReadingSessionOut`
- [x] 13.2 В `books/router.py` добавить `POST /books/{book_id}/sessions` — создание сессии, вычисление `duration_minutes`, валидация ended_at > started_at (HTTP 422)

## Task 14: Статистика чтения

**Requirements:** R9.1–R9.3

- [x] 14.1 Создать `backend/app/stats/` — `__init__.py`, `router.py`, `schemas.py`
- [x] 14.2 В `stats/schemas.py` создать `DailyBreakdown` (date, pages, minutes), `ReadingStatsOut` (total_pages, total_minutes, sessions_count, daily_breakdown)
- [x] 14.3 В `stats/router.py` реализовать `GET /stats/reading?period=week|month|year` — агрегация из `reading_sessions` за период, заполнение нулями дней без сессий
- [x] 14.4 Подключить `stats_router` в `main.py`

## Task 15: Цели чтения (ReadingGoal)

**Requirements:** R10.1–R10.4

- [x] 15.1 Создать `backend/app/goals/` — `__init__.py`, `router.py`, `schemas.py`
- [x] 15.2 В `goals/schemas.py` создать `GoalCreate` (goal_type, target_value >0), `GoalOut` (id, goal_type, target_value, current_value, created_at)
- [x] 15.3 В `goals/router.py` реализовать `POST /goals/` — создание/обновление цели (upsert по user_id + goal_type)
- [x] 15.4 В `goals/router.py` реализовать `GET /goals/` — список целей с `current_value` из `reading_sessions` за сегодня
- [x] 15.5 Подключить `goals_router` в `main.py`
