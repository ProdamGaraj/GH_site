# ТЗ: Динамические страницы проектов

> Дата: 6 апреля 2026  
> Статус: Черновик  
> Проект: Visual CMS
>
> Статус реализации (на 19 мая 2026): ЧАСТИЧНО, не покрыто тестами.
> Документ — черновик ТЗ. Функция «создание страниц проекта на лету» помечена
> в истории как нестабильная и непротестированная. Перед опорой на этот документ
> сверяйтесь с кодом и [../PROJECT_STATUS_REPORT.md](../PROJECT_STATUS_REPORT.md).

---

## 1. Цель

Реализовать систему динамических страниц проектов, которая позволяет:

1. **Авто-шаблоны** — настроить шаблон страницы, и система автоматически сгенерирует HTML-страницу для каждого элемента из API
2. **Управление ссылками** — автоматически и вручную формировать ссылки на страницы проектов в каталоге и навигации
3. **Кастомные страницы** — для отдельных проектов создавать уникальные страницы, которые заменяют авто-шаблон

---

## 2. Текущее состояние

### Что есть

| Компонент | Состояние |
|-----------|-----------|
| Publish-time генерация HTML | ✅ DeployService → HtmlGenerator |
| Runtime data-binding JS | ✅ DataBindingGenerator |
| INPUT-привязки (single / repeater) | ✅ Работают |
| Динамические фильтры | ✅ По sourceBlockId из DOM |
| Page Variables | ✅ `window.$var()` |
| Nginx clean URLs | ✅ `/golden-house/about` → `about.html` |
| Навигация сайта | ✅ NavigationEditor |

### Чего не хватает

| Возможность | Текущий статус |
|-------------|----------------|
| Чтение URL-параметров в runtime | ❌ Не реализовано |
| Генерация N страниц из одного шаблона | ❌ Нет концепции «collection page» |
| Slug из API-данных | ❌ Slug задаётся вручную в модели Page |
| Авто-ссылки в repeater → детальная страница | ❌ Вручную через html-code |
| Подмена шаблона для конкретного элемента | ❌ Нет механизма override |

---

## 3. Архитектура решения

### 3.1. Новая сущность: Collection (Коллекция)

Коллекция связывает **источник данных** (API), **шаблон страницы** и **правила генерации URL**.

```
┌─────────────────────────────────────────────────────┐
│                    COLLECTION                        │
│                                                     │
│  dataSourceId  ──→  API возвращает [{id, slug, …}] │
│  templatePageId ──→  Страница-шаблон в CMS          │
│  slugField      ──→  Поле API для URL (напр. "slug")│
│  titleField     ──→  Поле API для заголовка         │
│  basePath       ──→  "/projects"                     │
│  overrides[]    ──→  {apiItemId → customPageId}     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 3.2. Три режима работы

```
Проект "Sunrise"  ─→  Нет override  ─→  Автошаблон  ─→  /projects/sunrise
Проект "Oasis"    ─→  Нет override  ─→  Автошаблон  ─→  /projects/oasis
Проект "Premium"  ─→  Override есть ─→  Кастомная   ─→  /projects/premium
```

### 3.3. Поток данных при деплое

```
                        DeployService.deployCollection(collectionId)
                                        │
                    ┌───────────────────┤
                    ▼                   │
          1. GET /api/data-sources      │
             /{dsId}/data               │
                    │                   │
                    ▼                   │
          2. Получаем массив            │
             [{id:1, slug:"sunrise",    │
               title:"Sunrise", ...},   │
              {id:2, slug:"oasis", ...}]│
                    │                   │
       ┌────────────┼────────────┐     │
       ▼            ▼            ▼     │
   item[0]      item[1]      item[2]   │
       │            │            │     │
       ▼            ▼            ▼     │
   override?    override?    override? │
    Нет→шаблон   Нет→шаблон  Да→custom│
       │            │            │     │
       ▼            ▼            ▼     │
   Генерация    Генерация    Генерация │
   sunrise.html oasis.html  premium.html
       │            │            │
       └────────────┼────────────┘
                    ▼
        /sites/{siteSlug}/projects/
            ├── sunrise.html
            ├── oasis.html
            └── premium.html
