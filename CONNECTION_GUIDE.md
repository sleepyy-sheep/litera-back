# 🔗 Связь бэкенда и фронтенда

## Схема взаимодействия

```
┌─────────────────────────────────────────────────────────────┐
│                    БРАУЗЕР (localhost:5500)                  │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │              ФРОНТЕНД (HTML + JS)                   │    │
│  │                                                      │    │
│  │  log.html      → Вход/Регистрация                   │    │
│  │  index.html    → Главная страница (Книги)           │    │
│  │  shelves.html  → Полки                               │    │
│  │                                                      │    │
│  │  js/api.js     → API клиент                          │    │
│  │  API_BASE_URL = 'http://localhost:8000'             │    │
│  └────────────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTP Requests (JSON)
                       │ Authorization: Bearer <JWT_TOKEN>
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                 BACKEND (localhost:8000)                     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │              FastAPI Application                     │    │
│  │                                                      │    │
│  │  /auth/register  → Регистрация                       │    │
│  │  /auth/login     → Вход (возвращает JWT)            │    │
│  │  /auth/me        → Текущий пользователь             │    │
│  │  /books          → CRUD книг                         │    │
│  │  /shelves        → CRUD полок                        │    │
│  │  /notes          → CRUD заметок                      │    │
│  │  /stats/reading  → Статистика                        │    │
│  │  /goals          → Цели чтения                       │    │
│  │                                                      │    │
│  │  CORS: localhost:5500, localhost:3000               │    │
│  └────────────────────────────────────────────────────┘    │
│                       │                │                     │
│                       │                │                     │
│         ┌─────────────┴────┐    ┌─────┴──────────┐         │
│         │                  │    │                 │         │
│  ┌──────▼──────┐    ┌──────▼────▼───┐    ┌──────▼──────┐  │
│  │ PostgreSQL  │    │   SQLAlchemy   │    │    MinIO    │  │
│  │   (БД)      │◄───┤   (async ORM)  │    │ (Файлы)     │  │
│  │             │    │                │    │             │  │
│  │ Port: 5432  │    └────────────────┘    │ Port: 9000  │  │
│  │             │                           │ Port: 9001  │  │
│  │ • users     │                           │             │  │
│  │ • books     │                           │ • book.pdf  │  │
│  │ • shelves   │                           │ • book.epub │  │
│  │ • notes     │                           │ • book.fb2  │  │
│  └─────────────┘                           └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Поток данных

### 1. Регистрация пользователя

```
Браузер                    FastAPI                  PostgreSQL
   │                          │                          │
   │  POST /auth/register     │                          │
   ├─────────────────────────>│                          │
   │  {username, email, pwd}  │                          │
   │                          │  INSERT INTO users       │
   │                          ├─────────────────────────>│
   │                          │                          │
   │                          │  user_id                 │
   │                          │<─────────────────────────┤
   │  {access_token, ...}     │                          │
   │<─────────────────────────┤                          │
   │                          │                          │
   │  localStorage.setItem    │                          │
   │  ('access_token', ...)   │                          │
   │                          │                          │
```

### 2. Загрузка книги

```
Браузер                FastAPI              PostgreSQL         MinIO
   │                      │                      │               │
   │  POST /books         │                      │               │
   ├─────────────────────>│                      │               │
   │  multipart/form-data │                      │               │
   │  + JWT token         │                      │               │
   │                      │  Парсинг метаданных  │               │
   │                      │  (PyPDF2/EbookLib)   │               │
   │                      │                      │               │
   │                      │  PUT /books/file.pdf │               │
   │                      ├──────────────────────┼──────────────>│
   │                      │                      │               │
   │                      │  storage_key         │               │
   │                      │<─────────────────────┼───────────────┤
   │                      │                      │               │
   │                      │  INSERT INTO books   │               │
   │                      ├─────────────────────>│               │
   │                      │                      │               │
   │                      │  book_id             │               │
   │                      │<─────────────────────┤               │
   │  {id, title, ...}    │                      │               │
   │<─────────────────────┤                      │               │
   │                      │                      │               │
```

### 3. Получение списка книг

```
Браузер                    FastAPI                  PostgreSQL
   │                          │                          │
   │  GET /books              │                          │
   ├─────────────────────────>│                          │
   │  Authorization: Bearer   │                          │
   │                          │  SELECT * FROM books     │
   │                          │  WHERE user_id = ?       │
   │                          ├─────────────────────────>│
   │                          │                          │
   │                          │  [{id, title, ...}, ...] │
   │                          │<─────────────────────────┤
   │  [{id, title, ...}, ...] │                          │
   │<─────────────────────────┤                          │
   │                          │                          │
   │  Отображение карточек    │                          │
   │  книг на странице        │                          │
   │                          │                          │
