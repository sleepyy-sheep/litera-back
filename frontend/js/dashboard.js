// Интеграция главной страницы (index.html) с API
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📚 Загрузка главной страницы');

    if (!isAuthenticated()) {
        window.location.href = 'log.html';
        return;
    }

    const apiOnline = await apiCheckHealth();
    if (!apiOnline) {
        showToast('Сервер недоступен. Запустите start.bat и откройте через Live Server.', 'error');
    }

    await loadBooks();
    await loadStats();
    await loadGoals();

    setupAddBookButton();
    setupLogoutButton();
    setupSearch();
    setupSortPanel();
    setupStatsTabs();
    setupGoalEditors();
    // Mobile bottom nav handled by mobile-sheets.js
    // Дропдауны шапки управляются инлайн-скриптом в index.html
});

// ============================================================================
// HEADER DROPDOWNS — фиксация по клику, закрытие по повторному клику / вне
// ============================================================================
// ============================================================================
// HEADER DROPDOWNS — управляются инлайн-скриптом в index.html
// Эта функция оставлена пустой чтобы не создавать дублирующих обработчиков
// ============================================================================
function setupHeaderDropdowns() {
    // no-op: логика в инлайн-скрипте index.html
}

// ============================================================================
// ЗАГРУЗКА И ОТОБРАЖЕНИЕ КНИГ
// ============================================================================

async function loadBooks() {
    const result = await apiGetBooks();
    if (result.success) {
        displayBooks(result.data);
        updateMobileContinue(result.data);
    } else {
        showToast(formatApiError(result.error) || 'Ошибка загрузки книг', 'error');
    }
}

function updateMobileContinue(books) {
    if (!books || !books.length) return;

    const sorted = [...books].sort((a, b) => {
        const da = a.uploaded_at ? new Date(a.uploaded_at) : 0;
        const db = b.uploaded_at ? new Date(b.uploaded_at) : 0;
        return db - da;
    });
    const book = sorted[0];
    if (!book) return;

    const titleEl  = document.querySelector('.mobile-continue__book');
    const coverEl  = document.querySelector('.mobile-continue__cover');
    const fillEl   = document.querySelector('.mobile-continue__fill');
    const pctEl    = document.querySelector('.mobile-continue__pct');

    if (titleEl)  titleEl.textContent = book.title || 'Без названия';
    if (coverEl && book.cover_url) {
        coverEl.src = book.cover_url;
        coverEl.onerror = () => { coverEl.src = 'log_img/background_left_part.png'; };
    }

    const pct = book.progress?.percent != null ? Math.round(book.progress.percent) : 0;
    if (fillEl) fillEl.style.width = pct + '%';
    if (pctEl)  pctEl.textContent  = pct + '%';

    const continueBlock = document.querySelector('.mobile-continue');
    if (continueBlock) continueBlock.dataset.bookId = book.id;
}

function displayBooks(books) {
    const bookList = document.getElementById('book-list');
    if (!bookList) return;

    if (!books.length) {
        bookList.innerHTML = `
            <div style="text-align:center;padding:60px 20px;">
                <h2 style="color:var(--text-muted);margin-bottom:16px;">📚 У вас пока нет книг</h2>
                <p style="color:var(--text-muted);margin-bottom:24px;">
                    Добавьте первую книгу, чтобы начать отслеживать прогресс чтения
                </p>
                <button id="btn-empty-add-book"
                        style="padding:12px 24px;background:var(--accent);color:var(--surface);
                               border:none;border-radius:var(--r-pill);cursor:pointer;font-size:15px;font-weight:bold;">
                    Добавить книгу
                </button>
            </div>`;
        document.getElementById('btn-empty-add-book')
            ?.addEventListener('click', () => document.getElementById('btn-add-book')?.click());
        return;
    }

    bookList.innerHTML = '';
    books.forEach(book => bookList.appendChild(createBookCard(book)));
}

function createBookCard(book) {
    const article = document.createElement('article');
    article.className = 'book-card';
    article.dataset.bookId  = book.id;
    article.dataset.title   = book.title || '';
    article.dataset.author  = book.author || '';
    article.dataset.genre   = book.genre || '';
    article.dataset.date    = book.uploaded_at || new Date().toISOString();

    const progress    = book.progress || {};
    const currentPage = progress.current_page || 0;
    const totalPages  = book.total_pages || 0;
    const percent     = progress.percent != null
        ? Math.round(progress.percent)
        : (totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0);

    article.dataset.progress = percent;

    const uploadDate   = book.uploaded_at ? new Date(book.uploaded_at) : new Date();
    const formattedDate = uploadDate.toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric' });
    const coverUrl     = book.cover_url || 'log_img/background_left_part.png';

    article.innerHTML = `
        <div class="book-card__check-circle" aria-hidden="true"><span>✓</span></div>
        <img src="${coverUrl}" alt="Обложка «${escapeHtml(book.title)}»" class="book-card__cover"
             onerror="this.src='log_img/background_left_part.png'">
        <div class="book-card__info">
            <h2 class="book-card__title">${escapeHtml(book.title)}</h2>
            <p class="book-card__author">${escapeHtml(book.author || 'Неизвестный автор')}</p>
            <p class="book-card__genre">${escapeHtml(book.genre || 'Без жанра')}</p>
            <div class="reading-progress" aria-label="Прогресс ${percent}%">
                <div class="reading-progress__bar" role="progressbar"
                     aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
                    <div class="reading-progress__fill" style="width:${percent}%"></div>
                </div>
                <span class="reading-progress__label">${percent}%</span>
            </div>
            <p class="book-card__date">Последнее открытие: ${formattedDate}</p>
            <a href="#" class="book-card__note-link"
               onclick="openNotes(${book.id}); return false;">Добавьте заметку</a>
        </div>
        <div class="book-card__actions">
            <div class="more-wrap">
                <button class="more-btn" aria-label="Дополнительные действия" aria-haspopup="true">•••</button>
                <div class="ctx-menu" role="menu">
                    <button class="ctx-menu__item ctx-action-edit" role="menuitem"
                            onclick="editBook(${book.id})">
                        <span class="ctx-menu__icon">✏</span> Изменить
                    </button>
                    <div class="ctx-menu__sep"></div>
                    <button class="ctx-menu__item ctx-action-shelf" role="menuitem"
                            onclick="addToShelf(${book.id})">
                        <span class="ctx-menu__icon">✓</span> На полку
                    </button>
                    <div class="ctx-menu__sep"></div>
                    <button class="ctx-menu__item ctx-menu__item--danger ctx-action-delete"
                            role="menuitem" onclick="deleteBook(${book.id})">
                        <span class="ctx-menu__icon">🗑</span> Удалить
                    </button>
                </div>
            </div>
            <button class="play-btn" aria-label="Продолжить чтение"
                    onclick="openBook(${book.id}); event.stopPropagation();">
                <img src="log_img/play-svgrepo-com.svg" alt="" aria-hidden="true">
            </button>
        </div>`;

    return article;
}

