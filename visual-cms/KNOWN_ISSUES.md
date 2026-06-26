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
| B1 | Нестабильно | `DataTransformService`: `vm` не песочница + два движка | HIGH | FIXED 2026-05-20 |
| B2 | Нестабильно | Linked-блоки: чувствительный placeholder-инвариант | MED | FIXED 2026-05-19 |
| B3 | Нестабильно | Динамические страницы проектов: покрытие частично | MED | FIXED 2026-05-19 |
| B4 | Безопасность | SSRF в `SecureDataSourceService` | HIGH | FIXED 2026-05-19 |
| B5 | Нестабильно | Linked-блоки: двусторонняя синхронизация → гонка last-writer-wins | HIGH | FIXED 2026-05-22 |
| B6 | Не реализовано | DataSource: 3 реестра типов рассинхронизированы, большинство типов не работают | HIGH | FIXED 2026-06-08 |
| B7 | Не реализовано | DataSource техдолг: external/computed/sqlite/feed-scheduler реализованы; websocket/mock/rest → WONTFIX | LOW | FIXED 2026-06-08 |
| B8 | Нестабильно | Библиотека блоков: «В библиотеку» пишет мусор; второй инстанс блока не разворачивается | HIGH | FIXED 2026-06-12 |
| B9 | Не реализовано | «Преобразовать в блок» (дерево слоёв) не связывает узел и не сохраняет страницу | HIGH | FIXED 2026-06-12 |
| C1 | Не реализовано | Горячие клавиши: Ctrl+S/Delete/Ctrl+D/Ctrl+C/V | LOW | FIXED 2026-05-20 |
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
- Severity: HIGH. Статус: FIXED 2026-05-20 (RCE-класс закрыт, vm-путь
  удалён).
- Симптом (был): пользовательский JS исполнялся через node `vm` (не
  security-песочница, тривиальный escape) + два параллельных пути.
- Фаза 1 (DONE 2026-05-19): исправлены 3 бага `\${}` экранирования —
  async computed-поля заработали; дедупликация vm-механики
  (`safeGlobals`/`runSync`/`runAsync`); golden-тесты (9). Backend 23/495.
