from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import datetime
import os
import time
import psycopg2
from psycopg2 import OperationalError
import logging
from functools import wraps
import requests

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Конфигурация из .env
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'fallback-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'postgresql://taskflow_user:taskflow_pass@db/taskflow_db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Токены из .env
TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN')
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN')
GITHUB_REPO = "AleksandrSergeyevich/coursework-taskflow"

db = SQLAlchemy(app)

# Модель пользователя
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    telegram_chat_id = db.Column(db.String(50), nullable=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

# Модель задачи
class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(500), nullable=True)
    status = db.Column(db.String(20), default='Создана')
    due_date = db.Column(db.Date, nullable=True)  # ← ДОБАВЛЕНО
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    github_issue_number = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "status": self.status,
            "due_date": self.due_date.isoformat() if self.due_date else None,  # ← ДОБАВЛЕНО
            "user_id": self.user_id,
            "github_issue_number": self.github_issue_number,
            "created_at": self.created_at.isoformat()
        }

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
        # Создаём тестового пользователя, если нет
        if not User.query.first():
            test_user = User(username='admin')
            test_user.set_password('admin')
            db.session.add(test_user)
            db.session.commit()
            logger.info("✅ Created test user: admin / admin")
        logger.info("✅ Tables created")
        _initialized = True

# Генерация JWT токена
def generate_token(user_id):
    token = jwt.encode({
        'user_id': user_id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }, app.config['SECRET_KEY'], algorithm="HS256")
    return token

# Исправленный декоратор
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(" ")[1]
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.get(data['user_id'])
        except:
            return jsonify({'message': 'Token is invalid!'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

# 🤖 Функция отправки Telegram-уведомления
def send_telegram_notification(chat_id, text):
    if not TELEGRAM_BOT_TOKEN or not chat_id:
        logger.warning("Telegram bot token or chat_id not set")
        return
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        data = {"chat_id": chat_id, "text": text}
        response = requests.post(url, data=data)
        if response.status_code == 200:
            logger.info(f"✅ Telegram notification sent to {chat_id}")
        else:
            logger.error(f"❌ Failed to send Telegram notification: {response.text}")
    except Exception as e:
        logger.error(f"❌ Telegram error: {e}")

# 🐙 Функция создания GitHub Issue
def create_github_issue(title, body):
    if not GITHUB_TOKEN:
        logger.warning("GitHub token not set")
        return None
    try:
        url = f"https://api.github.com/repos/{GITHUB_REPO}/issues"
        headers = {
            "Authorization": f"token {GITHUB_TOKEN}",
            "Accept": "application/vnd.github.v3+json"
        }
        data = {"title": title, "body": body}
        response = requests.post(url, headers=headers, json=data)
        if response.status_code == 201:
            issue_number = response.json()['number']
            logger.info(f"✅ GitHub Issue #{issue_number} created")
            return issue_number
        else:
            logger.error(f"❌ Failed to create GitHub Issue: {response.text}")
            return None
    except Exception as e:
        logger.error(f"❌ GitHub error: {e}")
        return None

# Эндпоинты

## Регистрация
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({"error": "Username and password required"}), 400

    if User.query.filter_by(username=data['username']).first():
        return jsonify({"error": "User already exists"}), 400

    new_user = User(username=data['username'])
    new_user.set_password(data['password'])
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"message": "User registered successfully"}), 201

## Авторизация
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(username=data['username']).first()
    if not user or not user.check_password(data['password']):
        return jsonify({"error": "Invalid credentials"}), 401

    token = generate_token(user.id)
    return jsonify({"token": token, "user_id": user.id})

## Telegram Webhook
@app.route('/telegram-webhook', methods=['POST'])
def telegram_webhook():
    data = request.json
    if not data or 'message' not in data:
        return jsonify({"status": "ignored"})

    message = data['message']
    chat_id = str(message['chat']['id'])
    text = message.get('text', '')

    if text.startswith('/start'):
        parts = text.split()
        if len(parts) > 1 and parts[1].isdigit():
            user_id = int(parts[1])
            user = User.query.get(user_id)
            if user:
                user.telegram_chat_id = chat_id
                db.session.commit()
                logger.info(f"✅ Telegram chat_id {chat_id} привязан к пользователю {user.username}")
                send_telegram_notification(chat_id, f"✅ Ваш Telegram аккаунт успешно привязан к TaskFlow!")
            else:
                send_telegram_notification(chat_id, "❌ Пользователь не найден.")
        else:
            send_telegram_notification(chat_id, "ℹ️ Используйте команду в формате: /start <user_id>")
    
    return jsonify({"status": "ok"})

## Получить все задачи пользователя
@app.route('/tasks', methods=['GET'])
@token_required
def get_tasks(current_user):
    status = request.args.get('status')
    query = Task.query.filter_by(user_id=current_user.id)
    if status:
        query = query.filter_by(status=status)
    tasks = query.all()
    return jsonify([task.to_dict() for task in tasks])

## Создать задачу (+ GitHub Issue)
@app.route('/tasks', methods=['POST'])
@token_required
def create_task(current_user):
    data = request.get_json()
    if not data or 'title' not in data or not isinstance(data['title'], str) or not data['title'].strip():
        return jsonify({"error": "Title is required and must be a non-empty string"}), 400

    new_task = Task(
        title=data['title'].strip(),
        description=data.get('description', ''),
        due_date=data.get('due_date'),  # ← ДОБАВЛЕНО
        user_id=current_user.id
    )
    db.session.add(new_task)
    db.session.commit()

    # 🐙 Создаём GitHub Issue
    issue_number = create_github_issue(
        title=f"Task: {new_task.title}",
        body=f"Description: {new_task.description}\nDue Date: {new_task.due_date}\nCreated via TaskFlow at {new_task.created_at}"
    )
    if issue_number:
        new_task.github_issue_number = issue_number
        db.session.commit()

    return jsonify(new_task.to_dict()), 201

## Обновить статус задачи (+ Telegram уведомление)
@app.route('/tasks/<int:task_id>/status', methods=['PUT'])
@token_required
def update_task_status(current_user, task_id):
    task = Task.query.filter_by(id=task_id, user_id=current_user.id).first()
    if not task:
        return jsonify({"error": "Task not found or access denied"}), 404

    data = request.get_json()
    if 'status' not in data or data['status'] not in ['Создана', 'В работе', 'Завершена']:
        return jsonify({"error": "Invalid status"}), 400

    old_status = task.status
    task.status = data['status']
    db.session.commit()

    # 🤖 Отправляем Telegram-уведомление
    user = User.query.get(current_user.id)
    if user.telegram_chat_id:
        message = f"✅ Задача обновлена!\n\n📌 {task.title}\n🔄 Статус: {old_status} → {task.status}"
        send_telegram_notification(user.telegram_chat_id, message)

    return jsonify(task.to_dict())

## Удалить задачу
@app.route('/tasks/<int:task_id>', methods=['DELETE'])
@token_required
def delete_task(current_user, task_id):
    task = Task.query.filter_by(id=task_id, user_id=current_user.id).first()
    if not task:
        return jsonify({"error": "Task not found or access denied"}), 404
    db.session.delete(task)
    db.session.commit()
    return jsonify({"message": "Task deleted"})

## Поиск задач
@app.route('/tasks/search', methods=['GET'])
@token_required
def search_tasks(current_user):
    query = request.args.get('q', '')
    tasks = Task.query.filter(
        Task.user_id == current_user.id,
        Task.title.ilike(f'%{query}%')
    ).all()
    return jsonify([task.to_dict() for task in tasks])

## Health-check
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "OK"}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
