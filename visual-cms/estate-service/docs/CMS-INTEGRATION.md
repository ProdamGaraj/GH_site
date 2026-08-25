# Runbook: связка estate-service с CMS (DataSource + Collection)

Локально подтверждено: CMS-backend читает estate-service через DataSource
(`rest-api`, server-fetch) во всех 3 языках — SSRF-allowlist пропускает
`estate-service`. Ниже — шаги для сервера (.19), где живёт реальная страница
`/adostlik` («Complex Doʼstlik»), которую берём шаблоном.

Предпосылки на сервере:
- `estate-service` добавлен в тот же `docker compose` стек (см. корневой
  `docker-compose.yml`), поднят, БД `estate` создана, seed выполнен:
  `docker compose exec estate-service npm run seed:dostlik`.
- В backend `SSRF_ALLOWED_HOSTS` содержит `estate-service` (уже в базовом
  compose).

## 0. Быстрый путь — кнопка «Страницы проектов» (провижн)

В админке ЖК (`/visual_cms/estate`) кнопка **«Страницы проектов»** делает шаги
1–2 автоматически и идемпотентно (повторный вызов не плодит дубли):

- `POST /api/collections/provision-estate` `{ siteId, templatePageId, basePath }`.
- Создаёт/находит DataSource(`rest-api`) на
  `http://estate-service:5100/api/complexes?full=1&lang={{lang}}` — плейсхолдер
  `{{lang}}` подставляет DeployService на деплое (язык по умолчанию — на дефолтный
  код языка сайта; для не-дефолтных языков коллекция деплоится в `/<lang>/<basePath>/…`
  при наличии переводов страницы-шаблона).
- Создаёт/обновляет Collection с раскладкой полей estate: `arrayPath=items`,
  `slugField=slug`, `titleField=name`, `apiIdField=slug`.

После провижна остаётся ручной шаг 3 (привязка полей шаблона) и деплой (шаг 4).
Разделы 1–2 ниже — ручной эквивалент кнопки (для отладки/понимания).

## 1. DataSource (тип rest-api)

Создать источник, указывающий на full-эндпоинт (массив полных деталей ЖК). Для
мультиязычного деплоя одним источником — плейсхолдер `{{lang}}` в URL:

```
POST /api/data-sources
{
  "name": "Estate — Комплексы (ru)",
  "type": "rest-api",
  "status": "active",
  "config": {
    "url": "http://estate-service:5100/api/complexes?lang=ru&full=1",
    "method": "GET"
  }
}
```

Проверить: `POST /api/data-sources/new/test` тем же `config` → `success:true`,
`sampleData.items[0]` содержит `name/stats/yard/houses/apartments`.

Для uz/en — отдельные DataSource с `lang=uz` / `lang=en` (мультиязычный деплой
в CMS выбирает источник по языку) ИЛИ один источник + переключение языка на
уровне страницы (по тому, как устроен мультиязычный деплой сайта).

## 2. Collection

Массив элементов — `items` (каждый элемент = полный ЖК). Одна страница на ЖК.

```
POST /api/collections
{
  "name": "Проекты (ЖК)",
  "dataSourceId": "<id из шага 1>",
  "templatePageId": "<id страницы /adostlik>",
  "mainExtractPath": "items",      // путь к массиву в ответе источника
  "slugField": "slug",             // assalom-dostlik → /basePath/assalom-dostlik
  "basePath": "/complex",          // префикс URL сгенерированных страниц
  "itemIdField": "slug"
}
```

`templatePageId` — id существующей страницы Doʼstlik (взять из
`GET /api/pages`, найти по name «Complex Doʼstlik»).

## 3. Привязка полей шаблона к данным элемента

В редакторе шаблонной страницы привязать (INPUT-биндинги) секции к полям
элемента коллекции:

| Секция | Поле элемента |
|--------|---------------|
| `#projectName`, `#choiceProject`, `#leadProject` | `name` |
| `#projectClass` (бейдж) | `className` |
| `#projectIntro` | `intro` |
| `#projectAbout` / `#projectAboutExtra` | `about` / `aboutExtra` |
| `#features` (stats-row) | repeater по `stats[]` → `value` / `label` |
| `#yardEyebrow`/`#yardTitle`/`#yardText` | `yard.eyebrow`/`yard.title`/`yard.text` |
| `#yardFeatures` | repeater по `yard.features[]` |
| `#projectLocationText` | `locationText` |
| hero `--hero-image` | `heroImages[0]` |
| aboutMedia `--image` | `media` |
| yard/hall media | `yard.gallery[0]` / `hallGallery[0]` |
| `.apartments-grid` | **repeater по `apartments[]`** |

Внутри карточки квартиры (repeater `apartments[]`):

| Узел карточки | Поле |
|---------------|------|
| `h3` (заголовок) | `title` («4-комн. 114 м²», уже по языку) |
| `[data-apartment-class]` | `apartmentClass` |
| доп. бейдж | repeater `badges[]` |
| `.apartment-price` | `priceFormatted` |
| `.old-price` | `oldPriceFormatted` |
| `.apartment-meta` вторая строка | `meta` (уже по языку) |
| `.apartment-offer` | `offerLabel` (скрыть, если пусто) |
| `.plan-visual` `--plan-image` | `planImage` |

Производные (`title`, `priceFormatted`, `meta`) уже собраны сервисом под язык —
на стороне CMS трансформации не нужны.

## 4. Deploy + сверка

1. Опубликовать/задеплоить сайт (DeployService).
2. Открыть `/<basePath>/assalom-dostlik` (напр. `/complex/assalom-dostlik`) на
   каждом языке.
3. Сверить с текущей `/adostlik`: класс «Бизнес», stats «9 и 16», 4 карточки
   квартир (№ 102/116/139/66), цены и meta.
4. uz/en: переключить язык — тексты/бейджи/meta переводятся, непереведённые
   длинные абзацы (about/aboutExtra на uz) остаются на ru (ожидаемый фолбэк).

## Примечания

- Порядок карточек квартир в гриде задаётся глобальным `order` (endpoint отдаёт
  `apartments[]` уже отсортированным: 102, 116, 139, 66).
- Добавление нового ЖК = запись в estate (через админку/seed) → Collection
  автоматически сгенерит новую страницу того же шаблона при следующем деплое.
