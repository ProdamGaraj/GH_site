# Visual CMS — Состояние проекта

Дата: 19 мая 2026
Версия: 1.0.0 (единственный источник — `package.json`; root/frontend/backend синхронизированы)
Назначение: единый статус-документ. Канонический реестр функций с критичностью —
[docs/feature-inventory.md](docs/feature-inventory.md). Этот файл не дублирует реестр,
а описывает текущее техническое состояние, известные проблемы и план.

История версий ведётся в git. Прежние документы STATUS.md и набор
`docs/visual-constructor-*.md` удалены/не существуют — ссылки на них устарели.

---

## 1. Краткое описание

Visual CMS — no-code/low-code конструктор сайтов с drag&drop редактором,
системой привязки данных, мультисайтовостью, мультиязычностью, формами,
аналитикой и публикацией статических сайтов за nginx.

Архитектура — три рантайма:

```text
frontend (редактор)  ->  backend (Express + TypeORM + PostgreSQL)  ->  public-site (nginx, статика)
   React/Redux              22 роутера, 21 модель                       сгенерированный сайт + tracker.js
```

Центральная доменная сущность — рекурсивное дерево `BlockNode`
(`frontend/src/shared/types/index.ts`), сериализуется в `jsonb`
(`pages.structure`, `blocks.structure`).

---

## 2. Реализованные подсистемы

Детальная разбивка по функциям и критичности — в
[docs/feature-inventory.md](docs/feature-inventory.md), часть 1. Сводно реализовано:

- Визуальный редактор (Canvas): drag&drop с валидацией вложенности, дерево слоёв,
  20+ типов элементов, 4 режима layout, состояния, анимации, адаптивные
  breakpoints, zoom/pan, undo/redo, автосохранение, inline-редактирование,
  кастомный CSS (Monaco), экспорт/импорт.
- Блоки и шаблоны: reusable- и linked-блоки, Template-режим с автоопределением
  полей, библиотека сохранённых блоков.
- Data Binding: источники REST/GraphQL/Database/Feed/External; INPUT/OUTPUT;
  repeater; field mapping; фильтры/сортировка/пагинация; трансформации; join;
  вычисляемые поля; конвейер (`DataPipelineService`); кеширование (Redis).
- Переменные страницы: scopes page/session/global, реактивность, персистенция.
- Мультисайтовость: CRUD сайтов, навигация, дублирование, раздельный деплой.
- Публикация и деплой: генерация статики (`HtmlGenerator`/`DeployService`),
  история деплоев, откат (rollback), отдача через nginx.
- Версионирование страниц (snapshot auto/manual/deploy, восстановление).
- Формы: конструктор, destinations, история отправок, статистика.
- Мультиязычность: языки, переводы, языковая память, seed.
- Аналитика: tracker.js (pageview/click/scroll/form), сессии, web vitals,
  дашборд, таймсерии, устройства/гео/источники, realtime, статистика блоков.
- Коллекции, медиа-хранилище (MinIO, обработка через `sharp`), mock-сервер.
- Инфраструктура: CORS, helmet/CSP, rate limiting, шифрование credentials,
  Zod-валидация запросов, кастомные классы ошибок, Docker Compose.
  Базовый `GET /health` (инлайн в `app.ts`) работает. Расширенные
  `routes/health.ts` (`/metrics` Prometheus, `/health/live`, `/health/ready`)
  реализованы, но НЕ смонтированы — см. KNOWN_ISSUES.md, A1.

Персистенция БД: `synchronize: false`; идемпотентные SQL-миграции из
`backend/src/migrations` применяются автоматически на старте через
`runSafeMigrations` (`backend/src/server.ts`). Миграции: коллекции, медиа-ассеты,
thumbnail, статистика коллекций, template-поля блоков, система переводов.

---

## 3. Тесты — фактическое состояние

Ранее документация заявляла «Testing 100%» / «coverage > 80%». Это было неверно:
у backend отсутствовал jest-конфиг, и `.ts`-тесты вообще не запускались.

Актуально на 19 мая 2026:

- Backend: добавлен `backend/jest.config.js` (jest 29 + ts-jest 29, transpile-only,
  `roots: src`, setup через `setupFilesAfterEnv`). Прогон: 21 suite, 447 тестов —
  все зелёные.
- Frontend: Vitest — 9 файлов, 176 тестов — зелёные.
- Покрытие как метрика не измеряется (нет coverage-прогона в CI/локально).
- E2E-тестов нет (Playwright присутствует в devDependencies, спецификаций нет).
- Backend-тесты опираются на сервисную/доменную логику; `api.integration.test.ts`
  требует доступной тестовой БД.