```

---

## 4. Модель данных

### 4.1. Новая таблица: `collections`

```sql
CREATE TABLE collections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,         -- "Проекты"
  
  -- Источник данных
  data_source_id  UUID NOT NULL REFERENCES data_sources(id),
  array_path      VARCHAR(255) DEFAULT 'data',   -- Путь к массиву в ответе API
  
  -- Шаблон
  template_page_id UUID NOT NULL REFERENCES pages(id),
  
  -- URL-генерация
  base_path       VARCHAR(255) NOT NULL,          -- "/projects"
  slug_field      VARCHAR(255) NOT NULL,          -- Какое поле API использовать как slug
  title_field     VARCHAR(255) DEFAULT 'title',   -- Какое поле API → <title>
  
  -- Авто-ссылки
  link_mode       VARCHAR(50) DEFAULT 'auto',     -- 'auto' | 'manual' | 'disabled'
  link_text_field VARCHAR(255),                    -- Поле API для текста ссылки
  
  -- Настройки
  is_active       BOOLEAN DEFAULT true,
  items_order     VARCHAR(50) DEFAULT 'api',      -- 'api' | 'alphabetical' | 'custom'
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2. Таблица переопределений: `collection_overrides`

```sql
CREATE TABLE collection_overrides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id   UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  
  api_item_id     VARCHAR(255) NOT NULL,          -- ID элемента из API (напр. "3")
  api_item_slug   VARCHAR(255),                   -- Slug элемента из API (для маршрутизации)
  custom_page_id  UUID NOT NULL REFERENCES pages(id),
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(collection_id, api_item_id)
);
```

### 4.3. Изменения в существующих таблицах

**pages:**
```sql
ALTER TABLE pages ADD COLUMN is_template BOOLEAN DEFAULT false;
-- Страницы-шаблоны не публикуются отдельно, только через коллекцию
```

---

## 5. Backend: API

### 5.1. CRUD коллекций

```
GET    /api/collections                  -- Список коллекций (фильтр по siteId)
GET    /api/collections/:id              -- Одна коллекция с overrides
POST   /api/collections                  -- Создать коллекцию
PUT    /api/collections/:id              -- Обновить
DELETE /api/collections/:id              -- Удалить

GET    /api/collections/:id/items        -- Загрузить элементы из API + статусы
POST   /api/collections/:id/deploy       -- Опубликовать все страницы коллекции
```

### 5.2. CRUD переопределений

```
POST   /api/collections/:id/overrides    -- Привязать кастомную страницу к элементу
PUT    /api/collections/:id/overrides/:overrideId
DELETE /api/collections/:id/overrides/:overrideId
```

### 5.3. Формат запроса создания коллекции

```json
{
  "siteId": "a83bae31-...",
  "name": "Проекты Golden House",
  "dataSourceId": "fcf4abe2-...",
  "arrayPath": "data",
  "templatePageId": "5f597235-...",
  "basePath": "/projects",
  "slugField": "slug",
  "titleField": "title",
  "linkMode": "auto",
  "linkTextField": "name"
}
```

### 5.4. Формат ответа GET /collections/:id/items

```json
{
  "collection": { "id": "...", "name": "Проекты", "basePath": "/projects" },
  "items": [
    {
      "apiItemId": "1",
      "slug": "sunrise",
      "title": "ЖК Sunrise",
      "generatedUrl": "/projects/sunrise",
      "mode": "template",
      "status": "published",
      "lastDeployedAt": "2026-04-06T..."
    },
    {
      "apiItemId": "3",
      "slug": "premium",
      "title": "Golden House Premium",
      "generatedUrl": "/projects/premium",
      "mode": "custom",
      "customPageId": "abc123-...",
      "customPageName": "Premium — спецстраница",
      "status": "published",
      "lastDeployedAt": "2026-04-05T..."
    }
  ]
}
```

---

## 6. Backend: Генерация страниц

### 6.1. DeployService.deployCollection()

```
Вход: collectionId
Выход: массив сгенерированных файлов

Алгоритм:
1. Загрузить коллекцию с overrides
2. Выполнить запрос к data source → получить массив элементов
3. Для каждого элемента:
   a. Проверить — есть ли override (кастомная страница)?
      - Да → загрузить custom page, использовать её structure/bindings
      - Нет → использовать template page
   b. При использовании шаблона:
      - Создать «виртуальный» контекст привязки: PAGE_ITEM = текущий элемент
      - В DataConfig добавить item-specific фильтры
   c. Вызвать HtmlGenerator.generatePage() с:
      - structure (шаблона или кастомной страницы)
      - metadata = { title: item[titleField], ... }
      - dataConfig + добавленный фильтр по текущему элементу
   d. Записать файл: /sites/{siteSlug}/{basePath}/{itemSlug}.html
4. Обновить deploy log
```

