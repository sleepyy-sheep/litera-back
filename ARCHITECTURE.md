# Архитектура проекта ЛитЭра

## Общая схема

```
┌─────────────────────────────────────────────────────────────┐
│                         ПОЛЬЗОВАТЕЛЬ                         │
│                         (Браузер)                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP
                     │
┌────────────────────▼────────────────────────────────────────┐
│                        FRONTEND                              │
│                   (Vanilla JS + HTML)                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   log.html   │  │  index.html  │  │ shelves.html │     │
│  │ (Вход/Рег.)  │  │   (Книги)    │  │   (Полки)    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              js/api.js                                │  │
│  │  API_BASE_URL = 'http://localhost:8000'              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  Порт: 5500 (Live Server / Python HTTP)                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ REST API (JSON)
                     │ Authorization: Bearer <token>
                     │
┌────────────────────▼────────────────────────────────────────┐
│                        BACKEND                               │
│                    (FastAPI + Python)                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   app/main.py                         │  │
│  │              FastAPI Application                      │  │
│  │         CORS: localhost:5500, :3000                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  app/auth/  │  │ app/books/  │  │app/shelves/ │        │
│  │  (JWT Auth) │  │ (CRUD API)  │  │ (CRUD API)  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ app/notes/  │  │ app/stats/  │  │ app/goals/  │        │
│  │ (CRUD API)  │  │ (Analytics) │  │ (CRUD API)  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                              │
│  Порт: 8000 (uvicorn)                                       │
└────────┬──────────────────────────────┬─────────────────────┘
         │                              │
         │ SQLAlchemy                   │ boto3
         │ (asyncpg)                    │ (S3 API)
         │                              │
┌────────▼──────────────┐    ┌─────────▼──────────────┐
│     POSTGRESQL        │    │        MINIO           │
│   (База данных)       │    │  (S3 хранилище)        │
│                       │    │                        │
│  • users              │    │  Bucket: books         │
│  • books              │    │  • book.pdf            │
│  • shelves            │    │  • book.epub           │
│  • notes              │    │  • book.fb2            │
│  • reading_sessions   │    │                        │
│  • goals              │    │  Presigned URLs        │
│                       │    │  (временные ссылки)    │
│  Порт: 5432           │    │  Порт: 9000 (API)      │
│                       │    │  Порт: 9001 (Console)  │
└───────────────────────┘    └────────────────────────┘
```

## Поток данных

### 1. Регистрация пользователя

```
Браузер → POST /auth/register
         ↓
    FastAPI (app/auth/router.py)
         ↓
    Хеширование пароля (bcrypt)
         ↓
    PostgreSQL (INSERT INTO users)
         ↓
    Возврат JWT токена
         ↓
    localStorage.setItem('access_token', token)
```

### 2. Загрузка книги

```
Браузер → POST /books (multipart/form-data)
         ↓
    FastAPI (app/books/router.py)
         ↓
    Парсинг метаданных (PyPDF2/EbookLib)
         ↓
    MinIO (загрузка файла)
         ↓
    PostgreSQL (INSERT INTO books)
         ↓
    Возврат информации о книге
```

### 3. Получение книги для чтения

```
Браузер → GET /books/{id}/content
         ↓
    FastAPI (app/books/router.py)
         ↓
    MinIO (генерация presigned URL)
         ↓
    Возврат временной ссылки (60 мин)
         ↓
    Браузер скачивает файл напрямую из MinIO
```

## Технологический стек

### Frontend
- **HTML5** - структура страниц
- **CSS3** - стилизация (кастомные темы)
- **Vanilla JavaScript** - логика приложения
- **Fetch API** - HTTP запросы к бэкенду
- **LocalStorage** - хранение JWT токена

### Backend
- **FastAPI** - веб-фреймворк
- **SQLAlchemy 2.0** - ORM (async)
- **Alembic** - миграции БД
- **Pydantic** - валидация данных
- **python-jose** - JWT токены
- **passlib + bcrypt** - хеширование паролей
- **boto3** - S3 клиент для MinIO
- **PyPDF2** - парсинг PDF
- **EbookLib** - парсинг EPUB
- **slowapi** - rate limiting

### Инфраструктура
- **PostgreSQL 15** - реляционная БД
- **MinIO** - S3-совместимое хранилище
- **Docker + Docker Compose** - контейнеризация
- **uvicorn** - ASGI сервер

## Безопасность

### Аутентификация
- JWT токены (HS256)
- Срок действия: 7 дней (10080 минут)
- Хранение: localStorage (фронтенд)
- Передача: Authorization: Bearer <token>

