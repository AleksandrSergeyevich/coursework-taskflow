class TaskFlowApp {
    constructor() {
        this.token = localStorage.getItem('taskflow_token') || null;
        this.userId = localStorage.getItem('taskflow_user_id') || null;
        this.apiUrl = 'https://api.prodboost.ru';
        this.translations = {
            ru: {
                title: "ProdBoost — Управление задачами",
                tasks: "📋 Задачи",
                stats: "📊 Статистика",
                settings: "⚙️ Настройки",
                taskFormTitle: "Название задачи",
                taskFormDescription: "Описание (опционально)",
                taskFormDueDate: "Дата выполнения",
                taskFormButton: "Добавить задачу",
                taskFormSearch: "Поиск задач...",
                tasksHeader: "Ваши задачи",
                noTasks: "📋 Список задач пуст",
                taskStatusAll: "Все статусы",
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
                notificationsDisabled: "Отключены",
                forgotPassword: "Забыли пароль?",
                resetPassword: "🔑 Восстановление пароля",
                resetEmail: "Email",
                resetSendLink: "Отправить ссылку",
                registerStep1Title: "📝 Шаг 1: Создайте аккаунт",
                registerStep2Title: "📧 Шаг 2: Укажите email",
                nextStep: "Далее →",
                backToStep1: "← Назад",
                backToLogin: "← Назад к входу",
                completeRegistration: "✅ Завершить регистрацию",
                xp: "Очки опыта",
                level: "Уровень",
                badges: "Бейджи",
                totalTasks: "Всего задач",
                completedTasks: "Завершено",
                completionRate: "Процент выполнения",
                avgTime: "Среднее время (ч)"
            },
            en: {
                title: "ProdBoost — Task Management",
                tasks: "📋 Tasks",
                stats: "📊 Analytics",
                settings: "⚙️ Settings",
                taskFormTitle: "Task Title",
                taskFormDescription: "Description (optional)",
                taskFormDueDate: "Due Date",
                taskFormButton: "Add Task",
                taskFormSearch: "Search tasks...",
                tasksHeader: "Your Tasks",
                noTasks: "📋 Task list is empty",
                taskStatusAll: "All statuses",
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
                notificationsDisabled: "Disabled",
                forgotPassword: "Forgot Password?",
                resetPassword: "🔑 Password Reset",
                resetEmail: "Email",
                resetSendLink: "Send Link",
                registerStep1Title: "📝 Step 1: Create Account",
                registerStep2Title: "📧 Step 2: Enter Email",
                nextStep: "Next →",
                backToStep1: "← Back",
                backToLogin: "← Back to Login",
                completeRegistration: "✅ Complete Registration",
                xp: "Experience Points",
                level: "Level",
                badges: "Badges",
                totalTasks: "Total Tasks",
                completedTasks: "Completed",
                completionRate: "Completion Rate",
                avgTime: "Avg Time (h)"
            }
        };
        this.currentLanguage = localStorage.getItem('taskflow_language') || 'ru';
        this.init();
    }

    init() {
        const urlParams = new URLSearchParams(window.location.search);
        const tokenFromUrl = urlParams.get('token');
        const userIdFromUrl = urlParams.get('user_id');
        if (tokenFromUrl && userIdFromUrl) {
            this.token = tokenFromUrl;
            this.userId = userIdFromUrl;
            localStorage.setItem('taskflow_token', this.token);
            localStorage.setItem('taskflow_user_id', this.userId);
            window.history.replaceState({}, document.title, "/");
        }
        this.applyTranslations();
        this.loadUserSettings();
        if (this.token) {
            this.showApp();
            this.loadTasks();
            this.updateTelegramCommand();
            this.loadStats();
        } else {
            this.showAuth();
        }
    }

    applyTranslations() {
        const t = this.translations[this.currentLanguage];
        document.title = t.title;
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key.startsWith('[') && key.includes(']')) {
                const attr = key.match(/\[(.*?)\]/)[1];
                const transKey = key.split(']')[1];
                if (t[transKey]) {
                    el.setAttribute(attr, t[transKey]);
                }
            } else {
                if (t[key]) {
                    el.textContent = t[key];
                }
            }
        });
    }

    // === Авторизация ===
    async login() {
        const usernameEl = document.getElementById('username');
        const passwordEl = document.getElementById('password');
        const messageEl = document.getElementById('authMessage');
        if (!usernameEl || !passwordEl || !messageEl) return;

        const username = usernameEl.value.trim();
        const password = passwordEl.value.trim();
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
            this.loadStats();
        } catch (err) {
            messageEl.textContent = `❌ ${err.message}`;
            messageEl.style.color = 'red';
        }
    }

    showRegisterStep1() {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('registerStep1Section').style.display = 'block';
        document.getElementById('registerStep2Section').style.display = 'none';
        document.getElementById('forgotPasswordSection').style.display = 'none';
    }

    async nextToStep2() {
        const usernameEl = document.getElementById('registerUsername');
        const passwordEl = document.getElementById('registerPassword');
        const messageEl = document.getElementById('registerStep1Message');
        if (!usernameEl || !passwordEl || !messageEl) return;

        const username = usernameEl.value.trim();
        const password = passwordEl.value.trim();
        if (!username || !password) {
            messageEl.textContent = '❗ Заполните все поля';
            messageEl.style.color = 'red';
            return;
        }

        try {
            const response = await fetch(`${this.apiUrl}/check-username`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            const data = await response.json();
            if (data.exists) {
                messageEl.textContent = '❗ Имя пользователя уже занято';
                messageEl.style.color = 'red';
                return;
            }
            messageEl.textContent = '';
            this.showRegisterStep2();
        } catch (err) {
            messageEl.textContent = `❌ ${err.message}`;
            messageEl.style.color = 'red';
        }
    }

    showRegisterStep2() {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('registerStep1Section').style.display = 'none';
        document.getElementById('registerStep2Section').style.display = 'block';
        document.getElementById('forgotPasswordSection').style.display = 'none';
    }

    async completeRegistration() {
        const username = document.getElementById('registerUsername')?.value.trim();
        const password = document.getElementById('registerPassword')?.value.trim();
        const email = document.getElementById('registerEmail')?.value.trim();
        const messageEl = document.getElementById('registerStep2Message');
        if (!username || !password || !email) {
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
                body: JSON.stringify({ username, password, email })
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка регистрации');
            }
            messageEl.textContent = '✅ Регистрация успешна! Войдите в систему.';
            messageEl.style.color = 'green';
            setTimeout(() => {
                this.showAuth();
            }, 2000);
        } catch (err) {
            messageEl.textContent = `❌ ${err.message}`;
            messageEl.style.color = 'red';
        }
    }

    showForgotPassword() {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('registerStep1Section').style.display = 'none';
        document.getElementById('registerStep2Section').style.display = 'none';
        document.getElementById('forgotPasswordSection').style.display = 'block';
    }

    async sendResetLink() {
        const email = document.getElementById('resetEmail')?.value.trim();
        const messageEl = document.getElementById('resetMessage');
        if (!email) {
            messageEl.textContent = '❗ Введите email';
            messageEl.style.color = 'red';
            return;
        }

        messageEl.textContent = '⏳ Отправка...';
        messageEl.style.color = '#007bff';
        try {
            const response = await fetch(`${this.apiUrl}/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await response.json();
            messageEl.textContent = data.message;
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
        document.getElementById('registerStep1Section').style.display = 'none';
        document.getElementById('registerStep2Section').style.display = 'none';
        document.getElementById('forgotPasswordSection').style.display = 'none';
        document.getElementById('appSection').style.display = 'none';
    }

    showApp() {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('registerStep1Section').style.display = 'none';
        document.getElementById('registerStep2Section').style.display = 'none';
        document.getElementById('forgotPasswordSection').style.display = 'none';
        document.getElementById('appSection').style.display = 'block';
        this.showSection('tasks');
    }

    showSection(sectionId) {
        document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
        document.querySelectorAll('.nav-menu button').forEach(btn => btn.classList.remove('active'));
        const targetSection = document.getElementById(`${sectionId}Section`);
        const targetButton = document.querySelector(`.nav-menu button[onclick="app.showSection('${sectionId}')"]`);
        if (targetSection) targetSection.classList.add('active');
        if (targetButton) targetButton.classList.add('active');

        if (sectionId === 'stats') {
            this.loadStats();
        }
    }

    async loadStats() {
        if (!this.token) return;
        try {
            const response = await fetch(`${this.apiUrl}/user/stats`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!response.ok) throw new Error('Ошибка загрузки статистики');
            const stats = await response.json();
            this.renderStats(stats);
        } catch (err) {
            console.error('Ошибка загрузки статистики:', err);
        }
    }

    renderStats(stats) {
        const statsEl = document.getElementById('statsContent');
        if (!statsEl) return;

        const t = this.translations[this.currentLanguage];
        let badgesHtml = stats.badges.length > 0
            ? `<ul>${stats.badges.map(b => `<li>🎖️ ${b}</li>`).join('')}</ul>`
            : '<p>—</p>';

        statsEl.innerHTML = `
            <div class="stat-item"><strong>${t.xp}:</strong> ${stats.xp}</div>
            <div class="stat-item"><strong>${t.level}:</strong> ${stats.level}</div>
            <div class="stat-item"><strong>${t.badges}:</strong> ${badgesHtml}</div>
            <div class="stat-item"><strong>${t.totalTasks}:</strong> ${stats.total_tasks}</div>
            <div class="stat-item"><strong>${t.completedTasks}:</strong> ${stats.completed_tasks}</div>
            <div class="stat-item"><strong>${t.completionRate}:</strong> ${stats.completion_rate}%</div>
            <div class="stat-item"><strong>${t.avgTime}:</strong> ${stats.avg_completion_time_hours || '—'}</div>
        `;
    }

    // === Задачи и настройки (без изменений) ===
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
        const statusEl = document.getElementById('telegramStatus');
        if (statusEl) {
            statusEl.textContent = '✅ Команда скопирована!';
            statusEl.style.color = '#28a745';
        }
    }

    async loadTasks() {
        if (!this.token) return;
        const statusFilter = document.getElementById('statusFilter')?.value;
        const url = statusFilter ? `${this.apiUrl}/tasks?status=${statusFilter}` : `${this.apiUrl}/tasks`;
        try {
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!response.ok) throw new Error('Ошибка загрузки задач');
            const tasks = await response.json();
            this.renderTasks(tasks);
        } catch (err) {
            console.error('Ошибка загрузки задач:', err);
            const tasksList = document.getElementById('tasksList');
            if (tasksList) {
                tasksList.innerHTML = `<div style="color: red; padding: 20px;">${err.message}</div>`;
            }
        }
    }

    searchTasks() {
        // можно реализовать позже
    }

    filterTasks() {
        this.loadTasks();
    }

    async addTask() {
        const titleEl = document.getElementById('taskTitle');
        const descriptionEl = document.getElementById('taskDescription');
        const dueDateEl = document.getElementById('taskDueDate');
        if (!titleEl) return;

        const title = titleEl.value.trim();
        const description = descriptionEl?.value.trim() || '';
        const dueDate = dueDateEl?.value;

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
            if (titleEl) titleEl.value = '';
            if (descriptionEl) descriptionEl.value = '';
            if (dueDateEl) dueDateEl.value = '';
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
                headers: { 'Authorization': `Bearer ${this.token}` }
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
            const dueDateText = task.due_date ? `📅 Выполнить до: ${task.due_date}` : '';
            const statusText = this.translations[this.currentLanguage][`taskStatus${task.status}`] || task.status;
            card.innerHTML = `
                <div class="task-title">${task.title}</div>
                ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
                ${dueDateText ? `<div class="task-due">${dueDateText}</div>` : ''}
                <div class="task-meta">
                    <span>📌 Статус: <strong>${statusText}</strong></span>
                    <span>📅 Создана: ${new Date(task.created_at).toLocaleDateString()}</span>
                </div>
                <div class="task-actions">
                    ${task.status !== 'В работе' ? 
                      `<button class="btn-start" onclick="app.updateTaskStatus(${task.id}, 'В работе')">▶️ В работу</button>` :
                      `<button class="btn-complete" onclick="app.updateTaskStatus(${task.id}, 'Завершена')">✅ Завершить</button>`}
                    <button class="btn-delete" onclick="app.deleteTask(${task.id})">🗑️ Удалить</button>
                </div>`;
            container.appendChild(card);
        });
    }

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
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.style.opacity = '0.5';
        });
        const btn = document.querySelector(`.theme-btn.${theme}`);
        if (btn) {
            btn.style.opacity = '1';
        }
    }

    toggleDesktopNotifications() {
        const checkbox = document.getElementById('desktopNotifications');
        if (!checkbox) return;
        if (checkbox.checked && Notification.permission !== "granted") {
            Notification.requestPermission();
        }
        localStorage.setItem('taskflow_desktop_notifications', checkbox.checked);
        this.updateNotificationStatus(checkbox.checked);
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

// ✅ Гарантированная инициализация
document.addEventListener('DOMContentLoaded', function() {
    try {
        window.app = new TaskFlowApp();
        // Глобальные функции — только после создания app
        window.login = () => app.login();
        window.showRegisterStep1 = () => app.showRegisterStep1();
        window.nextToStep2 = () => app.nextToStep2();
        window.completeRegistration = () => app.completeRegistration();
        window.showForgotPassword = () => app.showForgotPassword();
        window.sendResetLink = () => app.sendResetLink();
        window.logout = () => app.logout();
        window.showAuth = () => app.showAuth();
    } catch (e) {
        console.error('❌ Критическая ошибка инициализации:', e);
    }
});
