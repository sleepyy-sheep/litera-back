// API конфигурация
const API_BASE_URL = 'http://localhost:8000';

// Регистрация пользователя
async function apiRegister(username, email, password) {
    try {
        console.log('📤 Отправка регистрации:', { username, email });

        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ username, email, password }),
        });

        console.log('📥 Статус ответа:', response.status);
        const data = await response.json();

        if (response.ok) {
            console.log('✅ Регистрация успешна:', data);
            return { success: true, data };
        } else {
            console.log('❌ Ошибка регистрации:', data);
            return { success: false, error: data };
        }
    } catch (error) {
        console.error('❌ Ошибка сети:', error);
        return {
            success: false,
            error: { detail: `Ошибка соединения: ${error.message}` },
        };
    }
}

// Вход пользователя
// OAuth2 требует form-data; поле "username" может содержать email — бэкенд ищет по обоим полям
async function apiLogin(email, password) {
    try {
        console.log('📤 Отправка входа:', { email });

        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);

        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
            },
            body: formData.toString(),
        });

        console.log('📥 Статус ответа:', response.status);
        const data = await response.json();

        if (response.ok) {
            console.log('✅ Вход успешен, получен токен');
            return { success: true, data };
        } else {
            console.log('❌ Ошибка входа:', data);
            return { success: false, error: data };
        }
    } catch (error) {
        console.error('❌ Ошибка сети:', error);
        return {
            success: false,
            error: { detail: `Ошибка соединения: ${error.message}` },
        };
    }
}

// Сохранение токена
function saveTokens(accessToken, tokenType) {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('token_type', tokenType);
    console.log('💾 Токен сохранён');
}

// Получение токена
function getAccessToken() {
    return localStorage.getItem('access_token');
}

// Удаление токена (выход)
function removeTokens() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_type');
    console.log('🗑️ Токен удалён');
}

// Проверка авторизации
function isAuthenticated() {
    const hasToken = localStorage.getItem('access_token') !== null;
    console.log('🔐 Авторизован:', hasToken);
    return hasToken;
}

// Выход из системы
function logout() {
    removeTokens();
    window.location.href = 'log.html';
}
