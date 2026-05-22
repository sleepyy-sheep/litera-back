// Интеграция главной страницы (index.html) с API
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📚 Загрузка главной страницы');

    // Проверка авторизации
    if (!isAuthenticated()) {
        console.log('❌ Пользователь не авторизован, перенаправление на страницу входа');
        window.location.href = 'log.html';
        return;
    }

    const apiOnline = await apiCheckHealth();
    if (!apiOnline) {
        showToast(
            'Сервер недоступен. Запустите start.bat в корне проекта и откройте страницу через Live Server.',
            'error'
        );
    }

    // Загрузка книг
    await loadBooks();

    // Загрузка статистики
    await loadStats();

    // Загрузка целей
    await loadGoals();

    // Обработчик кнопки "Добавить книгу"
    setupAddBookButton();

    // Обработчик кнопки выхода (если есть)
    setupLogoutButton();

    // Поиск и сортировка
    setupSearch();
    setupSortPanel();

    // Виджеты шапки: цели и статистика
    setupStatsTabs();
    setupGoalEditors();
});

// ============================================================================
// ЗАГРУЗКА КНИГ
// ============================================================================

async function loadBooks() {
    console.log('📖 Загрузка книг...');
    
    const result = await apiGetBooks();
    
    if (result.success) {
        displayBooks(result.data);
    } else {
        console.error('❌ Ошибка загрузки книг:', result.error);
        showToast(formatApiError(result.error) || 'Ошибка загрузки книг', 'error');
    }
}

