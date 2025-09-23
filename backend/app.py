from flask import Flask, request, jsonify, redirect, session
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
import hashlib
import hmac
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Flask-Admin
from flask_admin import Admin
from flask_admin.contrib.sqla import ModelView

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Secret key for sessions (used by Flask-Admin)
app.secret_key = os.environ.get('SECRET_KEY', 'fallback-secret-key-for-sessions')

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'fallback-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
    'DATABASE_URL', 
    'postgresql://taskflow_user:taskflow_pass@db/taskflow_db'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Environment variables
TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN')
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN')
GITHUB_REPO = os.environ.get('GITHUB_REPO', "AleksandrSergeyevich/coursework-taskflow")

# Email configuration
SMTP_SERVER = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
SMTP_USERNAME = os.environ.get('SMTP_USERNAME')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD')

# In-memory storage for password reset tokens
reset_tokens = {}

# Initialize database
db = SQLAlchemy(app)

# Models
class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    telegram_chat_id = db.Column(db.String(50), nullable=True)
    telegram_id = db.Column(db.String(50), nullable=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Task(db.Model):
    __tablename__ = 'tasks'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(500), nullable=True)
    status = db.Column(db.String(20), default='Создана')
    due_date = db.Column(db.Date, nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    github_issue_number = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "status": self.status,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "user_id": self.user_id,
            "github_issue_number": self.github_issue_number,
            "created_at": self.created_at.isoformat()
        }

# Database initialization
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

_initialized = False

@app.before_request
def initialize_once():
    global _initialized
    if not _initialized:
        wait_for_db()
        db.create_all()
        if not User.query.first():
            test_user = User(username='admin', email='admin@example.com')
            test_user.set_password('admin')
            db.session.add(test_user)
            db.session.commit()
            logger.info("✅ Created test user: admin / admin")
        logger.info("✅ Database initialized")
        _initialized = True

# JWT Token generation
def generate_token(user_id):
    token = jwt.encode({
        'user_id': user_id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }, app.config['SECRET_KEY'], algorithm="HS256")
    return token

