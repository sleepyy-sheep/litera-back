/**
 * Единое открытие панели сортировки на мобильных (Книги + Полки)
 * — панель остаётся открытой пока пользователь не закроет её вручную
 * — нет затемнения/блюра фона
 */
(function () {
  const panel = document.getElementById('sort-panel');
  if (!panel) return;

  // Add close button inside panel if not already there
  if (!panel.querySelector('.sort-panel__close')) {
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'sort-panel__close';
    closeBtn.setAttribute('aria-label', 'Закрыть сортировку');
    closeBtn.textContent = '✕';
    panel.insertBefore(closeBtn, panel.firstChild);
    closeBtn.addEventListener('click', closeSortDrawer);
  }

  function openSortDrawer() {
    panel.classList.add('sort-panel--open');
    document.querySelectorAll('[data-sort-trigger]').forEach(btn => {
      btn.setAttribute('aria-expanded', 'true');
    });
  }

  function closeSortDrawer() {
    panel.classList.remove('sort-panel--open');
    document.querySelectorAll('[data-sort-trigger]').forEach(btn => {
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  window.openSortDrawer  = openSortDrawer;
  window.closeSortDrawer = closeSortDrawer;

  // Sort trigger buttons — toggle open/close
  document.querySelectorAll('[data-sort-trigger]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      panel.classList.contains('sort-panel--open')
        ? closeSortDrawer()
        : openSortDrawer();
    });
  });

  // Escape key closes
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSortDrawer();
  });

  // Sort buttons do NOT auto-close — user picks multiple options then closes manually
  // (no auto-close on sort-pair-btn click)
})();
