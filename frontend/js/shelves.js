// ============================================================
// shelves.js — страница «Полки»
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    if (!isAuthenticated()) {
        window.location.href = 'log.html';
        return;
    }
    await Promise.all([loadShelves(), loadShelvesGoals(), loadShelvesStats()]);
    bindShelfButtons();
    setupShelvesStatsTabs();
    setupShelvesGoalEditors();
});

// ── Загрузка целей (как на главной) ──────────────────────────

async function loadShelvesGoals() {
    const result = await apiGetGoals();
    const goals  = mergeShelvesGoals(result.success ? result.data : []);
    const cards  = document.querySelectorAll('#dd-profile .goal-card');
    const meta   = {
        pages_per_day:   { label: 'Страниц за день', unit: '' },
        minutes_per_day: { label: 'Время чтения',    unit: ' м' },
    };
    goals.forEach((goal, i) => {
        const card = cards[i];
        if (!card) return;
        const m   = meta[goal.goal_type] || { label: goal.goal_type, unit: '' };
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

function mergeShelvesGoals(apiGoals) {
    const defaults = [
        { goal_type: 'pages_per_day',   target_value: 30, current_value: 0 },
        { goal_type: 'minutes_per_day', target_value: 30, current_value: 0 },
    ];
    const byType = Object.fromEntries((apiGoals || []).map(g => [g.goal_type, g]));
    return defaults.map(d => byType[d.goal_type] || d);
}

function setupShelvesGoalEditors() {
    document.querySelectorAll('#dd-profile .goal-card__edit').forEach((btn, i) => {
        btn.type = 'button';
        btn.addEventListener('click', async e => {
            e.preventDefault(); e.stopPropagation();
            const card     = btn.closest('.goal-card');
            const goalType = card?.dataset.goalType || (i === 0 ? 'pages_per_day' : 'minutes_per_day');
            const current  = card?.dataset.targetValue || '30';
            const input    = prompt('Введите целевое значение:', current);
            if (input === null) return;
            const target = parseInt(input, 10);
            if (isNaN(target) || target <= 0) { showToast('Введите положительное число', 'error'); return; }
            const result = await apiCreateGoal(goalType, target);
            if (result.success) { showToast('Цель обновлена', 'success'); await loadShelvesGoals(); }
            else showToast('Ошибка обновления цели', 'error');
        });
    });
}

// ── Загрузка статистики (как на главной) ─────────────────────

let shelvesPeriod = 'week';

async function loadShelvesStats(period) {
    if (period) shelvesPeriod = period;
    const result = await apiGetStats(shelvesPeriod);
    if (!result.success) return;
    const stats = result.data;

    const headerValue = document.querySelector('#dd-stats .stats-header__value');
    if (headerValue) {
        const badge = headerValue.querySelector('.stats-header__badge');
        headerValue.textContent = `${stats.total_pages ?? 0} стр `;
        if (badge) headerValue.appendChild(badge);
    }

    const svg = document.querySelector('#dd-stats .stats-chart__svg');
    if (!svg || !stats.daily_breakdown?.length) return;
    const daily = stats.daily_breakdown;
    const maxP  = Math.max(...daily.map(d => d.pages), 1);
    const W = 480, H = 140;
    const step = W / Math.max(daily.length - 1, 1);
    const pts  = daily.map((d, i) => `${i * step},${H - 20 - (d.pages / maxP) * (H - 40)}`);
    const line = `M${pts.join(' L')}`;
    const area = `${line} L${W},${H} L0,${H} Z`;
    svg.querySelector('path[stroke]')?.setAttribute('d', line);
    svg.querySelector('path[fill^="url"]')?.setAttribute('d', area);

    const labels = document.querySelector('#dd-stats .stats-chart__labels');
    if (labels) {
        const days = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
        labels.innerHTML = daily.slice(-7).map(d => {
            const dt  = new Date(d.date);
            const lbl = daily.length <= 7
                ? days[dt.getDay() === 0 ? 6 : dt.getDay() - 1]
                : `${dt.getDate()}.${dt.getMonth()+1}`;
            return `<span>${lbl}</span>`;
        }).join('');
    }
}

function setupShelvesStatsTabs() {
    document.querySelectorAll('#dd-stats .stats-tab').forEach(tab => {
        tab.addEventListener('click', async () => {
            tab.closest('.stats-tabs')?.querySelectorAll('.stats-tab')
                .forEach(t => t.classList.remove('stats-tab--active'));
            tab.classList.add('stats-tab--active');
            const lbl = tab.textContent.trim();
            const p   = lbl.includes('Месяц') ? 'month' : lbl.includes('Год') ? 'year' : 'week';
            await loadShelvesStats(p);
        });
    });
}

// ── Загрузка и отображение полок ─────────────────────────────

async function enrichShelvesWithCovers(shelves) {
    const booksResult = await apiGetBooks({ page_size: 100 });
    if (!booksResult.success) return shelves;

    const coverMap = {};
    booksResult.data.forEach(b => { if (b.cover_url) coverMap[b.id] = b.cover_url; });

    return shelves.map(shelf => ({
        ...shelf,
        books: (shelf.books || []).map(b => ({
            ...b,
            cover_url: b.cover_url || coverMap[b.id] || null,
        })),
    }));
}

async function loadShelves() {
    const result = await apiGetShelves();
    if (!result.success) { showToast('Ошибка загрузки полок', 'error'); return; }

    const rawShelves = Array.isArray(result.data)
        ? result.data
        : (result.data?.items || result.data?.shelves || []);

    const detailed = await Promise.all(
        rawShelves.map(async shelf => {
            const d = await apiGetShelf(shelf.id);
            return d.success ? d.data : { ...shelf, books: [] };
        })
    );
    const enriched = await enrichShelvesWithCovers(detailed);
    displayShelves(enriched);
}

function displayShelves(shelves) {
    const list = document.getElementById('shelves-list');
    if (!list) return;

    if (!shelves.length) {
        list.innerHTML = `
            <div style="text-align:center;padding:60px 20px;">
                <p style="font-size:48px;margin-bottom:16px;">📚</p>
                <h2 style="color:var(--text-muted);margin-bottom:12px;">У вас пока нет полок</h2>
                <p style="color:var(--text-muted);margin-bottom:24px;">
                    Создайте первую полку для организации книг
                </p>
                <button onclick="openAddShelfModal()"
                        style="padding:12px 28px;background:var(--accent);color:var(--surface);
                               border:none;border-radius:var(--r-pill);cursor:pointer;
                               font-size:15px;font-weight:bold;">
                    Создать полку
                </button>
            </div>`;
        return;
    }

    list.innerHTML = '';
    shelves.forEach(shelf => list.appendChild(createShelfCard(shelf)));
}

function createShelfCard(shelf) {
    const article = document.createElement('article');
    article.className = 'shelf-card';
    article.dataset.shelfId = shelf.id;
    article.dataset.count   = shelf.books?.length ?? shelf.book_count ?? 0;
    article.dataset.date    = shelf.created_at || new Date().toISOString();

    const books     = shelf.books || [];
    const bookCount = books.length;

    const authors = [...new Set(books.map(b => b.author).filter(Boolean))]
        .slice(0, 3).join(', ') || 'Пока пусто';

    const lastBook = books.at(-1);
    const lastText = lastBook
        ? `Последняя добавленная книга:<br><span class="shelf-card__last-title">«${escSh(lastBook.title)}»</span>`
        : 'Добавьте первую книгу на полку';

    // Обложки
    let coversHtml = '';
    if (!bookCount) {
        coversHtml = `
            <div class="shelf-cover shelf-cover--placeholder" aria-hidden="true">📚</div>
            <p class="shelf-empty-hint">Полка пуста</p>`;
    } else {
        coversHtml = books.slice(0, 4).map((b, i) => {
            const fade = i === 3 ? ' shelf-cover--fade' : '';
            const src  = b.cover_url || 'log_img/background_left_part.png';
            return `<img src="${src}" alt="" class="shelf-cover${fade}"
                         onerror="this.src='log_img/background_left_part.png'">`;
        }).join('');
        if (bookCount > 4) {
            coversHtml += `<div class="shelf-cover shelf-cover--count">+${bookCount - 4}</div>`;
        }
    }

    article.innerHTML = `
        <div class="shelf-card__meta">
            <div class="shelf-card__meta-text">
                <h2 class="shelf-card__title">${escSh(shelf.name)}</h2>
                <p class="shelf-card__authors">${escSh(authors)}</p>
                <p class="shelf-card__last">${lastText}</p>
            </div>
        </div>
        <div class="shelf-card__covers-wrap">
            <div class="shelf-card__covers${!bookCount ? ' shelf-card__covers--empty' : ''}"
                 role="button" tabindex="0" aria-label="Открыть полку «${escSh(shelf.name)}»">
                ${coversHtml}
            </div>
        </div>
        <div class="shelf-card__more-wrap">
            <button class="shelf-more-btn" aria-label="Действия с полкой" aria-haspopup="true">•••</button>
            <div class="shelf-ctx-menu" role="menu">
                <button class="shelf-ctx-menu__item" role="menuitem">
                    <span class="shelf-ctx-menu__icon">✏</span> Изменить
                </button>
                <div class="shelf-ctx-menu__sep"></div>
                <button class="shelf-ctx-menu__item shelf-ctx-menu__item--danger" role="menuitem">
                    <span class="shelf-ctx-menu__icon">🗑</span> Удалить
                </button>
            </div>
        </div>`;

    // Контекстное меню
    const moreBtn = article.querySelector('.shelf-more-btn');
    const ctxMenu = article.querySelector('.shelf-ctx-menu');
    const items   = ctxMenu.querySelectorAll('.shelf-ctx-menu__item');

    moreBtn.addEventListener('click', e => {
        e.stopPropagation();
        const isOpen = ctxMenu.classList.contains('shelf-ctx-menu--open');
        closeAllShelfMenus();
        if (!isOpen) ctxMenu.classList.add('shelf-ctx-menu--open');
    });

    items[0].addEventListener('click', e => { e.stopPropagation(); closeAllShelfMenus(); renameShelf(shelf.id); });
    items[1].addEventListener('click', e => { e.stopPropagation(); closeAllShelfMenus(); deleteShelf(shelf.id); });

    // Клик по обложкам — открыть полку
    const coversEl = article.querySelector('.shelf-card__covers');
    coversEl.addEventListener('click', () => openShelf(shelf.id));
    coversEl.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') openShelf(shelf.id);
    });

    return article;
}

// ── Действия с полками ────────────────────────────────────────

async function openShelf(shelfId) {
    const result = await apiGetShelf(shelfId);
    if (!result.success) { showToast('Не удалось открыть полку', 'error'); return; }

    const shelf = result.data;
    // Enrich covers
    const booksResult = await apiGetBooks({ page_size: 100 });
    const coverMap = {};
    if (booksResult.success) {
        booksResult.data.forEach(b => { if (b.cover_url) coverMap[b.id] = b.cover_url; });
    }
    const books = (shelf.books || []).map(b => ({
        ...b,
        cover_url: b.cover_url || coverMap[b.id] || null,
    }));

    const modal = document.createElement('div');
    modal.className = 'modal-overlay modal-overlay--visible';
    modal.id = 'modal-shelf-books';

    const booksHtml = books.length
        ? books.map(b => `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 0;
                        border-bottom:1px solid rgba(255,255,255,.10);">
                <img src="${b.cover_url || 'log_img/background_left_part.png'}" alt=""
                     style="width:40px;height:58px;border-radius:4px;object-fit:cover;flex-shrink:0;"
                     onerror="this.src='log_img/background_left_part.png'">
                <span style="flex:1;font-size:14px;">${escSh(b.title)}</span>
                <button onclick="window.location.href='reader.html?id=${b.id}'"
                        style="padding:6px 14px;background:var(--accent);color:var(--surface);
                               border:none;border-radius:var(--r-pill);cursor:pointer;font-size:13px;
                               font-weight:bold;white-space:nowrap;">Читать</button>
                <button onclick="removeBookFromShelfUi(${shelfId},${b.id})"
                        style="padding:6px 12px;background:rgba(255,255,255,.10);color:var(--text);
                               border:1px solid var(--card-border);border-radius:var(--r-pill);
                               cursor:pointer;font-size:13px;white-space:nowrap;">Убрать</button>
            </div>`).join('')
        : '<p style="color:var(--text-muted);padding:20px 0;">На полке пока нет книг.</p>';

    modal.innerHTML = `
        <div class="modal modal--add-book" style="max-width:560px;">
            <button class="modal__close modal__close--outside"
                    onclick="document.getElementById('modal-shelf-books').remove();document.body.style.overflow='';"
                    aria-label="Закрыть">✕</button>
            <h2 class="add-book__heading" style="margin-bottom:12px;">
                ${escSh(shelf.name)}
                <span style="font-size:16px;color:var(--text-muted);">(${books.length})</span>
            </h2>
            <div style="margin-bottom:14px;">
                <button onclick="addToShelfFromShelves(${shelfId})"
                        style="padding:9px 20px;background:var(--accent);color:var(--surface);
                               border:none;border-radius:var(--r-pill);cursor:pointer;font-size:13px;
                               font-weight:bold;">+ Добавить книгу на полку</button>
            </div>
            <div style="max-height:380px;overflow-y:auto;">${booksHtml}</div>
        </div>`;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    modal.addEventListener('click', e => {
        if (e.target === modal) { modal.remove(); document.body.style.overflow = ''; }
    });
}

async function addToShelfFromShelves(shelfId) {
    // Close the shelf modal first
    document.getElementById('modal-shelf-books')?.remove();
    document.body.style.overflow = '';

    const booksResult = await apiGetBooks({ page_size: 100 });
    if (!booksResult.success) { showToast('Ошибка загрузки книг', 'error'); return; }

    const allBooks = booksResult.data;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay modal-overlay--visible';
    modal.id = 'modal-add-to-shelf';

    const selectedIds = new Set();

    modal.innerHTML = `
        <div class="modal modal--add-book" style="max-width:520px;">
            <button class="modal__close modal__close--outside"
                    onclick="document.getElementById('modal-add-to-shelf').remove();document.body.style.overflow='';"
                    aria-label="Закрыть">✕</button>
            <h2 class="add-book__heading" style="margin-bottom:16px;">Добавить книгу на полку</h2>
            <div class="shelf-books-grid" id="add-to-shelf-grid" style="max-height:300px;overflow-y:auto;
                 display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:2px;margin-bottom:16px;">
            </div>
            <button id="add-to-shelf-confirm"
                    style="width:100%;padding:11px;border-radius:var(--r-pill);border:none;
                           background:var(--accent);color:var(--surface);font-family:inherit;
                           font-size:14px;font-weight:bold;cursor:pointer;opacity:.5;"
                    disabled>Добавить</button>
        </div>`;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    modal.addEventListener('click', e => {
        if (e.target === modal) { modal.remove(); document.body.style.overflow = ''; }
    });

    const grid = modal.querySelector('#add-to-shelf-grid');
    const confirmBtn = modal.querySelector('#add-to-shelf-confirm');

    function renderGrid() {
        grid.innerHTML = allBooks.map(book => {
            const sel = selectedIds.has(book.id);
            const src = book.cover_url || 'log_img/background_left_part.png';
            return `
                <div class="shelf-book-pick${sel ? ' shelf-book-pick--selected' : ''}"
                     data-book-id="${book.id}" title="${escSh(book.title)}"
                     style="position:relative;border-radius:8px;overflow:hidden;cursor:pointer;
                            aspect-ratio:2/3;border:2px solid ${sel ? 'var(--accent)' : 'transparent'};
                            transition:border-color .18s,transform .15s;">
                    <img src="${src}" alt="${escSh(book.title)}"
                         style="width:100%;height:100%;object-fit:cover;display:block;"
                         onerror="this.src='log_img/background_left_part.png'">
                    ${sel ? '<span style="position:absolute;top:4px;right:4px;width:20px;height:20px;border-radius:50%;background:var(--accent);color:var(--surface);font-size:11px;font-weight:bold;display:flex;align-items:center;justify-content:center;">✓</span>' : ''}
                </div>`;
        }).join('');

        grid.querySelectorAll('.shelf-book-pick').forEach(el => {
            el.addEventListener('click', () => {
                const id = parseInt(el.dataset.bookId, 10);
                if (selectedIds.has(id)) selectedIds.delete(id);
                else selectedIds.add(id);
                renderGrid();
                const n = selectedIds.size;
                confirmBtn.disabled = n === 0;
                confirmBtn.style.opacity = n > 0 ? '1' : '.5';
                confirmBtn.textContent = n > 0 ? `Добавить (${n})` : 'Добавить';
            });
        });
    }

    renderGrid();

    confirmBtn.addEventListener('click', async () => {
        if (!selectedIds.size) return;
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Добавление...';
        await Promise.all([...selectedIds].map(bookId => apiAddBookToShelf(shelfId, bookId)));
        showToast(`Добавлено ${selectedIds.size} книг на полку`, 'success');
        modal.remove();
        document.body.style.overflow = '';
        await loadShelves();
    });
}

async function removeBookFromShelfUi(shelfId, bookId) {
    const result = await apiRemoveBookFromShelf(shelfId, bookId);
    if (result.success) {
        showToast('Книга убрана с полки', 'success');
        document.getElementById('modal-shelf-books')?.remove();
        document.body.style.overflow = '';
        await loadShelves();
    } else {
        showToast('Не удалось убрать книгу', 'error');
    }
}

async function deleteShelf(shelfId) {
    if (!confirm('Удалить эту полку?')) return;
    const result = await apiDeleteShelf(shelfId);
    if (result.success) {
        showToast('Полка удалена', 'success');
        await loadShelves();
    } else {
        showToast(formatApiError(result.error) || 'Ошибка удаления полки', 'error');
    }
}

async function renameShelf(shelfId) {
    const name = prompt('Новое название полки:');
    if (!name?.trim()) return;
    const result = await apiRenameShelf(shelfId, name.trim());
    if (result.success) {
        showToast('Полка переименована', 'success');
        await loadShelves();
    } else {
        showToast(formatApiError(result.error) || 'Ошибка переименования', 'error');
    }
}

function closeAllShelfMenus() {
    document.querySelectorAll('.shelf-ctx-menu--open')
        .forEach(m => m.classList.remove('shelf-ctx-menu--open'));
}

document.addEventListener('click', closeAllShelfMenus);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllShelfMenus(); });