function displayBooks(books) {
    const bookList = document.getElementById('book-list');
    if (!bookList) {
        console.warn('⚠️ Элемент book-list не найден');
        return;
    }

    if (books.length === 0) {
        bookList.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                <h2 style="color: var(--text-secondary); margin-bottom: 20px;">
                    📚 У вас пока нет книг
                </h2>
                <p style="color: var(--text-tertiary); margin-bottom: 30px;">
                    Добавьте свою первую книгу, чтобы начать отслеживать прогресс чтения
                </p>
                <button onclick="document.getElementById('btn-add-book').click()" 
                        style="padding: 12px 24px; background: var(--accent); color: white; 
                               border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
                    Добавить книгу
                </button>
            </div>
        `;
        return;
    }

    // Очищаем список и добавляем книги из API
    bookList.innerHTML = '';
    
    books.forEach(book => {
        const bookCard = createBookCard(book);
        bookList.appendChild(bookCard);
    });

    console.log(`✅ Отображено ${books.length} книг`);
}

function createBookCard(book) {
    const article = document.createElement('article');
    article.className = 'book-card';
    article.dataset.bookId = book.id;
    article.dataset.title = book.title || 'Без названия';
    article.dataset.author = book.author || 'Неизвестный автор';
    article.dataset.genre = book.genre || 'Без жанра';
    
    // Вычисляем прогресс
    const progress = book.progress || {};
    const currentPage = progress.current_page || 0;
    const totalPages = book.total_pages || 0;
    const percent = progress.percent != null
        ? Math.round(progress.percent)
        : (totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0);

    article.dataset.progress = percent;
    article.dataset.page = currentPage;
    article.dataset.total = totalPages || '';
    article.dataset.date = book.uploaded_at || new Date().toISOString();

    // Форматируем дату
    const uploadDate = book.uploaded_at ? new Date(book.uploaded_at) : new Date();
    const formattedDate = uploadDate.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    const coverUrl = book.cover_url || 'log_img/background_left_part.png';

    article.innerHTML = `
        <div class="book-card__check-circle" aria-hidden="true"><span>✓</span></div>
        <img src="${coverUrl}" alt="Обложка «${book.title}»" class="book-card__cover" 
             onerror="this.src='log_img/background_left_part.png'">
        <div class="book-card__info">
            <h2 class="book-card__title">${book.title}</h2>
            <p class="book-card__author">${book.author || 'Неизвестный автор'}</p>
            <p class="book-card__genre">${book.genre || 'Без жанра'}</p>
            <div class="reading-progress" aria-label="Прогресс ${percent}%">
                <div class="reading-progress__bar" role="progressbar" 
                     aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
                    <div class="reading-progress__fill" style="width:${percent}%"></div>
                </div>
                <span class="reading-progress__label">${percent}%</span>
            </div>
            <p class="book-card__date">Последнее открытие: ${formattedDate}</p>
            <a href="#" class="book-card__note-link" onclick="openNotes(${book.id}); return false;">
                Добавьте заметку
            </a>
        </div>
        <div class="book-card__actions">
            <div class="more-wrap">
                <button class="more-btn" aria-label="Дополнительные действия" aria-haspopup="true">•••</button>
                <div class="ctx-menu" role="menu" aria-label="Действия с книгой">
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
                    onclick="openBook(${book.id})">
                <img src="log_img/play-svgrepo-com.svg" alt="" aria-hidden="true">
            </button>
        </div>
    `;

    return article;
}

// ============================================================================
// ДЕЙСТВИЯ С КНИГАМИ
// ============================================================================

async function openBook(bookId) {
    console.log('📖 Открытие книги:', bookId);
    
    // Открываем книгу в нашей читалке
    window.open(`reader.html?id=${bookId}`, '_blank');
}

async function deleteBook(bookId) {
    if (!confirm('Вы уверены, что хотите удалить эту книгу?')) {
        return;
    }

    console.log('🗑️ Удаление книги:', bookId);
    
    const result = await apiDeleteBook(bookId);
    
    if (result.success) {
        showToast('Книга удалена', 'success');
        // Перезагружаем список книг
        await loadBooks();
    } else {
        showToast('Ошибка удаления книги', 'error');
    }
}

async function editBook(bookId) {
    console.log('✏️ Редактирование книги:', bookId);
    
    // Получаем данные книги
    const result = await apiGetBook(bookId);
    if (!result.success) {
        showToast('Ошибка загрузки данных книги', 'error');
        return;
    }
    
    const book = result.data;
    
    // Создаем модальное окно редактирования
    const modal = document.createElement('div');
    modal.className = 'modal-overlay modal-overlay--visible';
    modal.id = 'modal-edit-book';
    modal.innerHTML = `
        <div class="modal modal--add-book">
            <button class="modal__close modal__close--outside" onclick="closeEditModal()" aria-label="Закрыть">✕</button>
            <h2 style="margin-bottom: 20px; color: var(--text-primary);">Редактировать книгу</h2>
            <div class="add-book__fields">
                <label style="display: block; margin-bottom: 10px; color: var(--text-primary);">
                    Название книги
                    <input type="text" id="edit-book-title" value="${book.title || ''}" 
                           style="width: 100%; padding: 10px; margin-top: 5px; border: 1px solid #ccc; border-radius: 4px;">
                </label>
                <label style="display: block; margin-bottom: 20px; color: var(--text-primary);">
                    Жанр
                    <input type="text" id="edit-book-genre" value="${book.genre || ''}" 
                           style="width: 100%; padding: 10px; margin-top: 5px; border: 1px solid #ccc; border-radius: 4px;">
                </label>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="closeEditModal()" 
                            style="padding: 10px 20px; background: #ccc; border: none; border-radius: 4px; cursor: pointer;">
                        Отмена
                    </button>
                    <button onclick="saveBookEdit(${bookId})" 
                            style="padding: 10px 20px; background: var(--accent); color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Сохранить
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Закрытие по клику вне модального окна
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeEditModal();
        }
    });
}

async function saveBookEdit(bookId) {
    const title = document.getElementById('edit-book-title').value.trim();
    const genre = document.getElementById('edit-book-genre').value.trim();
    
    if (!title) {
        showToast('Название книги не может быть пустым', 'error');
        return;
    }
    
    const updates = { title, genre };
    const result = await apiUpdateBook(bookId, updates);
    
    if (result.success) {
        showToast('Книга обновлена', 'success');
        closeEditModal();
        await loadBooks();
    } else {
        showToast('Ошибка обновления книги', 'error');
    }
}

function closeEditModal() {
    const modal = document.getElementById('modal-edit-book');
    if (modal) {
        modal.remove();
    }
}

