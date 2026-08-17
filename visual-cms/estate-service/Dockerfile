FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Синхронизация node_modules с package.json на каждом старте (dev-compose
# монтирует анонимный том /app/node_modules, который может отставать).
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 5100

# Через sh (не exec-формой): dev-compose bind-монтирует ./estate-service:/app и
# перекрывает exec-бит слоя образа хостовым файлом (Windows не хранит +x).
ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]