// ── Создание полки с выбором книг ────────────────────────────

let _allBooks = [];
let _selectedBookIds = new Set();

function openAddShelfModal() {
    const modal = document.getElementById('modal-add-shelf');
    if (!modal) return;
    modal.classList.add('modal-overlay--visible');
    document.body.style.overflow = 'hidden';
    document.getElementById('shelf-name-input')?.focus();
    _selectedBookIds.clear();
    loadBooksForShelfModal();
}

function closeAddShelfModal() {
    const modal = document.getElementById('modal-add-shelf');
    if (!modal) return;
    modal.classList.remove('modal-overlay--visible');
    document.body.style.overflow = '';
    _selectedBookIds.clear();
}

async function loadBooksForShelfModal() {
    const grid = document.getElementById('shelf-books-grid');
    const countBtn = document.getElementById('shelf-add-books-btn');
    if (!grid) return;

    grid.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Загрузка...</p>';

    const result = await apiGetBooks({ page_size: 50 });
    _allBooks = result.success ? result.data : [];

    if (!_allBooks.length) {
        grid.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">У вас пока нет книг</p>';
        return;
    }

    renderShelfBooksGrid();
    updateShelfAddBtn();
}

function renderShelfBooksGrid() {
    const grid = document.getElementById('shelf-books-grid');
    if (!grid) return;

    grid.innerHTML = _allBooks.map(book => {
        const sel = _selectedBookIds.has(book.id);
        const src = book.cover_url || 'log_img/background_left_part.png';
        return `
            <div class="shelf-book-pick${sel ? ' shelf-book-pick--selected' : ''}"
                 data-book-id="${book.id}"
                 title="${escSh(book.title)}">
                <img src="${src}" alt="${escSh(book.title)}"
                     onerror="this.src='log_img/background_left_part.png'">
                ${sel ? '<span class="shelf-book-pick__check">✓</span>' : ''}
                <span class="shelf-book-pick__num">${sel ? [..._selectedBookIds].indexOf(book.id) + 1 : ''}</span>
            </div>`;
    }).join('');

    grid.querySelectorAll('.shelf-book-pick').forEach(el => {
        el.addEventListener('click', () => {
            const id = parseInt(el.dataset.bookId, 10);
            if (_selectedBookIds.has(id)) {
                _selectedBookIds.delete(id);
            } else {
                _selectedBookIds.add(id);
            }
            renderShelfBooksGrid();
            updateShelfAddBtn();
        });
    });
}

