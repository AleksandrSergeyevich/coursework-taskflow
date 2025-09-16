const taskList = document.getElementById('taskList');
const taskInput = document.getElementById('taskInput');

async function loadTasks() {
    taskList.innerHTML = '<li>Загрузка задач...</li>';
    try {
        const res = await fetch('http://192.168.50.94:5000/tasks'); // ← ЗАМЕНИ НА СВОЙ IP!
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const tasks = await res.json();
        taskList.innerHTML = '';
        if (tasks.length === 0) {
            taskList.innerHTML = '<li>Список задач пуст</li>';
        } else {
            tasks.forEach(task => {
                const li = document.createElement('li');
                li.innerHTML = `
                    ${task.title} 
                    <span class="delete-btn" onclick="deleteTask(${task.id})">🗑️</span>
                `;
                taskList.appendChild(li);
            });
        }
    } catch (err) {
        taskList.innerHTML = `<li style="color: red">❌ Ошибка загрузки: ${err.message}</li>`;
        console.error("Ошибка при загрузке задач:", err);
    }
}

async function addTask() {
    const title = taskInput.value.trim();
    if (!title) {
        alert('❗ Пожалуйста, введите название задачи.');
        return;
    }

    // Блокируем поле ввода
    taskInput.disabled = true;
    const originalValue = taskInput.value;
    taskInput.value = 'Добавление...';

    try {
        const res = await fetch('http://192.168.50.94:5000/tasks', { // ← ЗАМЕНИ НА СВОЙ IP!
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title })
        });
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`HTTP ${res.status}: ${errorText}`);
        }
        await loadTasks();
        taskInput.value = ''; // Очищаем поле
    } catch (err) {
        alert(`❌ Ошибка при добавлении задачи: ${err.message}`);
        console.error("Ошибка при добавлении задачи:", err);
    } finally {
        taskInput.disabled = false;
        if (taskInput.value === 'Добавление...') {
            taskInput.value = originalValue;
        }
    }
}

async function deleteTask(id) {
    if (!confirm('❓ Вы уверены, что хотите удалить эту задачу?')) return;

    try {
        const res = await fetch(`http://192.168.50.94:5000/tasks/${id}`, { // ← ЗАМЕНИ НА СВОЙ IP!
            method: 'DELETE'
        });
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`HTTP ${res.status}: ${errorText}`);
        }
        await loadTasks();
    } catch (err) {
        alert(`❌ Ошибка при удалении задачи: ${err.message}`);
        console.error("Ошибка при удалении задачи:", err);
    }
}

// Загружаем задачи при открытии страницы
document.addEventListener('DOMContentLoaded', loadTasks);
