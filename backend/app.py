from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import os
import time
import psycopg2
from psycopg2 import OperationalError

app = Flask(__name__)
CORS(app)  # Разрешаем CORS для фронтенда

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
            print("✅ PostgreSQL is ready!")
            return True
        except OperationalError:
            print(f"⏳ Waiting for PostgreSQL... ({i+1}/{max_retries})")
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
        print("✅ Tables created")
        _initialized = True

# Эндпоинты
@app.route('/tasks', methods=['GET'])
def get_tasks():
    tasks = Task.query.all()
    return jsonify([task.to_dict() for task in tasks])

@app.route('/tasks', methods=['POST'])
def create_task():
    data = request.get_json()
    new_task = Task(title=data['title'])
    db.session.add(new_task)
    db.session.commit()
    return jsonify(new_task.to_dict()), 201

@app.route('/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    task = Task.query.get(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    db.session.delete(task)
    db.session.commit()
    return jsonify({"message": "Task deleted"})

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "OK"}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
