// API конфигурация
const API_BASE_URL = 'http://localhost:8000';

// ============================================================================
// БАЗОВЫЙ HTTP-КЛИЕНТ
// ============================================================================

function formatApiError(error) {
    if (!error) return 'Неизвестная ошибка';
    if (typeof error === 'string') return error;
    if (typeof error.detail === 'string') return error.detail;
    if (Array.isArray(error.detail)) {
        return error.detail.map((e) => e.msg || e.message || JSON.stringify(e)).join(', ');
    }
    if (error.message && error.message.includes('Failed to fetch')) {
        return 'Не удалось подключиться к серверу. Запустите start.bat (Docker) и откройте сайт через Live Server, не как файл.';
    }
    return 'Ошибка сервера';
}

async function apiCheckHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
        });
        if (!response.ok) return false;
        const data = await response.json();
        return data.status === 'ok';
    } catch {
        return false;
    }
}

async function apiRequest(path, options = {}) {
    const { method = 'GET', body = null, auth = true, headers = {} } = options;

    const requestHeaders = { Accept: 'application/json', ...headers };

    if (auth) {
        const token = getAccessToken();
        if (!token) {
            return { success: false, error: { detail: 'Требуется авторизация' } };
        }
        requestHeaders.Authorization = `Bearer ${token}`;
    }

    if (body !== null && !(body instanceof FormData)) {
        requestHeaders['Content-Type'] = 'application/json';
    }

    try {
        const response = await fetch(`${API_BASE_URL}${path}`, {
            method,
            headers: requestHeaders,
            body: body instanceof FormData || body === null ? body : JSON.stringify(body),
        });

        if (response.status === 204) {
            return { success: response.ok };
        }

        let data = null;
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            data = await response.json();
        }

        if (response.status === 401 && auth) {
            removeTokens();
            const onAuthPage = /log\.html|register\.html/i.test(window.location.pathname);
            if (!onAuthPage) {
                window.location.href = 'log.html';
            }
            return { success: false, error: { detail: 'Сессия истекла. Войдите снова.' }, status: 401 };
        }

        if (response.ok) {
            return { success: true, data };
        }
        return { success: false, error: data || { detail: response.statusText }, status: response.status };
    } catch (error) {
        console.error('❌ Ошибка сети:', error);
        const msg = error.message || 'Сетевая ошибка';
        const hint = msg.includes('fetch') || msg.includes('Network')
            ? 'Не удалось подключиться к серверу. Запустите start.bat и откройте frontend через Live Server (http://127.0.0.1:5500).'
            : `Ошибка соединения: ${msg}`;
        return { success: false, error: { detail: hint } };
    }
}

// ============================================================================
// АВТОРИЗАЦИЯ
// ============================================================================

async function apiRegister(username, email, password) {
    return apiRequest('/auth/register', {
        method: 'POST',
        auth: false,
        body: { username, email, password },
    });
}

async function apiLogin(email, password) {
    try {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);

        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
            },
            body: formData.toString(),
        });

        const data = await response.json();
        if (response.ok) {
            return { success: true, data };
        }
        return { success: false, error: data };
    } catch (error) {
        return { success: false, error: { detail: `Ошибка соединения: ${error.message}` } };
    }
}

function saveTokens(accessToken, tokenType) {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('token_type', tokenType || 'bearer');
}

function getAccessToken() {
    return localStorage.getItem('access_token');
}

function removeTokens() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_type');
}

function isAuthenticated() {
    return getAccessToken() !== null;
}

function logout() {
    removeTokens();
    window.location.href = 'log.html';
}

// ============================================================================
// КНИГИ
// ============================================================================

async function apiGetBooks(params = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page);
    if (params.page_size) query.set('page_size', params.page_size);
    if (params.genre) query.set('genre', params.genre);
    if (params.sort) query.set('sort', params.sort);

    const qs = query.toString();
    const result = await apiRequest(`/books/my${qs ? `?${qs}` : ''}`);
    if (result.success) {
        return { success: true, data: result.data.items || [], total: result.data.total };
    }
    return result;
}

async function apiSearchBooks(q, page = 1) {
    const result = await apiRequest(`/books/search?q=${encodeURIComponent(q)}&page=${page}`);
    if (result.success) {
        return { success: true, data: result.data.items || [], total: result.data.total };
    }
    return result;
}

async function apiGetBook(bookId) {
    return apiRequest(`/books/${bookId}`);
}

