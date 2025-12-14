FROM python:3.10-slim

WORKDIR /app

# Установка системных зависимостей
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Копирование зависимостей
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копирование приложения
COPY . .

# Создание пользователя для безопасности (опционально)
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Переменные окружения
ENV FLASK_APP=app.py
ENV PYTHONUNBUFFERED=1

# Порт
EXPOSE 5000

# Запуск приложения
CMD ["python", "app.py"]
