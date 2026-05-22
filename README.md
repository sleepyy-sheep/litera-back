# ЛитЭра - Книжный трекер

Веб-приложение для отслеживания прогресса чтения книг с поддержкой загрузки файлов, заметок и статистики.

## Архитектура проекта

- **Backend**: FastAPI + PostgreSQL + MinIO (S3-совместимое хранилище)
- **Frontend**: Vanilla JavaScript + HTML + CSS
- **Инфраструктура**: Docker Compose

## Быстрый старт

### Предварительные требования

- Docker Desktop для Windows (должен быть запущен)
- Python 3.x (для запуска фронтенда)
- Git

### 1. Запуск бэкенда

**Простой способ** - дважды кликните на `start.bat` в корне проекта

**Или через командную строку:**

```cmd
cd backend
docker-compose up -d
```

Эта команда запустит:
- PostgreSQL (порт 5432) - база данных
- MinIO (порт 9000 - API, 9001 - консоль) - хранилище файлов
- FastAPI приложение (порт 8000) - API сервер

⏱️ Первый запуск может занять 1-2 минуты (загрузка образов, применение миграций)

### 2. Проверка работы бэкенда

Откройте в браузере:
- API документация: http://localhost:8000/docs
- Health check: http://localhost:8000/health
- MinIO консоль: http://localhost:9001 (логин: minioadmin, пароль: minioadmin123)

### 3. Запуск фронтенда

Фронтенд - это статические файлы, которые можно открыть несколькими способами:

#### Вариант A: Live Server (рекомендуется)

Если у вас установлен VS Code с расширением Live Server:
1. Откройте папку `frontend` в VS Code
2. Правой кнопкой на `log.html` → "Open with Live Server"
3. Приложение откроется на http://localhost:5500

#### Вариант B: Python HTTP сервер

```cmd
cd frontend
python -m http.server 5500
```

Откройте http://localhost:5500/log.html

#### Вариант C: Простое открытие файла

Можно открыть `frontend/log.html` напрямую в браузере, но могут быть проблемы с CORS.

## Структура проекта

```
litera-back/
├── backend/
│   ├── app/
│   │   ├── auth/          # Аутентификация и авторизация
│   │   ├── books/         # Управление книгами
│   │   ├── shelves/       # Полки для книг
│   │   ├── notes/         # Заметки к книгам
│   │   ├── stats/         # Статистика чтения
│   │   ├── goals/         # Цели чтения
│   │   └── core/          # Конфигурация, безопасность, хранилище
│   ├── alembic/           # Миграции БД
│   ├── docker/            # Docker конфигурация
│   ├── docker-compose.yml
│   └── requirements.txt
└── frontend/
    ├── css/               # Стили
    ├── js/                # JavaScript модули
    ├── log_img/           # Изображения
    ├── log.html           # Страница входа/регистрации
    ├── index.html         # Главная страница (книги)
    └── shelves.html       # Страница полок
```

## API Endpoints

### Аутентификация
- `POST /auth/register` - Регистрация
- `POST /auth/login` - Вход (OAuth2 form-data)
- `GET /auth/me` - Текущий пользователь

### Книги
- `GET /books` - Список книг
- `POST /books` - Загрузка книги
- `GET /books/{id}` - Информация о книге
- `PUT /books/{id}` - Обновление книги
- `DELETE /books/{id}` - Удаление книги
- `GET /books/{id}/content` - Получение presigned URL для скачивания

### Полки
- `GET /shelves` - Список полок
- `POST /shelves` - Создание полки
- `POST /shelves/{id}/books/{book_id}` - Добавление книги на полку

### Заметки
- `GET /notes` - Список заметок
- `POST /notes` - Создание заметки
- `PUT /notes/{id}` - Обновление заметки
- `DELETE /notes/{id}` - Удаление заметки

### Статистика
- `GET /stats/reading` - Статистика чтения

### Цели
- `GET /goals` - Список целей
- `POST /goals` - Создание цели
- `PUT /goals/{id}` - Обновление цели

