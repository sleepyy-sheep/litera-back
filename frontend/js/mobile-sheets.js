/**
 * mobile-sheets.js
 * Мобильные bottom sheets: Статистика и Настройки.
 * Работает на index.html и shelves.html.
 * Подключается ПОСЛЕ api.js чтобы apiGetGoals/apiGetStats были доступны.
 */

(function () {
  'use strict';

  /* ── helpers ── */
  function _showToast(msg, type) {
    if (typeof showToast === 'function') showToast(msg, type);
  }

  function closeMobileSheet(sheet) {
    sheet?.classList.remove('mobile-bottom-sheet--open');
    document.body.style.overflow = '';
  }

  /* ── Stats sheet ── */
  function openMobileStatsSheet() {
    let sheet = document.getElementById('mobile-stats-sheet');
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.id = 'mobile-stats-sheet';
      sheet.className = 'mobile-bottom-sheet';
      sheet.innerHTML = `
        <div class="mobile-bottom-sheet__backdrop"></div>
        <div class="mobile-bottom-sheet__content">
          <div class="mobile-bottom-sheet__handle"></div>
          <h3 class="mobile-bottom-sheet__title">Активность и цели</h3>
          <div class="mobile-sheet-goals">
            <div class="goal-card" data-goal-type="pages_per_day" data-target-value="30">
              <button type="button" class="goal-card__edit" aria-label="Редактировать">✏</button>
              <p class="goal-card__label">Страниц за день</p>
              <p class="goal-card__value">0 / 30</p>
              <div class="goal-card__bar"><div class="goal-card__bar-fill" style="width:0%"></div></div>
            </div>
            <div class="goal-card" data-goal-type="minutes_per_day" data-target-value="30">
              <button type="button" class="goal-card__edit" aria-label="Редактировать">✏</button>
              <p class="goal-card__label">Время чтения</p>
              <p class="goal-card__value">0 м / 30 м</p>
              <div class="goal-card__bar"><div class="goal-card__bar-fill" style="width:0%"></div></div>
            </div>
          </div>
          <div class="mobile-sheet-stats">
            <div class="stats-header">
              <span class="stats-header__label">Активность</span>
              <span class="stats-header__value" id="mobile-stats-value">— стр</span>
              <div class="stats-tabs" role="group">
                <button class="stats-tab stats-tab--active" data-period="week">7 дней</button>
                <button class="stats-tab" data-period="month">Месяц</button>
                <button class="stats-tab" data-period="year">Год</button>
              </div>
            </div>
            <div class="stats-chart">
              <svg viewBox="0 0 480 140" class="stats-chart__svg" id="mobile-stats-svg" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="mobileChartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="rgba(246,237,231,0.25)"/>
                    <stop offset="100%" stop-color="rgba(246,237,231,0)"/>
                  </linearGradient>
                </defs>
                <path fill="url(#mobileChartGrad)"/>
                <path fill="none" stroke="#f6ede7" stroke-width="2.5"/>
              </svg>
              <div class="stats-chart__labels" id="mobile-stats-labels"></div>
            </div>
          </div>
        </div>`;
      document.body.appendChild(sheet);

      // Close on backdrop click
      sheet.addEventListener('click', e => {
        if (e.target === sheet || e.target.classList.contains('mobile-bottom-sheet__backdrop')) {
          closeMobileSheet(sheet);
        }
      });

      // Stats tabs
      sheet.querySelectorAll('.stats-tab').forEach(tab => {
        tab.addEventListener('click', async () => {
          sheet.querySelectorAll('.stats-tab').forEach(t => t.classList.remove('stats-tab--active'));
          tab.classList.add('stats-tab--active');
          await _loadMobileStats(tab.dataset.period, sheet);
        });
      });

      // Goal edit buttons
      sheet.querySelectorAll('.goal-card__edit').forEach((btn, i) => {
        btn.addEventListener('click', async e => {
          e.preventDefault(); e.stopPropagation();
          const card = btn.closest('.goal-card');
          const goalType = card?.dataset.goalType || (i === 0 ? 'pages_per_day' : 'minutes_per_day');
          const current  = parseInt(card?.dataset.targetValue || '30', 10);

          const target = await editGoalModal({ goalType, current });
          if (target === null) return;
          if (isNaN(target) || target <= 0) return;

          if (typeof apiCreateGoal === 'function') {
            const result = await apiCreateGoal(goalType, target);
            if (result.success) {
              _showToast('Цель обновлена', 'success');
              if (typeof loadGoals === 'function') await loadGoals();
              await _loadMobileGoals(sheet);
            }
          }
        });
      });
    }

    sheet.classList.add('mobile-bottom-sheet--open');
    document.body.style.overflow = 'hidden';
    _loadMobileGoals(sheet);
    _loadMobileStats('week', sheet);
  }

  async function _loadMobileGoals(sheet) {
    if (typeof apiGetGoals !== 'function') return;
    const result = await apiGetGoals();
    const goals = typeof mergeGoalsWithDefaults === 'function'
      ? mergeGoalsWithDefaults(result.success ? result.data : [])
      : (result.success ? result.data : []);
    const cards = sheet.querySelectorAll('.goal-card');
    const meta = {
      pages_per_day:   { label: 'Страниц за день', unit: '' },
      minutes_per_day: { label: 'Время чтения',    unit: ' м' },
    };
    goals.forEach((goal, i) => {
      const card = cards[i]; if (!card) return;
      const m = meta[goal.goal_type] || { label: goal.goal_type, unit: '' };
      const pct = goal.target_value > 0
        ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100)) : 0;
      const lbl  = card.querySelector('.goal-card__label');
      const val  = card.querySelector('.goal-card__value');
      const fill = card.querySelector('.goal-card__bar-fill');
      if (lbl)  lbl.textContent  = m.label;
      if (val)  val.textContent  = `${goal.current_value}${m.unit} / ${goal.target_value}${m.unit}`;
      if (fill) fill.style.width = `${pct}%`;
      card.dataset.goalType    = goal.goal_type;
      card.dataset.targetValue = goal.target_value;
    });
  }

  async function _loadMobileStats(period, sheet) {
    if (typeof apiGetStats !== 'function') return;
    const result = await apiGetStats(period);
    if (!result.success) return;
    const stats = result.data;
    const valEl = sheet.querySelector('#mobile-stats-value');
    if (valEl) valEl.textContent = `${stats.total_pages ?? 0} стр`;
    const svg = sheet.querySelector('#mobile-stats-svg');
    if (svg && stats.daily_breakdown?.length) {
      const daily = stats.daily_breakdown;
      const maxP  = Math.max(...daily.map(d => d.pages), 1);
      const W = 480, H = 140;
      const step = W / Math.max(daily.length - 1, 1);
      const pts  = daily.map((d, i) => `${i * step},${H - 20 - (d.pages / maxP) * (H - 40)}`);
      const line = `M${pts.join(' L')}`;
      svg.querySelector('path[stroke]')?.setAttribute('d', line);
      svg.querySelector('path[fill^="url"]')?.setAttribute('d', `${line} L${W},${H} L0,${H} Z`);
      const labels = sheet.querySelector('#mobile-stats-labels');
      if (labels) {
        const days = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
        labels.innerHTML = daily.slice(-7).map(d => {
          const dt = new Date(d.date);
          return `<span>${days[dt.getDay() === 0 ? 6 : dt.getDay() - 1]}</span>`;
        }).join('');
      }
    }
  }

  /* ── Settings sheet ── */
  function openMobileSettingsSheet() {
    let sheet = document.getElementById('mobile-settings-sheet');
    if (!sheet) {
      const savedTheme = localStorage.getItem('app_theme') || 'brown';
      sheet = document.createElement('div');
      sheet.id = 'mobile-settings-sheet';
      sheet.className = 'mobile-bottom-sheet';
      sheet.innerHTML = `
        <div class="mobile-bottom-sheet__backdrop"></div>
        <div class="mobile-bottom-sheet__content">
          <div class="mobile-bottom-sheet__handle"></div>
          <h3 class="mobile-bottom-sheet__title">Настройки</h3>
          <p class="mobile-bottom-sheet__section-label">Тема оформления</p>
          <div class="theme-grid mobile-theme-grid">
            <button class="theme-card${savedTheme === 'dark' ? ' theme-card--active' : ''}" data-theme="dark" aria-label="Тёмная тема">
              <div class="theme-card__preview theme-card__preview--dark">
                <img src="log_img/book2.svg" alt="" aria-hidden="true">
                <img src="log_img/Logo.svg" alt="ЛитЭра" class="theme-card__logo">
              </div>
              ${savedTheme === 'dark' ? '<span class="theme-card__check" aria-hidden="true">✓</span>' : ''}
            </button>
            <button class="theme-card${savedTheme === 'brown' ? ' theme-card--active' : ''}" data-theme="brown" aria-label="Коричневая тема">
              <div class="theme-card__preview theme-card__preview--brown">
                <img src="log_img/book2.svg" alt="" aria-hidden="true">
                <img src="log_img/Logo.svg" alt="ЛитЭра" class="theme-card__logo">
              </div>
              ${savedTheme === 'brown' ? '<span class="theme-card__check" aria-hidden="true">✓</span>' : ''}
            </button>
          </div>
          <div class="mobile-bottom-sheet__logout-wrap">
            <button class="mobile-logout-btn" data-logout aria-label="Выйти из аккаунта">
              <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
                <path d="M13 3h4v14h-4M8 7l-4 3 4 3M4 10h9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Выйти из аккаунта
            </button>
          </div>
        </div>`;
      document.body.appendChild(sheet);

      sheet.addEventListener('click', e => {
        if (e.target === sheet || e.target.classList.contains('mobile-bottom-sheet__backdrop')) {
          closeMobileSheet(sheet);
        }
      });

      sheet.querySelectorAll('.theme-card').forEach(card => {
        card.addEventListener('click', () => {
          const themeName = card.dataset.theme;
          if (typeof applyAppTheme === 'function') applyAppTheme(themeName);
          sheet.querySelectorAll('.theme-card').forEach(c => {
            c.classList.remove('theme-card--active');
            c.querySelector('.theme-card__check')?.remove();
          });
          card.classList.add('theme-card--active');
          const chk = document.createElement('span');
          chk.className = 'theme-card__check';
          chk.setAttribute('aria-hidden', 'true');
          chk.textContent = '✓';
          card.appendChild(chk);
        });
      });

      sheet.querySelector('[data-logout]')?.addEventListener('click', () => {
        if (typeof logout === 'function') logout();
      });
    }
    sheet.classList.add('mobile-bottom-sheet--open');
    document.body.style.overflow = 'hidden';
  }

  /* ── Wire up buttons ── */
  function init() {
    document.getElementById('mobile-stats-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      openMobileStatsSheet();
    });
    document.getElementById('mobile-settings-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      openMobileSettingsSheet();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.mobile-bottom-sheet--open').forEach(s => closeMobileSheet(s));
      }
    });
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose globally for dashboard.js compatibility
  window.openMobileStatsSheet    = openMobileStatsSheet;
  window.openMobileSettingsSheet = openMobileSettingsSheet;
  window.closeMobileSheet        = closeMobileSheet;
})();
