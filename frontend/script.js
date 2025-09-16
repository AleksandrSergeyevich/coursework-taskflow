class TaskFlowApp {
    constructor() {
        // Загружаем токен из localStorage
        this.token = localStorage.getItem('taskflow_token') || null;
        this.userId = localStorage.getItem('taskflow_user_id') || null;
        this.init();
    }

    init() {
        if (this.token) {
            this.showApp();
            this.loadTasks();
        } else {
            this.showAuth();
        }
    }

    // Авторизация
    async login() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const messageEl = document.getElementById('authMessage');

        if (!username || !password) {
            messageEl.textContent = 'Заполните все поля';
            messageEl.style.color = 'red';
            return;
        }

        try {
            const response = await fetch('http://192.168.50.94:5000/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка авторизации');
            }

            const data = await response.json();
            
            // ✅ СОХРАНЯЕМ ТОКЕН
            this.token = data.token;
            this.userId = data.user_id;
            localStorage.setItem('taskflow_token', this.token);
            localStorage.setItem('taskflow_user_id', this.userId);

            this.showApp();
            this.loadTasks();
        } catch (err) {
            messageEl.textContent = err.message;
            messageEl.style.color = 'red';
        }
    }

    // Регистрация
    async register() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const messageEl = document.getElementById('authMessage');

        if (!username || !password) {
            messageEl.textContent = 'Заполните все поля';
            messageEl.style.color = 'red';
            return;
        }

        try {
            const response = await fetch('http://192.168.50.94:5000/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка регистрации');
            }

            messageEl.textContent = 'Регистрация успешна! Войдите в систему.';
            messageEl.style.color = 'green';
        } catch (err) {
            messageEl.textContent = err.message;
            messageEl.style.color = 'red';
        }
    }

    // Выход
    logout() {
        this.token = null;
        this.userId = null;
        localStorage.removeItem('taskflow_token');
        localStorage.removeItem('taskflow_user_id');
        this.showAuth();
    }

    // Показать интерфейс авторизации
    showAuth() {
        document.getElementById('authSection').style.display = 'block';
        document.getElementById('appSection').style.display = 'none';
    }

    // Показать основной интерфейс
    showApp() {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('appSection').style.display = 'block';
    }

    // Загрузка задач
    async loadTasks() {
        const statusFilter = document.getElementById('statusFilter').value;
        const url = statusFilter ? 
            `http://192.168.50.94:5000/tasks?status=${statusFilter}` : 
            'http://192.168.50.94:5000/tasks';

        try {
            const response = await fetch(url, {
                headers: { 
                    'Authorization': `Bearer ${this.token}`  // ← ОТПРАВЛЯЕМ ТОКЕН
                }
            });

            if (!response.ok) throw new Error('Ошибка загрузки задач');

            const tasks = await response.json();
            this.renderTasks(tasks);
        } catch (err) {
            console.error(err);
            document.getElementById('tasksList').innerHTML = 
                `<div style="color: red; padding: 20px;">${err.message}</div>`;
        }
    }

    // Поиск задач
    async searchTasks() {
        const query = document.getElementById('searchInput').value;
        if (!query) {
            this.loadTasks();
            return;
        }

        try {
            const response = await fetch(`http://192.168.50.94:5000/tasks/search?q=${query}`, {
                headers: { 
                    'Authorization': `Bearer ${this.token}`  // ← ОТПРАВЛЯЕМ ТОКЕН
                }
            });

            if (!response.ok) throw new Error('Ошибка поиска');

            const tasks = await response.json();
            this.renderTasks(tasks);
        } catch (err) {
            console.error(err);
        }
    }

    // Фильтрация по статусу
    filterTasks() {
        this.loadTasks();
    }

    // Добавление задачи
    async addTask() {
        const title = document.getElementById('taskTitle').value.trim();
        const description = document.getElementById('taskDescription').value.trim();

        if (!title) {
            alert('Введите название задачи');
            return;
        }

        try {
            const response = await fetch('http://192.168.50.94:5000/tasks', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`  // ← ОТПРАВЛЯЕМ ТОКЕН
                },
                body: JSON.stringify({ title, description })
            });

            if (!response.ok) throw new Error('Ошибка создания задачи');

            document.getElementById('taskTitle').value = '';
            document.getElementById('taskDescription').value = '';
            this.loadTasks();
        } catch (err) {
            alert(err.message);
        }
    }

    // Обновление статуса задачи
    async updateTaskStatus(taskId, newStatus) {
        try {
            const response = await fetch(`http://192.168.50.94:5000/tasks/${taskId}/status`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`  // ← ОТПРАВЛЯЕМ ТОКЕН
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (!response.ok) throw new Error('Ошибка обновления статуса');

            this.loadTasks();
        } catch (err) {
            alert(err.message);
        }
    }

    // Удаление задачи
    async deleteTask(taskId) {
        if (!confirm('Вы уверены, что хотите удалить эту задачу?')) return;

        try {
            const response = await fetch(`http://192.168.50.94:5000/tasks/${taskId}`, {
                method: 'DELETE',
                headers: { 
                    'Authorization': `Bearer ${this.token}`  // ← ОТПРАВЛЯЕМ ТОКЕН
                }
            });

            if (!response.ok) throw new Error('Ошибка удаления задачи');

            this.loadTasks();
        } catch (err) {
            alert(err.message);
        }
    }

    // Рендеринг задач
    renderTasks(tasks) {
        const container = document.getElementById('tasksList');
        container.innerHTML = '';

        if (tasks.length === 0) {
            container.innerHTML = '<div class="no-tasks">Нет задач для отображения</div>';
            return;
        }

        tasks.forEach(task => {
            const card = document.createElement('div');
            card.className = `task-card status-${task.status}`;
            card.innerHTML = `
                <div class="task-title">${task.title}</div>
                ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
                <div class="task-meta">
                    <span>Статус: <strong>${task.status}</strong></span>
                    <span>Создана: ${new Date(task.created_at).toLocaleDateString()}</span>
                </div>
                <div class="task-actions">
                    ${task.status !== 'В работе' ? 
                        `<button class="btn-start" onclick="app.updateTaskStatus(${task.id}, 'В работе')">▶️ В работу</button>` : 
                        `<button class="btn-complete" onclick="app.updateTaskStatus(${task.id}, 'Завершена')">✅ Завершить</button>`}
                    <button class="btn-delete" onclick="app.deleteTask(${task.id})">🗑️ Удалить</button>
                </div>
            `;
            container.appendChild(card);
        });
    }
}

// Инициализация приложения
const app = new TaskFlowApp();

// Экспорт функций для кнопок
function login() { app.login(); }
function register() { app.register(); }
function logout() { app.logout(); }
function addTask() { app.addTask(); }
function searchTasks() { app.searchTasks(); }
function filterTasks() { app.filterTasks(); }
