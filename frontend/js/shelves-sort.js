/**
 * Сортировка полок — те же кнопки .sort-pair-btn, что на странице «Книги»
 */
(function () {
  const list = document.getElementById('shelves-list');
  if (!list) return;

  function getShelfCards() {
    return Array.from(list.querySelectorAll('.shelf-card'));
  }

  function reorder(cards) {
    cards.forEach(card => list.appendChild(card));
  }

  document.querySelectorAll('#sort-panel .sort-pair-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.sort;
      const dir = btn.dataset.dir;

      document.querySelectorAll(`#sort-panel .sort-pair-btn[data-sort="${type}"]`)
        .forEach(b => b.classList.remove('sort-pair-btn--active'));
      btn.classList.add('sort-pair-btn--active');

      const cards = getShelfCards();
      let sorted = cards.slice();

      if (type === 'alpha') {
        sorted.sort((a, b) => {
          const ta = a.querySelector('.shelf-card__title')?.textContent.trim() || '';
          const tb = b.querySelector('.shelf-card__title')?.textContent.trim() || '';
          return dir === 'asc' ? ta.localeCompare(tb, 'ru') : tb.localeCompare(ta, 'ru');
        });
      } else if (type === 'date') {
        sorted.sort((a, b) => {
          const da = new Date(a.dataset.date || 0);
          const db = new Date(b.dataset.date || 0);
          return dir === 'asc' ? da - db : db - da;
        });
      } else if (type === 'count') {
        sorted.sort((a, b) => {
          const ca = parseInt(a.dataset.count, 10) || 0;
          const cb = parseInt(b.dataset.count, 10) || 0;
          return dir === 'asc' ? ca - cb : cb - ca;
        });
      }

      reorder(sorted);
    });
  });
})();
