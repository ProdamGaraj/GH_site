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

EXPOSE 5000

CMD ["npm", "run", "dev"]
