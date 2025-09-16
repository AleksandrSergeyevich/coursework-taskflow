async function loadTasks() {
    try {
        const res = await fetch('http://localhost:5000/tasks');
        const tasks = await res.json();
        const list = document.getElementById('taskList');
        list.innerHTML = '';
        tasks.forEach(task => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${task.title}</span>
                <button class="delete-btn" onclick="deleteTask(${task.id})">×</button>
            `;
            list.appendChild(li);
        });
    } catch (error) {
        console.error('Ошибка загрузки задач:', error);
    }
}

async function addTask() {
    const input = document.getElementById('taskInput');
    const title = input.value.trim();
    if (!title) {
        alert('Введите название задачи!');
        return;
    }

    try {
        await fetch('http://localhost:5000/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title })
        });
        input.value = '';
        loadTasks();
    } catch (error) {
        console.error('Ошибка добавления задачи:', error);
    }
}

async function deleteTask(id) {
    try {
        await fetch(`http://localhost:5000/tasks/${id}`, { method: 'DELETE' });
        loadTasks();
    } catch (error) {
        console.error('Ошибка удаления задачи:', error);
    }
}

// Загружаем задачи при открытии страницы
document.addEventListener('DOMContentLoaded', loadTasks);