function updateShelfAddBtn() {
    const btn = document.getElementById('shelf-add-books-btn');
    if (!btn) return;
    const n = _selectedBookIds.size;
    btn.textContent = n > 0 ? `Добавить ${n} ${pluralBooks(n)}` : 'Добавить книги';
    btn.disabled = n === 0;
}

function pluralBooks(n) {
    if (n % 10 === 1 && n % 100 !== 11) return 'книгу';
    if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'книги';
    return 'книг';
}

function bindShelfButtons() {
    ['btn-add-shelf', 'bottom-add-shelf-btn', 'mobile-add-shelf-btn'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', openAddShelfModal);
    });
    document.querySelector('.add-shelf-btn')?.addEventListener('click', openAddShelfModal);
    document.querySelector('.add-shelf-btn--compact')?.addEventListener('click', openAddShelfModal);

    document.querySelectorAll('[data-close="modal-add-shelf"]').forEach(btn => {
        btn.addEventListener('click', closeAddShelfModal);
    });
    document.getElementById('modal-add-shelf')?.addEventListener('click', e => {
        if (e.target === document.getElementById('modal-add-shelf')) closeAddShelfModal();
    });

    // Пресеты
    document.querySelectorAll('.shelf-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.shelf-preset-btn')
                .forEach(b => b.classList.remove('shelf-preset-btn--active'));
            btn.classList.add('shelf-preset-btn--active');
            const input = document.getElementById('shelf-name-input');
            if (input) input.value = btn.dataset.name;
        });
    });

    // Кнопка создать
    const submitBtn = document.getElementById('shelf-submit-btn');
    if (submitBtn) {
        const fresh = submitBtn.cloneNode(true);
        submitBtn.replaceWith(fresh);
        fresh.addEventListener('click', handleCreateShelf);
    }

    document.getElementById('shelf-name-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleCreateShelf();
    });

    // Кнопка «Добавить N книг»
    document.getElementById('shelf-add-books-btn')?.addEventListener('click', () => {
        // Просто закрываем — книги добавятся после создания полки
        showToast(`Выбрано ${_selectedBookIds.size} книг`, 'info');
    });
}

