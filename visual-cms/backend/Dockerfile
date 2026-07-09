FROM node:20-alpine

WORKDIR /app

# Build toolchain для нативных npm-модулей:
#  - python3/make/g++: fallback-компиляция node-gyp, когда prebuild-install
#    недоступен/таймаутит (better-sqlite3). Без них npm install падает с "not found: make".
#  - vips-dev: sharp (обработка изображений).
RUN apk add --no-cache python3 make g++ vips-dev

COPY package*.json ./
RUN npm install

COPY . .

# Entrypoint синхронизирует node_modules с package.json на КАЖДОМ старте — иначе
# анонимный том /app/node_modules (dev-compose) отстаёт при добавлении зависимостей
# и бэкенд падает с «Cannot find module …».
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 5000

# Запуск через `sh`, а НЕ exec-формой ["/app/docker-entrypoint.sh"]: dev-compose
# bind-монтирует ./backend:/app и перекрывает слой образа (с chmod +x) хостовым
# файлом, у которого на Windows нет exec-бита → "permission denied". sh читает
# скрипт по read-биту (есть у 644), exec-бит не требуется.
ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]
