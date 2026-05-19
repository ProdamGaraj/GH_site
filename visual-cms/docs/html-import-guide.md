# Руководство по созданию HTML-страниц для импорта в Visual CMS

> Статус (на 19 мая 2026): руководство описывает ЦЕЛЕВОЙ формат HTML для импорта.
> Импорт подключён НЕ полностью: парсер `domElementToNewBlockNode`
> (`frontend/src/features/editor/utils/exportUtils.ts`) присутствует, но не
> вызывается из UI. До завершения интеграции рассматривайте документ как
> спецификацию формата, а не как описание работающей функции. См.
> [../PROJECT_STATUS_REPORT.md](../PROJECT_STATUS_REPORT.md), раздел 5.

## Содержание

1. [Обзор процесса](#1-обзор-процесса)
2. [Структура HTML-документа](#2-структура-html-документа)
3. [Маппинг HTML-тегов в типы элементов](#3-маппинг-html-тегов-в-типы-элементов)
4. [Стилизация](#4-стилизация)
5. [Поддерживаемые атрибуты](#5-поддерживаемые-атрибуты)
6. [Текстовое содержимое](#6-текстовое-содержимое)
7. [Layout-режимы (flex/grid)](#7-layout-режимы-flexgrid)
8. [Полный пример HTML-страницы для импорта](#8-полный-пример-html-страницы-для-импорта)
9. [Импорт через JSON (BlockNode)](#9-импорт-через-json-blocknode)
10. [Анимации, ховеры, скрипты (только JSON)](#10-анимации-ховеры-скрипты-только-json)
11. [Responsive дизайн (только JSON)](#11-responsive-дизайн-только-json)
12. [Data Binding атрибуты](#12-data-binding-атрибуты)
13. [Навигация сайта](#13-навигация-сайта)
14. [Импорт через API (программный)](#14-импорт-через-api-программный)
15. [Ограничения HTML-импорта](#15-ограничения-html-импорта)
16. [Чеклист перед импортом](#16-чеклист-перед-импортом)

---

## 1. Обзор процесса

Visual CMS поддерживает два формата импорта:

| Формат | Полнота | Сложность | Что поддерживается |
|--------|---------|-----------|-------------------|
| **HTML** | Базовая | Простая | Структура, стили, текст, атрибуты |
| **JSON (BlockNode)** | Полная | Высокая | Всё: стили, анимации, ховеры, скрипты, responsive, data binding |

### Процесс импорта HTML

1. Пользователь открывает **список страниц** или **редактор** в CMS
2. Нажимает кнопку **«Импорт»**
3. Вставляет HTML-код или загружает файл
4. CMS парсит HTML через `DOMParser` и конвертирует в дерево `BlockNode`
5. Страница открывается в визуальном редакторе для дальнейшего редактирования

### Формат автоопределяется

Если содержимое начинается с `{` или `[` — система считает его JSON, иначе — HTML.

---

## 2. Структура HTML-документа

### Минимальная структура

```html
<section data-cms-root>
  <!-- Всё содержимое страницы -->
</section>
```

### Полная структура

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Моя страница</title>
  <style>
    .hero { display: flex; align-items: center; min-height: 100vh; }
    .hero-title { font-size: 48px; font-weight: 700; color: #333; }
  </style>
</head>
<body>
  <section data-cms-root class="hero">
    <h1 class="hero-title">Заголовок</h1>
  </section>
</body>
</html>
```

### Определение корневого элемента

Парсер ищет корневой элемент в следующем порядке приоритета:

1. **Элемент с атрибутом `data-cms-root`** — наивысший приоритет
2. **`<main>`** — семантический корень
3. **`<section>`** — секция контента
4. **`<article>`** — статья / блок контента
5. **Единственный прямой потомок `<body>`** — если в body один элемент (без учёта `<script>`, `<style>`, `<meta>`, `<link>`)
6. **`<body>` целиком** — используется как fallback

**Рекомендация:** всегда используйте `data-cms-root` на нужном элементе, чтобы избежать неоднозначности.

```html
<body>
  <!-- CMS возьмёт этот div как корень -->
  <div data-cms-root>
    <header>...</header>
    <main>...</main>
    <footer>...</footer>
  </div>
</body>
```

---

## 3. Маппинг HTML-тегов в типы элементов

При импорте каждый HTML-тег конвертируется в определённый `elementType` в системе CMS:

### Контейнеры (`container`)

| HTML-тег | Описание |
|----------|----------|
| `<div>` | Универсальный контейнер |
| `<section>` | Секция страницы |
| `<article>` | Статья / карточка |
| `<header>` | Шапка |
| `<footer>` | Подвал |
| `<nav>` | Навигация |
| `<main>` | Основной контент |
| `<aside>` | Боковая панель |
| `<ul>`, `<ol>` | Списки |
| `<li>` | Элемент списка |
| `<form>` | Форма |
| `<textarea>` | Многострочное поле (как контейнер) |
| `<select>` | Выпадающий список (как контейнер) |

### Текстовые элементы (`text`)

| HTML-тег | Описание |
|----------|----------|
| `<p>` | Параграф |
| `<h1>`–`<h6>` | Заголовки |
| `<span>` | Строчный текст |
| `<label>` | Подпись |
| `<a>` | Ссылка (сохраняет `href`) |

### Специальные элементы

| HTML-тег | elementType | Описание |
|----------|------------|----------|
| `<img>` | `image` | Изображение (сохраняет `src`, `alt`) |
| `<button>` | `button` | Кнопка |
| `<input>` | `input` | Поле ввода (сохраняет `type`, `placeholder`, `value`, `name`) |
| `<video>` | `video` | Видео |

### Все остальные теги

Любой нераспознанный тег становится `container`.

### Теги, которые пропускаются (не импортируются)

- `<script>` — скрипты отфильтровываются
- `<style>` — CSS извлекается, сам тег удаляется
- `<meta>`, `<link>`, `<head>`, `<title>`, `<noscript>` — служебные теги

---

## 4. Стилизация

Парсер поддерживает два способа задания стилей:

### 4.1. Inline-стили (атрибут `style`)

```html
<div style="display: flex; gap: 24px; padding: 40px;">
  <h2 style="font-size: 32px; font-weight: 700; color: #333;">Заголовок</h2>
</div>
```

Стили конвертируются из kebab-case в camelCase:
- `font-size: 32px` → `{ fontSize: "32px" }`
- `background-color: #fff` → `{ backgroundColor: "#fff" }`

### 4.2. CSS-классы (через `<style>`)

```html
<style>
  .card { background-color: #fff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
  .card-title { font-size: 24px; font-weight: 600; color: #222; }
</style>

<div class="card">
  <h3 class="card-title">Карточка</h3>
</div>
```

**Важные ограничения CSS-парсинга:**

- ✅ Поддерживаются **только простые селекторы классов**: `.className { ... }`
- ❌ **НЕ** поддерживаются составные селекторы: `.parent .child`, `.card:hover`, `.a.b`
- ❌ **НЕ** поддерживаются медиа-запросы в HTML: `@media (...) { ... }`
- ❌ **НЕ** поддерживаются псевдоклассы: `:hover`, `:focus`, `:nth-child()`
- ❌ **НЕ** поддерживаются псевдоэлементы: `::before`, `::after`
- ❌ **НЕ** поддерживаются селекторы тегов: `h1 { ... }`, `p { ... }`
- ❌ **НЕ** поддерживаются селекторы атрибутов: `[type="text"]`

### Приоритет стилей

Если у элемента есть и классы, и inline-стили:

1. Сначала собираются стили из всех классов элемента
2. Затем inline-стили **переопределяют** классовые

```html
<style>
  .box { padding: 20px; color: red; }
</style>

<!-- Результат: padding=20px, color=blue (inline перекрывает класс) -->
<div class="box" style="color: blue;"></div>
```

### Полный список поддерживаемых CSS-свойств

Все свойства хранятся в camelCase и автоматически конвертируются:

**Позиционирование:**
`position`, `top`, `right`, `bottom`, `left`

**Размеры:**
`width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`

**Display:**
`display`

**Flexbox:**
`flexDirection`, `justifyContent`, `alignItems`, `gap`, `flex`, `flexWrap`

**Grid:**
`gridTemplateColumns`, `gridTemplateRows`, `gridColumn`, `gridRow`, `gridGap`

**Отступы:**
`margin`, `marginTop`, `marginRight`, `marginBottom`, `marginLeft`,
`padding`, `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`

**Цвета и фон:**
`backgroundColor`, `color`, `backgroundImage`, `backgroundSize`, `backgroundPosition`, `backgroundRepeat`

**Типографика:**
`fontSize`, `fontWeight`, `lineHeight`, `textAlign`, `fontFamily`, `letterSpacing`

**Границы:**
`border`, `borderRadius`, `borderTop`, `borderRight`, `borderBottom`, `borderLeft`

**Эффекты:**
`opacity`, `boxShadow`, `transform`, `transition`, `filter`, `backdropFilter`

**Анимация (свойства):**
`animation`, `animationName`, `animationDuration`, `animationTimingFunction`,
`animationDelay`, `animationIterationCount`, `animationDirection`, `animationFillMode`, `animationPlayState`

**Прочее:**
`zIndex`, `overflow`, `overflowX`, `overflowY`, `cursor`, `pointerEvents`, `userSelect`

Также поддерживаются **любые произвольные CSS-свойства** — они сохраняются как есть.

---

## 5. Поддерживаемые атрибуты

Парсер извлекает и сохраняет следующие HTML-атрибуты:

| Атрибут | Теги | Описание |
|---------|------|----------|
| `src` | `<img>`, `<video>` | URL изображения/видео |
| `href` | `<a>` | URL ссылки |
| `alt` | `<img>` | Альтернативный текст |
| `placeholder` | `<input>` | Плейсхолдер |
| `type` | `<input>`, `<button>` | Тип элемента |
| `value` | `<input>` | Значение поля |
| `name` | `<input>` | Имя поля формы |

**Остальные атрибуты не импортируются** из HTML. Если нужны дополнительные атрибуты — используйте JSON-импорт.

---

## 6. Текстовое содержимое

### Текстовые элементы (`text`, `button`)

Для элементов типа `text` и `button` извлекается **только непосредственный текст** (прямые текстовые ноды), без текста вложенных элементов:

```html
<!-- content = "Привет мир" -->
<p>Привет мир</p>

<!-- content = "Нажми" (текст span отдельно) -->
<button>Нажми <span>сюда</span></button>
```

### Текстовые ноды внутри контейнеров

Если внутри `<div>` (контейнера) есть «голый» текст, он автоматически оборачивается в виртуальный `<span>` с типом `text`:

```html
<div>
  Этот текст станет отдельным span-элементом
  <p>А это параграф</p>
</div>
```

Результат: div-контейнер с двумя детьми:
1. `span` (text) — «Этот текст станет отдельным span-элементом»
2. `p` (text) — «А это параграф»

---

## 7. Layout-режимы (flex/grid)

Парсер автоматически распознаёт layout-режим из CSS-свойства `display`:

```html
<!-- layoutMode: "flex" -->
<div style="display: flex; gap: 20px; align-items: center;">
  ...
</div>

<!-- layoutMode: "grid" -->
<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
  ...
</div>
```

Если `display` не flex и не grid — `layoutMode` не устанавливается (остаётся `undefined`).

---

## 8. Полный пример HTML-страницы для импорта

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Golden House — Главная</title>
  <style>
    .page-root {
      font-family: 'Muller', Arial, sans-serif;
      color: #403E3D;
      margin: 0;
      padding: 0;
    }

    /* === HEADER === */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 40px;
      height: 80px;
      background-color: #403E3D;
      position: sticky;
      top: 0;
      z-index: 1000;
    }
    .header-logo {
      color: #D29F66;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 2px;
      text-decoration: none;
    }
    .header-nav {
      display: flex;
      gap: 32px;
    }
    .nav-link {
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
      text-decoration: none;
    }
    .header-phone {
      color: #D29F66;
      font-size: 14px;
      text-decoration: none;
    }

    /* === HERO === */
    .hero {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background-image: url('/images/hero-bg.jpg');
      background-size: cover;
      background-position: center;
      position: relative;
    }
    .hero-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.4);
    }
    .hero-content {
      position: relative;
      z-index: 1;
      text-align: center;
      color: #fff;
      padding: 0 20px;
    }
    .hero-title {
      font-size: 56px;
      font-weight: 700;
      letter-spacing: 4px;
      margin-bottom: 16px;
    }
    .hero-subtitle {
      font-size: 18px;
      opacity: 0.9;
      margin-bottom: 32px;
    }
    .hero-cta {
      display: inline-block;
      padding: 16px 48px;
      background-color: #D29F66;
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 2px;
      text-decoration: none;
      border-radius: 4px;
    }

    /* === FEATURES === */
    .features {
      display: flex;
      justify-content: center;
      gap: 40px;
      padding: 80px 40px;
      background-color: #f5f5f5;
    }
    .feature-card {
      text-align: center;
      max-width: 300px;
    }
    .feature-icon {
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
    }
    .feature-title {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .feature-text {
      font-size: 14px;
      color: #666;
      line-height: 1.6;
    }

    /* === FOOTER === */
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 40px;
      background-color: #403E3D;
      color: rgba(255, 255, 255, 0.7);
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div data-cms-root class="page-root">

    <!-- Header -->
    <header class="header">
      <a href="/" class="header-logo">GOLDEN HOUSE</a>
      <nav class="header-nav">
        <a href="/apartments" class="nav-link">Квартиры</a>
        <a href="/commercial" class="nav-link">Коммерция</a>
        <a href="/mortgage" class="nav-link">Ипотека</a>
        <a href="/about" class="nav-link">О компании</a>
        <a href="/contacts" class="nav-link">Контакты</a>
      </nav>
      <a href="tel:+78001234567" class="header-phone">8 800 123-45-67</a>
    </header>

    <!-- Hero Section -->
    <section class="hero">
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <h1 class="hero-title">GOLDEN HOUSE</h1>
        <p class="hero-subtitle">Жилой комплекс премиум-класса в центре города</p>
        <a href="/apartments" class="hero-cta">Выбрать квартиру</a>
      </div>
    </section>

    <!-- Features Section -->
    <section class="features">
      <div class="feature-card">
        <img src="/images/icon-location.svg" alt="Расположение" class="feature-icon">
        <h3 class="feature-title">Расположение</h3>
        <p class="feature-text">В самом сердце города, рядом с парком и набережной</p>
      </div>
      <div class="feature-card">
        <img src="/images/icon-quality.svg" alt="Качество" class="feature-icon">
        <h3 class="feature-title">Качество</h3>
        <p class="feature-text">Премиальные материалы отделки и европейские стандарты</p>
      </div>
      <div class="feature-card">
        <img src="/images/icon-comfort.svg" alt="Комфорт" class="feature-icon">
        <h3 class="feature-title">Комфорт</h3>
        <p class="feature-text">Подземный паркинг, консьерж-сервис и закрытая территория</p>
      </div>
    </section>

    <!-- Footer -->
    <footer class="footer">
      <span>© 2024 Golden House. Все права защищены.</span>
      <a href="tel:+78001234567" class="header-phone">8 800 123-45-67</a>
    </footer>

  </div>
</body>
</html>
```

### Что произойдёт при импорте

Этот HTML будет конвертирован в дерево из ~25 `BlockNode`:

```
div (container, data-cms-root) — корень страницы
├── header (container, flex)
│   ├── a (text) — "GOLDEN HOUSE"
│   ├── nav (container, flex)
│   │   ├── a (text) — "Квартиры"
│   │   ├── a (text) — "Коммерция"
│   │   ├── a (text) — "Ипотека"
│   │   ├── a (text) — "О компании"
│   │   └── a (text) — "Контакты"
│   └── a (text) — "8 800 123-45-67"
├── section (container, flex) — hero
│   ├── div (container) — overlay
│   └── div (container) — hero-content
│       ├── h1 (text) — "GOLDEN HOUSE"
│       ├── p (text) — "Жилой комплекс..."
│       └── a (text) — "Выбрать квартиру"
├── section (container, flex) — features
│   ├── div (container) — card 1
│   │   ├── img (image)
│   │   ├── h3 (text)
│   │   └── p (text)
│   ├── div (container) — card 2
│   │   └── ...
│   └── div (container) — card 3
│       └── ...
└── footer (container, flex)
    ├── span (text) — "© 2024..."
    └── a (text) — "8 800..."
```

---

## 9. Импорт через JSON (BlockNode)

JSON-импорт даёт полный контроль над всеми возможностями системы. Формат — объект `BlockNode`.

### Структура BlockNode

```jsonc
{
  "id": "unique-id-1",
  "elementType": "container",      // container | text | image | button | input | video | html-code
  "tagName": "div",                // HTML-тег
  "tag": "div",                    // Дублирует tagName (для совместимости)
  
  "styles": {
    "properties": {                // CSS-свойства в camelCase
      "display": "flex",
      "alignItems": "center",
      "padding": "40px",
      "backgroundColor": "#fff"
    },
    "customCSS": "",               // Произвольный CSS (опционально)
    "states": {                    // Стили для состояний (опционально)
      "hover": {
        "backgroundColor": "#f0f0f0",
        "transform": "translateY(-2px)"
      },
      "active": { "opacity": "0.8" },
      "focus": { "outline": "2px solid #D29F66" },
      "disabled": { "opacity": "0.5" }
    },
    "stateTransition": {           // Анимация перехода между состояниями
      "duration": 200,             // ms
      "easing": "ease",
      "properties": ["all"]        // Какие свойства анимировать
    }
  },

  "layoutMode": "flex",            // flex | grid | absolute | table | undefined
  
  "children": [                    // Дочерние элементы (массив BlockNode)
    { /* вложенный BlockNode */ }
  ],
  
  "attributes": {                  // HTML-атрибуты
    "href": "/about",
    "src": "/images/photo.jpg",
    "alt": "Описание",
    "placeholder": "Введите email",
    "type": "email",
    "name": "email"
  },
  
  "content": "Текст элемента",     // Текстовое содержимое (для text/button)
  
  "metadata": {
    "name": "Hero Section",        // Имя в дереве редактора
    "locked": false,               // Заблокирован для редактирования
    "hidden": false,               // Скрыт в редакторе
    "linkedBlockId": "uuid",       // Связь с библиотечным блоком
    "customHeadHtml": "",          // HTML для <head> (только корень)
    "customBodyEndHtml": "",       // HTML перед </body> (только корень)
    "breakpoints": [               // Брейкпоинты (только корень)
      { "id": "tablet", "name": "Tablet", "width": 768 },
      { "id": "mobile", "name": "Mobile", "width": 480 }
    ]
  },
  
  "animations": [/* ... */],       // Массив анимаций (см. раздел 10)
  "scripts": [/* ... */],          // Массив скриптов (см. раздел 10)
  "variations": {/* ... */}        // Responsive-вариации (см. раздел 11)
}
```

### Пример JSON-импорта: карточка

```json
{
  "id": "card-root",
  "elementType": "container",
  "tagName": "div",
  "tag": "div",
  "layoutMode": "flex",
  "styles": {
    "properties": {
      "display": "flex",
      "flexDirection": "column",
      "gap": "16px",
      "padding": "24px",
      "backgroundColor": "#ffffff",
      "borderRadius": "12px",
      "boxShadow": "0 4px 20px rgba(0,0,0,0.08)",
      "maxWidth": "400px"
    },
    "states": {
      "hover": {
        "boxShadow": "0 8px 40px rgba(0,0,0,0.15)",
        "transform": "translateY(-4px)"
      }
    },
    "stateTransition": {
      "duration": 300,
      "easing": "ease-out",
      "properties": ["box-shadow", "transform"]
    }
  },
  "children": [
    {
      "id": "card-image",
      "elementType": "image",
      "tagName": "img",
      "tag": "img",
      "styles": {
        "properties": {
          "width": "100%",
          "height": "240px",
          "objectFit": "cover",
          "borderRadius": "8px"
        }
      },
      "children": [],
      "attributes": {
        "src": "/images/apartment.jpg",
        "alt": "Квартира 72м²"
      },
      "metadata": { "name": "Photo" }
    },
    {
      "id": "card-title",
      "elementType": "text",
      "tagName": "h3",
      "tag": "h3",
      "styles": {
        "properties": {
          "fontSize": "22px",
          "fontWeight": "600",
          "color": "#222"
        }
      },
      "children": [],
      "attributes": {},
      "content": "2-комнатная, 72 м²",
      "metadata": { "name": "Title" }
    },
    {
      "id": "card-price",
      "elementType": "text",
      "tagName": "p",
      "tag": "p",
      "styles": {
        "properties": {
          "fontSize": "28px",
          "fontWeight": "700",
          "color": "#D29F66"
        }
      },
      "children": [],
      "attributes": {},
      "content": "от 12 500 000 ₽",
      "metadata": { "name": "Price" }
    },
    {
      "id": "card-button",
      "elementType": "button",
      "tagName": "button",
      "tag": "button",
      "styles": {
        "properties": {
          "padding": "12px 32px",
          "backgroundColor": "#D29F66",
          "color": "#fff",
          "fontSize": "14px",
          "fontWeight": "600",
          "border": "none",
          "borderRadius": "6px",
          "cursor": "pointer",
          "textTransform": "uppercase",
          "letterSpacing": "1px"
        },
        "states": {
          "hover": { "backgroundColor": "#B8864D" }
        },
        "stateTransition": {
          "duration": 200,
          "easing": "ease",
          "properties": ["background-color"]
        }
      },
      "children": [],
      "attributes": {},
      "content": "Подробнее",
      "metadata": { "name": "CTA Button" }
    }
  ],
  "attributes": {},
  "metadata": { "name": "Apartment Card" }
}
```

---

## 10. Анимации, ховеры, скрипты (только JSON)

> **Важно:** Анимации, hover-состояния и скрипты **нельзя** задать через HTML-импорт. Используйте JSON-формат.

### 10.1. Hover-состояния (styles.states)

```json
{
  "styles": {
    "properties": {
      "backgroundColor": "#fff",
      "transform": "scale(1)"
    },
    "states": {
      "hover": {
        "backgroundColor": "#f5f5f5",
        "transform": "scale(1.02)",
        "boxShadow": "0 4px 20px rgba(0,0,0,0.1)"
      },
      "active": {
        "transform": "scale(0.98)"
      },
      "focus": {
        "outline": "2px solid #D29F66",
        "outlineOffset": "2px"
      }
    },
    "stateTransition": {
      "duration": 200,
      "easing": "ease-out",
      "properties": ["all"]
    }
  }
}
```

В генерируемом HTML это превращается в:
```css
[data-element-id="node-id"]:hover { background-color: #f5f5f5 !important; ... }
[data-element-id="node-id"] { transition: all 200ms ease-out; }
```

### 10.2. Анимации (animations)

```json
{
  "animations": [
    {
      "id": "fade-in-1",
      "name": "Появление",
      "trigger": "load",
      "preset": "fade-in",
      "duration": 800,
      "delay": 0,
      "easing": "ease-out",
      "iterationCount": 1,
      "direction": "normal",
      "fillMode": "both"
    },
    {
      "id": "scroll-slide",
      "name": "Слайд при скролле",
      "trigger": "scroll-into-view",
      "preset": "slide-up",
      "duration": 600,
      "delay": 200,
      "easing": "ease-out",
      "iterationCount": 1,
      "direction": "normal",
      "fillMode": "both",
      "scrollTrigger": {
        "threshold": 0.2,
        "once": true,
        "offset": 0
      }
    }
  ]
}
```

**Доступные пресеты анимаций:**

| Пресет | Описание |
|--------|----------|
| `fade-in` | Плавное появление |
| `fade-out` | Плавное исчезновение |
| `slide-up` | Слайд снизу вверх |
| `slide-down` | Слайд сверху вниз |
| `slide-left` | Слайд справа налево |
| `slide-right` | Слайд слева направо |
| `zoom-in` | Увеличение |
| `zoom-out` | Уменьшение |
| `bounce` | Подпрыгивание |
| `shake` | Тряска |
| `pulse` | Пульсация |
| `spin` | Вращение |
| `flip-x` | Переворот по X |
| `flip-y` | Переворот по Y |
| `custom` | Произвольные keyframes |

**Триггеры анимаций:**

| Триггер | Описание |
|---------|----------|
| `load` | При загрузке страницы |
| `scroll-into-view` | Когда элемент появляется в viewport (IntersectionObserver) |
| `hover` | При наведении мыши |
| `click` | При клике |
| `loop` | Бесконечный цикл |

**Пользовательские keyframes (preset: "custom"):**

```json
{
  "preset": "custom",
  "keyframes": [
    { "offset": 0, "properties": { "opacity": "0", "transform": "rotateY(90deg)" } },
    { "offset": 50, "properties": { "opacity": "0.5", "transform": "rotateY(45deg)" } },
    { "offset": 100, "properties": { "opacity": "1", "transform": "rotateY(0deg)" } }
  ]
}
```

### 10.3. Скрипты элемента (scripts)

Скрипты привязываются к конкретному элементу и выполняются в его контексте:

```json
{
  "scripts": [
    {
      "id": "counter-script",
      "name": "Анимация счётчика",
      "trigger": "scroll",
      "enabled": true,
      "code": "var target = parseInt(element.textContent); var current = 0; var step = Math.ceil(target / 60); var interval = setInterval(function() { current += step; if (current >= target) { current = target; clearInterval(interval); } element.textContent = current.toLocaleString('ru-RU'); }, 16);"
    }
  ]
}
```

**Триггеры скриптов:**

| Триггер | Описание | Реализация |
|---------|----------|------------|
| `load` | При загрузке | Выполняется в IIFE |
| `click` | При клике | `addEventListener('click', ...)` |
| `hover` | При наведении | `addEventListener('mouseenter', ...)` |
| `scroll` | При скролле в viewport | `IntersectionObserver` |
| `custom` | Произвольный | Выполняется в IIFE |

Внутри скрипта доступна переменная `element` — DOM-элемент, к которому привязан скрипт (выбирается по `[data-element-id="..."]`).

### 10.4. Скрипты страницы (PageScript)

Скрипты уровня страницы задаются не в BlockNode, а в настройках страницы:

```json
{
  "scripts": [
    {
      "id": "analytics",
      "name": "Google Analytics",
      "code": "window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'G-XXXXXXX');",
      "position": "head",
      "enabled": true,
      "loadType": "async"
    },
    {
      "id": "scroll-to-top",
      "name": "Scroll to Top",
      "code": "document.querySelector('.scroll-top').addEventListener('click', function() { window.scrollTo({top: 0, behavior: 'smooth'}); });",
      "position": "body-end",
      "enabled": true,
      "loadType": "sync"
    }
  ]
}
```

---

## 11. Responsive дизайн (только JSON)

> Responsive breakpoints работают только через JSON — их нельзя задать в HTML.

### 11.1. Определение брейкпоинтов (в корневом узле)

```json
{
  "id": "root",
  "elementType": "container",
  "tagName": "div",
  "metadata": {
    "name": "Page Root",
    "breakpoints": [
      { "id": "tablet", "name": "Tablet", "width": 768 },
      { "id": "mobile", "name": "Mobile", "width": 480 }
    ]
  }
}
```

### 11.2. Вариации (variations)

Вариации определяются в корневом узле и позволяют переопределять стили, контент и видимость **любого** элемента дерева по его ID:

```json
{
  "id": "root",
  "variations": {
    "tablet": {
      "inheritedOverrides": {
        "hero-title": {
          "styles": { "fontSize": "36px" }
        },
        "nav-desktop": {
          "hidden": true
        },
        "burger-button": {
          "hidden": false
        },
        "features-grid": {
          "styles": { "gridTemplateColumns": "1fr 1fr" }
        }
      }
    },
    "mobile": {
      "inheritedOverrides": {
        "hero-title": {
          "styles": { "fontSize": "28px", "letterSpacing": "1px" }
        },
        "nav-desktop": {
          "hidden": true
        },
        "burger-button": {
          "hidden": false
        },
        "features-grid": {
          "styles": { "gridTemplateColumns": "1fr" }
        },
        "sidebar": {
          "hidden": true
        }
      }
    }
  }
}
```

**Что можно переопределить в `inheritedOverrides[nodeId]`:**

| Поле | Тип | Описание |
|------|-----|----------|
| `hidden` | `boolean` | Скрыть элемент (`display: none !important`) |
| `styles` | `Partial<CSSProperties>` | Перезаписать CSS-свойства |
| `attributes` | `Record<string, string>` | Перезаписать HTML-атрибуты |
| `content` | `string` | Заменить текст |

### 11.3. Специфичные дочерние элементы (specificChildren)

Для каждого брейкпоинта можно задать полностью альтернативное дерево потомков:

```json
{
  "variations": {
    "mobile": {
      "specificChildren": [
        {
          "id": "mobile-only-cta",
          "elementType": "button",
          "tagName": "button",
          "styles": { "properties": { "width": "100%", "padding": "16px" } },
          "children": [],
          "attributes": {},
          "content": "Позвонить",
          "metadata": { "name": "Mobile CTA" }
        }
      ]
    }
  }
}
```

### Как генерируется responsive CSS

Система на основе `metadata.breakpoints` и `variations` генерирует медиа-запросы:

```css
@media (max-width: 768px) {
  [data-element-id="hero-title"] { font-size: 36px !important; }
  [data-element-id="nav-desktop"] { display: none !important; }
}

@media (max-width: 480px) {
  [data-element-id="hero-title"] { font-size: 28px !important; letter-spacing: 1px !important; }
  [data-element-id="features-grid"] { grid-template-columns: 1fr !important; }
}
```

---

## 12. Data Binding атрибуты

Data binding позволяет привязывать элементы к источникам данных. Эти атрибуты используются в генерируемом HTML:

| Атрибут | Назначение | Пример |
|---------|-----------|--------|
| `data-element-id` | Уникальный ID элемента для всех динамических фич | `data-element-id="abc-123"` |
| `data-element-name` | Человекочитаемое имя для автоматического маппинга | `data-element-name="Product Image"` |
| `data-bind` | Привязка к полю данных (для INPUT-биндингов) | `data-bind="email"` |
| `data-repeater-item` | Маркер клонированного элемента | `data-repeater-item="0"` |

### Пример формы с data binding

```html
<form data-element-id="contact-form" data-element-name="Contact Form">
  <input name="name" data-element-id="input-name" data-bind="name" />
  <input name="email" data-element-id="input-email" data-bind="email" />
  <textarea name="message" data-element-id="input-message"></textarea>
  <button type="submit">Отправить</button>
</form>
```

### Пример repeater-контейнера

```html
<div data-element-id="results-container" data-element-name="Results">
  <!-- Шаблон (скрывается автоматически) -->
  <div data-element-id="item-template" style="display: none;">
    <h3 data-bind="title"></h3>
    <p data-element-name="Description"></p>
    <img data-bind="image" />
  </div>
  <!-- Клоны добавляются сюда автоматически -->
</div>
```

> Data binding настраивается через интерфейс CMS после импорта страницы. При написании HTML для импорта достаточно проставить `data-element-id` и `data-element-name` на элементы, которые планируется привязать к данным.

---

## 13. Навигация сайта

Навигация сайта генерируется автоматически из настроек сайта при деплое. Для интеграции навигации в страницу используется атрибут `data-site-nav`:

```html
<nav data-site-nav>
  <!-- Навигация подставляется системой при генерации -->
</nav>
```

При деплое система:
1. Берёт `NavigationItem[]` из настроек сайта
2. Резолвит `pageId` → URL страницы
3. Генерирует HTML-меню с вложенными пунктами

Навигацию не нужно жёстко прописывать в HTML — она управляется через настройки сайта в CMS.

---

## 14. Импорт через API (программный)

Для массового импорта страниц можно использовать REST API.

### Создание страницы

```
POST /api/pages
Content-Type: application/json
```

```json
{
  "name": "Квартиры",
  "slug": "apartments",
  "status": "draft",
  "metadata": {
    "title": "Квартиры — Golden House",
    "description": "Каталог квартир жилого комплекса Golden House",
    "keywords": ["квартиры", "golden house", "жк"],
    "ogImage": "/images/og-apartments.jpg"
  },
  "structure": {
    "id": "page-root",
    "elementType": "container",
    "tagName": "div",
    "tag": "div",
    "styles": { "properties": { "fontFamily": "'Muller', sans-serif" } },
    "layoutMode": "flex",
    "children": [
      { "..." : "BlockNode дерево" }
    ],
    "attributes": {},
    "metadata": {
      "name": "Page Root",
      "breakpoints": [
        { "id": "tablet", "name": "Tablet", "width": 768 },
        { "id": "mobile", "name": "Mobile", "width": 480 }
      ]
    }
  }
}
```

### Валидация (Zod-схема)

| Поле | Тип | Обязательное | Правила |
|------|-----|-------------|---------|
| `name` | string | ✅ | 1–255 символов |
| `slug` | string | ✅ | Только `a-z`, `0-9`, `-` (regex: `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`) |
| `status` | enum | ❌ | `draft` \| `published` \| `archived` |
| `groupId` | uuid | ❌ | UUID группы |
| `metadata.title` | string | ❌ | SEO title |
| `metadata.description` | string | ❌ | SEO description |
| `metadata.keywords` | string[] | ❌ | Ключевые слова |
| `metadata.ogImage` | string | ❌ | URL изображения для Open Graph |
| `structure` | BlockNode | ❌ | Дерево структуры страницы |

### Привязка к сайту

```
POST /api/pages
```
```json
{
  "name": "About",
  "slug": "about",
  "siteId": "uuid-сайта",
  "structure": { "..." }
}
```

### Скрипт массового импорта (пример)

```javascript
const API_URL = 'http://localhost:5000/api'

const createNode = (overrides) => ({
  id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  elementType: 'container',
  tagName: 'div',
  tag: 'div',
  styles: { properties: {} },
  layoutMode: undefined,
  children: [],
  metadata: { name: 'Element' },
  content: '',
  attributes: {},
  ...overrides,
})

async function createPage(pageData) {
  const response = await fetch(`${API_URL}/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pageData),
  })
  if (!response.ok) {
    const err = await response.json()
    throw new Error(`Failed to create page: ${JSON.stringify(err)}`)
  }
  return response.json()
}

// Пример
async function main() {
  const page = await createPage({
    name: 'О компании',
    slug: 'about',
    status: 'draft',
    metadata: {
      title: 'О компании — Golden House',
      description: 'История и миссия Golden House',
    },
    structure: createNode({
      metadata: { name: 'About Page' },
      children: [
        createNode({
          elementType: 'text',
          tagName: 'h1',
          content: 'О компании',
          styles: { properties: { fontSize: '48px', fontWeight: '700' } },
          metadata: { name: 'Title' },
        }),
        createNode({
          elementType: 'text',
          tagName: 'p',
          content: 'Golden House — это премиальный жилой комплекс...',
          styles: { properties: { fontSize: '16px', lineHeight: '1.8', maxWidth: '800px' } },
          metadata: { name: 'Description' },
        }),
      ],
    }),
  })
  console.log('Created page:', page.id)
}

main()
```

---

## 15. Ограничения HTML-импорта

### Что импортируется

| Функция | HTML-импорт | JSON-импорт |
|---------|:-----------:|:-----------:|
| Структура (теги, вложенность) | ✅ | ✅ |
| Inline-стили | ✅ | ✅ |
| CSS-классы (простые) | ✅ | ✅ |
| Атрибуты (src, href, alt, placeholder, type, value, name) | ✅ | ✅ |
| Текстовое содержимое | ✅ | ✅ |
| Layout mode (flex/grid) | ✅ | ✅ |
| Hover-состояния | ❌ | ✅ |
| Анимации | ❌ | ✅ |
| Скрипты элемента | ❌ | ✅ |
| Responsive брейкпоинты | ❌ | ✅ |
| Вариации (responsive) | ❌ | ✅ |
| Data binding | ❌ | ✅ |
| Имена элементов (metadata.name) | ❌ | ✅ |
| Кастомный HTML для head/body | ❌ | ✅ |
| Linked blocks | ❌ | ✅ |

### Теги, которые фильтруются

`<script>`, `<style>` (CSS извлекается), `<meta>`, `<link>`, `<head>`, `<title>`, `<noscript>`

### Ограничения CSS-парсера

- Поддерживаются только `.className { ... }` — без пробелов, двоеточий, комбинаторов
- Медиа-запросы в `<style>` не обрабатываются
- Псевдоклассы и псевдоэлементы не поддерживаются
- Каскадность CSS не учитывается — последний найденный стиль побеждает

---

## 16. Чеклист перед импортом

### HTML-импорт

- [ ] Есть `data-cms-root` на корневом элементе
- [ ] Все стили заданы через `<style>` с простыми `.class` селекторами или через inline `style=""`
- [ ] Используются поддерживаемые HTML-теги (см. раздел 3)
- [ ] Изображения имеют `src` и `alt`
- [ ] Ссылки имеют `href`
- [ ] Нет `<script>` тегов (они будут отфильтрованы)
- [ ] Нет составных CSS-селекторов (`.parent .child`, `:hover`, `@media`)
- [ ] Контейнеры с flex/grid имеют `display: flex` / `display: grid` в стилях
- [ ] Текст внутри контейнеров обёрнут в `<p>`, `<span>`, `<h1>`-`<h6>` (голый текст оборачивается автоматически, но лучше явно)

### JSON-импорт

- [ ] Каждый узел имеет уникальный `id`
- [ ] `elementType` соответствует одному из: `container`, `text`, `image`, `button`, `input`, `video`, `html-code`
- [ ] `tagName` — валидный HTML-тег
- [ ] `styles.properties` — CSS в camelCase
- [ ] `children` — массив (даже если пустой)
- [ ] `attributes` — объект (даже если пустой)
- [ ] `metadata` — объект (даже если пустой)
- [ ] Для responsive: `metadata.breakpoints` определены в корневом узле
- [ ] Для responsive: `variations` ссылаются на существующие `id` элементов дерева
- [ ] Анимации имеют валидный `trigger` и `preset` или `keyframes`
- [ ] Скрипты имеют `trigger` из допустимого набора

### API-импорт

- [ ] `slug` — только `a-z`, `0-9`, `-` (без заглавных букв)
- [ ] `name` — от 1 до 255 символов
- [ ] `structure` — валидное дерево BlockNode
- [ ] Сервер запущен и доступен по `http://localhost:5000`
