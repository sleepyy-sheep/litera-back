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
            body: JSON.stringify({
                username: username,
                email: email,
                password: password
            })
        });
        
        console.log('📥 Статус ответа:', response.status);
        
        if (response.status === 201) {  // Успешная регистрация
            const data = await response.json();
            console.log('✅ Регистрация успешна:', data);
            return { success: true, data: data };
        } else if (response.status === 422) {
            const errorData = await response.json();
            console.log('❌ Ошибка валидации:', errorData);
            return { success: false, error: errorData };
        } else {
            const errorData = await response.json();
            console.log('❌ Другая ошибка:', errorData);
            return { success: false, error: errorData };
        }
    } catch (error) {
        console.error('❌ Ошибка сети:', error);
        return { 
            success: false, 
            error: { detail: `Ошибка соединения: ${error.message}` }
        };
    }
}

// Вход пользователя (ВАЖНО: username в form-data должен быть email)
async function apiLogin(email, password) {
    try {
        console.log('📤 Отправка входа:', { email });
        
        // Создаем FormData в правильном формате для OAuth2
        const formData = new URLSearchParams();
        formData.append('username', email);  // В OAuth2 поле называется "username", но содержит email
        formData.append('password', password);
        
        // Добавляем grant_type если требуется
        // formData.append('grant_type', 'password');
        
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
            },
            body: formData.toString()
        });
        
        console.log('📥 Статус ответа:', response.status);
        
        if (response.status === 200) {  // Успешный вход
            const data = await response.json();
            console.log('✅ Вход успешен, получен токен');
            return { success: true, data: data };
        } else if (response.status === 422) {
            const errorData = await response.json();
            console.log('❌ Ошибка валидации:', errorData);
            return { success: false, error: errorData };
        } else {
            const errorData = await response.json();
            console.log('❌ Ошибка входа:', errorData);
            return { success: false, error: errorData };
        }
    } catch (error) {
        console.error('❌ Ошибка сети:', error);
        return { 
            success: false, 
            error: { detail: `Ошибка соединения: ${error.message}` }
        };
    }
}

// Сохранение токена
function saveTokens(accessToken, tokenType) {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('token_type', tokenType);
    console.log('💾 Токен сохранен');
}

// Получение токена
function getAccessToken() {
    return localStorage.getItem('access_token');
}

// Удаление токена (выход)
function removeTokens() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_type');
    console.log('🗑️ Токен удален');
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