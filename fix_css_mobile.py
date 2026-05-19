with open(r'c:\Users\ASUS\Desktop\litera-back\frontend\css\dashboard.css', encoding='utf-8') as f:
    css = f.read()

# Cut everything from the mobile section onwards and replace
cut_at = css.find('/* \u2500\u2500 MOBILE HEADER TITLE')
if cut_at == -1:
    print("ERROR: marker not found")
    exit(1)

base_css = css[:cut_at]

mobile_css = r"""/* ============================================================
   MOBILE-ONLY ELEMENTS — hidden by default on desktop
   ============================================================ */
.header-title        { display: none; }
.mobile-top-area     { display: none; }
.mobile-continue     { display: none; }
.mobile-subnav-wrap  { display: none; }
.mobile-subnav       { display: none; }
.mobile-ctx-menu     { display: none; }
.bottom-nav          { display: none; }
.book-card__check-circle { display: none; }

/* ============================================================
   MOBILE  ≤ 600px
   ============================================================ */
@media (max-width: 600px) {

  /* Отступ снизу под bottom-nav */
  body { padding-bottom: 72px; }

  /* ── Шапка ── */
  .site-header { height: 54px; }
  .header-inner {
    padding: 0 16px;
    gap: 0;
    justify-content: space-between;
  }
  .search-form  { display: none; }
  .main-nav     { display: none; }
  .header-actions { display: none; }

  /* Показываем заголовок "Мои книги" по центру */
  .header-title {
    display: block;
    font-size: 17px;
    font-weight: bold;
    color: var(--text);
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
  }

  /* Иконка поиска справа — показываем только её */
  .header-inner .logo { flex-shrink: 0; }

  /* Кнопка поиска отдельно */
  .mobile-search-btn {
    display: flex;
    width: 36px; height: 36px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: var(--text);
    align-items: center; justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
  }

  /* ── Мобильный блок (баннер + суб-нав) ── */
  .mobile-top-area {
    display: block;
    position: relative;
    z-index: 10;
  }

  /* Баннер "Продолжите чтение" */
  .mobile-continue {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--surface-mid);
    margin: 10px 12px 0;
    border-radius: 16px;
    padding: 14px 12px 14px 16px;
    gap: 10px;
  }
  .mobile-continue__text { flex: 1; min-width: 0; }
  .mobile-continue__title {
    font-size: 19px; font-weight: bold; color: var(--text);
    margin-bottom: 3px; line-height: 1.2;
  }
  .mobile-continue__book {
    font-size: 12px; color: var(--text-muted); margin-bottom: 10px;
  }
  .mobile-continue__progress {
    display: flex; align-items: center; gap: 8px;
  }
  .mobile-continue__bar {
    flex: 1; height: 6px;
    background: rgba(255,255,255,0.20);
    border-radius: 9999px; overflow: hidden;
  }
  .mobile-continue__fill {
    height: 100%; background: var(--text); border-radius: 9999px;
  }
  .mobile-continue__pct {
    font-size: 12px; font-weight: bold; color: var(--text); min-width: 30px;
  }
  .mobile-continue__cover-wrap { position: relative; flex-shrink: 0; }
  .mobile-continue__star {
    position: absolute; top: -8px; left: -10px;
    font-size: 20px; z-index: 1;
  }
  .mobile-continue__cover {
    width: 78px; height: 108px; border-radius: 8px;
    object-fit: cover; box-shadow: 2px 4px 12px rgba(0,0,0,0.4);
    display: block;
  }

  /* Обёртка суб-нав + контекстное меню */
  .mobile-subnav-wrap {
    display: block;
    position: relative;
    margin: 0 0 4px;
  }

  /* Суб-навигация */
  .mobile-subnav {
    display: flex;
    align-items: center;
    padding: 8px 12px 6px;
    gap: 8px;
  }
  .mobile-subnav__sort {
    width: 36px; height: 36px; border-radius: 8px;
    border: 1px solid var(--card-border);
    background: rgba(255,255,255,0.08);
    color: var(--text); font-size: 15px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .mobile-subnav__tabs {
    flex: 1; display: flex; align-items: center;
    justify-content: center; gap: 20px;
  }
  .mobile-subnav__tab {
    border: none; background: transparent;
    color: var(--text-muted); font-family: inherit;
    font-size: 16px; cursor: pointer; padding: 4px 0;
    transition: color .2s;
  }
  .mobile-subnav__tab--active {
    color: var(--text); font-weight: bold;
    border-bottom: 2px solid var(--accent);
  }
  .mobile-subnav__more {
    width: 36px; height: 36px; border-radius: 50%;
    border: 1px solid var(--card-border);
    background: rgba(255,255,255,0.08);
    color: var(--text); font-size: 15px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; letter-spacing: 1px;
  }

  /* Мобильное контекстное меню */
  .mobile-ctx-menu {
    position: absolute;
    top: 100%; right: 12px;
    background: #3a2418;
    border-radius: 14px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    padding: 6px 0;
    min-width: 190px;
    z-index: 200;
    opacity: 0; pointer-events: none;
    transform: scale(0.94) translateY(-6px);
    transform-origin: top right;
    transition: opacity .18s ease, transform .18s ease;
  }
  .mobile-ctx-menu--open {
    opacity: 1; pointer-events: auto;
    transform: scale(1) translateY(0);
  }
  .mobile-ctx-menu__item {
    display: flex; align-items: center; gap: 12px;
    width: 100%; padding: 13px 20px;
    border: none; background: transparent;
    color: var(--text); font-family: inherit; font-size: 15px;
    cursor: pointer; text-align: left; transition: background .15s;
  }
  .mobile-ctx-menu__item:hover { background: rgba(255,255,255,0.10); }
  .mobile-ctx-menu__item--danger { color: #e07070; }
  .mobile-ctx-menu__item span { font-size: 16px; width: 22px; text-align: center; }

  /* ── Дашборд — одна колонка ── */
  .dashboard {
    grid-template-columns: 1fr;
    grid-template-areas: "books";
    padding: 0 0 16px 0;
    gap: 0;
    max-width: 100%;
  }
  .sort-panel  { display: none; }
  .right-panel { display: none; }

  /* ── Список книг ── */
  .book-list {
    padding: 0 12px;
    gap: 10px;
  }

  /* ── Карточка книги ── */
  .book-card {
    padding: 10px 12px 10px 0;
    gap: 0;
    border-radius: 16px;
    align-items: center;
  }

  /* Кружок-галочка слева */
  .book-card__check-circle {
    display: flex;
    align-items: center; justify-content: center;
    width: 30px; height: 30px; border-radius: 50%;
    background: var(--surface-mid);
    border: 2px solid rgba(255,255,255,0.22);
    color: var(--text); font-size: 13px;
    flex-shrink: 0;
    margin-left: 10px; margin-right: 6px;
  }

  .book-card__cover {
    width: 88px; height: 128px;
    border-radius: 10px; margin-right: 12px;
    flex-shrink: 0;
  }

  .book-card__info { flex: 1; min-width: 0; }
  .book-card__title  { font-size: 15px; line-height: 1.25; }
  .book-card__author { font-size: 13px; }
  .book-card__genre  { font-size: 11px; margin-bottom: 8px; }

  .reading-progress__bar { width: 100%; max-width: 160px; }
  .reading-progress__label { font-size: 12px; }

  .book-card__date { display: none; }

  /* Скрываем кнопки действий (play + more) на мобильном */
  .book-card__actions { display: none; }

  /* ── Нижняя навигация ── */
  .bottom-nav {
    display: flex;
    position: fixed; bottom: 0; left: 0; right: 0;
    height: 64px; z-index: 300;
    background: var(--surface);
    border-top: 1px solid rgba(255,255,255,0.10);
    box-shadow: 0 -2px 12px rgba(0,0,0,0.4);
  }
  .bottom-nav__item {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 3px;
    border: none; background: transparent;
    color: var(--text-muted); font-family: inherit;
    font-size: 10px; cursor: pointer;
    transition: color .2s; padding: 6px 4px;
  }
  .bottom-nav__item:hover { color: var(--text); }
  .bottom-nav__item--active { color: var(--accent); }
  .bottom-nav__icon { width: 22px; height: 22px; flex-shrink: 0; }

  /* ── Модальное окно снизу ── */
  .modal-overlay { padding-top: 0; align-items: flex-end; }
  .modal--add-book {
    width: 100%; border-radius: 20px 20px 0 0;
    max-height: 90vh; padding: 20px 16px 24px;
  }
  .add-book__top { flex-direction: column; align-items: center; gap: 14px; }
  .add-book__file-zone { width: 110px; height: 135px; }
  .add-book__heading { font-size: 17px; }
  .add-book__subheading { font-size: 15px; }
  .add-book__genres-grid { gap: 6px; }
  .genre-tag { font-size: 11px; padding: 5px 10px; }
  .add-book__submit { width: 100%; }
  .add-book__footer { justify-content: stretch; }

  /* ── Выпадашки шапки ── */
  .hdr-dropdown--stats,
  .hdr-dropdown--profile,
  .hdr-dropdown--theme { width: calc(100vw - 24px); right: -8px; }
  .goal-grid { flex-direction: column; }

  /* Toast выше bottom-nav */
  .toast { bottom: 80px; }
}

/* ============================================================
   TABLET  601px – 1100px
   ============================================================ */
@media (min-width: 601px) and (max-width: 1100px) {
  .mobile-top-area     { display: none; }
  .mobile-continue     { display: none; }
  .mobile-subnav-wrap  { display: none; }
  .mobile-subnav       { display: none; }
  .mobile-ctx-menu     { display: none; }
  .bottom-nav          { display: none; }
  .book-card__check-circle { display: none; }
}
"""

new_css = base_css + mobile_css

with open(r'c:\Users\ASUS\Desktop\litera-back\frontend\css\dashboard.css', 'w', encoding='utf-8') as f:
    f.write(new_css)

print("CSS written. Lines:", len(new_css.split('\n')))