// ============================================================================
// ДЕЙСТВИЯ С КНИГАМИ
// ============================================================================

function openBook(bookId) {
    // Открываем встроенную читалку, а не PDF-редактор браузера
    window.location.href = `reader.html?id=${bookId}`;
}

async function deleteBook(bookId) {
    bookId = Number(bookId);
    const ok = await confirmModal({
        title: 'Удалить книгу?',
        message: 'Это действие нельзя отменить. Книга и весь прогресс чтения будут удалены навсегда.',
        confirmText: 'Удалить',
        cancelText: 'Отмена',
        danger: true,
    });
    if (!ok) return;

    showToast('Удаление книги...', 'info');
    const result = await apiDeleteBook(bookId);

    if (result.success) {
        showToast('Книга удалена', 'success');
        const card = document.querySelector(`[data-book-id="${bookId}"]`);
        if (card) {
            card.style.transition = 'opacity .3s, transform .3s';
            card.style.opacity = '0';
            card.style.transform = 'translateX(-20px)';
            setTimeout(() => { card.remove(); }, 320);
        } else {
            await loadBooks();
        }
    } else {
        const msg = formatApiError(result.error);
        showToast(msg || 'Ошибка удаления книги', 'error');
        console.error('Delete error:', result);
    }
}

// ── Mobile book action sheet ──────────────────────────────────
function openBookActionSheet(bookId, bookTitle) {
    // Remove any existing sheet
    document.getElementById('mobile-book-action-sheet')?.remove();

    const sheet = document.createElement('div');
    sheet.id = 'mobile-book-action-sheet';
    sheet.className = 'mobile-bottom-sheet';
    sheet.innerHTML = `
        <div class="mobile-bottom-sheet__backdrop"></div>
        <div class="mobile-bottom-sheet__content">
            <div class="mobile-bottom-sheet__handle"></div>
            <h3 class="mobile-bottom-sheet__title" style="font-size:15px;padding:14px 0 10px;">
                ${escapeHtml(bookTitle)}
            </h3>
            <div style="display:flex;flex-direction:column;gap:8px;padding-bottom:8px;">
                <button class="book-action-sheet-btn" id="sheet-btn-read">
                    <span style="font-size:18px;">▶</span> Читать
                </button>
                <button class="book-action-sheet-btn" id="sheet-btn-edit">
                    <span style="font-size:18px;">✏</span> Изменить
                </button>
                <button class="book-action-sheet-btn" id="sheet-btn-shelf">
                    <span style="font-size:18px;">📚</span> На полку
                </button>
                <button class="book-action-sheet-btn book-action-sheet-btn--danger" id="sheet-btn-delete">
                    <span style="font-size:18px;">🗑</span> Удалить
                </button>
            </div>
        </div>`;
    document.body.appendChild(sheet);

    const close = () => {
        sheet.classList.remove('mobile-bottom-sheet--open');
        document.body.style.overflow = '';
        setTimeout(() => sheet.remove(), 320);
    };

    sheet.addEventListener('click', e => {
        if (e.target === sheet || e.target.classList.contains('mobile-bottom-sheet__backdrop')) close();
    });

    sheet.querySelector('#sheet-btn-read').addEventListener('click', () => {
        close(); openBook(bookId);
    });
    sheet.querySelector('#sheet-btn-edit').addEventListener('click', () => {
        close(); editBook(bookId);
    });
    sheet.querySelector('#sheet-btn-shelf').addEventListener('click', () => {
        close(); addToShelf(bookId);
    });
    sheet.querySelector('#sheet-btn-delete').addEventListener('click', () => {
        close(); deleteBook(bookId);
    });

    // Trigger open animation
    requestAnimationFrame(() => {
        sheet.classList.add('mobile-bottom-sheet--open');
        document.body.style.overflow = 'hidden';
    });
}

