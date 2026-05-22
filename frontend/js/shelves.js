// Интеграция страницы полок (shelves.html) с API
document.addEventListener('DOMContentLoaded', async () => {
    if (!isAuthenticated()) {
        window.location.href = 'log.html';
        return;
    }

    await loadShelves();
    setupCreateShelfButton();
});

async function loadShelves() {
    const result = await apiGetShelves();

    if (!result.success) {
        showToast('Ошибка загрузки полок', 'error');
        if (result.error?.detail?.toString().toLowerCase().includes('auth')) {
            setTimeout(() => { window.location.href = 'log.html'; }, 2000);
        }
        return;
    }

    const shelves = result.data || [];
    const detailed = await Promise.all(
        shelves.map(async (shelf) => {
            const detail = await apiGetShelf(shelf.id);
            return detail.success ? detail.data : { ...shelf, books: [] };
        })
    );

    displayShelves(detailed);
}

function displayShelves(shelves) {
    const shelfList = document.getElementById('shelves-list');
    if (!shelfList) return;

    if (shelves.length === 0) {
        shelfList.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                <h2 style="color: var(--text-secondary); margin-bottom: 20px;">📚 У вас пока нет полок</h2>
                <p style="color: var(--text-tertiary); margin-bottom: 30px;">
                    Создайте свою первую полку для организации книг
                </p>
                <button onclick="document.getElementById('btn-add-shelf').click()"
                        style="padding: 12px 24px; background: var(--accent); color: white;
                               border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
                    Создать полку
                </button>
            </div>
        `;
        return;
    }

    shelfList.innerHTML = '';
    shelves.forEach(shelf => {
        shelfList.appendChild(createShelfCard(shelf));
    });
}

function createShelfCard(shelf) {
    const article = document.createElement('article');
    article.className = 'shelf-card';
    article.dataset.shelfId = shelf.id;
    article.dataset.count = shelf.books ? shelf.books.length : shelf.book_count || 0;
    article.dataset.date = shelf.created_at || new Date().toISOString();

    const books = shelf.books || [];
    const bookCount = books.length;

    const authors = books
        .map(book => book.author)
        .filter((author, index, self) => author && self.indexOf(author) === index)
        .slice(0, 3)
        .join(', ');

    const authorsText = authors || 'Пока пусто';

    const coverUrls = books
        .slice(0, 4)
        .map(book => book.cover_url || 'log_img/background_left_part.png');

    let coversHtml = '';
    if (bookCount === 0) {
        coversHtml = `
            <div class="shelf-cover shelf-cover--placeholder" aria-hidden="true">📚</div>
            <p class="shelf-empty-hint">Добавьте первую книгу</p>
        `;
    } else {
        coversHtml = coverUrls.map((url, index) => {
            const fadeClass = index === 3 ? ' shelf-cover--fade' : '';
            return `<img src="${url}" alt="" class="shelf-cover${fadeClass}"
                         onerror="this.src='log_img/background_left_part.png'">`;
        }).join('');

        if (bookCount > 4) {
            coversHtml += `<div class="shelf-cover shelf-cover--more" aria-hidden="true">
                <span>+${bookCount - 4}</span>
            </div>`;
        }
    }

    const lastBook = books.length > 0 ? books[books.length - 1] : null;
    const lastBookText = lastBook
        ? `Последняя добавленная книга: <span class="shelf-card__last-title">«${lastBook.title}»</span>`
        : 'Добавьте первую книгу на полку';

    article.innerHTML = `
        <div class="shelf-card__head">
            <div class="shelf-card__head-text">
                <h2 class="shelf-card__title">${shelf.name}</h2>
                <p class="shelf-card__authors">${authorsText}</p>
            </div>
            <div class="shelf-card__more-wrap">
                <button class="shelf-more-btn" aria-label="Действия с полкой" aria-haspopup="true">•••</button>
                <div class="shelf-ctx-menu" role="menu">
                    <button class="shelf-ctx-menu__item" role="menuitem"
                            onclick="renameShelf(${shelf.id})">
                        <span class="shelf-ctx-menu__icon">✏</span> Переименовать
                    </button>
                    <div class="shelf-ctx-menu__sep"></div>
                    <button class="shelf-ctx-menu__item shelf-ctx-menu__item--danger"
                            role="menuitem" onclick="deleteShelf(${shelf.id})">
                        <span class="shelf-ctx-menu__icon">🗑</span> Удалить полку
                    </button>
                </div>
            </div>
        </div>
        <div class="shelf-card__covers-wrap">
            <div class="shelf-card__covers${bookCount === 0 ? ' shelf-card__covers--empty' : ''}"
                 tabindex="0" aria-label="Обложки на полке, всего ${bookCount} книг"
                 onclick="openShelf(${shelf.id})">
                ${coversHtml}
            </div>
        </div>
        <p class="shelf-card__last">${lastBookText}</p>
    `;

    const moreBtn = article.querySelector('.shelf-more-btn');
    moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = article.querySelector('.shelf-ctx-menu');
        const isOpen = menu.classList.contains('shelf-ctx-menu--open');
        closeAllShelfMenus();
        if (!isOpen) menu.classList.add('shelf-ctx-menu--open');
    });

    return article;
}

async function openShelf(shelfId) {
    const result = await apiGetShelf(shelfId);
    if (!result.success) {
        showToast('Не удалось открыть полку', 'error');
        return;
    }

    const shelf = result.data;
    const books = shelf.books || [];

    const modal = document.createElement('div');
    modal.className = 'modal-overlay modal-overlay--visible';
    modal.id = 'modal-shelf-books';

    const booksHtml = books.length
        ? books.map(book => `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.1);">
                <span style="flex:1;color:var(--text-primary);">«${book.title}»</span>
                <button onclick="openBookFromShelf(${book.id})"
                        style="padding:6px 12px;background:var(--accent);color:#fff;border:none;border-radius:4px;cursor:pointer;">
                    Читать
                </button>
                <button onclick="removeBookFromShelfUi(${shelfId}, ${book.id})"
                        style="padding:6px 12px;background:#ccc;border:none;border-radius:4px;cursor:pointer;">
                    Убрать
                </button>
            </div>
        `).join('')
        : '<p style="color:var(--text-tertiary);">На полке пока нет книг. Добавьте книги со страницы «Книги».</p>';

    modal.innerHTML = `
        <div class="modal modal--add-book" style="max-width:560px;">
            <button class="modal__close modal__close--outside" onclick="closeShelfBooksModal()" aria-label="Закрыть">✕</button>
            <h2 style="margin-bottom:16px;color:var(--text-primary);">${shelf.name} (${books.length})</h2>
            <div style="max-height:400px;overflow-y:auto;">${booksHtml}</div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    modal.addEventListener('click', (e) => { if (e.target === modal) closeShelfBooksModal(); });
}

