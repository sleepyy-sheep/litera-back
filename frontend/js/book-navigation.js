/**
 * Переход на страницу чтения по клику на карточку книги (делегирование событий)
 */
(function () {
  const list = document.getElementById('book-list');
  if (!list) return;

  function readerUrl(card) {
    const bookId = card.dataset.bookId;
    if (bookId) {
      return `reader.html?id=${bookId}`;
    }
    return 'reader.html';
  }

  list.addEventListener('click', e => {
    const card = e.target.closest('.book-card');
    if (!card) return;
    if (e.target.closest('.more-btn, .more-wrap, .ctx-menu, .play-btn, .book-card__note-link')) {
      return;
    }
    window.location.href = readerUrl(card);
  });

  list.addEventListener('keydown', e => {
    const card = e.target.closest('.book-card');
    if (!card) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      window.location.href = readerUrl(card);
    }
  });

  document.querySelectorAll('#book-list .book-card').forEach(card => {
    card.classList.add('book-card--clickable');
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'link');

    const playBtn = card.querySelector('.play-btn');
    if (playBtn && !playBtn.getAttribute('onclick')) {
      playBtn.addEventListener('click', e => {
        e.stopPropagation();
        window.location.href = readerUrl(card);
      });
    }
  });

  const continueBlock = document.querySelector('.mobile-continue');
  if (continueBlock) {
    continueBlock.classList.add('mobile-continue--clickable');
    continueBlock.setAttribute('role', 'button');
    continueBlock.setAttribute('tabindex', '0');
    continueBlock.addEventListener('click', () => {
      const bookId = continueBlock.dataset.bookId;
      if (bookId) { window.location.href = `reader.html?id=${bookId}`; return; }
      const first = document.querySelector('#book-list .book-card');
      if (first) window.location.href = readerUrl(first);
    });
  }
})();