async function editBook(bookId) {
    bookId = Number(bookId);
    const result = await apiGetBook(bookId);
    if (!result.success) { showToast('Ошибка загрузки данных книги', 'error'); return; }

    const book = result.data;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay modal-overlay--visible';
    modal.id = 'modal-edit-book';
    modal.innerHTML = `
        <div class="modal modal--add-book" style="max-width:480px;">
            <button class="modal__close modal__close--outside" id="close-edit-book-modal"
                    aria-label="Закрыть">✕</button>
            <h2 class="add-book__heading" style="margin-bottom:20px;">Редактировать книгу</h2>
            <div class="add-book__fields">
                <label class="modal__shelf-label" style="display:block;margin-bottom:8px;">Название</label>
                <input type="text" id="edit-book-title" value="${escapeHtml(book.title || '')}"
                       class="modal__shelf-input" style="margin-bottom:14px;">
                <label class="modal__shelf-label" style="display:block;margin-bottom:8px;">Автор</label>
                <input type="text" id="edit-book-author" value="${escapeHtml(book.author || '')}"
                       class="modal__shelf-input" style="margin-bottom:14px;">
                <label class="modal__shelf-label" style="display:block;margin-bottom:8px;">Жанр</label>
                <input type="text" id="edit-book-genre" value="${escapeHtml(book.genre || '')}"
                       class="modal__shelf-input" style="margin-bottom:20px;">
                <div style="display:flex;gap:10px;justify-content:flex-end;">
                    <button id="edit-book-cancel" class="modal__shelf-cancel">Отмена</button>
                    <button id="edit-book-save"   class="modal__shelf-submit">Сохранить</button>
                </div>
            </div>
        </div>`;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    const closeEditModal = () => { modal.remove(); document.body.style.overflow = ''; };

    modal.querySelector('#close-edit-book-modal').addEventListener('click', closeEditModal);
    modal.querySelector('#edit-book-cancel').addEventListener('click', closeEditModal);
    modal.querySelector('#edit-book-save').addEventListener('click', () => saveBookEdit(bookId, modal));
    modal.addEventListener('click', e => { if (e.target === modal) closeEditModal(); });

    // Enter to save
    modal.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') saveBookEdit(bookId, modal); });
    });
}

async function saveBookEdit(bookId, modal) {
    const title  = document.getElementById('edit-book-title')?.value.trim();
    const author = document.getElementById('edit-book-author')?.value.trim();
    const genre  = document.getElementById('edit-book-genre')?.value.trim();

    if (!title) { showToast('Название не может быть пустым', 'error'); return; }

    const saveBtn = modal?.querySelector('#edit-book-save');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Сохранение...'; }

    const result = await apiUpdateBook(bookId, { title, author, genre });

    if (result.success) {
        showToast('Книга обновлена', 'success');
        modal?.remove();
        document.body.style.overflow = '';
        await loadBooks();
    } else {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Сохранить'; }
        showToast(formatApiError(result.error) || 'Ошибка обновления', 'error');
    }
}

// ============================================================================
// ПОЛКИ — выбор и добавление книги
// ============================================================================

async function addToShelf(bookId) {
    bookId = Number(bookId);
    const result = await apiGetShelves();

    if (!result.success) {
        showToast(formatApiError(result.error) || 'Ошибка загрузки полок', 'error');
        return;
    }

    const shelves = Array.isArray(result.data) ? result.data
        : (result.data?.items || result.data?.shelves || []);

    const modal = document.createElement('div');
    modal.className = 'modal-overlay modal-overlay--visible';
    modal.id = 'modal-select-shelf';

    let shelvesHtml = '';
    if (!shelves.length) {
        shelvesHtml = `
            <p style="color:var(--text-muted);margin-bottom:16px;">У вас пока нет полок.</p>
            <button id="btn-create-shelf-add" class="modal__shelf-submit" style="width:100%;">
                + Создать полку и добавить
            </button>`;
    } else {
        shelvesHtml = shelves.map(shelf => `
            <button data-shelf-id="${shelf.id}"
                    style="display:flex;align-items:center;gap:10px;width:100%;padding:12px 14px;
                           margin-bottom:8px;background:rgba(255,255,255,.08);
                           border:1px solid var(--card-border);border-radius:var(--r-md);
                           cursor:pointer;text-align:left;color:var(--text);font-family:inherit;
                           font-size:14px;transition:background .15s;">
                <span style="font-size:18px;">📚</span>
                <span>${escapeHtml(shelf.name)}</span>
                <span style="margin-left:auto;color:var(--text-muted);font-size:12px;">
                    ${shelf.book_count ?? (shelf.books?.length ?? 0)} книг
                </span>
            </button>`).join('');
        shelvesHtml += `
            <button id="btn-create-shelf-add"
                    style="display:flex;align-items:center;gap:10px;width:100%;padding:12px 14px;
                           background:transparent;border:1px dashed rgba(255,255,255,.25);
                           border-radius:var(--r-md);cursor:pointer;color:var(--text-muted);
                           font-family:inherit;font-size:14px;margin-top:4px;">
                <span style="font-size:18px;">+</span> Создать новую полку
            </button>`;
    }

    modal.innerHTML = `
        <div class="modal modal--add-book" style="max-width:420px;">
            <button class="modal__close modal__close--outside" id="close-select-shelf-modal"
                    aria-label="Закрыть">✕</button>
            <h2 class="add-book__heading" style="margin-bottom:20px;">Выберите полку</h2>
            <div style="max-height:360px;overflow-y:auto;">${shelvesHtml}</div>
        </div>`;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    const closeModal = () => { modal.remove(); document.body.style.overflow = ''; };

    modal.querySelector('#close-select-shelf-modal').addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    // Клик по полке
    modal.querySelectorAll('[data-shelf-id]').forEach(btn => {
        btn.addEventListener('mouseover', () => { btn.style.background = 'rgba(255,255,255,.16)'; });
        btn.addEventListener('mouseout',  () => { btn.style.background = 'rgba(255,255,255,.08)'; });
        btn.addEventListener('click', () => addBookToShelfConfirm(bookId, Number(btn.dataset.shelfId)));
    });

    // Создать новую полку
    modal.querySelector('#btn-create-shelf-add')?.addEventListener('click', () => createShelfAndAdd(bookId));
}

