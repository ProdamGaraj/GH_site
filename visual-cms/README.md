# Visual CMS - Визуальный конструктор веб-страниц

Полнофункциональная CMS с визуальным редактором для создания веб-страниц и блоков.

## Возможности

- 🎨 **Визуальный редактор** с drag & drop
- 📦 **4 режима layout**: Flexbox, Grid, Absolute, Table
- 🎯 **3 способа вёрстки**: Drag & Drop, Properties Panel, Custom CSS
- 🔄 **Переиспользуемые блоки** - создавайте библиотеку компонентов
- 📱 **Адаптивный дизайн** - поддержка desktop, tablet, mobile
- 💾 **История изменений** - Undo/Redo
- 🚀 **Экспорт** в HTML/CSS

## Структура проекта

```
visual-cms/
├── frontend/          # React + TypeScript + Vite
├── backend/           # Node.js + Express + TypeScript
├── docker-compose.yml # Docker инфраструктура
└── package.json       # Root package.json
```

## Требования

- Node.js 18+
- Docker и Docker Compose
- npm или yarn

## Быстрый старт

### Локальная разработка

1. **Установка зависимостей:**
```bash
npm install
cd frontend && npm install
cd ../backend && npm install
```

2. **Запуск инфраструктуры (PostgreSQL, Redis, MinIO):**
```bash
npm run docker:up
```

3. **Запуск в режиме разработки:**
```bash
npm run dev
```

Frontend будет доступен на http://localhost:3000
Backend API на http://localhost:5000

### Docker (полный стек)

```bash
docker-compose up
```

## Разработка

### Frontend

```bash
cd frontend
npm run dev          # Запуск dev сервера
npm run build        # Production build
npm run preview      # Предпросмотр build
npm run test         # Запуск тестов
```

### Backend

```bash
cd backend
npm run dev          # Запуск с nodemon
npm run build        # Build TypeScript
npm run start        # Запуск production
npm run test         # Запуск тестов
```

## Технологии

### Frontend
- React 18
- TypeScript
- Redux Toolkit
- @dnd-kit (Drag & Drop)
- Monaco Editor (Code editor)
- TailwindCSS
- Vite

### Backend
- Node.js
- Express
- TypeScript
- TypeORM
- PostgreSQL
- Redis
- MinIO (S3-совместимое хранилище)

## Документация

- [Архитектура проекта](../docs/visual-constructor-architecture.md)
- [План реализации](../docs/visual-constructor-implementation-plan.md)
- [План создания сайта](../docs/company-website-cms-plan.md)

## Лицензия

MIT
