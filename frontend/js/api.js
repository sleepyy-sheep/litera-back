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

// ============================================================================
// CONFIRM MODAL — единое окно подтверждения для необратимых действий
// ============================================================================

/**
 * Показывает красивое окно подтверждения вместо browser confirm().
 * @param {object} opts
 * @param {string} opts.title       — заголовок
 * @param {string} opts.message     — текст
 * @param {string} opts.confirmText — текст кнопки подтверждения (default: "Подтвердить")
 * @param {string} opts.cancelText  — текст кнопки отмены (default: "Отмена")
 * @param {boolean} opts.danger     — красная кнопка подтверждения (default: true)
 * @returns {Promise<boolean>}
 */
function confirmModal({ title = 'Вы уверены?', message = '', confirmText = 'Подтвердить', cancelText = 'Отмена', danger = true } = {}) {
    return new Promise(resolve => {
        const existing = document.getElementById('global-confirm-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'global-confirm-modal';
        modal.className = 'modal-overlay modal-overlay--visible';
        modal.style.cssText = 'z-index:700;';

        const confirmBtnStyle = danger
            ? 'background:#e07070;color:#fff;border:none;'
            : 'background:var(--accent);color:var(--surface);border:none;';

        modal.innerHTML = `
            <div class="modal modal--add-book" style="max-width:360px;text-align:center;padding:32px 24px 28px;">
                <img src="log_img/sad_star.svg" alt="" aria-hidden="true"
                     style="width:64px;height:64px;margin:0 auto 16px;display:block;">
                <h2 style="font-size:18px;font-weight:bold;margin-bottom:10px;color:var(--text);line-height:1.3;">
                    ${title}
                </h2>
                ${message ? `<p style="font-size:14px;color:var(--text-muted);margin-bottom:24px;line-height:1.55;">${message}</p>` : '<div style="margin-bottom:24px;"></div>'}
                <div style="display:flex;gap:10px;">
                    <button id="gcm-cancel"
                            style="flex:1;padding:12px 16px;border-radius:var(--r-pill);
                                   border:1px solid rgba(255,255,255,.22);background:transparent;
                                   color:var(--text-muted);font-family:inherit;font-size:14px;cursor:pointer;
                                   transition:background .2s;">
                        ${cancelText}
                    </button>
                    <button id="gcm-confirm"
                            style="flex:1;padding:12px 16px;border-radius:var(--r-pill);
                                   ${confirmBtnStyle}
                                   font-family:inherit;font-size:14px;font-weight:bold;cursor:pointer;
                                   transition:opacity .2s;">
                        ${confirmText}
                    </button>
                </div>
            </div>`;

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';

        const cleanup = (result) => {
            modal.remove();
            document.body.style.overflow = '';
            resolve(result);
        };

        modal.querySelector('#gcm-cancel').addEventListener('click', () => cleanup(false));
        modal.querySelector('#gcm-confirm').addEventListener('click', () => cleanup(true));
        modal.addEventListener('click', e => { if (e.target === modal) cleanup(false); });
        document.addEventListener('keydown', function handler(e) {
            if (e.key === 'Escape') { cleanup(false); document.removeEventListener('keydown', handler); }
            if (e.key === 'Enter')  { cleanup(true);  document.removeEventListener('keydown', handler); }
        });
    });
}

window.confirmModal = confirmModal;

// ============================================================================
// EDIT GOAL MODAL — красивое окно редактирования цели
// ============================================================================

/**
 * @param {object} opts
 * @param {string} opts.goalType    — 'pages_per_day' | 'minutes_per_day'
 * @param {number} opts.current     — текущее целевое значение
 * @returns {Promise<number|null>}  — новое значение или null если отменили
 */
function editGoalModal({ goalType = 'pages_per_day', current = 30 } = {}) {
    return new Promise(resolve => {
        const existing = document.getElementById('edit-goal-modal');
        if (existing) existing.remove();

        const isPages   = goalType === 'pages_per_day';
        const label     = isPages ? 'Страниц за день' : 'Минут чтения в день';
        const icon      = isPages ? '📖' : '⏱';
        const min       = isPages ? 5  : 5;
        const max       = isPages ? 200 : 240;
        const step      = isPages ? 5  : 5;
        const unit      = isPages ? 'стр' : 'мин';

        const modal = document.createElement('div');
        modal.id = 'edit-goal-modal';
        modal.className = 'modal-overlay modal-overlay--visible';
        modal.style.cssText = 'z-index:700;';
        modal.innerHTML = `
            <div class="modal modal--add-book" style="max-width:360px;padding:28px 24px 24px;">
                <div style="text-align:center;margin-bottom:20px;">
                    <span style="font-size:36px;">${icon}</span>
                    <h2 style="font-size:17px;font-weight:bold;color:var(--text);margin-top:10px;">
                        ${label}
                    </h2>
                </div>

                <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:20px;">
                    <button id="egm-minus"
                            style="width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.22);
                                   background:rgba(255,255,255,.08);color:var(--text);font-size:20px;
                                   cursor:pointer;display:flex;align-items:center;justify-content:center;
                                   flex-shrink:0;transition:background .15s;">−</button>
                    <div style="text-align:center;min-width:80px;">
                        <input id="egm-input" type="number"
                               value="${current}" min="${min}" max="${max}" step="${step}"
                               style="width:80px;text-align:center;font-size:28px;font-weight:bold;
                                      background:transparent;border:none;border-bottom:2px solid var(--accent);
                                      color:var(--text);font-family:inherit;outline:none;padding:4px 0;">
                        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${unit}</div>
                    </div>
                    <button id="egm-plus"
                            style="width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.22);
                                   background:rgba(255,255,255,.08);color:var(--text);font-size:20px;
                                   cursor:pointer;display:flex;align-items:center;justify-content:center;
                                   flex-shrink:0;transition:background .15s;">+</button>
                </div>

                <input id="egm-range" type="range"
                       min="${min}" max="${max}" step="${step}" value="${current}"
                       style="width:100%;accent-color:var(--accent);cursor:pointer;margin-bottom:8px;">

                <div style="display:flex;justify-content:space-between;font-size:11px;
                            color:var(--text-muted);margin-bottom:24px;">
                    <span>${min} ${unit}</span>
                    <span>${max} ${unit}</span>
                </div>

                <div style="display:flex;gap:10px;">
                    <button id="egm-cancel"
                            style="flex:1;padding:12px;border-radius:var(--r-pill);
                                   border:1px solid rgba(255,255,255,.22);background:transparent;
                                   color:var(--text-muted);font-family:inherit;font-size:14px;cursor:pointer;">
                        Отмена
                    </button>
                    <button id="egm-save"
                            style="flex:1;padding:12px;border-radius:var(--r-pill);border:none;
                                   background:var(--accent);color:var(--surface);
                                   font-family:inherit;font-size:14px;font-weight:bold;cursor:pointer;">
                        Сохранить
                    </button>
                </div>
            </div>`;

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';

        const input = modal.querySelector('#egm-input');
        const range = modal.querySelector('#egm-range');

        // Sync input ↔ range
        input.addEventListener('input', () => {
            let v = parseInt(input.value, 10);
            if (!isNaN(v)) range.value = Math.min(max, Math.max(min, v));
        });
        range.addEventListener('input', () => { input.value = range.value; });

        modal.querySelector('#egm-minus').addEventListener('click', () => {
            let v = Math.max(min, (parseInt(input.value, 10) || min) - step);
            input.value = v; range.value = v;
        });
        modal.querySelector('#egm-plus').addEventListener('click', () => {
            let v = Math.min(max, (parseInt(input.value, 10) || min) + step);
            input.value = v; range.value = v;
        });

        const cleanup = (val) => {
            modal.remove();
            document.body.style.overflow = '';
            resolve(val);
        };

        modal.querySelector('#egm-cancel').addEventListener('click', () => cleanup(null));
        modal.querySelector('#egm-save').addEventListener('click', () => {
            const v = parseInt(input.value, 10);
            if (isNaN(v) || v < min) { input.style.borderBottomColor = '#e07070'; return; }
            cleanup(v);
        });
        modal.addEventListener('click', e => { if (e.target === modal) cleanup(null); });
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') modal.querySelector('#egm-save').click();
            if (e.key === 'Escape') cleanup(null);
        });

        // Focus input
        setTimeout(() => { input.focus(); input.select(); }, 50);
    });
}