async function addToShelf(bookId) {
    console.log('📚 Добавление книги на полку:', bookId);
    
    // Загружаем список полок
    const result = await apiGetShelves();
    if (!result.success) {
        showToast('Ошибка загрузки полок', 'error');
        return;
    }
    
    const shelves = result.data;
    
    if (shelves.length === 0) {
        showToast('Сначала создайте полку на странице "Полки"', 'info');
        return;
    }
    
    // Создаем модальное окно выбора полки
    const modal = document.createElement('div');
    modal.className = 'modal-overlay modal-overlay--visible';
    modal.id = 'modal-select-shelf';
    
    const shelvesHtml = shelves.map(shelf => `
        <button onclick="addBookToShelfConfirm(${bookId}, ${shelf.id})" 
                style="display: block; width: 100%; padding: 12px; margin-bottom: 10px; 
                       background: var(--bg-secondary); border: 1px solid #ccc; 
                       border-radius: 4px; cursor: pointer; text-align: left; color: var(--text-primary);">
            📚 ${shelf.name} (${shelf.book_count != null ? shelf.book_count : (shelf.books?.length || 0)} книг)
        </button>
    `).join('');
    
    modal.innerHTML = `
        <div class="modal modal--add-book">
            <button class="modal__close modal__close--outside" onclick="closeShelfModal()" aria-label="Закрыть">✕</button>
            <h2 style="margin-bottom: 20px; color: var(--text-primary);">Выберите полку</h2>
            <div style="max-height: 400px; overflow-y: auto;">
                ${shelvesHtml}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Закрытие по клику вне модального окна
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeShelfModal();
        }
    });
}

async function addBookToShelfConfirm(bookId, shelfId) {
    const result = await apiAddBookToShelf(shelfId, bookId);
    
    if (result.success) {
        showToast('Книга добавлена на полку', 'success');
        closeShelfModal();
    } else {
        showToast('Ошибка добавления книги на полку', 'error');
    }
}

function closeShelfModal() {
    const modal = document.getElementById('modal-select-shelf');
    if (modal) {
        modal.remove();
    }
}

async function openNotes(bookId) {
    const bookResult = await apiGetBook(bookId);
    const title = bookResult.success ? bookResult.data.title : 'Книга';

    const notesResult = await apiGetNotes(bookId);
    const notes = notesResult.success ? notesResult.data : [];

    const modal = document.createElement('div');
    modal.className = 'modal-overlay modal-overlay--visible';
    modal.id = 'modal-notes';
    modal.innerHTML = `
        <div class="modal modal--add-book" style="max-width: 520px;">
            <button class="modal__close modal__close--outside" onclick="closeNotesModal()" aria-label="Закрыть">✕</button>
            <h2 style="margin-bottom: 16px; color: var(--text-primary);">Заметки: ${title}</h2>
            <div id="notes-list" style="max-height: 240px; overflow-y: auto; margin-bottom: 16px;"></div>
            <textarea id="note-new-text" class="add-book__textarea" rows="3"
                      placeholder="Новая заметка..." aria-label="Текст заметки"></textarea>
            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 12px;">
                <button onclick="closeNotesModal()"
                        style="padding: 10px 20px; background: #ccc; border: none; border-radius: 4px; cursor: pointer;">
                    Закрыть
                </button>
                <button onclick="saveNewNote(${bookId})"
                        style="padding: 10px 20px; background: var(--accent); color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Добавить
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    modal.addEventListener('click', (e) => { if (e.target === modal) closeNotesModal(); });
    renderNotesList(bookId, notes);
}

function renderNotesList(bookId, notes) {
    const list = document.getElementById('notes-list');
    if (!list) return;

    if (!notes.length) {
        list.innerHTML = '<p style="color: var(--text-tertiary);">Заметок пока нет</p>';
        return;
    }

    list.innerHTML = notes.map(note => `
        <div class="note-item" data-note-id="${note.id}" style="padding: 10px; margin-bottom: 8px; background: var(--bg-secondary); border-radius: 6px;">
            <p style="margin: 0 0 8px; color: var(--text-primary); white-space: pre-wrap;">${escapeHtml(note.text)}</p>
            <button onclick="deleteNoteConfirm(${bookId}, ${note.id})"
                    style="font-size: 12px; color: #c33; background: none; border: none; cursor: pointer;">
                Удалить
            </button>
        </div>
    `).join('');
}

