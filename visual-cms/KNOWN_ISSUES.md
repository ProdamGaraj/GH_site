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
| A1 | Недоступно | Prometheus `/metrics` и k8s-пробы не смонтированы | MED | OPEN |
| A2 | Мёртвый код | `domElementToNewBlockNode` не вызывается | LOW | OPEN |
| A3 | Наблюдаемость | `Logger`/метрики обходятся `console.log` (12 файлов) | MED | OPEN |
| B1 | Нестабильно | `DataTransformService`: `vm` не песочница + два движка | HIGH | IN_PROGRESS (фаза 1 done 2026-05-19) |
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
- Severity: MED. Статус: OPEN.
- Симптом: `backend/src/routes/health.ts` реализует `/metrics` (Prometheus),
  `/health/live`, `/health/ready`, но роутер не импортирован в
  `backend/src/routes/index.ts`; в `backend/src/app.ts` только инлайновый
  простой `app.get('/health')`. Эндпоинты недостижимы.
- Заявлено: feature-inventory 11.7/11.9.
- План: смонтировать health-роутер в `routes/index.ts` (или в `app.ts` до
  `/api`), проверить `metricsService.getPrometheusMetrics()`, добавить тест на
  доступность `/metrics`, `/health/ready`.

### A2 — `domElementToNewBlockNode` не вызывается
- Severity: LOW. Статус: OPEN.
- Симптом: функция-орфан в `frontend/src/features/editor/utils/exportUtils.ts`
  (~стр. 955), только саморекурсия. Экспортирована при стабилизации, чтобы
  не падал `tsc`. HTML/JSON-импорт в целом РАБОТАЕТ через `importContent`/
  `importFromHTML` (ImportModal) — мёртв только этот помощник.
- План: решить — удалить как дубль или подключить как альтернативный парсер;
  сверить с `docs/html-import-guide.md`.

### A3 — Логи/метрики обходятся `console.log`
- Severity: MED. Статус: OPEN.
- Симптом: есть `Logger`/`MetricsService`, но 12 файлов backend пишут прямой
  `console.log`; `/metrics` не смонтирован (см. A1). В проде нет
  структурированных логов и наружных метрик; риск утечки секретов в логах.
- Прогресс: 2026-05-19 убраны `console.log` URL/queryParams в
  `SecureDataSourceService` (утечка секретов) в рамках B4. Остальное (11 файлов,
  `Logger`, ESLint, метрики) — OPEN.
- План: заменить `console.*` на `Logger`, ESLint-правило `no-console`,
  redaction секретов; решить A1.

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
- Фаза 2 (OPEN, HIGH): закрытие RCE — переход на `expr-eval` (уже в deps) +
  декларативные трансформации; убрать произвольный JS/`vm`. Ломающее
  изменение для биндингов с JS — нужен инвентарь использования и миграция.
  Требует отдельного согласования. См. PROJECT_STATUS_REPORT р.5.

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