async function handleCreateShelf() {
    const nameInput = document.getElementById('shelf-name-input');
    const name = nameInput?.value.trim();

    if (!name) { nameInput?.focus(); showToast('Введите название полки', 'error'); return; }

    const submitBtn = document.getElementById('shelf-submit-btn');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Создание...'; }

    const result = await apiCreateShelf(name);

    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Создать полку'; }

    if (!result.success) {
        showToast(formatApiError(result.error) || 'Ошибка создания полки', 'error');
        return;
    }

    const shelfId = result.data.id;

    // Добавляем выбранные книги
    if (_selectedBookIds.size > 0) {
        await Promise.all(
            [..._selectedBookIds].map(bookId => apiAddBookToShelf(shelfId, bookId))
        );
        showToast(`Полка «${name}» создана с ${_selectedBookIds.size} книгами`, 'success');
    } else {
        showToast(`Полка «${name}» создана`, 'success');
    }

    closeAddShelfModal();
    if (nameInput) nameInput.value = '';
    document.querySelectorAll('.shelf-preset-btn').forEach(b => b.classList.remove('shelf-preset-btn--active'));
    await loadShelves();
}

// ── Toast ─────────────────────────────────────────────────────

function showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `toast toast--${type} toast--visible`;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('toast--visible'), 3000);
}

// ── Вспомогательные ──────────────────────────────────────────

function escSh(str) {
    return String(str || '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatApiError(err) {
    if (!err) return '';
    if (typeof err === 'string') return err;
    if (typeof err.detail === 'string') return err.detail;
    if (Array.isArray(err.detail)) return err.detail.map(e => e.msg || e).join(', ');
    return 'Ошибка сервера';
}

window.openShelf             = openShelf;
window.deleteShelf           = deleteShelf;
window.renameShelf           = renameShelf;
window.removeBookFromShelfUi = removeBookFromShelfUi;
window.openAddShelfModal     = openAddShelfModal;
window.closeAddShelfModal    = closeAddShelfModal;
window.addToShelfFromShelves = addToShelfFromShelves;