async function apiUploadBook(file, genre = null, notes = null) {
    const formData = new FormData();
    formData.append('file', file);

    const fileName = file.name.replace(/\.[^/.]+$/, '');
    formData.append('title', fileName);

    const fileExt = file.name.split('.').pop().toLowerCase();
    let format = 'other';
    if (fileExt === 'pdf') format = 'pdf';
    else if (fileExt === 'epub') format = 'epub';
    else if (fileExt === 'fb2') format = 'fb2';
    formData.append('format', format);

    if (genre) formData.append('genre', genre);
    if (notes) formData.append('description', notes);

    return apiRequest('/books', { method: 'POST', body: formData });
}

// Загрузка книги с метаданными (название, автор из файла)
async function apiUploadBookWithMeta(file, meta = {}) {
    const formData = new FormData();
    formData.append('file', file);

    // Используем метаданные из файла или имя файла как fallback
    const title = meta.title?.trim() || file.name.replace(/\.[^/.]+$/, '');
    formData.append('title', title);

    if (meta.author?.trim()) formData.append('author', meta.author.trim());

    const fileExt = file.name.split('.').pop().toLowerCase();
    let format = 'other';
    if (fileExt === 'pdf') format = 'pdf';
    else if (fileExt === 'epub') format = 'epub';
    else if (fileExt === 'fb2') format = 'fb2';
    formData.append('format', format);

    if (meta.genre) formData.append('genre', meta.genre);
    if (meta.notes) formData.append('description', meta.notes);

    return apiRequest('/books', { method: 'POST', body: formData });
}

async function apiUpdateBook(bookId, updates) {
    return apiRequest(`/books/${bookId}`, { method: 'PATCH', body: updates });
}

async function apiDeleteBook(bookId) {
    return apiRequest(`/books/${bookId}`, { method: 'DELETE' });
}

async function apiGetBookContent(bookId) {
    const result = await apiRequest(`/books/${bookId}/read`);
    if (result.success) {
        return {
            success: true,
            data: {
                url: result.data.presigned_url,
                progress: result.data.progress,
                ...result.data,
            },
        };
    }
    return result;
}

async function apiUpdateBookProgress(bookId, currentPage, percent) {
    return apiRequest(`/books/${bookId}/progress`, {
        method: 'POST',
        body: { current_page: currentPage, percent },
    });
}

// ============================================================================
// ПОЛКИ
// ============================================================================

async function apiGetShelves() {
    return apiRequest('/shelves');
}

async function apiGetShelf(shelfId) {
    return apiRequest(`/shelves/${shelfId}`);
}

async function apiCreateShelf(name) {
    return apiRequest('/shelves', { method: 'POST', body: { name } });
}

async function apiRenameShelf(shelfId, name) {
    return apiRequest(`/shelves/${shelfId}`, { method: 'PATCH', body: { name } });
}

async function apiDeleteShelf(shelfId) {
    return apiRequest(`/shelves/${shelfId}`, { method: 'DELETE' });
}

async function apiAddBookToShelf(shelfId, bookId) {
    return apiRequest(`/shelves/${shelfId}/books`, {
        method: 'POST',
        body: { book_id: Number(bookId) },
    });
}

async function apiRemoveBookFromShelf(shelfId, bookId) {
    return apiRequest(`/shelves/${shelfId}/books/${bookId}`, { method: 'DELETE' });
}

// ============================================================================
// ЗАМЕТКИ (привязаны к книге)
// ============================================================================

async function apiGetNotes(bookId) {
    return apiRequest(`/books/${bookId}/notes`);
}

async function apiCreateNote(bookId, text) {
    return apiRequest(`/books/${bookId}/notes`, {
        method: 'POST',
        body: { text },
    });
}

async function apiUpdateNote(bookId, noteId, text) {
    return apiRequest(`/books/${bookId}/notes/${noteId}`, {
        method: 'PATCH',
        body: { text },
    });
}

async function apiDeleteNote(bookId, noteId) {
    return apiRequest(`/books/${bookId}/notes/${noteId}`, { method: 'DELETE' });
}

// ============================================================================
// СТАТИСТИКА
// ============================================================================

async function apiGetStats(period = 'week') {
    return apiRequest(`/stats/reading?period=${period}`);
}

// ============================================================================
// ЦЕЛИ
// ============================================================================

async function apiGetGoals() {
    return apiRequest('/goals');
}

async function apiCreateGoal(goalType, targetValue) {
    return apiRequest('/goals', {
        method: 'POST',
        body: { goal_type: goalType, target_value: Number(targetValue) },
    });
}

async function apiUpdateGoal(goalType, targetValue) {
    return apiCreateGoal(goalType, targetValue);
}

// Глобальный доступ для inline-скриптов в HTML
window.formatApiError = formatApiError;
window.apiCheckHealth = apiCheckHealth;
