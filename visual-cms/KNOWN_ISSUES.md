# Visual CMS — Трекер недоработок

Живой документ. Источник — аудит «заявлено, но не реализовано / нестабильно»
от 19 мая 2026. Связано с [PROJECT_STATUS_REPORT.md](PROJECT_STATUS_REPORT.md)
(раздел 5) и [docs/feature-inventory.md](docs/feature-inventory.md).

Статусы: `OPEN` — не начато; `IN_PROGRESS` — в работе; `FIXED` — исправлено
(с датой); `WONTFIX` — не будет исправляться (с причиной); `EXTERNAL` — вне
скоупа репозитория.

Severity: `HIGH` — блокер прод/безопасность; `MED` — заметно влияет;
`LOW` — косметика/бэклог.

Правило ведения: при изменении статуса обновлять поле «Статус» и дату,
добавлять строку в «Журнал» внизу. Severity не понижать без обоснования.

---

## Сводная таблица

| ID | Категория | Заголовок | Severity | Статус |
|----|-----------|-----------|----------|--------|
| A1 | Недоступно | Prometheus `/metrics` и k8s-пробы не смонтированы | MED | FIXED 2026-05-19 |
| A2 | Мёртвый код | `domElementToNewBlockNode` не вызывается | LOW | FIXED 2026-05-20 |
| A3 | Наблюдаемость | `Logger`/метрики обходятся `console.log` (12 файлов) | MED | FIXED 2026-05-20 |
| B1 | Нестабильно | `DataTransformService`: `vm` не песочница + два движка | HIGH | IN_PROGRESS (фаза 1+2.A done 2026-05-20; 2.B/2.C OPEN) |
| B2 | Нестабильно | Linked-блоки: чувствительный placeholder-инвариант | MED | FIXED 2026-05-19 |
| B3 | Нестабильно | Динамические страницы проектов: покрытие частично | MED | FIXED 2026-05-19 |
| B4 | Безопасность | SSRF в `SecureDataSourceService` | HIGH | FIXED 2026-05-19 |
| C1 | Не реализовано | Горячие клавиши: Ctrl+S/Delete/Ctrl+D/Ctrl+C/V | LOW | OPEN |
| C2 | Не реализовано | Аутентификация / RBAC | HIGH | EXTERNAL |
| C3 | Не реализовано | Импорт из Figma | LOW | OPEN |
| D1 | Документация | Завышения в доках, найденные аудитом | LOW | FIXED 2026-05-19 |

---

## Детали

### A1 — Prometheus `/metrics` и Kubernetes-пробы не смонтированы
- Severity: MED. Статус: FIXED 2026-05-19.
- Симптом (был): `backend/src/routes/health.ts` реализует `/metrics`,
  `/health/live`, `/health/ready`, `/health/detailed`, но роутер нигде не
  монтировался; в `app.ts` был лишь инлайновый дублирующий `app.get('/health')`.
- Решение: в `app.ts` инлайновый `/health` заменён на `app.use(healthRouter)`
  (DRY; смонтирован до `notFoundHandler`, поэтому 404 для прочих путей не
  ломается). Доступны: `/health`, `/health/live`, `/health/ready` (200/503 по
  состоянию БД), `/health/detailed`, `/metrics` (Prometheus text + JSON по
  `Accept`). Тест: `src/__tests__/health.routes.test.ts` (8, через реальный
  `import app`). Backend 25 suites / 525, tsc 0.

### A2 — `domElementToNewBlockNode` не вызывается
- Severity: LOW. Статус: FIXED 2026-05-20.
- Симптом (был): функция-орфан в `frontend/.../exportUtils.ts` (~стр. 955),
  только саморекурсия. HTML-импорт в коде уже покрыт `importFromHTML`
  (используется `htmlElementToBlockNode` с CSS-rules merge) и
  `mergeElement`/`mergeHtmlIntoTree` (для FullPageHtmlEditor, создаёт новые
  узлы инлайн). Этот помощник — дубль без вызывающих сторон.