### 6.2. Injection контекста элемента в шаблон

При генерации авто-страницы runtime-скрипт получает дополнительный контекст:

```javascript
// Генерируется DeployService для каждого элемента коллекции
const _collectionItem = {
  id: "3",
  slug: "sunrise",
  title: "ЖК Sunrise",
  // ... все поля из API для этого элемента
};

// Runtime auto-фильтр: привязки шаблона автоматически фильтруют по текущему элементу
// Вместо загрузки всех проектов — загружается только текущий
const _collectionFilter = {
  field: "id",        // = slugField коллекции (или явно настроенный filterField)
  operator: "eq",
  value: "3"          // = apiItemId текущего элемента
};
```

В DataBindingGenerator добавляется логика:
```javascript
// Если страница — часть коллекции, добавить авто-фильтр к каждому INPUT binding
if (_collectionFilter) {
  filters.push(_collectionFilter);
}
```

### 6.3. Интеграция с существующим деплоем сайта

В `DeployService.deploySite()` после деплоя обычных страниц:

```typescript
// Существующий код: деплой обычных страниц
for (const page of site.pages) {
  await this.deployPage(page.id)
}

// НОВОЕ: деплой коллекций сайта
const collections = await collectionRepository.find({ where: { siteId, isActive: true } })
for (const collection of collections) {
  await this.deployCollection(collection.id)
}
```

---

## 7. Управление ссылками

### 7.1. Авто-ссылки в repeater

Когда repeater отображает элементы коллекции, ссылки генерируются автоматически.

**Новое поле в repeater config:**

```typescript
// В модели DataBinding, inputConfig.repeaterConfig:
repeaterConfig: {
  itemTemplate: "template-id",
  containerSelector: "...",
  
  // НОВОЕ:
  collectionLink?: {
    collectionId: string,          // ID коллекции
    slugField: string,             // Поле для slug (из API данных)
    linkSelector: string,          // CSS-селектор ссылки внутри шаблона
    // Пример: "a[data-project-link]" или "a:first-child"
  }
}
```

**Runtime-логика в DataBindingGenerator (renderRepeater):**

```javascript
// После клонирования шаблона для каждого item:
if (config.collectionLink) {
  var linkEl = clone.querySelector(config.collectionLink.linkSelector);
  if (linkEl) {
    var itemSlug = getNestedValue(item, config.collectionLink.slugField);
    linkEl.href = config.collectionLink.basePath + '/' + itemSlug;
  }
}
```

### 7.2. Ручные ссылки

Пользователь может вручную в шаблоне элемента (карточки проекта) привязать href к полю данных:

**Через существующий fieldMapping:**
```json
{
  "sourceField": "slug",
  "targetProperty": "attributes.href",
  "transform": "template:/projects/{{value}}"
}
```

Для этого нужно добавить **тип трансформации `template`** в runtime:

```javascript
function applyFieldMapping(element, mapping, value) {
  if (mapping.transform && mapping.transform.startsWith('template:')) {
    var tpl = mapping.transform.substring('template:'.length);
    value = tpl.replace('{{value}}', value);
  }
  // ... существующая логика setAttribute / textContent
}
```

### 7.3. Ссылки в навигации сайта

**Текущая навигация** (`NavigationEditor`) хранит массив пунктов меню со ссылками на страницы. Добавляется новый тип пункта:

```typescript
interface NavigationItem {
  id: string
  label: string
  type: 'page' | 'url' | 'collection'   // НОВОЕ: 'collection'
  
  // Для type='page':
  pageId?: string
  
  // Для type='url':
  url?: string
  
  // НОВОЕ: Для type='collection':
  collectionId?: string
  showAs?: 'dropdown' | 'mega-menu' | 'link-to-index'
  maxItems?: number              // Макс. кол-во подпунктов (для dropdown)
  sortBy?: string                // Поле API для сортировки
}
```

При деплое навигации (`HtmlGenerator.generateNavRuntime()`):
- `type: 'collection'` + `showAs: 'dropdown'` → подгружает элементы коллекции и строит подменю
- `type: 'collection'` + `showAs: 'link-to-index'` → одна ссылка на `{basePath}/` (индексная страница)

