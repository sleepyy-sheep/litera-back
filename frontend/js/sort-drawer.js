/**
 * Единое открытие панели сортировки на мобильных (Книги + Полки)
 */
(function () {
  const panel = document.getElementById('sort-panel');
  if (!panel) return;

  let backdrop = document.getElementById('sort-drawer-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'sort-drawer-backdrop';
    backdrop.className = 'sort-drawer-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.appendChild(backdrop);
  }

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
    backdrop.classList.add('sort-drawer-backdrop--open');
    backdrop.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.querySelectorAll('[data-sort-trigger]').forEach(btn => {
      btn.setAttribute('aria-expanded', 'true');
    });
  }

  function closeSortDrawer() {
    panel.classList.remove('sort-panel--open');
    backdrop.classList.remove('sort-drawer-backdrop--open');
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    document.querySelectorAll('[data-sort-trigger]').forEach(btn => {
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  window.openSortDrawer = openSortDrawer;
  window.closeSortDrawer = closeSortDrawer;

  document.querySelectorAll('[data-sort-trigger]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (panel.classList.contains('sort-panel--open')) closeSortDrawer();
      else openSortDrawer();
    });
  });

  backdrop.addEventListener('click', closeSortDrawer);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSortDrawer();
  });

  panel.querySelectorAll('.sort-pair-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (window.matchMedia('(max-width: 600px)').matches) {
        setTimeout(closeSortDrawer, 120);
      }
    });
  });
})();