- Решение: удалена. Frontend tsc 0, vitest 176/176. Баннер
  `docs/html-import-guide.md` обновлён (упоминание о мёртвом помощнике
  заменено на «удалён в A2; при необходимости — git-история или вынос
  общих частей `mergeElement`»). Если в будущем понадобится альтернативный
  путь импорта, более правильное решение — извлечь общий хелпер
  «DOM-Element → new BlockNode» из `mergeElement`'s NEW NODE branch.

### A3 — Логи/метрики обходятся `console.log`
- Severity: MED. Статус: FIXED 2026-05-20 (A1 закрыт ранее).
- Симптом (был): 12 файлов backend писали прямой `console.log`; `/metrics`
  не смонтирован; риск утечки секретов в логах.
- Решение:
  - `console.*` → `logger.*` в 14 файлах (controllers/BlockController,
    middleware/{errorHandler,performance}, routes/analytics, services/{
    CacheService, CredentialsManager, DataJoinService, DataTransformService,
    DeployService, MediaService, MinioStorageService, SecureDataSourceService},
    server.ts, migrations/runner.ts). Намеренные исключения: `DataBindingGenerator`
    (его `console.*` — внутри генерируемого браузерного рантайма, конвертация
    сломала бы опубликованные сайты), `Logger.ts` (это сам логгер), `src/scripts/`
    (разовые CLI-утилиты).
  - В DeployService операционные milestone-логи → `info`; диагностические дампы
    (mapping, raw bindings, per-binding spam) → `debug` (по умолчанию скрыты,
    включаются `LOG_LEVEL=debug`) — снижает шум в проде.
  - Добавлен `redact()` в Logger.ts: маскирует значения по ключам
    `token/secret/password/key/authorization/cookie/credential` (рекурсивно,
    с защитой от циклов). 6 тестов в `logger.redact.test.ts`.
  - ESLint: `no-console: 'warn'` в `backend/.eslintrc.js` + `overrides`,
    разрешающие console в `src/scripts/**`, `src/services/Logger.ts`,
    `src/**/__tests__/**`.
  - Backend tsc 0, 26 suites / 531 тестов.
- A1 (`/metrics` смонтирован) — закрыто отдельно; см. A1.

### B1 — `DataTransformService`: небезопасный `vm` + два движка
- Severity: HIGH. Статус: IN_PROGRESS (фаза 1 завершена 2026-05-19).
- Симптом: пользовательский JS исполняется через node `vm` (не security-
  песочница, тривиальный escape); два параллельных пути исполнения.
- Фаза 1 (DONE 2026-05-19): исправлены 3 бага экранирования `\${}` (стр. 392,
  407, 761) — async computed-поля (`applyComputedFields`/`addComputedFieldsAsync`)
  ранее не работали (в vm подставлялся литерал, а не выражение), теперь
  работают. Дедупликация vm-механики: общие `safeGlobals`/`runSync`/`runAsync`,
  API каждого пути (`value` vs `$var/$data/$page`) сохранён. Golden-тесты:
  `src/__tests__/DataTransformService.engines.test.ts` (9). Backend 23/495.
- Фаза 2.A (DONE 2026-05-20): добавлен `safeExpression.ts` (обёртка
  `expr-eval`) с helper-функциями (`upper/lower/trim/concat/len/slice/replace/
  round/floor/ceil/default/if`) и срезанием префикса `return`. Интегрирован
  во все 4 user-code метода `DataTransformService`: сначала `expr-eval`, при
  неудаче — отказ. Legacy vm-путь работает ТОЛЬКО при `ALLOW_USER_JS=true`
  (по умолчанию `false` — RCE-класс закрыт), с deprecation `logger.warn`.
  Расширен `applyBuiltInTransform` (`replace:`/`truncate:N`/`slice:S|E`).
  Тесты: `safeExpression.test.ts` (22) + миграция `engines.test.ts`/
  `DataTransformService.test.ts` под helper-API. Backend 27 suites / 553.
