# estate-service — модуль ЖК для Visual CMS

Отдельный микросервис-хранилище жилых комплексов, домов и квартир. CMS читает
его через **DataSource (`rest-api`)** и генерирует страницы проектов из одного
шаблона (**Collections**) — один стиль, разный контент. Логика изолирована от
основного backend; «подключение» к CMS — через DataSource + (позже) раздел
админки в CMS-фронте.

Статус: MVP (end-to-end на «Assalom Doʼstlik»). Backend сервиса готов, покрыт
тестами. Связка DataSource/Collection и деплой выполняются на запущенном стеке.

## Структура

```
estate-service/
├── src/
│   ├── models/            Complex, House, Apartment, EstateTranslation
│   ├── migrations/        001_init.sql (идемпотентно) + runner.ts
│   ├── services/          i18n.ts (overlay + производные), Logger.ts
│   ├── controllers/       ComplexController (read)
│   ├── routes/            /health, /api/complexes, /api/complexes/:slug
│   ├── config/            database.ts, ensureDatabase.ts (авто-создание БД)
│   ├── scripts/           seed-dostlik.ts
│   ├── __tests__/         35 unit-тестов (чистые функции)
│   ├── app.ts, server.ts
├── Dockerfile, docker-entrypoint.sh
└── package.json, tsconfig.json, jest.config.js
```

## Модель данных

- **Complex (ЖК)** — slug, className, intro/about/aboutExtra, yard{eyebrow/title/
  text/features/gallery}, hallGallery, stats[{value,label}], hero/media (URL),
  locationText/mapUrl, status, order.
- **House (дом/корпус)** — floors ("9"/"16"), entrances, deadline, className.
- **Apartment (квартира)** — rooms, areaM2, price/oldPrice (UZS), badges[],
  floor ("8/9"), entrance, number, deadline, offerLabel, planImage, status.

### Мультиязычность (ru/uz/en) — overlay-модель (как в CMS)

Базовые поля хранят язык по умолчанию **ru**. Переводы uz/en лежат строками в
`estate_translations` (entityType, entityId, locale, field, value) и
накладываются при чтении по `?lang=`. Нет строки (или пустая) → **фолбэк на ru**.
jsonb-поля (yardFeatures, stats, badges) хранятся в переводе как JSON-строка.

## Запуск

### В составе стека (docker-compose)

Сервис добавлен в корневой `docker-compose.yml` (`estate-service`, порт 5100,
БД `estate` на общем postgres, создаётся автоматически). Backend CMS уже имеет
`estate-service` в `SSRF_ALLOWED_HOSTS` (server-fetch DataSource).

```bash
# из visual-cms/
docker compose up -d estate-service
docker compose exec estate-service npm run seed:dostlik   # залить Doʼstlik
curl http://localhost:5100/health
curl "http://localhost:5100/api/complexes/assalom-dostlik?lang=ru"
```

### Локально (нужен доступный Postgres)

```bash
cd estate-service
npm install
cp .env.example .env        # поправить DATABASE_URL
npm run seed:dostlik
npm run dev
```

## API

| Метод | Путь | Назначение |
|-------|------|-----------|
| GET | `/health` | статус сервиса |
| GET | `/api/complexes?lang=ru\|uz\|en` | список ЖК для каталога/Collection |
| GET | `/api/complexes/:slug?lang=ru\|uz\|en` | деталь ЖК: houses[] + apartments[] |

Деталь возвращает и вложенные `houses[].apartments[]`, и плоский `apartments[]`
(для repeater «Выбрать», отсортирован по глобальному order). Производные поля
собираются по языку: `title` («4-комн. 114 м²»), `priceFormatted`
(«1 354 320 000 UZS»), `meta` («№ 102 | 8/9 этаж | 2 подъезд | 1 кв. 2028»).

## Интеграция с CMS (DataSource + Collection)

Выполняется на запущенном стеке (в CMS):

1. **DataSource** типа `rest-api`, URL
   `http://estate-service:5100/api/complexes/assalom-dostlik?lang=ru`
   (для листинга каталога — `.../api/complexes?lang=ru`, извлечение `items`).
2. **Collection**: `templatePageId` = страница `/adostlik` («Complex Doʼstlik»),
   источник — этот DataSource, `slugField=slug`, `basePath` каталога.
3. Привязать секции шаблона к полям (hero/stats/about/yard/hall/location) и
   квартиры — **repeater** по `apartments[]` (title/priceFormatted/badges/meta/…).
4. Deploy → сверить сгенерированную страницу с текущей `/adostlik` (ru/uz/en).

## Тесты

```bash
npm test          # jest: 35 тестов (overlay, фолбэк, производные, сборка DTO, guard имени БД)
npx tsc --noEmit  # типы
```

## Ops-заметки

- **БД `estate`** создаётся автоматически на старте (`ensureDatabase`), т.к.
  postgres-том CMS уже инициализирован и initdb-скрипты не сработают.
- **Схема** — идемпотентные SQL-миграции (`runSafeMigrations`), как в backend.
- **Записи** (будущая админка) — под заголовком `X-Estate-Token`
  (`ESTATE_WRITE_TOKEN`); чтение открыто во внутренней сети.
- **Изоляция** — отдельная БД; при желании легко вынести в отдельный
  postgres-контейнер (сменить `DATABASE_URL`).