---

## 8. Frontend: UI в редакторе

### 8.1. Новая страница: Коллекции

**Маршрут:** `/collections` и `/collections/:id`

**Список коллекций** (`CollectionsPage.tsx`):
- Таблица: имя, источник данных, шаблон, кол-во элементов, статус
- Кнопки: создать, удалить, опубликовать все

**Настройка коллекции** (`CollectionEditor.tsx`):

```
┌─────────────────────────────────────────────────────────┐
│  Коллекция: Проекты Golden House                        │
├─────────────┬───────────────────────────────────────────┤
│             │                                           │
│  Источник   │  [Выпадающий список Data Sources]         │
│  данных     │  123 (Mock API)                            │
│             │                                           │
│  Шаблон     │  [Выпадающий список Pages]                │
│  страницы   │  Шаблон проекта  [Открыть в редакторе →]  │
│             │                                           │
│  Базовый    │  /projects                                │
│  путь URL   │                                           │
│             │                                           │
│  Поле slug  │  [slug ▼]   ← из полей API               │
│             │                                           │
│  Поле       │  [title ▼]  ← из полей API               │
│  заголовка  │                                           │
│             │                                           │
│  Ссылки     │  ◉ Авто  ○ Вручную  ○ Выключены          │
│             │                                           │
├─────────────┴───────────────────────────────────────────┤
│                                                         │
│  Элементы коллекции           [🔄 Обновить] [🚀 Deploy] │
│                                                         │
│  ┌──────────┬──────────┬────────┬──────────┬─────────┐ │
│  │ Название │ URL      │ Режим  │ Статус   │ Действия│ │
│  ├──────────┼──────────┼────────┼──────────┼─────────┤ │
│  │ Sunrise  │ /sunrise │ 🤖 Авто│ ✅ Опубл.│  ✏️  🔗  │ │
│  │ Oasis    │ /oasis   │ 🤖 Авто│ ⏳ Черн. │  ✏️  🔗  │ │
│  │ Premium  │ /premium │ 📝 Своя│ ✅ Опубл.│  ✏️  🔗  │ │
│  │ Elite    │ /elite   │ 🤖 Авто│ ❌ Нет   │  ✏️  🔗  │ │
│  └──────────┴──────────┴────────┴──────────┴─────────┘ │
│                                                         │
│  ✏️ = открыть кастомную страницу / создать override     │
│  🔗 = скопировать URL                                    │
└─────────────────────────────────────────────────────────┘
```

### 8.2. Кнопка «Создать свою страницу» для элемента

При клике на ✏️ у элемента, который сейчас в режиме «Авто»:

1. **Диалог:** «Создать кастомную страницу для проекта "Sunrise"?»
2. **Два варианта:**
   - «Пустая страница» — создаётся новая Page, добавляется override
   - «Копия шаблона» — клонируется template page, добавляется override
3. Redirect в редактор новой страницы

### 8.3. Настройка авто-ссылок в SmartDataBindingTab

В существующем `SmartDataBindingTab.tsx`, в секции repeater, добавить блок:

```
┌─────────────────────────────────────────────┐
│  🔗 Ссылки на страницы проектов             │
│                                             │
│  Коллекция:  [Проекты Golden House ▼]       │
│  Поле slug:  [slug ▼]                       │
│  Элемент-ссылка:  [a[data-project-link] ▼]  │
│                                             │
│  Результат: /projects/{{slug}}              │
└─────────────────────────────────────────────┘
```

---

## 9. Изменения в Nginx

Добавить поддержку под-путей коллекций:

```nginx
# Существующий fallback уже работает:
# /golden-house/projects/sunrise
#   → rewrite → /sites/golden-house/projects/sunrise
#   → try_files → /sites/golden-house/projects/sunrise.html
```

**Дополнительно**: для индексной страницы коллекции (`/projects/`) — можно генерировать `projects/index.html` (авто-каталог или отдельная страница).

---

## 10. План реализации

### Этап 1: Модели и API (бэкенд)
**Задачи:**
- [ ] Создать модели Collection и CollectionOverride (TypeORM entity)
- [ ] Миграция БД: таблицы `collections`, `collection_overrides`
- [ ] CRUD routes: `/api/collections`, `/api/collections/:id/overrides`
- [ ] Endpoint `GET /api/collections/:id/items` — загрузка элементов из data source + merge со статусами
- [ ] Zod-схемы валидации