- Фаза 2.B (OPEN): дополнительная документация миграционных паттернов
  (JS → built-in / expr-eval / `additionalDataSources`+join) + обновление
  плейсхолдеров фронтенд-редакторов (`ComputedFieldsEditor`,
  `TransformsEditor`) — UX-часть.
- Фаза 2.C (OPEN, требует подтверждения по данным): cutover — отключить
  `ALLOW_USER_JS` совсем, удалить `vm` и runSync/runAsync, выкинуть `import vm`.
  Делать только когда подтверждено отсутствие JS-выражений в реальных
  DataBinding-записях в проде.

### B2 — Linked-блоки: чувствительный placeholder-инвариант
- Severity: MED. Статус: FIXED 2026-05-19 (код уже был корректен — добавлен
  регресс-щит).
- Симптом: страница хранит placeholder (`children: []`), структура
  подставляется при чтении (`_applyLinkedBlocks`). Исторически источник бага
  hybrid-карусели; тесты были устаревшими (исправлены 19.05).
- Решение: 3 регресс-теста в `LinkedBlocksService.test.ts`
  (describe «B2 regression: hybrid-carousel placeholder invariant»):
  (1) collapse — `syncBlockToAllPages` оставляет placeholder, сохраняет
  id/attributes/`linkedBlockId`, library в page НЕ просачивается, счёт 5/5;
  (2) read/expand — `updateLinkedBlocks` подставляет library, но attributes
  плейсхолдера ПЕРЕКРЫВАЮТ library (карусель-маркеры выживают), счёт 5/5;
  (3) `_replaceLinkedBlock` никогда не пишет library-children в page
  (защита от реинтродукции expand, включая `variations.specificChildren`).
  Backend 23 suites / 498. Дальнейшая регрессия инварианта = красный тест.

### B3 — Динамические страницы проектов: покрытие частично
- Severity: MED. Статус: FIXED 2026-05-19 (логика не менялась — добавлено
  покрытие + синхронизирована спека).
- Симптом (был): реализовано через Collections, но логика генерации
  (`CollectionController.getItems`) была НЕ покрыта — `collections.test.ts`
  тестировал только Zod-схемы/`template:`. git-история: «not tested at all».
- Решение: `src/__tests__/CollectionController.getItems.test.ts` (19 тестов):
  чистые `slugify` (транслит кириллицы, нормализация, лимит 100) и
  `getNestedValue`; генерация в `getItems` — slug из slugField/titleField/id,
  нормализация `basePath`, резолв overrides (по `apiItemId` и fallback по
  slug), кастомный slug + warning, fallback на кеш при ошибке API, 404.
  Backend 24 suites / 517. Черновик `docs/dynamic-project-pages-spec.md`
  синхронизирован (баннер: реализовано через Collections, генерация покрыта).
- Примечание: jest «Force exiting» — открытый хендл (вероятно Redis/таймер
  в `CacheService`), пре-существующее, относится к A3/инфра, не к B3.

### B4 — SSRF в `SecureDataSourceService`
- Severity: HIGH (до прод-выката). Статус: FIXED 2026-05-19.
- Симптом (был): `fetch` по пользовательскому URL без блок-листа `localhost`/
  приватных диапазонов/`169.254.169.254`.
- Решение: добавлен `backend/src/utils/ssrfGuard.ts` — классификация IPv4/IPv6
  (loopback/private/link-local/ULA/CGNAT/metadata/multicast/reserved),
  `assertUrlAllowed` (только http/https, резолв всех DNS-адресов, fail closed,
  env-allowlist `SSRF_ALLOWED_HOSTS` для доверенных внутренних хостов),
  `safeFetch` (поэтапная ре-валидация каждого редиректа, max 5 hops).
  Интегрировано в `SecureDataSourceService` (rest/graphql/oauth-token);
  убраны `console.log` URL/queryParams (утечка секретов — частично A3).
  Тесты: `src/__tests__/ssrfGuard.test.ts` (39). Backend 22 suites / 486.