async function addBookToShelfConfirm(bookId, shelfId) {
    // Закрываем модал выбора полки
    const sel = document.getElementById('modal-select-shelf');
    if (sel) { sel.remove(); document.body.style.overflow = ''; }

    const result = await apiAddBookToShelf(shelfId, bookId);

    if (result.success) {
        showToast('Книга добавлена на полку', 'success');
    } else {
        const msg = formatApiError(result.error);
        showToast(msg || 'Ошибка добавления на полку', 'error');
    }
}

async function createShelfAndAdd(bookId) {
    document.getElementById('modal-select-shelf')?.remove();
    document.body.style.overflow = '';

    // Красивый модал вместо prompt()
    const name = await inputModal({
        title: 'Создать новую полку',
        placeholder: 'Название полки',
        confirmText: 'Создать',
        cancelText: 'Отмена',
        maxLength: 40,
    });
    if (!name?.trim()) return;

    const createResult = await apiCreateShelf(name.trim());
    if (!createResult.success) {
        showToast(formatApiError(createResult.error) || 'Ошибка создания полки', 'error');
        return;
    }

    const shelfId = createResult.data.id;
    await addBookToShelfConfirm(bookId, shelfId);
}

// ============================================================================
// ДОБАВЛЕНИЕ КНИГИ — парсинг метаданных + одно диалоговое окно
// ============================================================================

// Показывает статус внутри модала добавления книги вместо toast
function showModalStatus(msg, type = 'info') {
    const el = document.getElementById('add-book-status');
    if (!el) { showToast(msg, type); return; }
    el.textContent = msg;
    el.className = `modal-status modal-status--${type}`;
    el.style.display = 'block';
    if (type !== 'error') {
        clearTimeout(el._timer);
        el._timer = setTimeout(() => { el.style.display = 'none'; }, 4000);
    }
}

function hideModalStatus() {
    const el = document.getElementById('add-book-status');
    if (el) { el.style.display = 'none'; el.textContent = ''; }
}

function setupAddBookButton() {
    const addBookBtn = document.getElementById('btn-add-book');
    const modal      = document.getElementById('modal-add-book');
    const fileInput  = document.getElementById('add-book-file');
    const dropZone   = document.getElementById('add-book-drop');
    const submitBtn  = document.querySelector('.add-book__submit');

    if (!addBookBtn || !modal) return;

    // Открытие модала
    addBookBtn.addEventListener('click', () => {
        modal.classList.add('modal-overlay--visible');
        document.body.style.overflow = 'hidden';
    });

    // Mobile bottom nav "Добавить" button
    const mobileAddBtn = document.getElementById('bottom-add-btn');
    if (mobileAddBtn) {
        mobileAddBtn.addEventListener('click', () => {
            modal.classList.add('modal-overlay--visible');
            document.body.style.overflow = 'hidden';
        });
    }

    // Закрытие
    modal.querySelectorAll('[data-close]').forEach(btn =>
        btn.addEventListener('click', closeAddBookModal));
    modal.addEventListener('click', e => { if (e.target === modal) closeAddBookModal(); });

    // ── Зона загрузки файла ──────────────────────────────────
    if (dropZone && fileInput) {
        // Клик на зону → открываем file picker ОДИН РАЗ
        dropZone.addEventListener('click', e => {
            // Если клик пришёл от самого input — игнорируем (предотвращаем двойной вызов)
            if (e.target === fileInput) return;
            fileInput.click();
        });

        // Останавливаем всплытие от input чтобы не триггерить dropZone click
        fileInput.addEventListener('click', e => e.stopPropagation());

        // Выбор файла через диалог
        fileInput.addEventListener('change', async e => {
            const file = e.target.files[0];
            if (file) await onFileSelected(file);
        });

        // Drag & Drop
        dropZone.addEventListener('dragover', e => {
            e.preventDefault();
            dropZone.classList.add('add-book__file-zone--drag');
        });
        dropZone.addEventListener('dragleave', () =>
            dropZone.classList.remove('add-book__file-zone--drag'));
        dropZone.addEventListener('drop', async e => {
            e.preventDefault();
            dropZone.classList.remove('add-book__file-zone--drag');
            const file = e.dataTransfer.files[0];
            if (file) await onFileSelected(file);
        });
    }

    // Кнопка «Добавить книгу»
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            const file = fileInput?.files[0];
            if (!file) {
                showModalStatus('Сначала выберите файл книги', 'error');
                return;
            }
            await handleBookUpload(file);
        });
    }
}