**Оценка:** ~20 файлов, основная работа — по аналогии с DataSource/DataBinding

### Этап 2: Деплой коллекций
**Задачи:**
- [ ] `DeployService.deployCollection()` — итерация по элементам API, генерация HTML для каждого
- [ ] Injection `_collectionItem` и `_collectionFilter` в DataConfig
- [ ] `DataBindingGenerator` — обработка `_collectionFilter` при сборе фильтров
- [ ] Интеграция в `deploySite()` — после деплоя обычных страниц деплоить коллекции
- [ ] Deploy endpoint: `POST /api/collections/:id/deploy`
- [ ] Генерация индексной страницы коллекции (опционально)

**Оценка:** основная логика в DeployService (~150 строк), DataBindingGenerator (~20 строк)

### Этап 3: Авто-ссылки
**Задачи:**
- [ ] Расширить repeaterConfig: `collectionLink`
- [ ] Runtime: генерация href в renderRepeater
- [ ] Трансформация `template:` в fieldMapping для ручного режима
- [ ] Расширить NavigationItem: type `'collection'`, showAs, runtime-подгрузка

**Оценка:** DataBindingGenerator (~30 строк), DeployService (~20 строк), NavigationEditor (~50 строк)

### Этап 4: UI коллекций (фронтенд)
**Задачи:**
- [ ] `collectionsSlice.ts` — Redux state + async thunks
- [ ] `CollectionsPage.tsx` — список коллекций
- [ ] `CollectionEditor.tsx` — настройка коллекции + таблица элементов
- [ ] Кнопка «Создать свою страницу» + диалог
- [ ] Секция «Ссылки на коллекцию» в SmartDataBindingTab
- [ ] Пункт навигации «Коллекция» в NavigationEditor
- [ ] Route `/collections` и `/collections/:id`
- [ ] Пункт в Dashboard и Header

**Оценка:** ~10 новых компонентов, 1 slice, 1 route-файл

### Этап 5: Интеграция и тесты
**Задачи:**
- [ ] E2E сценарий: создать коллекцию → настроить → деплой → проверить файлы
- [ ] Unit-тесты: deployCollection, авто-фильтр, slug-генерация
- [ ] Проверка конфликтов slugов (коллекция vs обычная страница)
- [ ] Проверка переопубликации при изменении API-данных

---

## 11. Пример использования (User Story)

### Сценарий: Golden House — страницы проектов

**1. Менеджер создаёт коллекцию:**
- Имя: «Проекты»
- Источник данных: Mock API (возвращает проекты)
- Шаблон: страница «Шаблон проекта» (созданная ранее в редакторе)
- Базовый путь: `/projects`
- Поле slug: `slug`
- Поле заголовка: `title`
- Ссылки: авто

**2. Система подгружает элементы из API:**
```
Sunrise  →  /projects/sunrise  →  🤖 Авто
Oasis    →  /projects/oasis    →  🤖 Авто
Premium  →  /projects/premium  →  🤖 Авто
```

**3. Менеджер решает сделать для Premium свою страницу:**
- Нажимает ✏️ → «Копия шаблона»
- Открывается редактор — редактирует уникальный дизайн
- Сохраняет

**4. Деплой:**
```
/sites/golden-house/projects/sunrise.html  ← из шаблона + данные API[0]
/sites/golden-house/projects/oasis.html    ← из шаблона + данные API[1]
/sites/golden-house/projects/premium.html  ← кастомная страница
```

**5. На главной в repeater-каталоге:**
Карточки автоматически получают ссылки:
```html
<a href="/projects/sunrise">ЖК Sunrise</a>
<a href="/projects/oasis">ЖК Oasis</a>
<a href="/projects/premium">Golden House Premium</a>
```

---

## 12. Ограничения и допущения

1. **Статическая генерация** — страницы создаются при деплое, а не по запросу. При изменении данных API нужен re-deploy коллекции.
2. **Slug-конфликты** — система проверяет уникальность slug внутри basePath. При конфликте — добавляет суффикс `-2`.
3. **Количество элементов** — рассчитано на ≤500 элементов в коллекции (для каждого генерируется HTML-файл).
4. **Кеширование API** — при деплое коллекции API вызывается один раз, результат переиспользуется для всех элементов.
5. **Шаблонная страница** не публикуется как самостоятельная — только через коллекцию.