# JWT Token required decorator
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
        except Exception as e:
            logger.error(f"Token decode error: {e}")
            return jsonify({'message': 'Token is invalid!'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

# Send email function
def send_email(to_email, subject, body):
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        logger.warning("SMTP credentials not set - email not sent")
        logger.info(f"📧 Mock email to {to_email}: {subject}\n{body}")
        return True

    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_USERNAME
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        text = msg.as_string()
        server.sendmail(SMTP_USERNAME, to_email, text)
        server.quit()
        logger.info(f"✅ Email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to send email: {e}")
        return False

# Telegram notification function
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

# GitHub Issue creation function
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

# === Flask-Admin Configuration ===
class AdminModelView(ModelView):
    def is_accessible(self):
        # Проверяем наличие JWT токена в заголовке Authorization
        token = request.headers.get('Authorization')
        if token:
            try:
                token = token.split(" ")[1]
                data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
                user = User.query.get(data['user_id'])
                # Разрешаем доступ, если username == 'admin'
                return user and user.username == 'admin'
            except:
                pass
        # Также проверяем сессию (для ручного входа в админку)
        return session.get('is_admin', False)

    def inaccessible_callback(self, name, **kwargs):
        # Перенаправляем на страницу входа, если доступ запрещён
        return redirect('/admin/login')

# Создаём админ-панель
admin = Admin(app, name='ProdBoost Admin', template_mode='bootstrap4')
admin.add_view(AdminModelView(User, db.session, name='Пользователи'))
admin.add_view(AdminModelView(Task, db.session, name='Задачи'))

# Эндпоинт для входа в админку (ручной вход)
@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user = User.query.filter_by(username=username).first()
        if user and user.check_password(password) and user.username == 'admin':
            session['is_admin'] = True
            return redirect('/admin')
        else:
            return 'Invalid credentials', 401
    return '''
        <!DOCTYPE html>
        <html>
        <head><title>Admin Login</title></head>
        <body>
            <h2>🔐 Вход в админ-панель</h2>
            <form method="post">
                <input type="text" name="username" placeholder="Username" required><br><br>
                <input type="password" name="password" placeholder="Password" required><br><br>
                <input type="submit" value="Login">
            </form>
        </body>
        </html>
    '''

# === Routes ===

## Проверка уникальности username
@app.route('/check-username', methods=['POST'])
def check_username():
    try:
        data = request.get_json()
        username = data.get('username')
        if not username:
            return jsonify({"error": "Username is required"}), 400
        
        user = User.query.filter_by(username=username).first()
        exists = user is not None
        
        logger.info(f"🔍 Проверка username: {username} — {'занят' if exists else 'свободен'}")
        return jsonify({"exists": exists})
    except Exception as e:
        logger.error(f"Ошибка проверки username: {e}")
        return jsonify({"error": "Internal server error"}), 500

## User Registration
@app.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        if not data or not data.get('username') or not data.get('password') or not data.get('email'):
            logger.warning("Registration: Missing username, password or email")
            return jsonify({"error": "Username, password and email required"}), 400
        
        if User.query.filter_by(username=data['username']).first():
            logger.warning(f"Registration: User {data['username']} already exists")
            return jsonify({"error": "User already exists"}), 400
        
        if User.query.filter_by(email=data['email']).first():
            logger.warning(f"Registration: Email {data['email']} already exists")
            return jsonify({"error": "Email already exists"}), 400
        
        new_user = User(
            username=data['username'], 
            email=data['email']
        )
        new_user.set_password(data['password'])
        db.session.add(new_user)
        db.session.commit()
        
        logger.info(f"✅ User registered: {data['username']} with email {data['email']}")
        return jsonify({"message": "User registered successfully"}), 201
    except Exception as e:
        logger.error(f"Registration error: {e}")
        return jsonify({"error": "Internal server error"}), 500

## User Login
@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        user = User.query.filter_by(username=data['username']).first()
        
        if not user or not user.check_password(data['password']):
            logger.warning(f"Login failed for user: {data.get('username')}")
            return jsonify({"error": "Invalid credentials"}), 401
        
        token = generate_token(user.id)
        logger.info(f"✅ User logged in: {user.username}")
        
        return jsonify({
            "token": token, 
            "user_id": user.id,
            "username": user.username
        })
    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({"error": "Internal server error"}), 500

## Telegram Login Widget — авторизация
@app.route('/auth/telegram', methods=['GET'])
def auth_telegram():
    data = request.args
    check_hash = data.get('hash')
    if not check_hash:
        logger.error("❌ Telegram hash is missing")
        return jsonify({"error": "Invalid hash"}), 400

    data_dict = dict(data)
    data_dict.pop('hash', None)

    sorted_data = sorted(data_dict.items(), key=lambda x: x[0])
    data_check_string = "\n".join([f"{k}={v}" for k, v in sorted_data])

    secret_key = hashlib.sha256(b"WebAppData").digest()
    _hash = hmac.new(key=secret_key, msg=data_check_string.encode(), digestmod=hashlib.sha256).hexdigest()

    if _hash != check_hash:
        logger.error("❌ Invalid Telegram hash")
        logger.error(f"Calculated: {_hash}")
        logger.error(f"Received:   {check_hash}")
        return jsonify({"error": "Invalid hash"}), 400

    telegram_id = data.get('id')
    username = data.get('username', f"user_{telegram_id}")
    first_name = data.get('first_name', "")

    user = User.query.filter_by(telegram_id=str(telegram_id)).first()
    if not user:
        user = User(username=username, telegram_id=str(telegram_id), email=f"{username}@telegram.local")
        user.set_password(str(telegram_id))
        db.session.add(user)
        db.session.commit()
        logger.info(f"✅ Created new user via Telegram: {username}")

    token = generate_token(user.id)
    return redirect(f"https://prodboost.ru?token={token}&user_id={user.id}")

## Forgot Password
@app.route('/forgot-password', methods=['POST'])
def forgot_password():
    try:
        data = request.get_json()
        email = data.get('email')
        if not email:
            logger.warning("Forgot password: Email is required")
            return jsonify({"error": "Email is required"}), 400
        
        user = User.query.filter_by(email=email).first()
        if not user:
            logger.info(f"Forgot password: Request for non-existent email: {email}")
            return jsonify({"message": "If email exists, reset link was sent"}), 200
        
        token = secrets.token_urlsafe(32)
        reset_tokens[token] = user.id
        
        reset_url = f"https://prodboost.ru/reset-password?token={token}"
        subject = "ProdBoost: Восстановление пароля"
        body = f"Здравствуйте!\n\nДля восстановления пароля перейдите по ссылке:\n{reset_url}\n\nСсылка действительна 1 час.\n\nС уважением, команда ProdBoost"
        
        if send_email(email, subject, body):
            logger.info(f"🔑 Password reset link sent to {email}")
            return jsonify({"message": "If email exists, reset link was sent"}), 200
        else:
            return jsonify({"error": "Failed to send email"}), 500
    except Exception as e:
        logger.error(f"Forgot password error: {e}")
        return jsonify({"error": "Internal server error"}), 500

## Reset Password
@app.route('/reset-password', methods=['POST'])
def reset_password():
    try:
        data = request.get_json()
        token = data.get('token')
        new_password = data.get('new_password')
        
        if not token or not new_password:
            logger.warning("Reset password: Token and new_password are required")
            return jsonify({"error": "Token and new_password are required"}), 400
        
        user_id = reset_tokens.get(token)
        if not user_id:
            logger.warning("Reset password: Invalid or expired token")
            return jsonify({"error": "Invalid or expired token"}), 400
        
        user = User.query.get(user_id)
        if not user:
            logger.warning("Reset password: User not found")
            return jsonify({"error": "User not found"}), 404
        
        user.set_password(new_password)
        db.session.commit()
        del reset_tokens[token]
        
        logger.info(f"✅ Password reset for user: {user.username}")
        return jsonify({"message": "Password reset successful"}), 200
    except Exception as e:
        logger.error(f"Reset password error: {e}")
        return jsonify({"error": "Internal server error"}), 500

## Telegram Webhook
@app.route('/telegram-webhook', methods=['POST'])
def telegram_webhook():
    try:
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
                    logger.info(f"✅ Telegram chat_id {chat_id} linked to user {user.username}")
                    send_telegram_notification(chat_id, "✅ Ваш Telegram аккаунт успешно привязан к ProdBoost!")
                else:
                    send_telegram_notification(chat_id, "❌ Пользователь не найден.")
            else:
                send_telegram_notification(chat_id, "ℹ️ Используйте команду в формате: /start <user_id>")
        
        return jsonify({"status": "ok"})
    except Exception as e:
        logger.error(f"Telegram webhook error: {e}")
        return jsonify({"error": "Internal server error"}), 500

## Get User Tasks
@app.route('/tasks', methods=['GET'])
@token_required
def get_tasks(current_user):
    try:
        status = request.args.get('status')
        query = Task.query.filter_by(user_id=current_user.id)
        if status:
            query = query.filter_by(status=status)
        tasks = query.all()
        logger.info(f"✅ Retrieved {len(tasks)} tasks for user: {current_user.username}")
        return jsonify([task.to_dict() for task in tasks])
    except Exception as e:
        logger.error(f"Get tasks error: {e}")
        return jsonify({"error": "Internal server error"}), 500

## Create Task
@app.route('/tasks', methods=['POST'])
@token_required
def create_task(current_user):
    try:
        data = request.get_json()
        if not data or 'title' not in data or not isinstance(data['title'], str) or not data['title'].strip():
            logger.warning("Create task: Invalid title")
            return jsonify({"error": "Title is required and must be a non-empty string"}), 400
        
        new_task = Task(
            title=data['title'].strip(),
            description=data.get('description', ''),
            due_date=data.get('due_date'),
            user_id=current_user.id
        )
        db.session.add(new_task)
        db.session.commit()
        
        issue_number = create_github_issue(
            title=f"Task: {new_task.title}",
            body=f"Description: {new_task.description}\nDue Date: {new_task.due_date}\nCreated via ProdBoost at {new_task.created_at}"
        )
        if issue_number:
            new_task.github_issue_number = issue_number
            db.session.commit()
        
        logger.info(f"✅ Task created: {new_task.title} by user: {current_user.username}")
        return jsonify(new_task.to_dict()), 201
    except Exception as e:
        logger.error(f"Create task error: {e}")
        return jsonify({"error": "Internal server error"}), 500

## Update Task Status
@app.route('/tasks/<int:task_id>/status', methods=['PUT'])
@token_required
def update_task_status(current_user, task_id):
    try:
        task = Task.query.filter_by(id=task_id, user_id=current_user.id).first()
        if not task:
            logger.warning(f"Update task status: Task {task_id} not found for user: {current_user.username}")
            return jsonify({"error": "Task not found or access denied"}), 404
        
        data = request.get_json()
        if 'status' not in data or data['status'] not in ['Создана', 'В работе', 'Завершена']:
            logger.warning(f"Update task status: Invalid status: {data.get('status')}")
            return jsonify({"error": "Invalid status"}), 400
        
        old_status = task.status
        task.status = data['status']
        db.session.commit()
        
        user = User.query.get(current_user.id)
        if user.telegram_chat_id:
            message = f"✅ Задача обновлена!\n📌 {task.title}\n🔄 Статус: {old_status} → {task.status}"
            send_telegram_notification(user.telegram_chat_id, message)
        
        logger.info(f"✅ Task status updated: {task.title} from {old_status} to {task.status} by user: {current_user.username}")
        return jsonify(task.to_dict())
    except Exception as e:
        logger.error(f"Update task status error: {e}")
        return jsonify({"error": "Internal server error"}), 500

## Delete Task
@app.route('/tasks/<int:task_id>', methods=['DELETE'])
@token_required
def delete_task(current_user, task_id):
    try:
        task = Task.query.filter_by(id=task_id, user_id=current_user.id).first()
        if not task:
            logger.warning(f"Delete task: Task {task_id} not found for user: {current_user.username}")
            return jsonify({"error": "Task not found or access denied"}), 404
        
        db.session.delete(task)
        db.session.commit()
        
        logger.info(f"✅ Task deleted: {task.title} by user: {current_user.username}")
        return jsonify({"message": "Task deleted"})
    except Exception as e:
        logger.error(f"Delete task error: {e}")
        return jsonify({"error": "Internal server error"}), 500

## Search Tasks
@app.route('/tasks/search', methods=['GET'])
@token_required
def search_tasks(current_user):
    try:
        query = request.args.get('q', '')
        tasks = Task.query.filter(
            Task.user_id == current_user.id,
            Task.title.ilike(f'%{query}%')
        ).all()
        logger.info(f"✅ Searched {len(tasks)} tasks for query: '{query}' by user: {current_user.username}")
        return jsonify([task.to_dict() for task in tasks])
    except Exception as e:
        logger.error(f"Search tasks error: {e}")
        return jsonify({"error": "Internal server error"}), 500

## Health Check
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "OK"}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