async function saveNewNote(bookId) {
    const textarea = document.getElementById('note-new-text');
    const text = textarea?.value.trim();
    if (!text) {
        showToast('Введите текст заметки', 'error');
        return;
    }
    const result = await apiCreateNote(bookId, text);
    if (result.success) {
        textarea.value = '';
        const notesResult = await apiGetNotes(bookId);
        if (notesResult.success) renderNotesList(bookId, notesResult.data);
        showToast('Заметка сохранена', 'success');
    } else {
        showToast('Не удалось сохранить заметку', 'error');
    }
}

async function deleteNoteConfirm(bookId, noteId) {
    const result = await apiDeleteNote(bookId, noteId);
    if (result.success) {
        const notesResult = await apiGetNotes(bookId);
        if (notesResult.success) renderNotesList(bookId, notesResult.data);
        showToast('Заметка удалена', 'success');
    } else {
        showToast('Не удалось удалить заметку', 'error');
    }
}

function closeNotesModal() {
    const modal = document.getElementById('modal-notes');
    if (modal) modal.remove();
    document.body.style.overflow = '';
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ============================================================================
// ДОБАВЛЕНИЕ КНИГИ
// ============================================================================

function setupAddBookButton() {
    const addBookBtn = document.getElementById('btn-add-book');
    const modal = document.getElementById('modal-add-book');
    const fileInput = document.getElementById('add-book-file');
    const dropZone = document.getElementById('add-book-drop');

    if (!addBookBtn || !modal) {
        console.warn('⚠️ Кнопка добавления книги или модальное окно не найдены');
        return;
    }

    // Открытие модального окна
    addBookBtn.addEventListener('click', () => {
        modal.classList.add('modal-overlay--visible');
        document.body.style.overflow = 'hidden';
    });

    const closeButtons = modal.querySelectorAll('[data-close]');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => closeAddBookModal());
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeAddBookModal();
    });

    const submitBtn = document.querySelector('.add-book__submit');
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            const file = fileInput?.files[0];
            if (!file) {
                showToast('Выберите файл книги', 'error');
                return;
            }
            await handleBookUpload(file);
        });
    }

    // Drag & Drop
    if (dropZone) {
        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--accent)';
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.style.borderColor = '';
        });

        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '';
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                await handleBookUpload(files[0]);
            }
        });
    }

    // Выбор файла через input
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (files.length > 0) {
                await handleBookUpload(files[0]);
            }
        });
    }
}

async function handleBookUpload(file) {
    console.log('📤 Загрузка файла:', file.name);

    if (!(await apiCheckHealth())) {
        showToast('Сервер недоступен. Запустите start.bat', 'error');
        return;
    }

    // Проверка типа файла
    const allowedTypes = ['.pdf', '.epub', '.fb2'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!allowedTypes.includes(fileExt)) {
        showToast(`Неподдерживаемый формат файла. Разрешены: ${allowedTypes.join(', ')}`, 'error');
        return;
    }

    // Получаем выбранный жанр
    const selectedGenreBtn = document.querySelector('.genre-tag.genre-tag--active');
    const genre = selectedGenreBtn ? selectedGenreBtn.dataset.genre : null;

    // Получаем заметки
    const notesTextarea = document.querySelector('.add-book__textarea');
    const notes = notesTextarea ? notesTextarea.value.trim() : null;

    // Показываем индикатор загрузки
    showToast('Загрузка книги...', 'info');

    // Загружаем книгу
    const result = await apiUploadBook(file, genre, notes);

    if (result.success) {
        showToast(`Книга "${result.data.title}" успешно добавлена!`, 'success');
        
        closeAddBookModal();

        // Очищаем форму
        if (notesTextarea) notesTextarea.value = '';
        const fileInput = document.getElementById('add-book-file');
        if (fileInput) fileInput.value = '';

        // Перезагружаем список книг
        await loadBooks();
    } else {
        showToast(formatApiError(result.error) || 'Ошибка загрузки книги', 'error');
    }
}