## Конфигурация

### Backend (.env)

Файл `backend/.env` уже настроен для работы с Docker Compose. Основные параметры:

```env
DATABASE_URL=postgresql+asyncpg://litera_user:litera_pass@postgres:5432/litera_db
MINIO_ENDPOINT=http://minio:9000
SECRET_KEY=your-very-long-random-secret-key-min-50-symbols-change-me-in-production-2026
```

⚠️ **Важно**: Перед деплоем в продакшн обязательно смените `SECRET_KEY` на случайную строку!

### Frontend (api.js)

Файл `frontend/js/api.js` настроен на подключение к локальному бэкенду:

```javascript
const API_BASE_URL = 'http://localhost:8000';
```

### CORS

Бэкенд настроен на прием запросов от:
- http://localhost:3000
- http://localhost:5500
- http://127.0.0.1:5500

Если фронтенд запущен на другом порту, добавьте его в `ALLOWED_ORIGINS` в `docker-compose.yml`.

## Управление Docker контейнерами

### Просмотр логов

```cmd
cd backend
docker-compose logs -f api
docker-compose logs -f postgres
docker-compose logs -f minio
```

### Остановка

```cmd
cd backend
docker-compose down
```

### Остановка с удалением данных

```cmd
cd backend
docker-compose down -v
```

### Перезапуск после изменений кода

```cmd
cd backend
docker-compose restart api
```

### Пересборка образа

```cmd
cd backend
docker-compose up -d --build
```

## Миграции базы данных

Миграции применяются автоматически при запуске контейнера `api`. Для ручного управления:

### Создание новой миграции

```cmd
cd backend
docker-compose exec api alembic revision --autogenerate -m "описание изменений"
```

### Применение миграций

```cmd
cd backend
docker-compose exec api alembic upgrade head
```

### Откат миграции

```cmd
cd backend
docker-compose exec api alembic downgrade -1
```

## Разработка

### Горячая перезагрузка

Backend настроен на автоматическую перезагрузку при изменении файлов в папке `app/` благодаря volume mapping в docker-compose.yml:

```yaml
volumes:
  - ./app:/app/app
```

### Отладка

1. Просмотр логов API: `docker-compose logs -f api`
2. Подключение к БД: используйте любой PostgreSQL клиент с параметрами из `.env`
3. MinIO консоль: http://localhost:9001

## Решение проблем

### Порты заняты

Если порты 5432, 8000, 9000 или 9001 заняты, измените их в `docker-compose.yml`:

```yaml
ports:
  - "5433:5432"  # Изменить первое число
```

### Ошибка подключения к БД

Убедитесь, что контейнер postgres запущен:

```cmd
docker-compose ps
```

### CORS ошибки

Проверьте, что фронтенд запущен на одном из разрешенных портов (5500, 3000) или добавьте свой порт в `ALLOWED_ORIGINS`.

### Контейнеры не запускаются

```cmd
docker-compose down -v
docker-compose up -d --build
```

## Тестирование API

### Через Swagger UI

Откройте http://localhost:8000/docs и используйте интерактивную документацию.

### Через curl

```cmd
# Регистрация
curl -X POST http://localhost:8000/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"test\",\"email\":\"test@example.com\",\"password\":\"password123\"}"

# Вход
curl -X POST http://localhost:8000/auth/login ^
  -H "Content-Type: application/x-www-form-urlencoded" ^
  -d "username=test@example.com&password=password123"

# Health check
curl http://localhost:8000/health
```

## Производственный деплой

Перед деплоем в продакшн:

1. Смените `SECRET_KEY` в `.env` на случайную строку (минимум 50 символов)
2. Используйте сильные пароли для PostgreSQL и MinIO
3. Настройте HTTPS
4. Обновите `ALLOWED_ORIGINS` на реальные домены
5. Настройте резервное копирование БД
6. Используйте внешнее S3 хранилище вместо MinIO (опционально)

## Лицензия

Проект создан в учебных целях.
