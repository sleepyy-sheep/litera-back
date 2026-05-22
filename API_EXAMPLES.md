# 📡 Примеры использования API

## Базовый URL

```
http://localhost:8000
```

## Аутентификация

Все защищенные endpoints требуют JWT токен в заголовке:

```
Authorization: Bearer <your_jwt_token>
```

---

## 1. Регистрация

### Request

```http
POST /auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "securePassword123"
}
```

### Response (200 OK)

```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer"
}
```

### cURL

```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"john_doe","email":"john@example.com","password":"securePassword123"}'
```

---

## 2. Вход

### Request

```http
POST /auth/login
Content-Type: application/x-www-form-urlencoded

username=john@example.com&password=securePassword123
```

### Response (200 OK)

```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer"
}
```

### cURL

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=john@example.com&password=securePassword123"
```

---

## 3. Получить текущего пользователя

### Request

```http
GET /auth/me
Authorization: Bearer <your_jwt_token>
```

### Response (200 OK)

```json
{
  "id": 1,
  "username": "john_doe",
  "email": "john@example.com",
  "is_active": true,
  "created_at": "2026-05-22T10:30:00Z"
}
```

### cURL

```bash
curl -X GET http://localhost:8000/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 4. Загрузить книгу

### Request

```http
POST /books
Authorization: Bearer <your_jwt_token>
Content-Type: multipart/form-data

file: <binary_file_data>
genre: "Фантастика"
notes: "Отличная книга!"
```

### Response (201 Created)

```json
{
  "id": 1,
  "user_id": 1,
  "title": "Дюна",
  "author": "Фрэнк Герберт",
  "description": "Научно-фантастический роман...",
  "genre": "Фантастика",
  "format": "pdf",
  "storage_key": "users/1/books/dune.pdf",
  "cover_key": null,
  "total_pages": 896,
  "uploaded_at": "2026-05-22T10:35:00Z"
}
```

### cURL

```bash
curl -X POST http://localhost:8000/books \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "file=@/path/to/book.pdf" \
  -F "genre=Фантастика" \
  -F "notes=Отличная книга!"
```

---

## 5. Получить список книг

### Request

```http
GET /books
Authorization: Bearer <your_jwt_token>
```

### Response (200 OK)

```json
[
  {
    "id": 1,
    "title": "Дюна",
    "author": "Фрэнк Герберт",
    "genre": "Фантастика",
    "format": "pdf",
    "total_pages": 896,
    "uploaded_at": "2026-05-22T10:35:00Z",
    "progress": {
      "current_page": 150,
      "percent": 16.7,
      "status": "reading"
    }
  },
  {
    "id": 2,
    "title": "1984",
    "author": "Джордж Оруэлл",
    "genre": "Антиутопия",
    "format": "epub",
    "total_pages": 328,
    "uploaded_at": "2026-05-21T14:20:00Z",
    "progress": {
      "current_page": 328,
      "percent": 100.0,
      "status": "finished"
    }
  }
]
```

### cURL

```bash
curl -X GET http://localhost:8000/books \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 6. Получить информацию о книге

### Request

```http
GET /books/1
Authorization: Bearer <your_jwt_token>
```

### Response (200 OK)

```json
{
  "id": 1,
  "user_id": 1,
  "title": "Дюна",
  "author": "Фрэнк Герберт",
  "description": "Научно-фантастический роман о планете Арракис...",
  "genre": "Фантастика",
  "format": "pdf",
  "storage_key": "users/1/books/dune.pdf",
  "cover_key": null,
  "total_pages": 896,
  "uploaded_at": "2026-05-22T10:35:00Z",
  "progress": {
    "id": 1,
    "current_page": 150,
    "percent": 16.7,
    "status": "reading",
    "last_read_at": "2026-05-22T18:45:00Z"
  }
}
```

---

## 7. Получить ссылку для скачивания книги

### Request

```http
GET /books/1/content
Authorization: Bearer <your_jwt_token>
```

### Response (200 OK)

```json
{
  "url": "http://localhost:9000/books/users/1/books/dune.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...",
  "expires_in": 3600
}
```

**Примечание**: URL действителен 60 минут

---

## 8. Обновить прогресс чтения

### Request

```http
PUT /books/1
Authorization: Bearer <your_jwt_token>
Content-Type: application/json

