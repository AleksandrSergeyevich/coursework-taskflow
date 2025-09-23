class ProdBoostApp {
    constructor() {
        this.config = {
            apiUrl: 'https://api.prodboost.ru',
            defaultLanguage: 'ru',
            themes: ['light', 'dark', 'blue']
        };

        this.state = {
            token: localStorage.getItem('prodboost_token') || null,
            userId: localStorage.getItem('prodboost_user_id') || null,
            currentLanguage: localStorage.getItem('prodboost_language') || this.config.defaultLanguage,
            currentTheme: localStorage.getItem('prodboost_theme') || 'light',
            tempRegistration: {
                username: '',
                password: ''
            }
        };

        this.translations = {
            ru: {
                title: "ProdBoost — Управление задачами",
                authLogin: "Войти",
                authRegister: "Регистрация",
                authUsername: "Имя пользователя",
                authPassword: "Пароль",
                authEmail: "Email",
                forgotPassword: "Забыли пароль?",
                tasks: "📋 Задачи",
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
                telegramTitle: "📲 Telegram",
                telegramInstruction: "Привяжите Telegram для получения уведомлений:",
                telegramCopy: "📋 Скопировать",
                themeTitle: "🎨 Тема интерфейса",
                notificationsTitle: "🔔 Desktop-уведомления",
                languageTitle: "🌐 Язык интерфейса",
                notificationsEnabled: "Включены",
                notificationsDisabled: "Отключены",
                resetPassword: "🔑 Восстановление пароля",
                resetEmail: "Email",
                resetSendLink: "Отправить ссылку",
                registerStep1Title: "📝 Шаг 1: Создайте учётную запись",
                registerStep2Title: "📧 Шаг 2: Укажите email",
                nextStep: "Далее →",
                completeRegistration: "Завершить регистрацию"
            },
            en: {
                title: "ProdBoost — Task Management",
                authLogin: "Login",
                authRegister: "Register",
                authUsername: "Username",
                authPassword: "Password",
                authEmail: "Email",
                forgotPassword: "Forgot Password?",
                tasks: "📋 Tasks",
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
                telegramTitle: "📲 Telegram",
                telegramInstruction: "Link Telegram to receive notifications:",
                telegramCopy: "📋 Copy",
                themeTitle: "🎨 Theme",
                notificationsTitle: "🔔 Desktop Notifications",
                languageTitle: "🌐 Interface Language",
                notificationsEnabled: "Enabled",
                notificationsDisabled: "Disabled",
                resetPassword: "🔑 Password Reset",
                resetEmail: "Email",
                resetSendLink: "Send Link",
                registerStep1Title: "📝 Step 1: Create Account",
                registerStep2Title: "📧 Step 2: Enter Email",
                nextStep: "Next →",
                completeRegistration: "Complete Registration"
            }
        };

        this.init();
    }

    init() {
        console.log('🚀 ProdBoost: Initializing application...');

        this.handleUrlParams();
        this.applyTheme(this.state.currentTheme);
        this.loadTranslations();

        if (this.state.token) {
            this.showApp();
            this.loadTasks();
            this.updateTelegramCommand();
            this.loadUserSettings();
        } else {
            this.showAuth();
        }

        this.bindGlobalFunctions();
    }

    handleUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const userId = urlParams.get('user_id');

        if (token && userId) {
            this.state.token = token;
            this.state.userId = userId;
            localStorage.setItem('prodboost_token', token);
            localStorage.setItem('prodboost_user_id', userId);
            window.history.replaceState({}, document.title, "/");
            console.log('✅ ProdBoost: Successfully logged in via Telegram');
        }
    }

    loadTranslations() {
        const t = this.translations[this.state.currentLanguage];
        document.title = t.title;

        Object.keys(t).forEach(key => {
            const elements = document.querySelectorAll(`[data-i18n="${key}"]`);
            elements.forEach(el => {
                if (el.tagName === 'INPUT' && el.placeholder) {
                    el.placeholder = t[key];
                } else {
                    el.textContent = t[key];
                }
            });
        });
    }

    applyTheme(theme) {
        document.body.className = `theme-${theme}`;
        localStorage.setItem('prodboost_theme', theme);
        this.state.currentTheme = theme;

        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.style.opacity = '0.5';
        });

        const btn = document.querySelector('.theme-btn.' + theme);
        if (btn) {
            btn.style.opacity = '1';
        }
    }

    async login() {
        const username = document.getElementById('username')?.value.trim();
        const password = document.getElementById('password')?.value.trim();
        const messageEl = document.getElementById('authMessage');

        if (!username || !password) {
            this.showMessage(messageEl, '❗ Заполните все поля', 'error');
            return;
        }

        this.showMessage(messageEl, '⏳ Авторизация...', 'info');

        try {
            const response = await fetch(`${this.config.apiUrl}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка авторизации');
            }

            const data = await response.json();
            this.state.token = data.token;
            this.state.userId = data.user_id;
            localStorage.setItem('prodboost_token', this.state.token);
            localStorage.setItem('prodboost_user_id', this.state.userId);

            this.showMessage(messageEl, '✅ Успешный вход!', 'success');
            this.showApp();
            this.loadTasks();
            this.updateTelegramCommand();
            this.loadUserSettings();

        } catch (err) {
            console.error('❌ Ошибка авторизации:', err);
            this.showMessage(messageEl, `❌ ${err.message}`, 'error');
        }
    }

    // Показать шаг 1 регистрации
    showRegisterStep1() {
        document.getElementById('authSection')?.style.setProperty('display', 'none');
        document.getElementById('registerStep1Section')?.style.setProperty('display', 'block');
        document.getElementById('registerStep2Section')?.style.setProperty('display', 'none');
        document.getElementById('forgotPasswordSection')?.style.setProperty('display', 'none');
    }

    // Переход к шагу 2 (email)
    async nextToEmailStep() {
        const username = document.getElementById('registerUsername')?.value.trim();
        const password = document.getElementById('registerPassword')?.value.trim();
        const messageEl = document.getElementById('registerStep1Message');

        if (!username || !password) {
            this.showMessage(messageEl, '❗ Заполните все поля', 'error');
            return;
        }

        // Проверим, не занят ли username
        try {
            const response = await fetch(`${this.config.apiUrl}/check-username`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка проверки имени пользователя');
            }

            const data = await response.json();
            if (data.exists) {
                this.showMessage(messageEl, '❗ Это имя пользователя уже занято', 'error');
                return;
            }

            // Сохраняем временно
            this.state.tempRegistration.username = username;
            this.state.tempRegistration.password = password;

            // Переходим к шагу 2
            this.showMessage(messageEl, '', 'info'); // Очищаем сообщение
            this.showRegisterStep2();

        } catch (err) {
            console.error('❌ Ошибка проверки имени пользователя:', err);
            this.showMessage(messageEl, `❌ ${err.message}`, 'error');
        }
    }

    // Показать шаг 2 регистрации
    showRegisterStep2() {
        document.getElementById('authSection')?.style.setProperty('display', 'none');
        document.getElementById('registerStep1Section')?.style.setProperty('display', 'none');
        document.getElementById('registerStep2Section')?.style.setProperty('display', 'block');
        document.getElementById('forgotPasswordSection')?.style.setProperty('display', 'none');
    }

    // Завершить регистрацию
    async completeRegistration() {
        const email = document.getElementById('registerEmail')?.value.trim();
        const messageEl = document.getElementById('registerStep2Message');

        if (!email) {
            this.showMessage(messageEl, '❗ Введите email', 'error');
            return;
        }

        // Валидация email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showMessage(messageEl, '❗ Неверный формат email', 'error');
            return;
        }

        this.showMessage(messageEl, '⏳ Регистрация...', 'info');

        try {
            const response = await fetch(`${this.config.apiUrl}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: this.state.tempRegistration.username,
                    password: this.state.tempRegistration.password,
                    email: email
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка регистрации');
            }

            this.showMessage(messageEl, '✅ Регистрация успешна! Войдите в систему.', 'success');
            
            // Очищаем временные данные
            this.state.tempRegistration = { username: '', password: '' };
            
            // Через 2 секунды возвращаемся на главный экран
            setTimeout(() => {
                this.showAuth();
            }, 2000);

        } catch (err) {
            console.error('❌ Ошибка регистрации:', err);
            this.showMessage(messageEl, `❌ ${err.message}`, 'error');
        }
    }

    logout() {
        this.state.token = null;
        this.state.userId = null;
        localStorage.removeItem('prodboost_token');
        localStorage.removeItem('prodboost_user_id');
        this.showAuth();
    }

    showAuth() {
        document.getElementById('authSection')?.style.setProperty('display', 'block');
        document.getElementById('registerStep1Section')?.style.setProperty('display', 'none');
        document.getElementById('registerStep2Section')?.style.setProperty('display', 'none');
        document.getElementById('forgotPasswordSection')?.style.setProperty('display', 'none');
        document.getElementById('appSection')?.style.setProperty('display', 'none');
    }

    showForgotPassword() {
        document.getElementById('authSection')?.style.setProperty('display', 'none');
        document.getElementById('registerStep1Section')?.style.setProperty('display', 'none');
        document.getElementById('registerStep2Section')?.style.setProperty('display', 'none');
        document.getElementById('forgotPasswordSection')?.style.setProperty('display', 'block');
    }

    async sendResetLink() {
        const email = document.getElementById('resetEmail')?.value.trim();
        const messageEl = document.getElementById('resetMessage');

        if (!email) {
            this.showMessage(messageEl, '❗ Введите email', 'error');
            return;
        }

        this.showMessage(messageEl, '⏳ Отправка...', 'info');

        try {
            const response = await fetch(`${this.config.apiUrl}/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();
            this.showMessage(messageEl, data.message, 'success');
        } catch (err) {
            console.error('❌ Ошибка восстановления пароля:', err);
            this.showMessage(messageEl, `❌ ${err.message}`, 'error');
        }
    }

    showApp() {
        document.getElementById('authSection')?.style.setProperty('display', 'none');
        document.getElementById('registerStep1Section')?.style.setProperty('display', 'none');
        document.getElementById('registerStep2Section')?.style.setProperty('display', 'none');
        document.getElementById('forgotPasswordSection')?.style.setProperty('display', 'none');
        document.getElementById('appSection')?.style.setProperty('display', 'block');
        this.showSection('tasks');
    }

    showSection(sectionId) {
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });

        document.querySelectorAll('.nav-menu button').forEach(btn => {
            btn.classList.remove('active');
        });

        const targetSection = document.getElementById(`${sectionId}Section`);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        const targetButton = document.querySelector(`.nav-menu button[onclick="app.showSection('${sectionId}')"]`);
        if (targetButton) {
            targetButton.classList.add('active');
        }
    }

    updateTelegramCommand() {
        const input = document.getElementById('telegramCommand');
        if (input && this.state.userId) {
            input.value = `/start ${this.state.userId}`;
        }
    }

    copyTelegramCommand() {
        if (!this.state.userId) {
            this.showToast('❗ Сначала войдите в систему');
            return;
        }
        const input = document.getElementById('telegramCommand');
        if (input) {
            input.select();
            document.execCommand('copy');
            this.showToast('✅ Команда скопирована!');
        }
    }

    async loadTasks() {
        if (!this.state.token) return;

        try {
            const response = await fetch(`${this.config.apiUrl}/tasks`, {
                headers: { 'Authorization': `Bearer ${this.state.token}` }
            });

            if (!response.ok) throw new Error('Ошибка загрузки задач');

            const tasks = await response.json();
            this.renderTasks(tasks);
        } catch (err) {
            console.error('❌ Ошибка загрузки задач:', err);
            const tasksList = document.getElementById('tasksList');
            if (tasksList) {
                tasksList.innerHTML = `<div style="color: red; padding: 20px;">${err.message}</div>`;
            }
        }
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
            const response = await fetch(`${this.config.apiUrl}/tasks`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.state.token}`
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
            const response = await fetch(`${this.config.apiUrl}/tasks/${taskId}/status`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.state.token}`
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
            const response = await fetch(`${this.config.apiUrl}/tasks/${taskId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.state.token}` }
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
            const statusText = this.translations[this.state.currentLanguage][`taskStatus${task.status}`] || task.status;
            
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
                </div>
            `;
            container.appendChild(card);
        });
    }

    // === Настройки ===
    loadUserSettings() {
        const savedTheme = localStorage.getItem('prodboost_theme') || 'light';
        this.setTheme(savedTheme);

        const savedNotifications = localStorage.getItem('prodboost_desktop_notifications') === 'true';
        const checkbox = document.getElementById('desktopNotifications');
        const statusEl = document.getElementById('notificationStatus');
        if (checkbox && statusEl) {
            checkbox.checked = savedNotifications;
            const t = this.translations[this.state.currentLanguage];
            statusEl.textContent = savedNotifications ? t.notificationsEnabled : t.notificationsDisabled;
            statusEl.style.color = savedNotifications ? '#28a745' : '#dc3545';
        }

        const savedLanguage = localStorage.getItem('prodboost_language') || 'ru';
        const select = document.getElementById('languageSelect');
        if (select) {
            select.value = savedLanguage;
            this.state.currentLanguage = savedLanguage;
            this.loadTranslations();
        }
    }

    setTheme(theme) {
        this.applyTheme(theme);
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
        localStorage.setItem('prodboost_desktop_notifications', checkbox.checked);
    }

    updateNotificationStatus(isEnabled) {
        const statusEl = document.getElementById('notificationStatus');
        if (!statusEl) return;
        const t = this.translations[this.state.currentLanguage];
        statusEl.textContent = isEnabled ? t.notificationsEnabled : t.notificationsDisabled;
        statusEl.style.color = isEnabled ? '#28a745' : '#dc3545';
    }

    changeLanguage() {
        const select = document.getElementById('languageSelect');
        if (!select) return;
        const lang = select.value;
        this.state.currentLanguage = lang;
        localStorage.setItem('prodboost_language', lang);
        this.loadTranslations();
        this.showToast(`✅ Язык изменён на ${lang === 'ru' ? 'Русский' : 'English'}`);
    }

    showMessage(element, text, type = 'info') {
        if (!element) return;
        element.textContent = text;
        element.style.color = type === 'error' ? 'red' : type === 'success' ? 'green' : '#007bff';
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    bindGlobalFunctions() {
        window.app = this;
        window.login = () => this.login();
        window.showRegisterStep1 = () => this.showRegisterStep1();
        window.nextToEmailStep = () => this.nextToEmailStep();
        window.completeRegistration = () => this.completeRegistration();
        window.showForgotPassword = () => this.showForgotPassword();
        window.sendResetLink = () => this.sendResetLink();
        window.showAuth = () => this.showAuth();
        window.logout = () => this.logout();
        window.copyTelegramCommand = () => this.copyTelegramCommand();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ProdBoostApp();
});