```

### 4. Скачивание книги для чтения

```
Браузер            FastAPI              MinIO
   │                  │                   │
   │  GET /books/1/   │                   │
   │  content         │                   │
   ├─────────────────>│                   │
   │                  │  generate_        │
   │                  │  presigned_url()  │
   │                  ├──────────────────>│
   │                  │                   │
   │                  │  presigned_url    │
   │                  │  (valid 60 min)   │
   │                  │<──────────────────┤
   │  {url: "http:// │                   │
   │  minio:9000/..."}│                   │
   │<─────────────────┤                   │
   │                  │                   │
   │  GET presigned   │                   │
   │  URL             │                   │
   ├──────────────────┼──────────────────>│
   │                  │                   │
   │  file content    │                   │
   │<─────────────────┼───────────────────┤
   │                  │                   │
```

## Конфигурация связи

### Фронтенд (js/api.js)

```javascript
// API конфигурация
const API_BASE_URL = 'http://localhost:8000';

// Все запросы идут на этот URL
async function apiRegister(username, email, password) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }),
    });
    return response.json();
}

// JWT токен добавляется автоматически
function getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
}
```

### Бэкенд (app/main.py)

```python
# CORS настройка
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5500"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Роуты
app.include_router(auth_router)      # /auth/*
app.include_router(books_router)     # /books/*
app.include_router(shelves_router)   # /shelves/*
app.include_router(notes_router)     # /notes/*
app.include_router(stats_router)     # /stats/*
app.include_router(goals_router)     # /goals/*
```

### Docker Compose (docker-compose.yml)

```yaml
services:
  api:
    ports:
      - "8000:8000"  # Доступен на localhost:8000
    environment:
      ALLOWED_ORIGINS: "http://localhost:3000,http://localhost:5500"
    depends_on:
      - postgres
      - minio
```

## Проверка связи

### 1. Проверка бэкенда

```cmd
curl http://localhost:8000/health
```

Ожидаемый ответ:
```json
{"status":"ok","db_connected":true}
```

### 2. Проверка CORS

Откройте консоль браузера (F12) на http://localhost:5500/log.html и выполните:

```javascript
fetch('http://localhost:8000/health')
  .then(r => r.json())
  .then(console.log)
```

Если CORS настроен правильно, вы увидите:
```json
{status: "ok", db_connected: true}
```

Если CORS не настроен, вы увидите ошибку:
```
Access to fetch at 'http://localhost:8000/health' from origin 
'http://localhost:5500' has been blocked by CORS policy
```

### 3. Проверка регистрации

В консоли браузера:

```javascript
fetch('http://localhost:8000/auth/register', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    username: 'test',
    email: 'test@example.com',
    password: 'password123'
  })
})
.then(r => r.json())
.then(console.log)
```

Ожидаемый ответ:
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

## Отладка проблем со связью

### Проблема: "Failed to fetch"

**Причина**: Бэкенд не запущен или недоступен

**Решение**:
```cmd
cd backend
docker-compose ps
docker-compose logs api
```

### Проблема: "CORS policy blocked"

**Причина**: Фронтенд запущен на неразрешенном порту

**Решение**:
1. Убедитесь, что фронтенд на порту 5500 или 3000
2. Или добавьте свой порт в `docker-compose.yml`:
```yaml
ALLOWED_ORIGINS: "http://localhost:3000,http://localhost:5500,http://localhost:ВАШИ_ПОРТ"
```
3. Перезапустите: `docker-compose restart api`

### Проблема: "401 Unauthorized"

**Причина**: JWT токен отсутствует или истек

**Решение**:
1. Проверьте localStorage: `localStorage.getItem('access_token')`
2. Если токена нет - войдите заново
3. Если токен есть - проверьте, что он передается в заголовке

### Проблема: "Network Error"

**Причина**: Неправильный API_BASE_URL

**Решение**:
Проверьте `frontend/js/api.js`:
```javascript
const API_BASE_URL = 'http://localhost:8000';  // Должно быть именно так
```

## Порты и адреса

| Сервис | Порт | URL | Назначение |
|--------|------|-----|------------|
| Фронтенд | 5500 | http://localhost:5500 | Веб-интерфейс |
| API | 8000 | http://localhost:8000 | REST API |
| PostgreSQL | 5432 | localhost:5432 | База данных |
| MinIO API | 9000 | http://localhost:9000 | S3 API |
| MinIO Console | 9001 | http://localhost:9001 | Веб-консоль MinIO |

## Итог

✅ Фронтенд (localhost:5500) → API (localhost:8000)  
✅ API → PostgreSQL (localhost:5432)  
✅ API → MinIO (localhost:9000)  
✅ CORS настроен для localhost:5500  
✅ JWT токены для авторизации  
✅ Presigned URLs для файлов  

**Все компоненты связаны и работают!** 🎉
