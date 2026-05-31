document.addEventListener('DOMContentLoaded', () => {
    console.log("✅ log.js загружен");

    // Переключение видимости пароля
    const password = document.getElementById('password');
    const toggle = document.getElementById('togglePassword');

    if (password && toggle) {
        let visible = false;
        toggle.addEventListener('click', () => {
            visible = !visible;
            password.type = visible ? 'text' : 'password';
            toggle.src = visible
                ? 'log_img/closed_eye_icon.svg'
                : 'log_img/opened_eye_icon.svg';
        });
    }

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

    // Восстановление запомненного email
    const rememberedEmail = localStorage.getItem('remembered_email');
    if (rememberedEmail) {
        const emailInput = document.getElementById('email');
        const rememberCheckbox = document.getElementById('remember');
        if (emailInput) emailInput.value = rememberedEmail;
        if (rememberCheckbox) rememberCheckbox.checked = true;
    }

    // === ВХОД В АККАУНТ ===
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', async function (e) {
            e.preventDefault();

            const email    = document.getElementById('email')?.value.trim();
            const pwd      = document.getElementById('password')?.value;
            const remember = document.getElementById('remember')?.checked;

            if (!email || !pwd) {
                showAuthMessage('Пожалуйста, заполните все поля', 'error');
                return;
            }

            this.disabled = true;
            const orig = this.textContent;
            this.textContent = 'Вход...';

            if (!(await apiCheckHealth())) {
                showAuthMessage('Сервер недоступен. Запустите start.bat.', 'error');
                this.disabled = false; this.textContent = orig;
                return;
            }

            const result = await apiLogin(email, pwd);

            if (result.success) {
                saveTokens(result.data.access_token, result.data.token_type);
                if (remember) {
                    localStorage.setItem('remembered_email', email);
                } else {
                    localStorage.removeItem('remembered_email');
                }
                showAuthMessage('Вход выполнен! Перенаправление...', 'success');
                setTimeout(() => { window.location.href = 'index.html'; }, 1200);
            } else {
                const msg = formatApiError(result.error) || 'Неверный email или пароль';
                showAuthMessage(msg, 'error');
                this.disabled = false;
                this.textContent = orig;
            }
        });

        // Enter в полях формы
        ['email', 'password'].forEach(id => {
            document.getElementById(id)?.addEventListener('keydown', e => {
                if (e.key === 'Enter') loginBtn.click();
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
    const btn = document.getElementById('loginBtn') || document.getElementById('registerBtn');
    btn?.parentNode?.insertBefore(div, btn.nextSibling);
    if (type === 'error') setTimeout(() => div.remove(), 5000);
}