### Пароли
- Хеширование: bcrypt (12 раундов)
- Минимальная длина: не задана (рекомендуется 8+)

### CORS
- Разрешенные origins: localhost:5500, localhost:3000
- Credentials: true
- Methods: все
- Headers: все

### Rate Limiting
- POST /auth/login: 10 запросов/минуту с одного IP
- Ответ при превышении: HTTP 429 + Retry-After header

### Файлы
- Presigned URLs с истечением через 60 минут
- Доступ только для авторизованных пользователей
- Изоляция файлов по пользователям

## База данных

### Основные таблицы

**users**
- id (PK)
- username (unique)
- email (unique)
- hashed_password
- created_at

**books**
- id (PK)
- user_id (FK → users)
- title
- author
- file_path (MinIO key)
- file_type (pdf/epub/fb2)
- total_pages
- current_page
- created_at
- updated_at

**shelves**
- id (PK)
- user_id (FK → users)
- name
- description
- created_at

**shelf_books** (many-to-many)
- shelf_id (FK → shelves)
- book_id (FK → books)

**notes**
- id (PK)
- user_id (FK → users)
- book_id (FK → books)
- content
- page_number
- created_at

**reading_sessions**
- id (PK)
- user_id (FK → users)
- book_id (FK → books)
- pages_read
- minutes_read
- session_date

**goals**
- id (PK)
- user_id (FK → users)
- goal_type (pages_per_day/minutes_per_day)
- target_value
- current_value

## API Endpoints

### Auth
- `POST /auth/register` - регистрация
- `POST /auth/login` - вход (OAuth2 form)
- `GET /auth/me` - текущий пользователь

### Books
- `GET /books` - список книг пользователя
- `POST /books` - загрузка книги
- `GET /books/{id}` - информация о книге
- `PUT /books/{id}` - обновление книги
- `DELETE /books/{id}` - удаление книги
- `GET /books/{id}/content` - presigned URL

### Shelves
- `GET /shelves` - список полок
- `POST /shelves` - создание полки
- `PUT /shelves/{id}` - обновление полки
- `DELETE /shelves/{id}` - удаление полки
- `POST /shelves/{id}/books/{book_id}` - добавить книгу
- `DELETE /shelves/{id}/books/{book_id}` - убрать книгу

### Notes
- `GET /notes?book_id={id}` - заметки к книге
- `POST /notes` - создание заметки
- `PUT /notes/{id}` - обновление заметки
- `DELETE /notes/{id}` - удаление заметки

### Stats
- `GET /stats/reading` - статистика чтения

### Goals
- `GET /goals` - список целей
- `POST /goals` - создание цели
- `PUT /goals/{id}` - обновление цели
- `DELETE /goals/{id}` - удаление цели

## Конфигурация

### Переменные окружения (.env)

```env
# Database
DATABASE_URL=postgresql+asyncpg://litera_user:litera_pass@postgres:5432/litera_db

# MinIO / S3
MINIO_ENDPOINT=http://minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET=books
MINIO_SECURE=false
PRESIGNED_URL_EXPIRE_MINUTES=60

# JWT
SECRET_KEY=your-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5500,http://127.0.0.1:5500
```

## Масштабирование

### Горизонтальное масштабирование API
- Stateless архитектура (JWT в клиенте)
- Можно запустить несколько инстансов FastAPI
- Использовать nginx/traefik для балансировки

### База данных
- PostgreSQL поддерживает репликацию
- Можно настроить read replicas для чтения
- Connection pooling через SQLAlchemy

### Хранилище файлов
- MinIO поддерживает кластеризацию
- Можно мигрировать на AWS S3 / Azure Blob
- CDN для раздачи файлов

## Мониторинг

### Логи
```cmd
docker-compose logs -f api
docker-compose logs -f postgres
docker-compose logs -f minio
```

### Health Check
```
GET /health
→ {"status": "ok", "db_connected": true}
```

### Метрики
- Можно добавить Prometheus + Grafana
- FastAPI поддерживает middleware для метрик
- PostgreSQL имеет встроенные статистики

## Разработка

### Горячая перезагрузка
- Backend: автоматическая (volume mapping)
- Frontend: Live Server (VS Code) или browser-sync

### Отладка
- Backend: логи через docker-compose logs
- Frontend: DevTools (F12) в браузере
- Database: pgAdmin или DBeaver

### Тестирование
- Backend: pytest + httpx
- Frontend: можно добавить Jest
- E2E: Playwright / Cypress