// Вызывается при выборе файла — показывает превью и парсит метаданные
async function onFileSelected(file) {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    const allowed = ['.pdf', '.epub', '.fb2'];
    if (!allowed.includes(ext)) {
        showModalStatus(`Неподдерживаемый формат. Разрешены: ${allowed.join(', ')}`, 'error');
        return;
    }

    // Показываем имя файла
    const dropZone = document.getElementById('add-book-drop');
    if (dropZone) {
        dropZone.querySelector('.add-book__file-name')?.remove();
        dropZone.querySelector('.add-book__cover-preview')?.remove();
        const label = document.createElement('p');
        label.className = 'add-book__file-name';
        label.textContent = file.name;
        dropZone.appendChild(label);
        dropZone.style.borderColor = 'var(--accent)';
    }

    // Показываем поля метаданных
    const metaFields = document.getElementById('add-book-meta-fields');
    if (metaFields) metaFields.style.display = 'flex';

    // Парсим метаданные из файла
    showModalStatus('Читаем метаданные файла...', 'info');
    try {
        const meta = await extractBookMetadata(file);

        const titleInput  = document.getElementById('add-book-title-input');
        const authorInput = document.getElementById('add-book-author-input');

        if (titleInput)  titleInput.value  = meta.title  || file.name.replace(/\.[^/.]+$/, '');
        if (authorInput) authorInput.value = meta.author || '';

        // Показываем обложку в зоне загрузки
        if (meta.coverUrl && dropZone) {
            dropZone.querySelector('.add-book__file-name')?.remove();
            const img = document.createElement('img');
            img.className = 'add-book__cover-preview';
            img.src = meta.coverUrl;
            img.alt = 'Обложка';
            dropZone.appendChild(img);
        }

        if (meta.title || meta.author) {
            showModalStatus(`Метаданные загружены: ${meta.title || file.name}`, 'success');
        } else {
            showModalStatus(`Файл выбран: ${file.name}`, 'success');
        }
    } catch (e) {
        console.warn('Не удалось прочитать метаданные:', e);
        const titleInput = document.getElementById('add-book-title-input');
        if (titleInput && !titleInput.value) {
            titleInput.value = file.name.replace(/\.[^/.]+$/, '');
        }
        showModalStatus(`Файл выбран: ${file.name}`, 'success');
    }
}

// ── Парсинг метаданных из файла ──────────────────────────────
async function extractBookMetadata(file) {
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (ext === '.epub') return extractEpubMetadata(file);
    if (ext === '.fb2')  return extractFb2Metadata(file);
    if (ext === '.pdf')  return extractPdfMetadata(file);
    return { title: '', author: '', coverUrl: null };
}

async function extractEpubMetadata(file) {
    // Загружаем JSZip если нужно
    if (!window.JSZip) {
        await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    }
    const ab  = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(ab);

    // container.xml → OPF path
    const containerXml = await zip.file('META-INF/container.xml')?.async('text');
    if (!containerXml) return { title: '', author: '', coverUrl: null };

    const containerDoc = new DOMParser().parseFromString(containerXml, 'text/xml');
    const opfPath = containerDoc.querySelector('rootfile')?.getAttribute('full-path');
    if (!opfPath) return { title: '', author: '', coverUrl: null };

    const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
    const opfXml = await zip.file(opfPath)?.async('text');
    if (!opfXml) return { title: '', author: '', coverUrl: null };

    const opfDoc = new DOMParser().parseFromString(opfXml, 'text/xml');

    // Название и автор
    const title  = opfDoc.querySelector('metadata > *|title,  metadata title')?.textContent?.trim()   || '';
    const author = opfDoc.querySelector('metadata > *|creator, metadata creator')?.textContent?.trim() || '';

    // Обложка
    let coverUrl = null;
    const manifest = {};
    opfDoc.querySelectorAll('manifest item').forEach(item => {
        manifest[item.getAttribute('id')] = item.getAttribute('href');
    });

    const coverMeta = opfDoc.querySelector('meta[name="cover"]');
    const coverId   = coverMeta?.getAttribute('content');
    const coverHref = coverId ? manifest[coverId] : null;

    // Также ищем по id="cover-image" или properties="cover-image"
    const coverItem = opfDoc.querySelector('manifest item[id="cover-image"], manifest item[properties~="cover-image"]');
    const coverHref2 = coverItem?.getAttribute('href');

    const finalHref = coverHref || coverHref2;
    if (finalHref) {
        const coverFile = zip.file(opfDir + finalHref) || zip.file(finalHref);
        if (coverFile) {
            const blob = await coverFile.async('blob');
            coverUrl = URL.createObjectURL(blob);
        }
    }

    return { title, author, coverUrl };
}

async function extractFb2Metadata(file) {
    const text = await file.text();
    const doc  = new DOMParser().parseFromString(text, 'text/xml');

    const title  = doc.querySelector('book-title')?.textContent?.trim() || '';
    const first  = doc.querySelector('first-name')?.textContent?.trim()  || '';
    const last   = doc.querySelector('last-name')?.textContent?.trim()   || '';
    const author = [first, last].filter(Boolean).join(' ');

    // Обложка из base64
    let coverUrl = null;
    const coverpage = doc.querySelector('coverpage image');
    if (coverpage) {
        const href = coverpage.getAttribute('l:href') || coverpage.getAttribute('xlink:href') || '';
        const id   = href.replace('#', '');
        const bin  = doc.querySelector(`binary[id="${id}"]`);
        if (bin) {
            const ct   = bin.getAttribute('content-type') || 'image/jpeg';
            const b64  = bin.textContent.trim().replace(/\s/g, '');
            coverUrl   = `data:${ct};base64,${b64}`;
        }
    }

    return { title, author, coverUrl };
}

async function extractPdfMetadata(file) {
    // PDF метаданные через pdf.js
    try {
        if (!window.pdfjsLib) {
            await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
        const ab  = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
        const meta = await pdf.getMetadata();
        const info = meta?.info || {};

        // Обложка — первая страница как превью
        let coverUrl = null;
        try {
            const page     = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 0.5 });
            const canvas   = document.createElement('canvas');
            canvas.width   = viewport.width;
            canvas.height  = viewport.height;
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
            coverUrl = canvas.toDataURL('image/jpeg', 0.7);
        } catch (_) {}

        return {
            title:    info.Title  || '',
            author:   info.Author || '',
            coverUrl,
        };
    } catch (e) {
        console.warn('PDF metadata error:', e);
        return { title: '', author: '', coverUrl: null };
    }
}

