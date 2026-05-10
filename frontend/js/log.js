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
});
