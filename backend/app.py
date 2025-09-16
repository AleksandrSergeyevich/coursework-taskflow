from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import os
import time
import psycopg2
from psycopg2 import OperationalError
import logging

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Конфигурация БД
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'postgresql://taskflow_user:taskflow_pass@db/taskflow_db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Модель задачи
class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    done = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {"id": self.id, "title": self.title, "done": self.done}

# Функция ожидания БД
def wait_for_db():
    max_retries = 10
    retry_delay = 3
    for i in range(max_retries):
        try:
            conn = psycopg2.connect(
                host=os.environ.get('DB_HOST', 'db'),
                database=os.environ.get('POSTGRES_DB', 'taskflow_db'),
                user=os.environ.get('POSTGRES_USER', 'taskflow_user'),
                password=os.environ.get('POSTGRES_PASSWORD', 'taskflow_pass')
            )
            conn.close()
            logger.info("✅ PostgreSQL is ready!")
            return True
        except OperationalError:
            logger.info(f"⏳ Waiting for PostgreSQL... ({i+1}/{max_retries})")
            time.sleep(retry_delay)
    raise Exception("❌ PostgreSQL is not available after multiple retries")

# Глобальный флаг для инициализации
_initialized = False

@app.before_request
def initialize_once():
    global _initialized
    if not _initialized:
        wait_for_db()
        db.create_all()
        logger.info("✅ Tables created")
        _initialized = True

# Эндпоинты
@app.route('/tasks', methods=['GET'])
def get_tasks():
    logger.info("Fetching all tasks")
    tasks = Task.query.all()
    return jsonify([task.to_dict() for task in tasks])

@app.route('/tasks', methods=['POST'])
def create_task():
    logger.info("Received request to create a new task")
    data = request.get_json()
    if not data or 'title' not in data or not isinstance(data['title'], str) or not data['title'].strip():
        logger.warning("Validation failed: title is missing or invalid")
        return jsonify({"error": "Title is required and must be a non-empty string"}), 400

    new_task = Task(title=data['title'].strip())
    db.session.add(new_task)
    db.session.commit()
    logger.info(f"Task created with ID: {new_task.id}")
    return jsonify(new_task.to_dict()), 201

@app.route('/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    logger.info(f"Received request to delete task with ID: {task_id}")
    task = Task.query.get(task_id)
    if not task:
        logger.warning(f"Task with ID {task_id} not found")
        return jsonify({"error": "Task not found"}), 404
    db.session.delete(task)
    db.session.commit()
    logger.info(f"Task with ID {task_id} deleted")
    return jsonify({"message": "Task deleted"})

@app.route('/health', methods=['GET'])
def health_check():
    logger.info("Health check requested")
    return jsonify({"status": "OK"}), 200

if __name__ == '__main__':
    # Слушаем на всех интерфейсах — для доступа по IP
    app.run(host='0.0.0.0', port=5000)