- Фаза 2.A (DONE 2026-05-20): добавлен `safeExpression.ts` (обёртка
  `expr-eval` с helper'ами `upper/lower/trim/concat/len/slice/replace/
  round/floor/ceil/default/if` и срезанием `return`). Интегрирован во все
  4 user-code метода. Расширен `applyBuiltInTransform`
  (`replace:`/`truncate:N`/`slice:S|E`). Переходный флаг `ALLOW_USER_JS`
  (default `false`) с deprecation-warning на vm-пути. Backend 27/553.
- Фаза 2.B (DONE 2026-05-20): миграционный гайд
  [docs/data-binding-migration.md](docs/data-binding-migration.md) +
  обновлены placeholder'ы фронтенд-редакторов
  (`ComputedFieldsEditor`/`FieldMappingEditor`).
- Фаза 2.C (DONE 2026-05-20): cutover. После проверки реальных
  `data_bindings`-записей в проде (3 точечных SQL по
  `inputConfig.fieldMappings[].transform`, `computedFields[].expression`,
  `outputConfig.payloadMappings[].transform` → все вернули 0 строк)
  vm-путь и его обвязка (`runSync`/`runAsync`/`safeGlobals`/
  `createSandbox`/`sandboxTimeout`/`import vm`) удалены. Флаг
  `ALLOW_USER_JS` и функция `isLegacyJsAllowed` удалены, тесты
  обновлены. Backend 27/551, tsc 0. RCE-класс закрыт окончательно.
  Скрипт диагностики
  [src/scripts/check-databindings-for-js.ts](backend/src/scripts/check-databindings-for-js.ts)
  оставлен для будущих проверок (если данные изменятся).

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

### B5 — Linked-блоки: двусторонняя синхронизация → гонка last-writer-wins
- Severity: HIGH. Статус: FIXED 2026-05-22.
- Симптом (был): после правки блока в библиотеке и сохранения страницы блок «не
  обновлялся» и жил в двух состояниях. Причина — конфликт двух путей записи с
  read-time разворачиванием (инвариант B2): `PageController.update` безусловно
  пушил структуру страницы обратно в библиотеку (`syncLinkedBlocksToLibrary`) и
  сохранял РАЗВЁРНУТУЮ копию linked-блока в `page.structure`. Т.к. фронт держал
  развёрнутую (при чтении) версию, сохранение страницы перезатирало библиотечную
  правку устаревшей копией. Старые кнопки «Только страница»/«В библиотеку» (бинарно
  «всё/ничего») усугубляли: `handleSaveForPageOnly` писал развёрнутую структуру без
  схлопывания.
- Решение (по согласованному с владельцем дизайну — гранулярное разрешение):
  - **Backend**: чистый детектор `linkedBlockDiff.ts` (`diffLinkedInstance`) —
    сравнивает контент инстанса с library, игнорируя overlay разворачивания на
    корне (id/attributes/metadata, в т.ч. карусель-маркеры). В `LinkedBlocksService`:
    Дети сопоставляются по `id` (reorder сохраняет id), поэтому перетаскивание
    показывается как одно «изменён порядок», а не лавина ложных «изменён текст»;
    при свежей вставке (id перевыданы, общих нет) — позиционный fallback.
    `detectChangedLinkedInstances` (preflight) и `applyLinkedDecisions`
    (push/static/revert/без-решения/неизменённый). `PageController`: новый
    `POST /pages/:id/save-preflight`; `update` принимает `decisions`, схлопывает
    linked в placeholder (инвариант B2 теперь enforced на ВСЕХ сохранениях),
    точечно пишет в библиотеку только при `push`. Удалён мёртвый/опасный
    `syncLinkedBlocksToLibrary` + `_collectLinkedNodes`.
  - **Frontend**: модалка `LinkedChangesModal` — изменения сгруппированы по блоку,
    чекбокс на уровне блока, три действия (🟢 в библиотеку / 🟡 статический /
    🔴 откатить) к выбранным N блокам; нерешённые остаются pending (страница
    «несохранена», F5 их теряет). `handleSave` идёт через preflight→модалку→commit.
    Удалены `handleSaveForPageOnly` и кнопка «Только страница»; «создать блок из
    секции» (`handleSaveAllToLibrary`) сохранена. Чистая логика решений вынесена в
    `linkedDecisions.ts`.
  - Тесты: backend `linkedBlockDiff.test.ts` (15, включая reorder/fallback),
    расширен `LinkedBlocksService.test.ts` (applyLinkedDecisions + detect);
    backend 28/569. Frontend `linkedDecisions.test.ts` (11); frontend 11 suites /
    201. tsc 0 обе стороны.
  - Доп. фиксы вставки из библиотеки (DnD): убран суффикс «(копия)» и
    принудительный `locked` детям (`cloneNodeWithNewIds` в Editor.tsx) — содержимое
    linked-блока редактируется на канвасе; nodemon переведён на `--legacy-watch`
    (Windows/Docker bind-mount не отдавал inotify, новые роуты не подхватывались).

### B6 — DataSource: рассинхрон реестров типов + большинство типов не работают
- Severity: HIGH. Статус: FIXED 2026-06-08.
- Симптом (был): тип источника жил в 3 несогласованных местах — frontend union
  (8 типов), Zod-enum (12), `FetchConfig` (5). Тип, заявленный в UI, мог молча
  падать на бэкенде (`Unsupported data source type`). Оба меню («Привязка данных»
  и редактор коллекций) игнорировали тип и считали ЛЮБОЙ источник REST-эндпоинтом
  (читали `config.url`, слали браузерный `fetch`). Реально доходили до сети только
  rest-api/feed (идентичный код), graphql, static. `database`/`form-data`/
  `external`/`computed` создавались, но не работали.
- Решение (4 этапа):
  - **Фундамент** — единый дескриптор поведения типа: бэкенд
    `services/dataSourceRuntime.ts` (`DATA_SOURCE_RUNTIME`: execution
    server-fetch|client-runtime|inline, availableInCollections/Bindings, status;
    `getDataSourceDescriptor`/`isClientRuntimeType`/`resolveLoadStrategy`), фронт —
    те же поля в `DATA_SOURCE_CAPABILITIES` + `getDataSourceMeta`. UI блокирует
    `status:'techdebt'`, коллекции фильтруют по `availableInCollections`.
    `SecureDataSourceService` роутит client-runtime коротким замыканием (убран
    дубль page-variable).
  - **feed** — развязан от rest-api: polling → клиентский авто-refresh
    (`resolveLoadStrategy`→`loadStrategy:'interval'` в DeployService; рантайм
    `DataBindingGenerator` грузит interval-источники И при загрузке, И периодически
    — починен баг: раньше interval-источники не делали начальную загрузку).
  - **form-data** — client-runtime: бэкенд возвращает пустой маркер, значение
    резолвится в браузере (`services/runtime/formDataResolver.ts` — единый
    JS-исходник, встраивается в страницу И тестируется через `new Function`).
    Источники: url-params / local-storage / session-storage / cookies.
    Недоступен в коллекциях (server-side генерация). Конфиг-UI в визарде.
  - **database** — `services/DatabaseQueryService.ts` (PostgreSQL + MySQL):
    только SELECT/WITH, один statement, denylist + READ ONLY транзакция (главная
    гарантия), параметризация `:name`→`$1`/`?` (значения отдельным массивом, не
    конкатенация), statement_timeout, лимит строк, пул по подключению, SSRF-guard
    хоста (по умолчанию пускает приватные — БД во внутренней сети — блокирует
    cloud-metadata; жёсткий allowlist `DATABASE_HOST_ALLOWLIST`). Секреты
    (password/connectionString) шифруются AES-256 (`CredentialsManager.
    encryptConfigSecrets` в `DataSourceController` create/update), маскируются в
    ответах API, дешифруются в точке использования. `mysql2` добавлен в deps.
- Тесты: `dataSourceRuntime.test.ts` (15), `formDataResolver.test.ts` (20),
  `DatabaseQueryService.test.ts` (31 — инъекции/read-only/SSRF/ранний отказ),
  `DatabaseQueryService.driver.test.ts` (6 — оркестрация pg/mysql2 на моках:
  последовательность read-only транзакции, параметры, лимит, ROLLBACK),
  `CredentialsManager.test.ts` (+5 — config-секреты). Backend 36 suites / 670,
  frontend 236, оба tsc 0, прод-сборка фронта проходит.
- **Живой E2E**: PostgreSQL (`visual-cms-postgres-1`) — реальный SELECT,
  параметризованный `:n::int`→42, запись отклонена валидатором, и сам Postgres
  отклонил запись в READ ONLY транзакции на уровне СУБД. MySQL (`mysql:8`) —
  тот же сценарий, MySQL отклонил запись в READ ONLY транзакции.
- Остаточный техдолг — см. B7.
- Решение оставить `graphql` рабочим (status:'stable', не techdebt): он реально
  фетчится; блокировать рабочую фичу = регресс. Отключается одной строкой при
  необходимости.

### B7 — DataSource: оставшийся техдолг типов
- Severity: LOW. Статус: FIXED 2026-06-08. Зависит от B6.
- **Реализовано** (по согласованию с владельцем — выбрал строить, а не WONTFIX):
  - `external` (status:'beta') — пресеты WordPress/Strapi/Shopify резолвятся в
    обычный REST-запрос (`services/externalServicePresets.ts` →
    `resolveExternalRequest`, переиспользуется и в рантайме, и в тесте). Тонкий
    слой над `fetchRestApi` (SSRF-guard наследуется). Тесты:
    `externalServicePresets.test.ts` (8).
  - `computed` (status:'beta') — объединение нескольких источников на сервере
    (`services/ComputedDataSourceService.ts`): mode `concat` (склейка) / `merge`
    (join по ключу, foreign-ключ не тянется в вывод). RCE-safe: НЕ исполняет JS
    (после B1), только декларативный конфиг. Защита: cap глубины (3) + детект
    циклов (вложенный computed). Cache-key расширен полями sources/mode (иначе
    коллизия). Тесты: `ComputedDataSourceService.test.ts` (18).
  - `database` → `sqlite` (better-sqlite3, readonly-соединение = физическая
    гарантия от записи; path-guard `SQLITE_ALLOWED_DIR`, fail-closed; защита от
    path-traversal). Живой E2E на реальном файле. Тесты в
    `DatabaseQueryService.test.ts` (+sqlite/path-guard).
  - `feed` серверный планировщик (`services/FeedPollingScheduler.ts`,
    `node-cron`, тик раз в минуту) — проактивно обновляет TTL-кэш due-источников
    (due по `lastFetchAt`+`pollingInterval`, переживает рестарты). Стартует в
    `server.ts`; отключается `FEED_POLLING_ENABLED=false`. Гранулярность 1 мин.
    Тесты: `FeedPollingScheduler.test.ts` (10). Webhook-pull НЕ делали (см. ниже).
  - Баг параметризации database (`:name` внутри строкового литерала) — починен
    полноценным токенайзером (`compileNamedParams`: пропускает литералы,
    комментарии, `::`-касты, срезы `arr[1:3]`).
- **WONTFIX** (дублируют существующее / архитектурный mismatch; не в визарде):
  - `websocket` — опубликованные страницы статичны (нет живого сервера держать
    соединение). Как C2 EXTERNAL.
  - `mock` — `static` уже принимает ручной JSON; генератор рандома маргинален.
  - `rest` — legacy-алиас; в dispatch смаплен на `rest-api` (старые записи
    работают), отдельным типом не разворачивается.
  - `feed` webhook-pull (`webhookSecret`) — публичный эндпоинт + безопасность;
    клиентский polling + серверный шедулер уже закрывают свежесть.
- Остаточное ограничение: гранулярность серверного feed-polling — 1 минута
  (суб-минутная свежесть — клиентским polling).

### B8 — Библиотека блоков: «В библиотеку» пишет мусор; второй инстанс не разворачивается
- Severity: HIGH. Статус: FIXED 2026-06-12.
- Симптомы (были): блок, сохранённый в библиотеку из режима «Блок» страницы,
  получал «неправильную структуру» или затирался пустышкой; правки linked-блока
  не появлялись на других страницах; второй инстанс одного блока на странице
  отображался пустым.
- Корни (3 дефекта, усиливавших друг друга):
  1. `EditorToolbar.handleSaveAllToLibrary` писал в библиотеку инстанс как есть —
     без удаления `metadata.linkedBlockId`/`styleOverrides` (блок ссылался сам
     на себя) и без guard'а от placeholder'ов (`children: []` затирал блок).
     Соседняя `syncNestedLinkedBlocksToLibrary` оба пункта делала — DRY-дубль
     с расхождением; её комментарий ссылался на серверный guard
     `_collectLinkedNodes`, удалённый ещё в B5.
  2. `LinkedBlocksService._applyLinkedBlocks`: `processingIds` (защита от
     циклов) никогда не очищался → разворачивался только ПЕРВЫЙ инстанс блока
     на странице, остальные оставались пустыми placeholder'ами — и поставляли
     пустышки для дефекта 1.
  3. Сервер не защищал инвариант «библиотечный блок ≠ linked-инстанс».
- Решение:
  - Backend: `_applyLinkedBlocks` снимает id из `processingIds` после обработки
    поддерева (циклы по ветке предков по-прежнему блокируются); 2 регресс-теста
    (мульти-инстанс, самоссылка-цикл).
  - Backend: `BlockController.stripInstanceArtifacts` — на `create`/`update`/
    `createFromElement` срезает `linkedBlockId`/`styleOverrides` с корня
    входящей структуры (вложенные ссылки легальны и не трогаются).
  - Frontend: общий хелпер `utils/libraryClean.ts` (`cleanForLibrary`,
    `isLinkedPlaceholder`, `stripViewportIds`) — устранён тройной дубль логики;
    `handleSaveAllToLibrary` пропускает placeholder'ы (с счётчиком в
    уведомлении) и чистит корень перед записью; `syncNestedLinkedBlocksToLibrary`
    переведена на хелпер. 8 unit-тестов.
  - Диагностика данных: read-only скрипт
    `backend/src/scripts/diagnose-library-blocks.ts` — ищет SELF_REF/EMPTY блоки
    и кандидатов на восстановление в `PageVersion`-снапшотах. Ремонт уже битых
    блоков — отдельным шагом после просмотра отчёта.
- Ремонт локальных данных (2026-06-12, `scripts/repair-library-blocks.ts`):
  срезаны самоссылки у 10 блоков (без потерь). ОШИБКА ПЕРВОЙ ИТЕРАЦИИ: эвристика
  «children пустые = битый» дала ложные срабатывания на leaf-блоках (img/span/a
  без детей — норма), из-за чего 9 «сирот» были удалены, хотя 8 были валидными.
  Все 9 восстановлены из до-ремонтного дампа (103901), эвристика диагностики
  исправлена (leaf-aware). «Projects Grid» (реально затёртый, с data-binding)
  восстановлен копией структуры из своего здорового дубля. Итог: 1/48 под
  вопросом («Slide Overlay» — пустой div, кандидатов нет; возможно, легитимный
  стилевой оверлей). Бэкапы: 103901 (до ремонта), 104703 (промежуточный,
  УСТАРЕЛ — без восстановленных блоков), **120938 — финальный для сервера**.
- Остаточный техдолг данных: дубли в библиотеке (Header/GH - Header,
  Footer/GH - Footer, Hero Carousel ×4, Navigation ×2 и др. — наследие старого
  бага создания вместо обновления). «Главная» сидит на новых Header/Footer,
  «Шаблон страницы проекта» — на старых GH-*. Консолидация — после решения
  владельца, какие блоки канонические.
- Тесты: backend 41 suites / 742, frontend 14 suites / 291, backend tsc 0.

### B9 — «Преобразовать в блок» (дерево слоёв) не связывает узел и не сохраняет страницу
- Severity: HIGH. Статус: FIXED 2026-06-12.
- Симптом (был): зелёная кнопка «Преобразовать в блок» в дереве слоёв
  (`LayerItem`) создавала блок в библиотеке и уходила в редактор блока, но НЕ
  проставляла `metadata.linkedBlockId` на узел страницы и НЕ сохраняла страницу.
  Узел оставался обычным `div`/`section` → правки блока не синхронизировались,
  переименование не доходило до редактора страницы, а повторные клики плодили
  дубли-сироты (в БД: 21 блок с тегом `converted-from-page`, 20 — сироты).
- Причина: рабочая линковка раньше жила в `RightPanel.tsx`, в коммите c736cd8
  («bugfix of link between page and blocks») перенесена в `EditorToolbar`
  (кнопка «В библиотеку», режим блока). Зелёная кнопка в дереве — отдельная
  точка входа, куда линковку так и не подключили.
- Решение: единый канонический thunk `convertNodeToLinkedBlock` (editorSlice):
  создаёт блок из узла (`cleanForLibrary` срезает linkedBlockId/styleOverrides/
  _viewportId), проставляет `linkedBlockId` на узел, сохраняет страницу (бэкенд
  схлопывает в placeholder по инварианту B8, при чтении подставляет из
  библиотеки). Guard: уже связанный узел не создаёт дубль. Кнопка показывается
  только в редакторе СОХРАНЁННОЙ страницы (нужен pageId; для `new` скрыта) и
  только для несвязанных узлов. Удалена дублирующая create-логика из `LayerItem`.
- Тесты: `convertNodeToLinkedBlock.test.ts` (5: happy-path, cleanForLibrary,
  guard-дубль, без pageId, несуществующий узел). Frontend 19 suites / 365, tsc
  чист (кроме предсуществующей ошибки routes.tsx import.meta.env).
- Остаточно: 20 блоков-сирот `converted-from-page` в БД — наследие бага, чистка
  отдельной задачей (read-only список перед удалением). В редакторе БЛОКА кнопка
  теперь скрыта (раньше там создавала орфанов); вложенное преобразование
  суб-узла в редакторе блока — отдельная фича, не реализована.

### C1 — Горячие клавиши не полны
- Severity: LOW. Статус: FIXED 2026-05-20.
- Реализовано: Ctrl+Z/Y (undo/redo), Ctrl+Wheel zoom, Space+drag pan
  (Canvas) — было ранее. Добавлено в C1:
  - **Ctrl+S** — явное сохранение (вызывает `handleSave`); ref-pattern
    для стабильности effect'а.
  - **Delete / Backspace** — удалить выбранный узел (защита: не root,
    есть selectedNodeId).
  - **Ctrl+D** — дублировать выбранный (`duplicateNode` reducer: клон
    с регенерацией id, sibling-вставка после оригинала).
  - **Ctrl+C** — копировать узел в `state.editor.clipboard`
    (`copyNode` reducer; id сохраняются, перегенерация — при paste).
  - **Ctrl+V** — вставить из буфера (`pasteFromClipboard` reducer:
    клон с новыми id; при выборе root → последний child root, иначе →
    sibling после выбранного).
- Все шорткаты пропускают input/textarea/contentEditable (defocus-guard).
- Reducer'ы корректно регенерируют id во вложенных children и в
  `variations.specificChildren`; `inheritedOverrides` в variations
  ремапятся на новые id (idMap).
- Тесты: 6 новых в `editorSlice.test.ts` (duplicate/copy+paste/edge cases).
  Frontend 9 suites / 182 теста, tsc 0.

### C2 — Аутентификация / RBAC
- Severity: HIGH. Статус: EXTERNAL.
- Решение владельца: выносится во внешний сервис (микросервисная авторизация,
  гранулярные роли). В коде репозитория не реализуется. `JWT_*` в `.env` —
  вестигиальны. Точки интеграции — backend middleware (будущая задача).

### C3 — Импорт из Figma
- Severity: LOW. Статус: OPEN (бэклог). feature-inventory M5.
- Согласованное направление (зафиксировано 2026-05-21, без имплементации;
  цель — не переоткрывать развилку при возвращении к задаче):
  - Путь: Figma REST API на бэкенде (endpoint `/api/figma/import`,
    конвертер в monorepo). Plugin-вариант — не рассматривается в
    скоупе репо (по аналогии с C2 EXTERNAL: отдельный артефакт +
    публикация в Figma Community).
  - Скоуп MVP — Tier 2: FRAME/GROUP/TEXT/RECTANGLE → BlockNode-узлы;
    auto-layout → flex (row / column / gap); design tokens (цвета,
    типографика) поднимаются в глобальные стили.
  - Шрифты: fallback на ближайший web-safe / Google Font + warning.
  - Изображения: download → MinIO через `MediaService` (не хранить
    подписанные `s3-alpha.figma.com` URL — у них TTL).
  - Безопасность: Personal Access Token через `CredentialsManager`
    (не логировать — A3); запросы к `api.figma.com` и
    `s3-alpha.figma.com` — только через `safeFetch` ([ssrfGuard.ts](
    backend/src/utils/ssrfGuard.ts)) с явным allowlist
    (`SSRF_ALLOWED_HOSTS`).
- Out of scope MVP: vector / boolean ops (экспорт в SVG/PNG —
  отдельной задачей), эффекты / маски / blend modes, варианты
  компонентов, prototyping links.
- Тесты: golden-фикстуры Figma JSON → ожидаемое `BlockNode`-дерево
  (без сети); сетевой слой (Figma API client) мокается отдельно.

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
- 2026-05-20 — B1 фаза 2.B DONE: миграционный гайд
  `docs/data-binding-migration.md`, обновлены placeholder'ы/подсказки
  ComputedFieldsEditor и FieldMappingEditor. 2.C — OPEN (cutover после
  подтверждения отсутствия JS в реальных DataBinding-записях).
- 2026-05-20 — B1 фаза 2.C DONE (cutover): после подтверждения от
  владельца (3 точечных SQL по prod-БД вернули 0 строк JS-выражений)
  vm-путь удалён полностью — `import vm`, `runSync`/`runAsync`/
  `safeGlobals`/`createSandbox`/`sandboxTimeout`, `ALLOW_USER_JS` флаг и
  `isLegacyJsAllowed` — всё убрано. Backend 27/551, tsc 0. B1 → FIXED.
- 2026-05-20 — C1 FIXED: горячие клавиши Ctrl+S/Delete/Ctrl+D/Ctrl+C/Ctrl+V.
  Новые reducer'ы `duplicateNode`/`copyNode`/`pasteFromClipboard` в
  editorSlice (id-регенерация для children/variations/inheritedOverrides),
  поле `clipboard` в EditorState. 6 unit-тестов. Frontend 9/182, tsc 0.
- 2026-05-21 — C3 направление зафиксировано (без имплементации): REST API
  на бэкенде, MVP Tier 2 (FRAME/GROUP/TEXT/RECTANGLE, auto-layout→flex,
  design tokens→глобальные стили), images→MinIO через MediaService, PAT
  через CredentialsManager, сеть через safeFetch+allowlist. Статус —
  по-прежнему OPEN: задача отложена, кода не добавлено.
- 2026-06-08 — B6 FIXED: спасение DataSource. Объединён реестр типов
  (`dataSourceRuntime.ts` + `DATA_SOURCE_CAPABILITIES`, dispatch по execution,
  techdebt-блокировка в UI). Доведены до рабочего состояния: feed (клиентский
  авто-refresh), form-data (рантайм-резолвер url/local/session/cookies),
  database (`DatabaseQueryService`, PostgreSQL+MySQL, read-only/параметризация/
  пул/шифрование секретов). Backend 36/670, frontend 236, оба tsc 0, прод-сборка
  фронта проходит. Живой E2E на Postgres И MySQL: оба отклоняют запись в READ
  ONLY транзакции на уровне СУБД. Остаточный техдолг заведён как B7 (OPEN):
  external/computed/websocket/mock/sqlite + серверный feed-polling/webhook.
- 2026-06-08 — B7 FIXED: реализованы external (пресеты WP/Strapi/Shopify→REST),
  computed (concat/merge, RCE-safe, cycle/depth-guard), database→sqlite
  (better-sqlite3 readonly + path-guard, живой E2E на файле), серверный
  feed-scheduler (node-cron, due по lastFetchAt). Починен токенайзер `:name`
  (литералы/комментарии/касты). WONTFIX: websocket (статика), mock (=static),
  rest (алиас rest-api), feed webhook-pull. Новые тесты: externalServicePresets
  (8), ComputedDataSourceService (18), FeedPollingScheduler (10), +sqlite/`:name`
  в DatabaseQueryService. Backend 39 suites / 720, frontend 236, оба tsc 0,
  прод-сборка фронта проходит. Деп: +better-sqlite3, +node-cron.
- 2026-06-12 — B8 FIXED: библиотека блоков. (1) `_applyLinkedBlocks` — цикл-guard
  по ветке предков вместо «навсегда» (второй инстанс блока разворачивается),
  +2 регресс-теста; (2) `BlockController.stripInstanceArtifacts` на всех путях
  записи в библиотеку; (3) фронт: `libraryClean.ts` (cleanForLibrary/
  isLinkedPlaceholder/stripViewportIds, 8 тестов), `handleSaveAllToLibrary`
  получил guard от placeholder'ов и очистку корня, тройной дубль логики
  устранён. Read-only диагностика битых блоков:
  `scripts/diagnose-library-blocks.ts` (SELF_REF/EMPTY + кандидаты
  восстановления из PageVersion). Backend 41/742, frontend 14/291, backend tsc 0.
- 2026-06-12 — B8: ремонт локальных данных (`repair-library-blocks.ts` + ручная
  зачистка сирот): 21/48 битых → 3/39 (детали в секции B8). Бэкапы до/после в
  `backups/` (103901 / 104703), послеремонтный — для переноса на сервер.