---

## 4. Технологический стек

Frontend: React 18, TypeScript 5, Vite 5, Redux Toolkit 2, @dnd-kit 6,
Monaco Editor, TailwindCSS 3, React Router 6, Axios, Zod, Vitest.

Backend: Node.js 18+, Express 4, TypeScript 5, TypeORM 0.3, PostgreSQL,
Redis, MinIO/S3, `sharp`, Zod, Jest + ts-jest.

DevOps: Docker / Docker Compose, nginx (reverse proxy + отдача public-site),
GitHub Actions (`.github/workflows`).

Порты по умолчанию (см. `backend/.env.example`, `frontend/vite.config.ts`):
frontend 3000, backend 5000 (`/api`, Swagger `/api/docs`),
PostgreSQL 5432, Redis 6379, MinIO 9000/9001.

---

## 5. Известные проблемы и технический долг

Зафиксировано по результатам ревью и стабилизации:

- Аутентификация/авторизация в коде отсутствует. По решению владельца выносится
  во внешний сервис с микросервисной авторизацией и гранулярными ролями —
  вне скоупа данного репозитория. До интеграции backend полагается на сетевой
  контур (см. часть 2 feature-inventory, C1/C2 — трактовать как «внешнее»).
- SSRF: `SecureDataSourceService` ходит по пользовательскому URL без блок-листа
  приватных диапазонов — defense-in-depth до прод-выката.
- `DataTransformService` исполняет пользовательский JS через node `vm`
  (не является security-песочницей) и содержит два параллельных движка
  исполнения — требует консолидации.
- Дублирование типа `BlockNode` (frontend + 3 копии в backend) — риск дрейфа
  контракта публикации.
- God-файлы: `DeployService` (~1879 строк), `DataBindingGenerator` (~1604),
  `DataTransformService` (~1317), `AnalyticsService` (~1016) — низкая
  тестируемость.
- HTML-импорт частично: `exportUtils.domElementToNewBlockNode` не подключён к UI;
  см. статус в [docs/html-import-guide.md](docs/html-import-guide.md).
- Расширенные health-эндпоинты и Prometheus-метрики (`routes/health.ts`)
  реализованы, но роутер не смонтирован — наблюдаемость в проде отсутствует.
- `npm audit` (backend): присутствуют уязвимости в зависимостях — требуется
  отдельный разбор.

Отслеживание состояния этих и других недоработок ведётся в
[KNOWN_ISSUES.md](KNOWN_ISSUES.md). Полный список нереализованного с
критичностью — feature-inventory, часть 2.

---

## 6. Журнал стабилизации (19 мая 2026)

- Исправлен рантайм-краш drag&drop: реализована отсутствовавшая
  `checkCyclicReference` (`frontend/.../dropValidation.ts`).
- Восстановлена прод-сборка фронтенда (`BlockNode.tag` -> опциональный;
  `OutputBindingEditor` приведён к `EndpointConfig`; зачищен мёртвый код).
  Результат: `tsc` 0 ошибок, `npm run build` проходит.
- Backend: установлен `sharp`; `tsc` 0 ошибок.
- Добавлен `backend/jest.config.js` (ts-jest) — backend-тесты впервые
  запускаются (447/447).
- 3 устаревших backend-теста приведены к корректному поведению
  (placeholder-инвариант linked-блоков; контракт `blockId`).

---

## 7. План (приоритеты не зафиксированы — требуют согласования)

1. Разбор технического долга: дубли `BlockNode`, декларативные трансформации
   вместо `vm`, распил god-файлов под тесты.
2. Интеграция внешнего auth-сервиса (точки подключения в backend middleware).
3. Defense-in-depth: блок-лист SSRF, аудит логов на утечку секретов.
4. E2E-тесты критичных сценариев (создание -> биндинг -> публикация).
5. Обновление уязвимых зависимостей.

---

## 8. Связанные документы

- [README.md](README.md) — обзор и запуск
- [QUICKSTART.md](QUICKSTART.md) — детальная установка
- [KNOWN_ISSUES.md](KNOWN_ISSUES.md) — трекер недоработок и нестабильных мест
- [docs/feature-inventory.md](docs/feature-inventory.md) — канонический реестр функций
- [docs/data-binding-system-spec.md](docs/data-binding-system-spec.md) — ТЗ Data Binding
- [docs/dynamic-project-pages-spec.md](docs/dynamic-project-pages-spec.md) — ТЗ динамических страниц (черновик)
- [docs/html-import-guide.md](docs/html-import-guide.md) — руководство по импорту HTML
