document.addEventListener('DOMContentLoaded', () => {
    console.log("✅ register.js загружен");

    // Переключение видимости паролей
    const setupToggle = (passId, toggleId) => {
        const pass = document.getElementById(passId);
        const toggle = document.getElementById(toggleId);
        if (!pass || !toggle) return;

        let visible = false;
        toggle.addEventListener('click', () => {
            visible = !visible;
            pass.type = visible ? 'text' : 'password';
            toggle.src = visible
                ? 'log_img/closed_eye_icon.svg'
                : 'log_img/opened_eye_icon.svg';
        });
    };

    setupToggle('password', 'togglePassword');
    setupToggle('confirmPassword', 'toggleConfirmPassword');

    // === ВСПЛЫВАЮЩИЕ ПОДСКАЗКИ ===
    const triggers = document.querySelectorAll('.tooltip-trigger');
    const tooltipAbout = document.getElementById('tooltip-about');
    const tooltipContact = document.getElementById('tooltip-contact');

    triggers.forEach(trigger => {
        trigger.addEventListener('mouseenter', function () {
            const tooltip =
                this.dataset.tooltip === 'about' ? tooltipAbout : tooltipContact;

            if (tooltipAbout) tooltipAbout.style.display = 'none';
            if (tooltipContact) tooltipContact.style.display = 'none';

            if (tooltip) {
                const rect = this.getBoundingClientRect();
                tooltip.style.top = `${rect.bottom + window.scrollY + 15}px`;
                tooltip.style.left = `${rect.left + window.scrollX + rect.width / 2 - 220}px`;
                tooltip.style.display = 'block';
            }
        });
    });

    [tooltipAbout, tooltipContact].forEach(t => {
        if (t) t.addEventListener('mouseleave', () => (t.style.display = 'none'));
    });

    // Копирование почты
    const copyBtn = document.getElementById('copy-email-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText('litera@gmail.com');
            copyBtn.innerHTML = '✓';
            setTimeout(() => (copyBtn.innerHTML = '📋'), 2000);
        });
    }

    // === РЕГИСТРАЦИЯ ===
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
        registerBtn.addEventListener('click', async function (e) {
            e.preventDefault();

            const name            = document.getElementById('name')?.value.trim();
            const email           = document.getElementById('email')?.value.trim();
            const pwd             = document.getElementById('password')?.value;
            const confirmPwd      = document.getElementById('confirmPassword')?.value;

            if (!name || !email || !pwd || !confirmPwd) {
                showAuthMessage('Пожалуйста, заполните все поля', 'error');
                return;
            }
            if (pwd !== confirmPwd) {
                showAuthMessage('Пароли не совпадают', 'error');
                return;
            }
            if (pwd.length < 8) {
                showAuthMessage('Пароль должен содержать минимум 8 символов', 'error');
                return;
            }
            if (!/^[^\s@]+@([^\s@]+\.)+[^\s@]+$/.test(email)) {
                showAuthMessage('Введите корректный email адрес', 'error');
                return;
            }

            this.disabled = true;
            const orig = this.textContent;
            this.textContent = 'Регистрация...';

            if (!(await apiCheckHealth())) {
                showAuthMessage('Сервер недоступен. Запустите start.bat.', 'error');
                this.disabled = false; this.textContent = orig;
                return;
            }

            const result = await apiRegister(name, email, pwd);

            if (result.success) {
                // Auto-login after registration
                const loginResult = await apiLogin(email, pwd);
                if (loginResult.success) {
                    saveTokens(loginResult.data.access_token, loginResult.data.token_type);
                    showAuthMessage('Аккаунт создан! Перенаправление...', 'success');
                    setTimeout(() => { window.location.href = 'index.html'; }, 1200);
                } else {
                    showAuthMessage('Аккаунт создан! Войдите в систему.', 'success');
                    setTimeout(() => { window.location.href = 'log.html'; }, 1500);
                }
            } else {
                const msg = formatApiError(result.error) || 'Ошибка регистрации';
                showAuthMessage(msg, 'error');
                this.disabled = false;
                this.textContent = orig;
            }
        });

        // Enter в полях формы
        ['name', 'email', 'password', 'confirmPassword'].forEach(id => {
            document.getElementById(id)?.addEventListener('keydown', e => {
                if (e.key === 'Enter') registerBtn.click();
            });
        });
    }
});

// ── Вспомогательные ──────────────────────────────────────────

function showAuthMessage(text, type) {
    document.querySelectorAll('.auth-message').forEach(el => el.remove());
    const div = document.createElement('div');
    div.className = 'auth-message';
    div.style.cssText = `
        padding: 12px 16px; border-radius: 10px; margin-top: 14px;
        font-size: 14px; text-align: center; font-family: inherit;
        ${type === 'error'
            ? 'background:rgba(224,112,112,.15);color:#e07070;border:1px solid rgba(224,112,112,.3);'
            : 'background:rgba(60,179,113,.15);color:#3cb371;border:1px solid rgba(60,179,113,.3);'}
    `;
    div.textContent = text;
    const btn = document.getElementById('registerBtn');
    btn?.parentNode?.insertBefore(div, btn.nextSibling);
    if (type === 'error') setTimeout(() => div.remove(), 5000);
}
