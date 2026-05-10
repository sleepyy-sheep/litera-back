// API Интеграция с бэкендом
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 API Интеграция загружена');

    // === ОБРАБОТЧИК РЕГИСТРАЦИИ ===
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
        registerBtn.addEventListener('click', async function (e) {
            e.preventDefault();

            console.log('🔘 Нажата кнопка регистрации');

            const nameInput = document.getElementById('name');
            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');
            const confirmInput = document.getElementById('confirmPassword');

            const name = nameInput ? nameInput.value.trim() : '';
            const email = emailInput ? emailInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value : '';
            const confirmPassword = confirmInput ? confirmInput.value : '';

            // Валидация
            if (!name || !email || !password || !confirmPassword) {
                showApiError('Пожалуйста, заполните все поля');
                return;
            }
            if (password !== confirmPassword) {
                showApiError('Пароли не совпадают');
                return;
            }
            // Минимум 8 символов — согласовано с бэкендом
            if (password.length < 8) {
                showApiError('Пароль должен содержать минимум 8 символов');
                return;
            }
            if (!validateEmail(email)) {
                showApiError('Введите корректный email адрес');
                return;
            }

            this.disabled = true;
            const originalText = this.textContent;
            this.textContent = 'Регистрация...';

            const result = await apiRegister(name, email, password);

            if (result.success) {
                console.log('✅ Регистрация успешна, выполняем вход');
                const loginResult = await apiLogin(email, password);
                if (loginResult.success) {
                    saveTokens(loginResult.data.access_token, loginResult.data.token_type);
                    showApiSuccess('Регистрация успешна! Перенаправление...');
                    setTimeout(() => { window.location.href = 'index.html'; }, 1500);
                } else {
                    showApiSuccess('Регистрация успешна! Пожалуйста, войдите в систему.');
                    setTimeout(() => { window.location.href = 'log.html'; }, 1500);
                }
            } else {
                let errorMessage = 'Ошибка регистрации';
                if (result.error && result.error.detail) {
                    if (Array.isArray(result.error.detail)) {
                        errorMessage = result.error.detail.map(err => err.msg).join(', ');
                    } else if (typeof result.error.detail === 'string') {
                        errorMessage = result.error.detail;
                    }
                }
                showApiError(errorMessage);
                this.disabled = false;
                this.textContent = originalText;
            }
        });
    }

    // === ОБРАБОТЧИК ВХОДА ===
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', async function (e) {
            e.preventDefault();

            console.log('🔘 Нажата кнопка входа');

            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');
            const rememberCheckbox = document.getElementById('remember');

            const email = emailInput ? emailInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value : '';
            const remember = rememberCheckbox ? rememberCheckbox.checked : false;

            if (!email || !password) {
                showApiError('Пожалуйста, заполните все поля');
                return;
            }

            this.disabled = true;
            const originalText = this.textContent;
            this.textContent = 'Вход...';

            const result = await apiLogin(email, password);

            if (result.success) {
                console.log('✅ Вход успешен');
                saveTokens(result.data.access_token, result.data.token_type);

                if (remember) {
                    localStorage.setItem('remembered_email', email);
                } else {
                    localStorage.removeItem('remembered_email');
                }

                showApiSuccess('Вход выполнен успешно! Перенаправление...');
                setTimeout(() => { window.location.href = 'index.html'; }, 1500);
            } else {
                let errorMessage = 'Ошибка входа';
                if (result.error && result.error.detail) {
                    if (Array.isArray(result.error.detail)) {
                        errorMessage = result.error.detail.map(err => err.msg).join(', ');
                    } else if (typeof result.error.detail === 'string') {
                        errorMessage = result.error.detail;
                    }
                }
                showApiError(errorMessage);
                this.disabled = false;
                this.textContent = originalText;
            }
        });
    }

    // Восстановление запомненного email на странице входа
    if (window.location.pathname.includes('log.html')) {
        const rememberedEmail = localStorage.getItem('remembered_email');
        if (rememberedEmail) {
            const emailInput = document.getElementById('email');
            const rememberCheckbox = document.getElementById('remember');
            if (emailInput) emailInput.value = rememberedEmail;
            if (rememberCheckbox) rememberCheckbox.checked = true;
            console.log('📧 Восстановлен email:', rememberedEmail);
        }
    }
});

// ====================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ======================

function validateEmail(email) {
    const re = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
    return re.test(email);
}

function showApiError(message) {
    removeApiMessages();
    const errorDiv = document.createElement('div');
    errorDiv.className = 'api-error-message';
    errorDiv.style.cssText = `
        background-color: #fee;
        color: #c33;
        padding: 12px;
        border-radius: 8px;
        margin-top: 15px;
        font-size: 14px;
        text-align: center;
        border: 1px solid #fcc;
        animation: fadeIn 0.3s ease;
    `;
    errorDiv.textContent = message;
    _insertMessage(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

function showApiSuccess(message) {
    removeApiMessages();
    const successDiv = document.createElement('div');
    successDiv.className = 'api-success-message';
    successDiv.style.cssText = `
        background-color: #e8f5e9;
        color: #2e7d32;
        padding: 12px;
        border-radius: 8px;
        margin-top: 15px;
        font-size: 14px;
        text-align: center;
        border: 1px solid #a5d6a7;
        animation: fadeIn 0.3s ease;
    `;
    successDiv.textContent = message;
    _insertMessage(successDiv);
}

function _insertMessage(el) {
    const rightPart = document.querySelector('.right-part');
    const button = document.getElementById('registerBtn') || document.getElementById('loginBtn');
    if (rightPart && button) {
        rightPart.insertBefore(el, button.nextSibling);
    }
}

function removeApiMessages() {
    document.querySelectorAll('.api-error-message, .api-success-message')
        .forEach(el => el.remove());
}

// Анимация fadeIn
if (!document.querySelector('#api-styles')) {
    const style = document.createElement('style');
    style.id = 'api-styles';
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to   { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(style);
}