{
  "current_page": 200,
  "status": "reading"
}
```

### Response (200 OK)

```json
{
  "id": 1,
  "title": "Дюна",
  "author": "Фрэнк Герберт",
  "progress": {
    "current_page": 200,
    "percent": 22.3,
    "status": "reading",
    "last_read_at": "2026-05-22T19:00:00Z"
  }
}
```

---

## 9. Удалить книгу

### Request

```http
DELETE /books/1
Authorization: Bearer <your_jwt_token>
```

### Response (204 No Content)

---

## 10. Создать полку

### Request

```http
POST /shelves
Authorization: Bearer <your_jwt_token>
Content-Type: application/json

{
  "name": "Любимые книги"
}
```

### Response (201 Created)

```json
{
  "id": 1,
  "user_id": 1,
  "name": "Любимые книги",
  "created_at": "2026-05-22T19:05:00Z"
}
```

---

## 11. Получить список полок

### Request

```http
GET /shelves
Authorization: Bearer <your_jwt_token>
```

### Response (200 OK)

```json
[
  {
    "id": 1,
    "name": "Любимые книги",
    "created_at": "2026-05-22T19:05:00Z",
    "books_count": 3
  },
  {
    "id": 2,
    "name": "Прочитать позже",
    "created_at": "2026-05-21T10:00:00Z",
    "books_count": 7
  }
]
```

---

## 12. Добавить книгу на полку

### Request

```http
POST /shelves/1/books/1
Authorization: Bearer <your_jwt_token>
```

### Response (200 OK)

```json
{
  "message": "Book added to shelf successfully"
}
```

---

## 13. Убрать книгу с полки

### Request

```http
DELETE /shelves/1/books/1
Authorization: Bearer <your_jwt_token>
```

### Response (204 No Content)

---

## 14. Создать заметку

### Request

```http
POST /notes
Authorization: Bearer <your_jwt_token>
Content-Type: application/json

{
  "book_id": 1,
  "text": "Интересная мысль о власти и контроле"
}
```

### Response (201 Created)

```json
{
  "id": 1,
  "user_id": 1,
  "book_id": 1,
  "text": "Интересная мысль о власти и контроле",
  "created_at": "2026-05-22T19:10:00Z",
  "updated_at": "2026-05-22T19:10:00Z"
}
```

---

## 15. Получить заметки к книге

### Request

```http
GET /notes?book_id=1
Authorization: Bearer <your_jwt_token>
```

### Response (200 OK)

```json
[
  {
    "id": 1,
    "book_id": 1,
    "text": "Интересная мысль о власти и контроле",
    "created_at": "2026-05-22T19:10:00Z",
    "updated_at": "2026-05-22T19:10:00Z"
  },
  {
    "id": 2,
    "book_id": 1,
    "text": "Отличное описание пустыни",
    "created_at": "2026-05-22T19:15:00Z",
    "updated_at": "2026-05-22T19:15:00Z"
  }
]
```

---

## 16. Обновить заметку

### Request

```http
PUT /notes/1
Authorization: Bearer <your_jwt_token>
Content-Type: application/json

{
  "text": "Обновленная заметка о власти"
}
```

### Response (200 OK)

```json
{
  "id": 1,
  "book_id": 1,
  "text": "Обновленная заметка о власти",
  "created_at": "2026-05-22T19:10:00Z",
  "updated_at": "2026-05-22T19:20:00Z"
}
```

---

## 17. Удалить заметку

### Request

```http
DELETE /notes/1
Authorization: Bearer <your_jwt_token>
```

### Response (204 No Content)

---

## 18. Получить статистику чтения

### Request

```http
GET /stats/reading
Authorization: Bearer <your_jwt_token>
```

### Response (200 OK)

```json
{
  "total_books": 15,
  "books_reading": 3,
  "books_finished": 10,
  "books_new": 2,
  "total_pages_read": 4523,
  "total_reading_time_minutes": 1820,
  "average_pages_per_day": 45,
  "current_streak_days": 7
}
```

---

## 19. Создать цель чтения

### Request

```http
POST /goals
Authorization: Bearer <your_jwt_token>
Content-Type: application/json

