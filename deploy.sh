#!/bin/bash

echo "🔄 Копирую файлы фронтенда в /var/www/prodboost/..."
sudo cp ./frontend/index.html /var/www/prodboost/
sudo cp ./frontend/script.js /var/www/prodboost/
sudo cp ./frontend/style.css /var/www/prodboost/
sudo chown -R www-data:www-data /var/www/prodboost/
sudo chmod -R 755 /var/www/prodboost/

echo "✅ Файлы фронтенда скопированы!"

echo "🔄 Копирую шаблоны админки в /var/www/prodboost/templates/admin/..."
sudo mkdir -p /var/www/prodboost/templates/admin/
sudo cp ./backend/templates/admin/dashboard.html /var/www/prodboost/templates/admin/
sudo chown -R www-data:www-data /var/www/prodboost/templates/
sudo chmod -R 755 /var/www/prodboost/templates/

echo "✅ Шаблоны админки скопированы!"

echo "🔄 Перезагружаю Nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo "✅ Готово! Откройте https://prodboost.ru"
