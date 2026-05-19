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
| B1 | Нестабильно | `DataTransformService`: `vm` не песочница + два движка | HIGH | OPEN |
| B2 | Нестабильно | Linked-блоки: чувствительный placeholder-инвариант | MED | OPEN |
| B3 | Нестабильно | Динамические страницы проектов: покрытие частично | MED | OPEN |
| B4 | Безопасность | SSRF в `SecureDataSourceService` | HIGH | OPEN |
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
- План: заменить `console.*` на `Logger`, ESLint-правило `no-console`,
  redaction секретов; решить A1.

### B1 — `DataTransformService`: небезопасный `vm` + два движка
- Severity: HIGH. Статус: OPEN.
- Симптом: пользовательский JS исполняется через node `vm` (не security-
  песочница, тривиальный escape); в файле два параллельных пути исполнения
  (`executeTransform`/`executeAsyncComputed` и `executeComputedField*`).
- План: консолидировать в один путь, golden-тесты семантики; стратегически —
  декларативные трансформации либо `isolated-vm`. См. PROJECT_STATUS_REPORT р.5.

### B2 — Linked-блоки: чувствительный placeholder-инвариант
- Severity: MED. Статус: OPEN (под наблюдением).
- Симптом: страница хранит placeholder (`children: []`), структура
  подставляется при чтении (`_applyLinkedBlocks`). Исторически источник бага
  hybrid-карусели; тесты были устаревшими (исправлены 19.05).
- План: добавить регресс-тест сценария карусели 5/5 после reload; не
  реинтродуцировать раскрытие library в page.

### B3 — Динамические страницы проектов: покрытие частично
- Severity: MED. Статус: OPEN.
- Симптом: реализовано через Collections (`Collection`/`CollectionOverride`,
  `collectionApi`, `collections.test.ts` проходит), но git-история:
  «not tested at all»; `docs/dynamic-project-pages-spec.md` — черновик.
- План: дописать тесты генерации N страниц из шаблона; синхронизировать
  спеку с фактической реализацией (Collections).

### B4 — SSRF в `SecureDataSourceService`
- Severity: HIGH (до прод-выката). Статус: OPEN.
- Симптом: `fetch` по пользовательскому URL без блок-листа `localhost`/
  приватных диапазонов/`169.254.169.254`.
- План: резолв DNS + проверка диапазонов, `redirect: 'manual'`, тест на
  отклонение приватных адресов. Defense-in-depth даже за внешним auth.

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