function openBookFromShelf(bookId) {
    window.open(`reader.html?id=${bookId}`, '_blank');
}

async function removeBookFromShelfUi(shelfId, bookId) {
    const result = await apiRemoveBookFromShelf(shelfId, bookId);
    if (result.success) {
        showToast('Книга убрана с полки', 'success');
        closeShelfBooksModal();
        await loadShelves();
    } else {
        showToast('Не удалось убрать книгу', 'error');
    }
}

function closeShelfBooksModal() {
    const modal = document.getElementById('modal-shelf-books');
    if (modal) modal.remove();
    document.body.style.overflow = '';
}

async function deleteShelf(shelfId) {
    if (!confirm('Вы уверены, что хотите удалить эту полку?')) return;

    const result = await apiDeleteShelf(shelfId);
    if (result.success) {
        showToast('Полка удалена', 'success');
        await loadShelves();
    } else {
        showToast('Ошибка удаления полки', 'error');
    }
    closeAllShelfMenus();
}

async function renameShelf(shelfId) {
    const newName = prompt('Введите новое название полки:');
    if (!newName || !newName.trim()) return;

    const result = await apiRenameShelf(shelfId, newName.trim());
    if (result.success) {
        showToast('Полка переименована', 'success');
        await loadShelves();
    } else {
        showToast('Ошибка переименования', 'error');
    }
    closeAllShelfMenus();
}

function closeAllShelfMenus() {
    document.querySelectorAll('.shelf-ctx-menu--open').forEach(menu => {
        menu.classList.remove('shelf-ctx-menu--open');
    });
}

function setupCreateShelfButton() {
    const submitBtn = document.getElementById('shelf-submit-btn');
    if (!submitBtn) return;

    const newBtn = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newBtn, submitBtn);

    newBtn.addEventListener('click', async () => {
        const nameInput = document.getElementById('shelf-name-input');
        const name = nameInput?.value.trim();
        if (!name) {
            nameInput?.focus();
            return;
        }

        const result = await apiCreateShelf(name);
        if (result.success) {
            showToast(`Полка «${name}» создана`, 'success');
            const modal = document.getElementById('modal-add-shelf');
            if (modal) {
                modal.classList.remove('modal-overlay--visible');
                document.body.style.overflow = '';
            }
            if (nameInput) nameInput.value = '';
            document.querySelectorAll('.shelf-preset-btn').forEach(btn => {
                btn.classList.remove('shelf-preset-btn--active');
            });
            await loadShelves();
        } else {
            const msg = typeof result.error?.detail === 'string'
                ? result.error.detail
                : 'Ошибка создания полки';
            showToast(msg, 'error');
        }
    });
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    const colors = {
        success: '#4caf50',
        error: '#f44336',
        info: '#2196f3',
        warning: '#ff9800',
    };

    toast.textContent = message;
    toast.style.backgroundColor = colors[type] || colors.info;
    toast.classList.add('toast--visible');
    setTimeout(() => toast.classList.remove('toast--visible'), 2800);
}

window.openShelf = openShelf;
window.deleteShelf = deleteShelf;
window.renameShelf = renameShelf;
window.openBookFromShelf = openBookFromShelf;
window.removeBookFromShelfUi = removeBookFromShelfUi;
window.closeShelfBooksModal = closeShelfBooksModal;
