# LitEra

Платформа для чтения книг с трекером прогресса.

## Структура проекта

```
litera-back/
├── backend/          # FastAPI приложение
│   ├── app/
│   │   ├── auth/     # Аутентификация (JWT)
│   │   ├── books/    # Книги и прогресс чтения
│   │   ├── core/     # Конфиг, безопасность, MinIO
│   │   ├── db.py     # Подключение к PostgreSQL
│   │   ├── models.py # SQLAlchemy модели
│   │   └── main.py   # Точка входа FastAPI
│   ├── docker/       # Dockerfile и конфиги БД
│   ├── .env          # Переменные окружения
│   ├── docker-compose.yml
│   └── requirements.txt
│
└── frontend/         # Статический фронтенд
    ├── css/
    ├── js/
    ├── log_img/
    ├── index.html    # Дашборд
    ├── log.html      # Страница входа
    └── register.html # Страница регистрации
```

## Запуск через Docker Compose (рекомендуется)

```bash
cd backend
docker-compose up --build
```

Сервисы после запуска:
- **API**: http://localhost:8000
- **Swagger UI**: http://localhost:8000/docs
- **MinIO Console**: http://localhost:9001 (minioadmin / minioadmin123)

## Запуск локально (без Docker)

### 1. Запустите PostgreSQL и MinIO

Измените в `backend/.env`:
```
DATABASE_URL=postgresql+asyncpg://litera_user:litera_pass@localhost:5432/litera_db
MINIO_ENDPOINT=http://localhost:9000
```

### 2. Установите зависимости и запустите API

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Запуск фронтенда

Фронтенд — статические файлы. Открывайте через локальный сервер (не через `file://`):

```bash
cd frontend
python -m http.server 3000
```

Затем откройте http://localhost:3000/log.html
