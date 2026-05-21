# Быстрый старт Visual CMS

Обзор проекта — [README.md](README.md). Состояние и техдолг —
[PROJECT_STATUS_REPORT.md](PROJECT_STATUS_REPORT.md). Реестр функций —
[docs/feature-inventory.md](docs/feature-inventory.md).

## Шаг 1. Зависимости

```bash
npm install                 # корневые скрипты (concurrently и пр.)
cd frontend && npm install
cd ../backend && npm install
```

Backend тянет `sharp` (нативный модуль обработки изображений). Для его сборки
нужен тулчейн: на Windows — Visual C++ Build Tools, на Linux —
`build-essential` и `python3`. Если `sharp` не собрался, `MediaService`
не запустится — переустановите зависимости backend после установки тулчейна.

## Шаг 2. Окружение backend

```bash
cd backend
cp .env.example .env
```

Переменные (`backend/.env.example`):

```text
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://cms_user:cms_password@localhost:5432/visual_cms
REDIS_URL=redis://localhost:6379
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=cms-media
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
```

Примечание: переменные `JWT_*` присутствуют в шаблоне, но аутентификация в коде
не реализована (выносится во внешний сервис) — они зарезервированы.

## Шаг 3. Инфраструктура

Вариант А — Docker (из корня):

```bash
npm run docker:up     # PostgreSQL 5432, Redis 6379, MinIO 9000/9001
docker-compose ps
```

Вариант Б — локальные PostgreSQL/Redis/MinIO с настройкой `.env` под них.

Схема БД создаётся автоматически при первом старте backend: `synchronize: false`,
идемпотентные миграции из `backend/src/migrations` применяются через
`runSafeMigrations`. Отдельная команда миграции не требуется.

## Шаг 4. Запуск

```bash
npm run dev           # frontend + backend параллельно (из корня)
```

Или раздельно: `cd frontend && npm run dev` и `cd backend && npm run dev`.

## Шаг 5. Адреса

- Frontend: <http://localhost:3000>
- Backend API: <http://localhost:5000/api>
- Swagger UI: <http://localhost:5000/api/docs>
- MinIO Console: <http://localhost:9001> (minioadmin / minioadmin)

## Структура проекта

```text
visual-cms/
├── frontend/   # app/ (store, routes), features/, pages/, shared/, widgets/
├── backend/    # config/, controllers/, models/, routes/, services/,
│               # middleware/, migrations/, schemas/, docs/ (OpenAPI), __tests__/
├── public-site/# сгенерированные статические сайты (nginx)
├── docs/       # спецификации и реестр функций
└── docker-compose.yml
```

## Первые шаги

1. Создать страницу: на главной — «Создать страницу», перетащить элементы
   из левой панели на холст, настроить свойства справа, сохранить
   (есть автосохранение с debounce).
2. Layout-режимы: выбрать контейнер, в правой панели переключить
   flex/grid/absolute/table, настроить специфичные свойства.
3. Переиспользуемый блок: раздел «Блоки» — создать и сохранить;
   использовать на страницах через библиотеку (linked-блоки
   синхронизируются из библиотеки при чтении страницы).

## Тесты

```bash
cd backend  && npm test   # Jest + ts-jest (21 suite, 447 тестов)
cd frontend && npm test   # Vitest (176 тестов)
```

E2E-тестов нет. Покрытие как метрика не измеряется.

## Полезные команды

```bash
docker-compose down       # остановить контейнеры
docker-compose up --build # пересобрать
docker-compose logs -f    # логи
docker-compose down -v    # очистить включая volumes
npm run build             # прод-сборка frontend + backend (из корня)
```

## Горячие клавиши

- **Ctrl+Z / Ctrl+Y** — undo/redo
- **Ctrl+S** — явное сохранение (помимо автосейва)
- **Delete / Backspace** — удалить выбранный элемент (root защищён)
- **Ctrl+D** — дублировать выбранный
- **Ctrl+C / Ctrl+V** — копировать/вставить элемент через буфер обмена
- **Ctrl+колесо** — zoom (25–500%)
- **Space + перетаскивание** — pan холста

Все шорткаты не срабатывают при фокусе в `input`/`textarea`/contenteditable.

## Отладка

- Frontend не стартует: Node.js 18+, переустановить `node_modules`,
  проверить занятость порта 3000.
- Backend не подключается к БД: PostgreSQL поднят (`docker-compose ps`),
  корректный `DATABASE_URL` в `.env`, логи `docker-compose logs postgres`.
- Ошибка импорта `sharp` в backend: не собран нативный модуль — установить
  тулчейн (см. Шаг 1) и переустановить зависимости backend.
- Drag&Drop: открыть консоль браузера (F12), проверить ошибки, убедиться,
  что элемент бросается в контейнер.