window.editGoalModal = editGoalModal;

// ============================================================================
// INPUT MODAL — красивое окно ввода текста (замена window.prompt)
// ============================================================================

/**
 * @param {object} opts
 * @param {string} opts.title        — заголовок
 * @param {string} opts.placeholder  — плейсхолдер поля
 * @param {string} opts.confirmText  — текст кнопки подтверждения (default: "ОК")
 * @param {string} opts.cancelText   — текст кнопки отмены (default: "Отмена")
 * @param {number} opts.maxLength    — максимальная длина (default: 100)
 * @returns {Promise<string|null>}   — введённое значение или null если отменили
 */
function inputModal({ title = 'Введите значение', placeholder = '', confirmText = 'ОК', cancelText = 'Отмена', maxLength = 100 } = {}) {
    return new Promise(resolve => {
        const existing = document.getElementById('global-input-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'global-input-modal';
        modal.className = 'modal-overlay modal-overlay--visible';
        modal.style.cssText = 'z-index:700;';

        modal.innerHTML = `
            <div class="modal modal--add-book" style="max-width:380px;padding:28px 24px 24px;">
                <h2 style="font-size:17px;font-weight:bold;color:var(--text);margin-bottom:18px;text-align:center;">
                    ${title}
                </h2>
                <input id="gim-input" type="text"
                       maxlength="${maxLength}"
                       placeholder="${placeholder}"
                       style="width:100%;padding:12px 16px;border-radius:var(--r-pill);
                              border:1.5px solid rgba(255,255,255,.22);
                              background:rgba(255,255,255,.08);color:var(--text);
                              font-family:inherit;font-size:15px;outline:none;
                              transition:border-color .2s;margin-bottom:20px;
                              box-sizing:border-box;">
                <div style="display:flex;gap:10px;">
                    <button id="gim-cancel"
                            style="flex:1;padding:12px 16px;border-radius:var(--r-pill);
                                   border:1px solid rgba(255,255,255,.22);background:transparent;
                                   color:var(--text-muted);font-family:inherit;font-size:14px;cursor:pointer;">
                        ${cancelText}
                    </button>
                    <button id="gim-confirm"
                            style="flex:1;padding:12px 16px;border-radius:var(--r-pill);border:none;
                                   background:var(--accent);color:var(--surface);
                                   font-family:inherit;font-size:14px;font-weight:bold;cursor:pointer;">
                        ${confirmText}
                    </button>
                </div>
            </div>`;

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';

        const input = modal.querySelector('#gim-input');

        // Focus + highlight on open
        setTimeout(() => { input.focus(); }, 50);

        // Style focus
        input.addEventListener('focus', () => { input.style.borderColor = 'var(--accent)'; });
        input.addEventListener('blur',  () => { input.style.borderColor = 'rgba(255,255,255,.22)'; });

        const cleanup = (val) => {
            modal.remove();
            document.body.style.overflow = '';
            resolve(val);
        };

        modal.querySelector('#gim-cancel').addEventListener('click', () => cleanup(null));
        modal.querySelector('#gim-confirm').addEventListener('click', () => {
            const v = input.value.trim();
            if (!v) { input.style.borderColor = '#e07070'; input.focus(); return; }
            cleanup(v);
        });
        modal.addEventListener('click', e => { if (e.target === modal) cleanup(null); });
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                const v = input.value.trim();
                if (!v) { input.style.borderColor = '#e07070'; return; }
                cleanup(v);
            }
            if (e.key === 'Escape') cleanup(null);
        });
    });
}

window.inputModal = inputModal;

// ── Перехватываем logout чтобы показать подтверждение ────────
const _originalLogout = logout;
window.logout = async function() {
    const ok = await confirmModal({
        title: 'Выйти из аккаунта?',
        message: 'Вы уверены, что хотите выйти? Несохранённый прогресс будет потерян.',
        confirmText: 'Выйти',
        cancelText: 'Остаться',
        danger: true,
    });
    if (ok) _originalLogout();
};