- Остаточные ограничения: эвристика IPv6 не покрывает экзотические формы;
  десятичные/hex-литералы IP полагаются на fail-closed DNS. Приемлемо для
  defense-in-depth; зафиксировано в доке модуля.

### C1 — Горячие клавиши не полны
- Severity: LOW. Статус: OPEN.
- Реализовано: Ctrl+Z/Y (undo/redo, EditorToolbar), Ctrl+Wheel zoom,
  Space pan (Canvas). Нет: Ctrl+S, Delete, Ctrl+D, Ctrl+C/V.
- План: добавить недостающие биндинги с учётом фокуса в input/contenteditable.

### C2 — Аутентификация / RBAC
- Severity: HIGH. Статус: EXTERNAL.
- Решение владельца: выносится во внешний сервис (микросервисная авторизация,
  гранулярные роли). В коде репозитория не реализуется. `JWT_*` в `.env` —
  вестигиальны. Точки интеграции — backend middleware (будущая задача).

### C3 — Импорт из Figma
- Severity: LOW. Статус: OPEN (бэклог). feature-inventory M5.

### D1 — Завышения в документации (найдены аудитом)
- Severity: LOW. Статус: FIXED 2026-05-19.
- Исправлено: PROJECT_STATUS_REPORT (Prometheus/health → отражает A1);
  QUICKSTART (горячие клавиши — корректный список); html-import-guide
  (баннер: импорт работает, мёртв только `domElementToNewBlockNode`);
  feature-inventory (актуализация: 11.7/11.9 не смонтировано — см. A1).

---

## Журнал

- 2026-05-19 — Создан трекер по результатам аудита. A1–C3 заведены как OPEN/
  EXTERNAL. D1 (доки) исправлено в этот же день.
- 2026-05-19 — B4 (SSRF) FIXED: добавлен `ssrfGuard` + `safeFetch`,
  интегрирован в `SecureDataSourceService`, 39 тестов, backend 22/486.
  Частичный прогресс A3 (убраны секрет-логи в этом сервисе).
- 2026-05-19 — B1 фаза 1 DONE: фикс 3 багов `\${}` (async computed работали
  некорректно), дедупликация vm-механики (safeGlobals/runSync/runAsync),
  golden-тесты (9), backend 23/495. Фаза 2 (RCE → expr-eval) — OPEN.
- 2026-05-19 — B2 FIXED: 3 регресс-теста placeholder-инварианта
  (collapse/expand/_replaceLinkedBlock-guard), backend 23/498. Код не менялся.
- 2026-05-19 — B3 FIXED: 19 тестов генерации Collections
  (`CollectionController.getItems` + slugify/getNestedValue), backend 24/517,
  спека-черновик синхронизирована. Код не менялся.
- 2026-05-19 — A1 FIXED: health-роутер смонтирован в app.ts (инлайн `/health`
  заменён на `app.use(healthRouter)`, DRY), 8 supertest-тестов, backend 25/525.
  PROJECT_STATUS_REPORT и feature-inventory актуализированы.
- 2026-05-20 — A3 FIXED: console.* → logger в 14 файлах (исключения:
  DataBindingGenerator/Logger.ts/scripts задокументированы); добавлен
  `redact()` + 6 тестов; ESLint `no-console:'warn'` + overrides; diagnostic
  dumps в DeployService демотированы в debug. Backend 26/531.
- 2026-05-20 — A2 FIXED: удалён мёртвый `domElementToNewBlockNode`
  (frontend/.../exportUtils.ts), баннер html-import-guide обновлён.
  Frontend tsc 0, vitest 176/176.
- 2026-05-20 — B1 фаза 2.A DONE: `safeExpression` (expr-eval+helpers),
  `ALLOW_USER_JS` flag (default false = RCE закрыт), расширен
  built-in-набор, тесты+миграция. Backend 27/553, tsc 0. 2.B/2.C — OPEN.
