/**
 * Переход на страницу чтения по клику на карточку книги
 */
(function () {
  function readerUrl(card) {
    const params = new URLSearchParams({
      title: card.dataset.title || '',
      author: card.dataset.author || '',
      progress: card.dataset.progress || '0',
      page: card.dataset.page || '400',
      total: card.dataset.total || '1567',
      minutes: card.dataset.minutes || '20'
    });
    return `reader.html?${params.toString()}`;
  }

  document.querySelectorAll('#book-list .book-card').forEach(card => {
    card.classList.add('book-card--clickable');
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'link');
    card.setAttribute('aria-label', `Читать «${card.dataset.title || 'книгу'}»`);

    const go = () => { window.location.href = readerUrl(card); };

    card.addEventListener('click', e => {
      if (e.target.closest('.more-btn, .more-wrap, .ctx-menu, .play-btn, .book-card__note-link')) return;
      go();
    });

    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        go();
      }
    });

    const playBtn = card.querySelector('.play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', e => {
        e.stopPropagation();
        go();
      });
    }
  });

  const continueBlock = document.querySelector('.mobile-continue');
  if (continueBlock) {
    continueBlock.classList.add('mobile-continue--clickable');
    continueBlock.setAttribute('role', 'button');
    continueBlock.setAttribute('tabindex', '0');
    continueBlock.addEventListener('click', () => {
      const first = document.querySelector('#book-list .book-card');
      if (first) window.location.href = readerUrl(first);
    });
  }
})();