function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const s = document.createElement('script');
        s.src = src; s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
    });
}

// Показываем имя выбранного файла в зоне загрузки (legacy — оставляем для совместимости)
function setSelectedFile(file) { onFileSelected(file); }

async function handleBookUpload(file) {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!['.pdf', '.epub', '.fb2'].includes(ext)) {
        showModalStatus('Неподдерживаемый формат файла', 'error');
        return;
    }

    if (!(await apiCheckHealth())) {
        showModalStatus('Сервер недоступен. Запустите start.bat', 'error');
        return;
    }

    // Берём название и автора из полей (могут быть заполнены автоматически)
    const titleInput  = document.getElementById('add-book-title-input');
    const authorInput = document.getElementById('add-book-author-input');
    const customTitle  = titleInput?.value.trim()  || null;
    const customAuthor = authorInput?.value.trim() || null;

    const genre   = document.querySelector('.genre-tag.genre-tag--active')?.dataset.genre || null;
    const notes   = document.querySelector('.add-book__textarea')?.value.trim() || null;
    const submitBtn = document.querySelector('.add-book__submit');

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Загрузка...'; }
    showModalStatus('Загрузка книги, подождите...', 'info');

    // Загружаем книгу с метаданными
    const result = await apiUploadBookWithMeta(file, { title: customTitle, author: customAuthor, genre, notes });

    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Добавить книгу'; }

    if (result.success) {
        const bookTitle = result.data.title || customTitle || file.name;

        // Загружаем обложку если есть превью — ЖДЁМ завершения перед обновлением списка
        const coverPreview = document.querySelector('.add-book__cover-preview');
        if (coverPreview?.src && result.data.id) {
            await uploadCoverFromPreview(result.data.id, coverPreview.src);
        }

        closeAddBookModal();
        resetAddBookForm();
        showToast(`✅ Книга «${bookTitle}» успешно добавлена!`, 'success');
        await loadBooks();
    } else {
        const msg = formatApiError(result.error);
        showModalStatus(msg || 'Ошибка загрузки книги', 'error');
        console.error('Upload error:', result);
    }
}

// Загрузка обложки из data URL или blob URL
async function uploadCoverFromPreview(bookId, src) {
    try {
        let blob;
        if (src.startsWith('data:')) {
            const res = await fetch(src);
            blob = await res.blob();
        } else if (src.startsWith('blob:')) {
            const res = await fetch(src);
            blob = await res.blob();
        } else {
            return;
        }

        const formData = new FormData();
        formData.append('file', blob, 'cover.jpg');

        await apiRequest(`/books/${bookId}/cover`, {
            method: 'POST',
            body: formData,
        });
        console.log('✅ Обложка загружена для книги', bookId);
    } catch (e) {
        console.warn('Не удалось загрузить обложку:', e);
    }
}

function resetAddBookForm() {
    const fileInput = document.getElementById('add-book-file');
    if (fileInput) fileInput.value = '';

    const dropZone = document.getElementById('add-book-drop');
    if (dropZone) {
        dropZone.querySelector('.add-book__file-name')?.remove();
        dropZone.querySelector('.add-book__cover-preview')?.remove();
        dropZone.style.borderColor = '';
    }

    const metaFields = document.getElementById('add-book-meta-fields');
    if (metaFields) metaFields.style.display = 'none';

    const titleInput  = document.getElementById('add-book-title-input');
    const authorInput = document.getElementById('add-book-author-input');
    if (titleInput)  titleInput.value  = '';
    if (authorInput) authorInput.value = '';

    const textarea = document.querySelector('.add-book__textarea');
    if (textarea) textarea.value = '';

    document.querySelectorAll('.genre-tag').forEach(t => t.classList.remove('genre-tag--active'));
}

function closeAddBookModal() {
    const modal = document.getElementById('modal-add-book');
    if (modal) modal.classList.remove('modal-overlay--visible');
    document.body.style.overflow = '';
    hideModalStatus();
}

// Выбор жанра в модале
document.addEventListener('click', e => {
    if (e.target.classList.contains('genre-tag')) {
        document.querySelectorAll('.genre-tag').forEach(t => t.classList.remove('genre-tag--active'));
        e.target.classList.add('genre-tag--active');
    }
});

// ============================================================================
// ЗАМЕТКИ
// ============================================================================

async function openNotes(bookId) {
    bookId = Number(bookId);
    const bookResult  = await apiGetBook(bookId);
    const title       = bookResult.success ? bookResult.data.title : 'Книга';
    const notesResult = await apiGetNotes(bookId);
    const notes       = notesResult.success ? notesResult.data : [];

    const modal = document.createElement('div');
    modal.className = 'modal-overlay modal-overlay--visible';
    modal.id = 'modal-notes';
    modal.innerHTML = `
        <div class="modal modal--add-book" style="max-width:520px;">
            <button class="modal__close modal__close--outside" id="close-notes-modal"
                    aria-label="Закрыть">✕</button>
            <h2 class="add-book__heading" style="margin-bottom:16px;">
                Заметки: ${escapeHtml(title)}
            </h2>
            <div id="notes-list" style="max-height:240px;overflow-y:auto;margin-bottom:16px;"></div>
            <textarea id="note-new-text" class="add-book__textarea" rows="3"
                      placeholder="Новая заметка..."></textarea>
            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px;">
                <button id="btn-notes-close" class="modal__shelf-cancel">Закрыть</button>
                <button id="btn-notes-add"   class="modal__shelf-submit">Добавить</button>
            </div>
        </div>`;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    modal.querySelector('#close-notes-modal').addEventListener('click', closeNotesModal);
    modal.querySelector('#btn-notes-close').addEventListener('click', closeNotesModal);
    modal.querySelector('#btn-notes-add').addEventListener('click', () => saveNewNote(bookId));
    modal.querySelector('#note-new-text').addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.ctrlKey) saveNewNote(bookId);
    });
    modal.addEventListener('click', e => { if (e.target === modal) closeNotesModal(); });

    renderNotesList(bookId, notes);
}

