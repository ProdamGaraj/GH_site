# Visual CMS

No-code/low-code визуальный конструктор веб-сайтов: drag&drop редактор страниц с
привязкой к внешним данным, мультисайтовостью, мультиязычностью, формами,
аналитикой и публикацией в статический HTML.

Версия определяется единственным источником — `package.json` (текущая: 1.0.0).
Историю изменений см. в git и в [PROJECT_STATUS_REPORT.md](PROJECT_STATUS_REPORT.md).

## Возможности

Полный реестр функций с критичностью и статусом — в
[docs/feature-inventory.md](docs/feature-inventory.md) (канонический документ).
Кратко:

- Визуальный редактор: drag&drop, дерево слоёв, 20+ типов элементов,
  4 режима layout (flex/grid/absolute/table), состояния (hover/active/focus),
  анимации, адаптивные breakpoints, zoom/pan, undo/redo, автосохранение,
  inline-редактирование, кастомный CSS (Monaco), экспорт в HTML/CSS/JSON.
- Блоки и шаблоны: переиспользуемые и связанные (linked) блоки,
  Template-режим с автоопределением полей, библиотека сохранённых блоков.
- Привязка данных (Data Binding): источники REST/GraphQL/Database/Feed/External,
  INPUT/OUTPUT-биндинги, repeater, фильтры, сортировка, пагинация,
  трансформации, join, вычисляемые поля, конвейер обработки, кеширование.
- Переменные страницы: scopes (page/session/global), реактивность, персистенция.
- Мультисайтовость: CRUD сайтов, навигация, раздельный деплой.
- Публикация и деплой: генерация статики, история деплоев, откат, nginx.
- Версионирование страниц, формы с destinations, мультиязычность,
  аналитика (tracker.js, сессии, web vitals, дашборд), mock-сервер.

Известные ограничения и нереализованное (в т.ч. аутентификация — выносится
во внешний сервис) описаны в [docs/feature-inventory.md](docs/feature-inventory.md),
часть 2.

## Структура проекта

```text
visual-cms/
├── frontend/          # React 18 + TypeScript + Vite + Redux Toolkit
├── backend/           # Node.js + Express + TypeScript + TypeORM
├── public-site/       # Сгенерированные статические сайты (отдаются через nginx)
├── docs/              # Спецификации и реестр функций
├── docker-compose.yml # PostgreSQL, Redis, MinIO, сервисы
└── package.json       # Корневые скрипты (dev/build/docker)
```

## Требования

- Node.js 18+
- Docker и Docker Compose (PostgreSQL, Redis, MinIO)
- Тулчейн для сборки нативных модулей (`sharp` для обработки изображений):
  на Windows — Build Tools, на Linux — `build-essential`/`python3`.

## Быстрый старт

Подробные инструкции — [QUICKSTART.md](QUICKSTART.md).

```bash
# 1. Зависимости
npm install
cd frontend && npm install
cd ../backend && npm install   # подтянет и соберёт sharp

# 2. Окружение backend (см. backend/.env.example)
cd backend
cp .env.example .env

# 3. Инфраструктура (PostgreSQL, Redis, MinIO)
cd ..
npm run docker:up

# 4. Запуск dev (frontend + backend)
npm run dev
```

- Frontend: <http://localhost:3000>
- Backend API: <http://localhost:5000/api>
- Swagger UI: <http://localhost:5000/api/docs>
- MinIO Console: <http://localhost:9001> (minioadmin / minioadmin)

Схема БД применяется автоматически при старте backend: `synchronize: false`,
идемпотентные миграции из `backend/src/migrations` выполняются через
`runSafeMigrations` (см. `backend/src/server.ts`).

## Команды

Frontend (`cd frontend`):

```bash
npm run dev      # dev-сервер (Vite, порт 3000)
npm run build    # прод-сборка (tsc + vite build)
npm run preview  # предпросмотр сборки
npm test         # тесты (Vitest)
```

Backend (`cd backend`):

```bash
npm run dev      # dev (nodemon, порт 5000)
npm run build    # сборка TypeScript -> dist/
npm start        # прод-запуск (node dist/server.js)
npm test         # тесты (Jest + ts-jest)
npm run lint     # ESLint
```

Корень:

```bash
npm run dev          # frontend + backend параллельно
npm run build        # сборка обоих
npm run docker:up    # поднять инфраструктуру
npm run docker:down  # остановить инфраструктуру
npm run deploy:all   # деплой всех сайтов (scripts/deploy-all.js)
```

## Технологии

Frontend: React 18, TypeScript, Redux Toolkit, @dnd-kit, Monaco Editor,
TailwindCSS, Vite, React Router, Axios, Zod.

Backend: Node.js, Express, TypeScript, TypeORM, PostgreSQL, Redis,
MinIO (S3-совместимое хранилище), Zod, Jest + ts-jest.

## Документация

- [QUICKSTART.md](QUICKSTART.md) — установка и запуск
- [PROJECT_STATUS_REPORT.md](PROJECT_STATUS_REPORT.md) — состояние проекта (единый статус-документ)
- [docs/feature-inventory.md](docs/feature-inventory.md) — канонический реестр функций
- [docs/data-binding-system-spec.md](docs/data-binding-system-spec.md) — ТЗ системы Data Binding
- [docs/dynamic-project-pages-spec.md](docs/dynamic-project-pages-spec.md) — ТЗ динамических страниц проектов (черновик)
- [docs/html-import-guide.md](docs/html-import-guide.md) — руководство по подготовке HTML к импорту

## Лицензия

MIT