// Обработчик выбора жанра
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('genre-tag')) {
        // Убираем активный класс у всех
        document.querySelectorAll('.genre-tag').forEach(tag => {
            tag.classList.remove('genre-tag--active');
        });
        // Добавляем активный класс выбранному
        e.target.classList.add('genre-tag--active');
    }
});

// ============================================================================
// СТАТИСТИКА И ЦЕЛИ
// ============================================================================

let currentStatsPeriod = 'week';

async function loadStats(period = currentStatsPeriod) {
    currentStatsPeriod = period;
    const result = await apiGetStats(period);

    if (!result.success) {
        console.warn('⚠️ Не удалось загрузить статистику');
        return;
    }

    const stats = result.data;
    const headerValue = document.querySelector('.stats-header__value');
    if (headerValue) {
        headerValue.innerHTML = `${stats.total_pages} стр`;
    }

    updateStatsChart(stats.daily_breakdown || []);
}

function updateStatsChart(dailyBreakdown) {
    const svg = document.querySelector('.stats-chart__svg');
    if (!svg || !dailyBreakdown.length) return;

    const maxPages = Math.max(...dailyBreakdown.map(d => d.pages), 1);
    const width = 480;
    const height = 140;
    const step = width / Math.max(dailyBreakdown.length - 1, 1);

    const points = dailyBreakdown.map((day, i) => {
        const x = i * step;
        const y = height - 20 - (day.pages / maxPages) * (height - 40);
        return `${x},${y}`;
    });

    const linePath = `M${points.join(' L')}`;
    const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

    const line = svg.querySelector('path[stroke]');
    const area = svg.querySelector('path[fill^="url"]');
    if (line) line.setAttribute('d', linePath);
    if (area) area.setAttribute('d', areaPath);

    const labels = document.querySelector('.stats-chart__labels');
    if (labels) {
        const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        labels.innerHTML = dailyBreakdown
            .slice(-7)
            .map((d, i) => {
                const date = new Date(d.date);
                const label = dailyBreakdown.length <= 7
                    ? dayNames[date.getDay() === 0 ? 6 : date.getDay() - 1]
                    : `${date.getDate()}.${date.getMonth() + 1}`;
                return `<span>${label}</span>`;
            })
            .join('');
    }
}

function mergeGoalsWithDefaults(apiGoals) {
    const defaults = [
        { goal_type: 'pages_per_day', target_value: 30, current_value: 0 },
        { goal_type: 'minutes_per_day', target_value: 30, current_value: 0 },
    ];
    const byType = Object.fromEntries((apiGoals || []).map((g) => [g.goal_type, g]));
    return defaults.map((d) => byType[d.goal_type] || d);
}

async function loadGoals() {
    const result = await apiGetGoals();

    let goals = mergeGoalsWithDefaults([]);

    if (!result.success) {
        console.warn('⚠️ Не удалось загрузить цели:', result.error);
        showToast(formatApiError(result.error) || 'Не удалось загрузить цели', 'error');
    } else {
        goals = mergeGoalsWithDefaults(result.data);
    }
    const goalCards = document.querySelectorAll('#dd-profile .goal-card');
    const mapping = {
        pages_per_day: { label: 'Страниц за день', unit: '' },
        minutes_per_day: { label: 'Время чтения', unit: ' м' },
    };

    goals.forEach((goal, index) => {
        const card = goalCards[index];
        if (!card) return;

        const meta = mapping[goal.goal_type] || { label: goal.goal_type, unit: '' };
        const labelEl = card.querySelector('.goal-card__label');
        const valueEl = card.querySelector('.goal-card__value');
        const barFill = card.querySelector('.goal-card__bar-fill');

        if (labelEl) labelEl.textContent = meta.label;
        if (valueEl) {
            valueEl.textContent = `${goal.current_value}${meta.unit} / ${goal.target_value}${meta.unit}`;
        }
        if (barFill) {
            const pct = goal.target_value > 0
                ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100))
                : 0;
            barFill.style.width = `${pct}%`;
        }

        card.dataset.goalType = goal.goal_type;
        card.dataset.targetValue = goal.target_value;
    });
}

