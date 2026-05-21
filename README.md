# LitEra

Платформа для чтения книг с трекером прогресса, полками, заметками, статистикой и целями чтения.

## Стек

| Слой | Технологии |
|---|---|
| Backend | FastAPI, SQLAlchemy 2 (async), asyncpg |
| База данных | PostgreSQL |
| Хранилище файлов | MinIO (S3-совместимое) |
| Миграции | Alembic |
| Аутентификация | JWT (access 30 мин) + Refresh-токены (30 дней, rotation) |
| Rate limiting | slowapi |
| Frontend | Vanilla JS, HTML/CSS (статика) |

## Структура проекта

```
litera-back/
├── backend/
│   ├── app/
│   │   ├── auth/         # Аутентификация и управление профилем
│   │   ├── books/        # Книги, прогресс, сессии чтения
│   │   ├── shelves/      # Полки
│   │   ├── notes/        # Заметки к книгам
│   │   ├── stats/        # Статистика чтения
│   │   ├── goals/        # Цели чтения
│   │   ├── core/         # Конфиг, безопасность, MinIO-клиент
│   │   ├── db.py         # Подключение к PostgreSQL
│   │   ├── models.py     # SQLAlchemy-модели
│   │   └── main.py       # Точка входа FastAPI
│   ├── alembic/          # Миграции БД
│   │   └── versions/
│   │       ├── 0001_initial.py
│   │       └── 0002_new_models.py
│   ├── docker/
│   │   └── Dockerfile.api
│   ├── .env
│   ├── docker-compose.yml
│   └── requirements.txt
│
└── frontend/
    ├── css/
    ├── js/
    ├── index.html        # Дашборд
    ├── log.html          # Вход
    └── register.html     # Регистрация
```

## Запуск через Docker Compose (рекомендуется)

```bash
cd backend
docker-compose up --build
```

Сервисы после запуска:

| Сервис | URL |
|---|---|
| API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |
| MinIO Console | http://localhost:9001 |

Учётные данные MinIO по умолчанию: `minioadmin` / `minioadmin123`

Миграции применяются автоматически при старте контейнера (`alembic upgrade head`).

## Запуск локально (без Docker)

### 1. Запустите PostgreSQL и MinIO

Измените в `backend/.env`:
```
DATABASE_URL=postgresql+asyncpg://litera_user:litera_pass@localhost:5432/litera_db
MINIO_ENDPOINT=http://localhost:9000
```

### 2. Установите зависимости

```bash
cd backend
pip install -r requirements.txt
```

### 3. Примените миграции

```bash
cd backend
alembic upgrade head
```

### 4. Запустите API

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Запуск фронтенда

Фронтенд — статические файлы. Открывайте через локальный сервер (не через `file://`):

```bash
cd frontend
python -m http.server 3000
```

Затем откройте http://localhost:3000/log.html

## API

Полная интерактивная документация доступна по адресу http://localhost:8000/docs.

### Аутентификация (`/auth`)

| Метод | Путь | Описание |
|---|---|---|
| POST | `/auth/register` | Регистрация (лимит: 5/мин) |
| POST | `/auth/login` | Вход, возвращает access + refresh токены (лимит: 10/мин) |
| POST | `/auth/refresh` | Обновление пары токенов (rotation) |
| POST | `/auth/logout` | Выход, инвалидация refresh-токена |
| GET | `/auth/me` | Профиль текущего пользователя |
| PATCH | `/auth/me` | Обновление username, email или пароля |
| DELETE | `/auth/me` | Удаление аккаунта (каскадно, включая файлы в MinIO) |

### Книги (`/books`)

| Метод | Путь | Описание |
|---|---|---|
| POST | `/books/` | Загрузка книги (PDF/EPUB/FB2, ≤50 МБ, валидация magic bytes) |
| GET | `/books/my` | Список книг с пагинацией, фильтром по жанру и сортировкой |
| GET | `/books/search` | Поиск по названию и автору (ILIKE) |
| GET | `/books/{id}` | Детальная карточка книги |
| DELETE | `/books/{id}` | Удаление книги и файла из MinIO |
| GET | `/books/{id}/read` | Presigned URL для чтения + текущий прогресс |
| POST | `/books/{id}/cover` | Загрузка обложки (JPEG/PNG, ≤5 МБ) |
| POST | `/books/{id}/progress` | Обновление прогресса чтения |
| GET | `/books/{id}/progress` | Текущий прогресс чтения |
| POST | `/books/{id}/sessions` | Запись сессии чтения (страницы + время) |

### Полки (`/shelves`)

| Метод | Путь | Описание |
|---|---|---|
| POST | `/shelves/` | Создание полки |
| GET | `/shelves/` | Список полок с количеством книг |
| GET | `/shelves/{id}` | Детали полки со списком книг |
| PATCH | `/shelves/{id}` | Переименование полки |
| DELETE | `/shelves/{id}` | Удаление полки (книги не удаляются) |
| POST | `/shelves/{id}/books` | Добавление книги на полку |
| DELETE | `/shelves/{id}/books/{book_id}` | Удаление книги с полки |

### Заметки (`/books/{id}/notes`)

| Метод | Путь | Описание |
|---|---|---|
| POST | `/books/{id}/notes` | Создание заметки (до 5000 символов) |
| GET | `/books/{id}/notes` | Список заметок к книге |
| PATCH | `/books/{id}/notes/{note_id}` | Редактирование заметки |
| DELETE | `/books/{id}/notes/{note_id}` | Удаление заметки |

### Статистика (`/stats`)

| Метод | Путь | Описание |
|---|---|---|
| GET | `/stats/reading?period=week\|month\|year` | Статистика чтения за период (страницы, минуты, разбивка по дням) |

### Цели чтения (`/goals`)

| Метод | Путь | Описание |
|---|---|---|
| POST | `/goals/` | Создать или обновить цель (`pages_per_day` / `minutes_per_day`) |
| GET | `/goals/` | Список целей с прогрессом за сегодня |

## Модели данных

```
User ──< Book ──< ReadingProgress
     ──< RefreshToken
     ──< Shelf ──< ShelfBook >── Book
     ──< BookNote >── Book
     ──< ReadingSession >── Book
     ──< ReadingGoal
```

## Переменные окружения

Файл `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://litera_user:litera_pass@db:5432/litera_db
SECRET_KEY=your-very-long-random-secret-key-min-50-symbols-change-me-2026
MINIO_ENDPOINT=http://minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET=books
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5500,http://127.0.0.1:5500
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30
```

## Безопасность

- Пароли хэшируются через bcrypt
- Refresh-токены хранятся в БД в виде SHA-256 хэша, при обновлении старый токен удаляется (rotation)
- CORS настраивается через `ALLOWED_ORIGINS` (не `*` в продакшене)
- Rate limiting: 10 запросов/мин на `/auth/login`, 5 запросов/мин на `/auth/register`
- Файлы книг валидируются по расширению и magic bytes перед загрузкой в MinIO