function renderNotesList(bookId, notes) {
    const list = document.getElementById('notes-list');
    if (!list) return;
    if (!notes.length) {
        list.innerHTML = '<p style="color:var(--text-muted);">Заметок пока нет</p>';
        return;
    }
    list.innerHTML = notes.map(note => `
        <div data-note-id="${note.id}"
             style="padding:10px;margin-bottom:8px;background:rgba(255,255,255,.08);border-radius:var(--r-sm);">
            <p style="margin:0 0 8px;white-space:pre-wrap;">${escapeHtml(note.text)}</p>
            <button data-delete-note="${note.id}"
                    style="font-size:12px;color:#e07070;background:none;border:none;cursor:pointer;">
                Удалить
            </button>
        </div>`).join('');

    // Event delegation для удаления заметок
    list.querySelectorAll('[data-delete-note]').forEach(btn => {
        btn.addEventListener('click', () => deleteNoteConfirm(bookId, Number(btn.dataset.deleteNote)));
    });
}

async function saveNewNote(bookId) {
    const text = document.getElementById('note-new-text')?.value.trim();
    if (!text) { showToast('Введите текст заметки', 'error'); return; }
    const result = await apiCreateNote(bookId, text);
    if (result.success) {
        document.getElementById('note-new-text').value = '';
        const r = await apiGetNotes(bookId);
        if (r.success) renderNotesList(bookId, r.data);
        showToast('Заметка сохранена', 'success');
    } else {
        showToast('Не удалось сохранить заметку', 'error');
    }
}

async function deleteNoteConfirm(bookId, noteId) {
    const ok = await confirmModal({
        title: 'Удалить заметку?',
        message: 'Заметка будет удалена без возможности восстановления.',
        confirmText: 'Удалить',
        cancelText: 'Отмена',
        danger: true,
    });
    if (!ok) return;
    const result = await apiDeleteNote(bookId, noteId);
    if (result.success) {
        const r = await apiGetNotes(bookId);
        if (r.success) renderNotesList(bookId, r.data);
        showToast('Заметка удалена', 'success');
    } else {
        showToast('Не удалось удалить заметку', 'error');
    }
}

function closeNotesModal() {
    document.getElementById('modal-notes')?.remove();
    document.body.style.overflow = '';
}

// ============================================================================
// СТАТИСТИКА И ЦЕЛИ
// ============================================================================

let currentStatsPeriod = 'week';

async function loadStats(period = currentStatsPeriod) {
    currentStatsPeriod = period;
    const result = await apiGetStats(period);
    if (!result.success) return;

    const stats = result.data;
    const headerValue = document.querySelector('.stats-header__value');
    if (headerValue) {
        const badge = headerValue.querySelector('.stats-header__badge');
        headerValue.textContent = `${stats.total_pages ?? 0} стр `;
        if (badge) headerValue.appendChild(badge);
    }
    updateStatsChart(stats.daily_breakdown || []);
}

function updateStatsChart(daily) {
    const svg = document.querySelector('.stats-chart__svg');
    if (!svg || !daily.length) return;

    const maxPages = Math.max(...daily.map(d => d.pages), 1);
    const W = 480, H = 140;
    const step = W / Math.max(daily.length - 1, 1);

    const points = daily.map((d, i) => {
        const x = i * step;
        const y = H - 20 - (d.pages / maxPages) * (H - 40);
        return `${x},${y}`;
    });

    const line = `M${points.join(' L')}`;
    const area = `${line} L${W},${H} L0,${H} Z`;

    svg.querySelector('path[stroke]')?.setAttribute('d', line);
    svg.querySelector('path[fill^="url"]')?.setAttribute('d', area);

    const labels = document.querySelector('.stats-chart__labels');
    if (labels) {
        const days = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
        labels.innerHTML = daily.slice(-7).map(d => {
            const dt = new Date(d.date);
            const lbl = daily.length <= 7
                ? days[dt.getDay() === 0 ? 6 : dt.getDay() - 1]
                : `${dt.getDate()}.${dt.getMonth()+1}`;
            return `<span>${lbl}</span>`;
        }).join('');
    }
}

function mergeGoalsWithDefaults(apiGoals) {
    const defaults = [
        { goal_type: 'pages_per_day',   target_value: 30, current_value: 0 },
        { goal_type: 'minutes_per_day', target_value: 30, current_value: 0 },
    ];
    const byType = Object.fromEntries((apiGoals || []).map(g => [g.goal_type, g]));
    return defaults.map(d => byType[d.goal_type] || d);
}

async function loadGoals() {
    const result = await apiGetGoals();
    const goals  = mergeGoalsWithDefaults(result.success ? result.data : []);
    const cards  = document.querySelectorAll('#dd-profile .goal-card');
    const meta   = {
        pages_per_day:   { label: 'Страниц за день', unit: '' },
        minutes_per_day: { label: 'Время чтения',    unit: ' м' },
    };

    goals.forEach((goal, i) => {
        const card = cards[i];
        if (!card) return;
        const m = meta[goal.goal_type] || { label: goal.goal_type, unit: '' };
        const pct = goal.target_value > 0
            ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100)) : 0;

        card.querySelector('.goal-card__label') && (card.querySelector('.goal-card__label').textContent = m.label);
        card.querySelector('.goal-card__value') && (card.querySelector('.goal-card__value').textContent =
            `${goal.current_value}${m.unit} / ${goal.target_value}${m.unit}`);
        const fill = card.querySelector('.goal-card__bar-fill');
        if (fill) fill.style.width = `${pct}%`;
        card.dataset.goalType    = goal.goal_type;
        card.dataset.targetValue = goal.target_value;
    });

    // Update "Прогресс за день" ring — average of all goals progress
    updateDayProgressRing(goals);
}