{
  "goal_type": "pages_per_day",
  "target_value": 50
}
```

### Response (201 Created)

```json
{
  "id": 1,
  "user_id": 1,
  "goal_type": "pages_per_day",
  "target_value": 50,
  "created_at": "2026-05-22T19:25:00Z"
}
```

---

## 20. Получить список целей

### Request

```http
GET /goals
Authorization: Bearer <your_jwt_token>
```

### Response (200 OK)

```json
[
  {
    "id": 1,
    "goal_type": "pages_per_day",
    "target_value": 50,
    "current_value": 45,
    "progress_percent": 90.0,
    "created_at": "2026-05-22T19:25:00Z"
  },
  {
    "id": 2,
    "goal_type": "minutes_per_day",
    "target_value": 60,
    "current_value": 55,
    "progress_percent": 91.7,
    "created_at": "2026-05-21T10:00:00Z"
  }
]
```

---

## Коды ответов

| Код | Описание |
|-----|----------|
| 200 | OK - Запрос выполнен успешно |
| 201 | Created - Ресурс создан |
| 204 | No Content - Запрос выполнен, нет содержимого |
| 400 | Bad Request - Неверный запрос |
| 401 | Unauthorized - Требуется авторизация |
| 403 | Forbidden - Доступ запрещен |
| 404 | Not Found - Ресурс не найден |
| 422 | Unprocessable Entity - Ошибка валидации |
| 429 | Too Many Requests - Превышен лимит запросов |
| 500 | Internal Server Error - Внутренняя ошибка сервера |

---

## Ошибки

### Формат ошибки

```json
{
  "detail": "Описание ошибки"
}
```

### Примеры ошибок

**401 Unauthorized**
```json
{
  "detail": "Not authenticated"
}
```

**404 Not Found**
```json
{
  "detail": "Book not found"
}
```

**422 Validation Error**
```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "value is not a valid email address",
      "type": "value_error.email"
    }
  ]
}
```

**429 Too Many Requests**
```json
{
  "detail": "Too many requests"
}
```

Headers:
```
Retry-After: 60
```

---

## Swagger UI

Интерактивная документация доступна по адресу:

```
http://localhost:8000/docs
```

Здесь вы можете:
- Просмотреть все endpoints
- Протестировать запросы
- Увидеть схемы данных
- Авторизоваться с JWT токеном

---

## Postman Collection

Вы можете импортировать эти примеры в Postman для удобного тестирования.

### Настройка переменных окружения

```
base_url: http://localhost:8000
token: <your_jwt_token>
```

### Использование токена

В Postman добавьте в Headers:
```
Authorization: Bearer {{token}}
```

---

## JavaScript примеры

### Регистрация

```javascript
async function register(username, email, password) {
  const response = await fetch('http://localhost:8000/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password })
  });
  const data = await response.json();
  if (response.ok) {
    localStorage.setItem('access_token', data.access_token);
  }
  return data;
}
```

### Получение книг

```javascript
async function getBooks() {
  const token = localStorage.getItem('access_token');
  const response = await fetch('http://localhost:8000/books', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
}
```

### Загрузка книги

```javascript
async function uploadBook(file, genre, notes) {
  const token = localStorage.getItem('access_token');
  const formData = new FormData();
  formData.append('file', file);
  formData.append('genre', genre);
  formData.append('notes', notes);
  
  const response = await fetch('http://localhost:8000/books', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  return response.json();
}
```

---

## Итог

✅ Все endpoints документированы  
✅ Примеры запросов и ответов  
✅ Коды ошибок описаны  
✅ JavaScript примеры готовы  
✅ Swagger UI доступен  

**API готов к использованию!** 🚀
