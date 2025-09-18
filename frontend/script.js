class TaskFlowApp {
    constructor() {
        this.token = localStorage.getItem('taskflow_token') || null;
        this.userId = localStorage.getItem('taskflow_user_id') || null;
        this.apiUrl = 'http://192.168.50.94:5000';
        this.translations = {
            ru: {
                title: "ProdBoost — Управление задачами",
                tasks: "📋 Задачи",
                settings: "⚙️ Настройки",
                taskFormTitle: "Название задачи",
                taskFormDescription: "Описание (опционально)",
                taskFormDueDate: "Дата выполнения",
                taskFormButton: "Добавить задачу",
                tasksHeader: "Ваши задачи",
                noTasks: "📋 Список задач пуст",
                taskStatusCreated: "Создана",
                taskStatusInProgress: "В работе",
                taskStatusCompleted: "Завершена",
                taskActionStart: "▶️ В работу",
                taskActionComplete: "✅ Завершить",
                taskActionDelete: "🗑️ Удалить",
                authTitle: "🚀 ProdBoost",
                authLogin: "Войти",
                authRegister: "Регистрация",
                authUsername: "Имя пользователя",
                authPassword: "Пароль",
                logout: "Выйти",
                telegramTitle: "📲 Telegram",
                telegramInstruction: "Привяжите Telegram для получения уведомлений:",
                telegramCopy: "📋 Скопировать",
                themeTitle: "🎨 Тема интерфейса",
                notificationsTitle: "🔔 Desktop-уведомления",
                languageTitle: "🌐 Язык интерфейса",
                notificationsEnabled: "Включены",
                notificationsDisabled: "Отключены"
            },
            en: {
                title: "ProdBoost — Task Management",
                tasks: "📋 Tasks",
                settings: "⚙️ Settings",
                taskFormTitle: "Task Title",
                taskFormDescription: "Description (optional)",
                taskFormDueDate: "Due Date",
                taskFormButton: "Add Task",
                tasksHeader: "Your Tasks",
                noTasks: "📋 Task list is empty",
                taskStatusCreated: "Created",
                taskStatusInProgress: "In Progress",
                taskStatusCompleted: "Completed",
                taskActionStart: "▶️ Start",
                taskActionComplete: "✅ Complete",
                taskActionDelete: "🗑️ Delete",
                authTitle: "🚀 ProdBoost",
                authLogin: "Login",
                authRegister: "Register",
                authUsername: "Username",
                authPassword: "Password",
                logout: "Logout",
                telegramTitle: "📲 Telegram",
                telegramInstruction: "Link Telegram to receive notifications:",
                telegramCopy: "📋 Copy",
                themeTitle: "🎨 Theme",
                notificationsTitle: "🔔 Desktop Notifications",
                languageTitle: "🌐 Interface Language",
                notificationsEnabled: "Enabled",
                notificationsDisabled: "Disabled"
            }
        };
        this.currentLanguage = localStorage.getItem('taskflow_language') || 'ru';
        this.init();
    }

    init() {
        if (this.token) {
            this.showApp();
            this.loadTasks();
            this.updateTelegramCommand();
            this.loadUserSettings();
            this.applyTranslations();
        } else {
            this.showAuth();
        }
    }

    applyTranslations() {
        const t = this.translations[this.currentLanguage];
        // Обновляем заголовок
        document.title = t.title;
        // Обновляем тексты в интерфейсе — ТОЛЬКО если элемент существует
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (t[key]) {
                if (el.tagName === 'INPUT' && el.placeholder) {
                    el.placeholder = t[key];
                } else {
                    el.textContent = t[key];
                }
            }
        });
    }

    async login() {
        const username = document.getElementById('username')?.value.trim();
        const password = document.getElementById('password')?.value.trim();
        const messageEl = document.getElementById('authMessage');

        if (!username || !password) {
            messageEl.textContent = '❗ Заполните все поля';
            messageEl.style.color = 'red';
            return;
        }

        messageEl.textContent = '⏳ Авторизация...';
        messageEl.style.color = '#007bff';

        try {
            const response = await fetch(`${this.apiUrl}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка авторизации');
            }

            const data = await response.json();
            this.token = data.token;
            this.userId = data.user_id;
            localStorage.setItem('taskflow_token', this.token);
            localStorage.setItem('taskflow_user_id', this.userId);

            messageEl.textContent = '✅ Успешный вход!';
            messageEl.style.color = 'green';

            this.showApp();
            this.loadTasks();
            this.updateTelegramCommand();
        } catch (err) {
            messageEl.textContent = `❌ ${err.message}`;
            messageEl.style.color = 'red';
        }
    }

    async register() {
        const username = document.getElementById('username')?.value.trim();
        const password = document.getElementById('password')?.value.trim();
        const messageEl = document.getElementById('authMessage');

        if (!username || !password) {
            messageEl.textContent = '❗ Заполните все поля';
            messageEl.style.color = 'red';
            return;
        }

        messageEl.textContent = '⏳ Регистрация...';
        messageEl.style.color = '#007bff';

        try {
            const response = await fetch(`${this.apiUrl}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка регистрации');
            }

            messageEl.textContent = '✅ Регистрация успешна! Войдите в систему.';
            messageEl.style.color = 'green';
        } catch (err) {
            messageEl.textContent = `❌ ${err.message}`;
            messageEl.style.color = 'red';
        }
    }

    logout() {
        this.token = null;
        this.userId = null;
        localStorage.removeItem('taskflow_token');
        localStorage.removeItem('taskflow_user_id');
        this.showAuth();
    }

    showAuth() {
        document.getElementById('authSection').style.display = 'block';
        document.getElementById('appSection').style.display = 'none';
    }

    showApp() {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('appSection').style.display = 'block';
        this.showSection('tasks');
    }

    showSection(sectionId) {
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        document.querySelectorAll('.nav-menu button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`${sectionId}Section`).classList.add('active');
        document.querySelector(`.nav-menu button[onclick="app.showSection('${sectionId}')"]`).classList.add('active');
    }

    updateTelegramCommand() {
        const input = document.getElementById('telegramCommand');
        if (input && this.userId) {
            input.value = `/start ${this.userId}`;
        }
    }

    copyTelegramCommand() {
        if (!this.userId) {
            this.showToast('❗ Сначала войдите в систему');
            return;
        }
        const input = document.getElementById('telegramCommand');
        input.select();
        document.execCommand('copy');
        document.getElementById('telegramStatus').textContent = '✅ Команда скопирована!';
        document.getElementById('telegramStatus').style.color = '#28a745';
    }

    async loadTasks() {
        const statusFilter = document.getElementById('statusFilter')?.value;
        const url = statusFilter ? 
            `${this.apiUrl}/tasks?status=${statusFilter}` : 
            `${this.apiUrl}/tasks`;

        try {
            const response = await fetch(url, {
                headers: { 
                    'Authorization': `Bearer ${this.token}`
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

    async searchTasks() {
        const query = document.getElementById('searchInput')?.value.trim();
        if (!query) {
            this.loadTasks();
            return;
        }

        try {
            const response = await fetch(`${this.apiUrl}/tasks/search?q=${query}`, {
                headers: { 
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) throw new Error('Ошибка поиска');

            const tasks = await response.json();
            this.renderTasks(tasks);
        } catch (err) {
            console.error(err);
        }
    }

    filterTasks() {
        this.loadTasks();
    }

    async addTask() {
        const title = document.getElementById('taskTitle')?.value.trim();
        const description = document.getElementById('taskDescription')?.value.trim();
        const dueDate = document.getElementById('taskDueDate')?.value;

        if (!title) {
            alert('❗ Введите название задачи');
            return;
        }

        try {
            const response = await fetch(`${this.apiUrl}/tasks`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ title, description, due_date: dueDate })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка создания задачи');
            }

            document.getElementById('taskTitle').value = '';
            document.getElementById('taskDescription').value = '';
            document.getElementById('taskDueDate').value = '';
            this.loadTasks();
        } catch (err) {
            alert(`❌ ${err.message}`);
        }
    }

    async updateTaskStatus(taskId, newStatus) {
        try {
            const response = await fetch(`${this.apiUrl}/tasks/${taskId}/status`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка обновления статуса');
            }

            this.loadTasks();
        } catch (err) {
            alert(`❌ ${err.message}`);
        }
    }

    async deleteTask(taskId) {
        if (!confirm('❓ Вы уверены, что хотите удалить эту задачу?')) return;

        try {
            const response = await fetch(`${this.apiUrl}/tasks/${taskId}`, {
                method: 'DELETE',
                headers: { 
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка удаления задачи');
            }

            this.loadTasks();
        } catch (err) {
            alert(`❌ ${err.message}`);
        }
    }

    renderTasks(tasks) {
        const container = document.getElementById('tasksList');
        if (!container) return;

        container.innerHTML = '';

        if (tasks.length === 0) {
            container.innerHTML = '<div class="no-tasks">📋 Список задач пуст</div>';
            return;
        }

        tasks.forEach(task => {
            const card = document.createElement('div');
            card.className = `task-card status-${task.status}`;
            card.innerHTML = `
                <div class="task-title">${task.title}</div>
                ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
                ${task.due_date ? `<div class="task-due">📅 Выполнить до: ${task.due_date}</div>` : ''}
                <div class="task-meta">
                    <span>📌 Статус: <strong>${task.status}</strong></span>
                    <span>📅 Создана: ${new Date(task.created_at).toLocaleDateString()}</span>
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

    // Настройки
    loadUserSettings() {
        const savedTheme = localStorage.getItem('taskflow_theme') || 'light';
        this.setTheme(savedTheme);
        
        const savedNotifications = localStorage.getItem('taskflow_desktop_notifications') === 'true';
        const checkbox = document.getElementById('desktopNotifications');
        if (checkbox) {
            checkbox.checked = savedNotifications;
            this.updateNotificationStatus(savedNotifications);
        }
        
        const savedLanguage = localStorage.getItem('taskflow_language') || 'ru';
        const select = document.getElementById('languageSelect');
        if (select) {
            select.value = savedLanguage;
        }
        this.currentLanguage = savedLanguage;
        this.applyTranslations();
    }

    setTheme(theme) {
        document.body.className = `theme-${theme}`;
        localStorage.setItem('taskflow_theme', theme);
        // Обновляем активную кнопку
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.style.opacity = '0.5';
        });
        document.querySelector(`.theme-btn.${theme}`)?.style.opacity = '1';
    }

    toggleDesktopNotifications() {
        const checkbox = document.getElementById('desktopNotifications');
        const statusEl = document.getElementById('notificationStatus');
        if (!checkbox || !statusEl) return;

        if (checkbox.checked && Notification.permission !== "granted") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    this.showToast('✅ Desktop-уведомления разрешены');
                    this.updateNotificationStatus(true);
                } else {
                    checkbox.checked = false;
                    this.showToast('❌ Уведомления заблокированы');
                    this.updateNotificationStatus(false);
                }
            });
        } else {
            this.updateNotificationStatus(checkbox.checked);
        }
        localStorage.setItem('taskflow_desktop_notifications', checkbox.checked);
    }

    updateNotificationStatus(isEnabled) {
        const statusEl = document.getElementById('notificationStatus');
        if (!statusEl) return;

        const t = this.translations[this.currentLanguage];
        statusEl.textContent = isEnabled ? t.notificationsEnabled : t.notificationsDisabled;
        statusEl.style.color = isEnabled ? '#28a745' : '#dc3545';
    }

    changeLanguage() {
        const select = document.getElementById('languageSelect');
        if (!select) return;

        const lang = select.value;
        this.currentLanguage = lang;
        localStorage.setItem('taskflow_language', lang);
        this.applyTranslations();
        this.showToast(`✅ Язык изменён на ${lang === 'ru' ? 'Русский' : 'English'}`);
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const app = new TaskFlowApp();

    window.login = function() { app.login(); };
    window.register = function() { app.register(); };
    window.logout = function() { app.logout(); };
    window.copyTelegramCommand = function() { app.copyTelegramCommand(); };
});