function setupStatsTabs() {
    document.querySelectorAll('.stats-tab').forEach(tab => {
        tab.addEventListener('click', async () => {
            tab.closest('.stats-tabs')?.querySelectorAll('.stats-tab')
                .forEach(t => t.classList.remove('stats-tab--active'));
            tab.classList.add('stats-tab--active');

            const label = tab.textContent.trim();
            let period = 'week';
            if (label.includes('Месяц')) period = 'month';
            if (label.includes('Год')) period = 'year';
            await loadStats(period);
        });
    });
}

function setupGoalEditors() {
    document.querySelectorAll('#dd-profile .goal-card__edit').forEach((btn, index) => {
        btn.type = 'button';
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!(await apiCheckHealth())) {
                showToast('Сервер недоступен. Запустите start.bat', 'error');
                return;
            }

            const card = btn.closest('.goal-card');
            const goalType = card?.dataset.goalType
                || (index === 0 ? 'pages_per_day' : 'minutes_per_day');
            const current = card?.dataset.targetValue || '30';
            const input = prompt('Введите целевое значение:', current);
            if (input === null) return;

            const target = parseInt(input, 10);
            if (Number.isNaN(target) || target <= 0) {
                showToast('Цель должна быть положительным числом', 'error');
                return;
            }

            const result = await apiCreateGoal(goalType, target);
            if (result.success) {
                showToast('Цель обновлена', 'success');
                await loadGoals();
            } else {
                showToast(formatApiError(result.error) || 'Не удалось обновить цель', 'error');
            }
        });
    });
}

function setupSearch() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            const query = e.target.value.trim();
            if (!query) {
                await loadBooks();
                return;
            }
            const result = await apiSearchBooks(query);
            if (result.success) {
                displayBooks(result.data);
            }
        }, 300);
    });
}

function setupSortPanel() {
    document.querySelectorAll('.sort-pair-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const type = btn.dataset.sort;
            const dir = btn.dataset.dir;

            document.querySelectorAll(`.sort-pair-btn[data-sort="${type}"]`)
                .forEach(b => b.classList.remove('sort-pair-btn--active'));
            btn.classList.add('sort-pair-btn--active');

            let sortField = null;
            if (type === 'alpha') sortField = 'title';
            if (type === 'date') sortField = 'uploaded_at';

            if (sortField) {
                const result = await apiGetBooks({ sort: sortField });
                if (result.success) {
                    let books = result.data;
                    if (dir === 'desc' && sortField === 'title') {
                        books = [...books].reverse();
                    }
                    displayBooks(books);
                }
            } else if (type === 'progress') {
                const cards = Array.from(document.querySelectorAll('#book-list .book-card'));
                cards.sort((a, b) => {
                    const pa = parseInt(a.dataset.progress, 10) || 0;
                    const pb = parseInt(b.dataset.progress, 10) || 0;
                    return dir === 'asc' ? pa - pb : pb - pa;
                });
                const list = document.getElementById('book-list');
                cards.forEach(card => list.appendChild(card));
            }
        });
    });
}

function closeAddBookModal() {
    const modal = document.getElementById('modal-add-book');
    if (modal) modal.classList.remove('modal-overlay--visible');
    document.body.style.overflow = '';
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

function setupLogoutButton() {
    // Ищем кнопку выхода (может быть в разных местах)
    const logoutButtons = document.querySelectorAll('[data-action="logout"]');
    
    logoutButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Вы уверены, что хотите выйти?')) {
                logout();
            }
        });
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

// Экспортируем функции для использования в HTML
window.openBook = openBook;
window.deleteBook = deleteBook;
window.editBook = editBook;
window.addToShelf = addToShelf;
window.openNotes = openNotes;
window.saveBookEdit = saveBookEdit;
window.closeEditModal = closeEditModal;
window.addBookToShelfConfirm = addBookToShelfConfirm;
window.closeShelfModal = closeShelfModal;
window.closeNotesModal = closeNotesModal;
window.saveNewNote = saveNewNote;
window.deleteNoteConfirm = deleteNoteConfirm;