function updateDayProgressRing(goals) {
    if (!goals || !goals.length) return;

    // Average percent across all goals
    const totalPct = goals.reduce((sum, g) => {
        const pct = g.target_value > 0
            ? Math.min(100, (g.current_value / g.target_value) * 100) : 0;
        return sum + pct;
    }, 0);
    const avgPct = Math.round(totalPct / goals.length);

    // Update text
    const valueEl = document.querySelector('.day-progress__value');
    if (valueEl) valueEl.textContent = avgPct + '%';

    // Update SVG ring: circumference = 2π×32 ≈ 201
    const circumference = 2 * Math.PI * 32; // ≈ 201
    const offset = circumference - (avgPct / 100) * circumference;
    const ringEl = document.querySelector('.day-progress__fill-ring');
    if (ringEl) {
        ringEl.style.strokeDasharray  = circumference.toFixed(1);
        ringEl.style.strokeDashoffset = offset.toFixed(1);
    }
}

function setupStatsTabs() {
    document.querySelectorAll('.stats-tab').forEach(tab => {
        tab.addEventListener('click', async () => {
            tab.closest('.stats-tabs')?.querySelectorAll('.stats-tab')
                .forEach(t => t.classList.remove('stats-tab--active'));
            tab.classList.add('stats-tab--active');
            const lbl = tab.textContent.trim();
            const period = lbl.includes('Месяц') ? 'month' : lbl.includes('Год') ? 'year' : 'week';
            await loadStats(period);
        });
    });
}

function setupGoalEditors() {
    document.querySelectorAll('#dd-profile .goal-card__edit').forEach((btn, i) => {
        btn.type = 'button';
        btn.addEventListener('click', async e => {
            e.preventDefault(); e.stopPropagation();
            const card     = btn.closest('.goal-card');
            const goalType = card?.dataset.goalType || (i === 0 ? 'pages_per_day' : 'minutes_per_day');
            const current  = parseInt(card?.dataset.targetValue || '30', 10);

            const target = await editGoalModal({ goalType, current });
            if (target === null) return;
            if (isNaN(target) || target <= 0) { showToast('Введите положительное число', 'error'); return; }

            const result = await apiCreateGoal(goalType, target);
            if (result.success) { showToast('Цель обновлена', 'success'); await loadGoals(); }
            else showToast(formatApiError(result.error) || 'Ошибка обновления цели', 'error');
        });
    });
}

// ============================================================================
// ПОИСК И СОРТИРОВКА
// ============================================================================

function setupSearch() {
    const input = document.getElementById('search-input');
    if (!input) return;
    let timer;
    input.addEventListener('input', e => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
            const q = e.target.value.trim();
            if (!q) { await loadBooks(); return; }
            const r = await apiSearchBooks(q);
            if (r.success) displayBooks(r.data);
        }, 300);
    });
}

function setupSortPanel() {
    document.querySelectorAll('.sort-pair-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const type = btn.dataset.sort;
            const dir  = btn.dataset.dir;
            document.querySelectorAll(`.sort-pair-btn[data-sort="${type}"]`)
                .forEach(b => b.classList.remove('sort-pair-btn--active'));
            btn.classList.add('sort-pair-btn--active');

            if (type === 'alpha' || type === 'date') {
                const field = type === 'alpha' ? 'title' : 'uploaded_at';
                const r = await apiGetBooks({ sort: field });
                if (r.success) {
                    let books = r.data;
                    if (dir === 'desc') books = [...books].reverse();
                    displayBooks(books);
                }
            } else if (type === 'progress') {
                const r = await apiGetBooks();
                if (r.success) {
                    const sorted = [...r.data].sort((a, b) => {
                        const pa = a.progress?.percent ?? 0;
                        const pb = b.progress?.percent ?? 0;
                        return dir === 'asc' ? pa - pb : pb - pa;
                    });
                    displayBooks(sorted);
                }
            }
        });
    });

    // Фильтр по жанру (поле ввода)
    const genreInput = document.getElementById('genre-search');
    if (genreInput) {
        let timer;
        genreInput.addEventListener('input', e => {
            clearTimeout(timer);
            timer = setTimeout(async () => {
                const val = e.target.value.trim();
                const r = await apiGetBooks(val ? { genre: val } : {});
                if (r.success) displayBooks(r.data);
            }, 300);
        });
    }

    // Чипы жанров
    document.querySelectorAll('.genre-chip').forEach(chip => {
        chip.addEventListener('click', async () => {
            document.querySelectorAll('.genre-chip').forEach(c => c.classList.remove('genre-chip--active'));
            chip.classList.add('genre-chip--active');
            const filter = chip.dataset.genreFilter;
            const r = await apiGetBooks(filter !== 'all' ? { genre: filter } : {});
            if (r.success) displayBooks(r.data);
            const gi = document.getElementById('genre-search');
            if (gi) gi.value = filter !== 'all' ? filter : '';
        });
    });
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ
// ============================================================================

function setupLogoutButton() {
    document.querySelectorAll('[data-logout]').forEach(btn => {
        btn.addEventListener('click', () => logout());
    });
}

function showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `toast toast--${type} toast--visible`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('toast--visible'), 3200);
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

