# План создания корпоративного сайта с использованием визуального конструктора

## 1. Введение

Данный документ описывает полный план внедрения визуального конструктора для создания и управления корпоративным веб-сайтом компании.

---

## 2. Структура корпоративного сайта

### 2.1 Типовые страницы

1. **Главная страница** (Landing)
   - Hero секция с основным призывом к действию
   - О компании (краткое описание)
   - Услуги/Продукты (карточки)
   - Преимущества
   - Отзывы клиентов
   - Контакты и форма связи

2. **О компании**
   - История компании
   - Миссия и ценности
   - Команда
   - Достижения и награды
   - Сертификаты

3. **Услуги/Продукты**
   - Каталог услуг
   - Детальные страницы для каждой услуги
   - Цены
   - Кейсы и примеры работ

4. **Портфолио/Кейсы**
   - Список проектов
   - Детальная информация о проектах
   - Результаты

5. **Блог/Новости**
   - Список статей
   - Детальные страницы статей
   - Категории

6. **Контакты**
   - Контактная информация
   - Форма обратной связи
   - Карта
   - Офисы

7. **Дополнительные страницы**
   - Политика конфиденциальности
   - Пользовательское соглашение
   - FAQ
   - Карьера/Вакансии

---

## 3. Библиотека переиспользуемых блоков

### 3.1 Категория: Header & Navigation

#### Header - Вариант 1 (Классический)
```
Группа: Навигация
Описание: Логотип слева, меню по центру, кнопка справа
Layout: Flexbox (justify-content: space-between)

Структура:
- Container (flex)
  - Logo (image + link)
  - Navigation Menu (flex)
    - Menu Item (link) x N
  - CTA Button (button)
```

#### Header - Вариант 2 (С поиском)
```
Группа: Навигация
Описание: Логотип, меню, поиск, иконки
Layout: Flexbox

Структура:
- Container (flex)
  - Logo
  - Nav Menu
  - Search Input
  - Icons Container
    - Phone Icon + Number
    - Language Selector
```

#### Mobile Menu (Burger)
```
Группа: Навигация
Описание: Бургер меню для мобильных устройств
Layout: Absolute

Структура:
- Burger Button
- Overlay (absolute)
- Mobile Nav Container (flex column)
  - Menu Items
  - Contact Info
```

---

### 3.2 Категория: Hero Sections

#### Hero - Вариант 1 (Полноэкранный)
```
Группа: Hero Секции
Описание: Полноэкранная секция с фоном и текстом
Layout: Flexbox (column, center)

Структура:
- Container (flex, height: 100vh)
  - Background Image/Video (absolute)
  - Content Container (flex column, center)
    - Heading (h1)
    - Subheading (p)
    - CTA Buttons Group (flex)
      - Primary Button
      - Secondary Button
```

#### Hero - Вариант 2 (С изображением сбоку)
```
Группа: Hero Секции
Описание: Текст слева, изображение справа
Layout: Grid (2 columns)

Структура:
- Container (grid, 1fr 1fr)
  - Text Column
    - Tag/Label
    - Heading
    - Description
    - Features List
    - CTA Button
  - Image Column
    - Image/Illustration
```

#### Hero - Вариант 3 (С формой)
```
Группа: Hero Секции
Описание: Призыв к действию с формой заявки
Layout: Flexbox

Структура:
- Container (flex)
  - Content (60%)
    - Heading
    - Benefits List
  - Form Card (40%)
    - Form Heading
    - Input Fields
    - Submit Button
```

---

### 3.3 Категория: Content Blocks

#### Feature Cards Grid
```
Группа: Контентные блоки
Описание: Сетка карточек с иконками
Layout: Grid (3 columns)

Структура:
- Container
  - Section Heading
  - Cards Grid (grid, 3 columns)
    - Feature Card x 6
      - Icon
      - Title
      - Description
```

#### Two Column Text + Image
```
Группа: Контентные блоки
Описание: Текст с изображением (чередующиеся)
Layout: Grid (2 columns)

Структура:
- Container (grid, 1fr 1fr, gap: 60px)
  - Text Column
    - Section Tag
    - Heading
    - Paragraphs
    - List Items
    - CTA Link
  - Image Column
    - Image
    - Caption (optional)
```

#### Statistics Block
```
Группа: Контентные блоки
Описание: Блок с цифрами и достижениями
Layout: Grid (4 columns)

Структура:
- Container (background с акцентом)
  - Stats Grid (grid, 4 columns)
    - Stat Item x 4
      - Number (large)
      - Label
      - Icon (optional)
```

#### Testimonials Slider
```
Группа: Контентные блоки
Описание: Слайдер с отзывами клиентов
Layout: Flexbox

Структура:
- Container
  - Section Heading
  - Slider Container
    - Testimonial Card (active)
      - Quote Text
      - Author Info
        - Avatar
        - Name
        - Position
      - Rating Stars
    - Navigation Dots
    - Prev/Next Buttons
```

#### Team Grid
```
Группа: Контентные блоки
Описание: Сетка с членами команды
Layout: Grid (4 columns)

Структура:
- Container
  - Section Heading
  - Team Grid (grid, 4 columns)
    - Team Member Card x N
      - Photo
      - Name
      - Position
      - Social Links
```

#### Pricing Cards
```
Группа: Контентные блоки
Описание: Карточки с тарифами
Layout: Grid (3 columns)

Структура:
- Container
  - Section Heading
  - Pricing Grid (grid, 3 columns)
    - Pricing Card x 3
      - Badge (Popular, Best Value)
      - Plan Name
      - Price
        - Amount
        - Period
      - Features List
      - CTA Button
```

---

### 3.4 Категория: Forms

#### Contact Form - Simple
```
Группа: Формы
Описание: Простая контактная форма
Layout: Flexbox (column)

Структура:
- Form Container
  - Form Heading
  - Input Field (Name)
  - Input Field (Email)
  - Input Field (Phone)
  - Textarea (Message)
  - Checkbox (Privacy Policy)
  - Submit Button
```

#### Newsletter Subscription
```
Группа: Формы
Описание: Форма подписки на рассылку
Layout: Flexbox

Структура:
- Container (flex, centered)
  - Icon/Image
  - Text Content
    - Heading
    - Description
  - Form (flex, horizontal)
    - Email Input
    - Subscribe Button
```

#### Advanced Contact Form
```
Группа: Формы
Описание: Расширенная форма с выбором услуги
Layout: Grid

Структура:
- Form Container (grid, 2 columns)
  - Left Column
    - Name Input
    - Email Input
    - Phone Input
    - Company Input
  - Right Column
    - Service Select
    - Budget Select
    - Message Textarea
  - Full Width Row
    - File Upload
    - Privacy Checkbox
    - Submit Button
```

---

### 3.5 Категория: Footer

#### Footer - Вариант 1 (Классический)
```
Группа: Подвал
Описание: Многоколоночный футер с информацией
Layout: Grid (4 columns)

Структура:
- Footer Container
  - Top Section (grid, 4 columns)
    - Column 1 (О компании)
      - Logo
      - Description
      - Social Links
    - Column 2 (Ссылки)
      - Heading
      - Link List
    - Column 3 (Услуги)
      - Heading
      - Link List
    - Column 4 (Контакты)
      - Heading
      - Contact Info
        - Phone
        - Email
        - Address
  - Bottom Section (flex, space-between)
    - Copyright
    - Legal Links
```

#### Footer - Вариант 2 (Минималистичный)
```
Группа: Подвал
Описание: Компактный футер
Layout: Flexbox

Структура:
- Footer Container (flex, column, centered)
  - Logo
  - Navigation Links (flex, horizontal)
  - Social Links
  - Copyright
```

---

### 3.6 Категория: Call-to-Action

#### CTA Banner - Вариант 1
```
Группа: CTA
Описание: Полноширинный баннер с призывом
Layout: Flexbox (space-between)

Структура:
- Container (flex, background gradient)
  - Text Content
    - Heading
    - Description
  - Button Container
    - Primary Button
    - Secondary Button (optional)
```

#### CTA Card
```
Группа: CTA
Описание: Карточка с призывом к действию
Layout: Flexbox (column, centered)

Структура:
- Card Container (flex column, centered, shadow)
  - Icon/Illustration
  - Heading
  - Description
  - Features List (optional)
  - CTA Button
```

---

### 3.7 Категория: Navigation & Breadcrumbs

#### Breadcrumbs
```
Группа: Навигация
Описание: Хлебные крошки
Layout: Flexbox

Структура:
- Breadcrumbs Container (flex)
  - Home Link
  - Separator
  - Category Link
  - Separator
  - Current Page
```

#### Tabs Navigation
```
Группа: Навигация
Описание: Табы для переключения контента
Layout: Flexbox

Структура:
- Tabs Container
  - Tabs Header (flex)
    - Tab Item x N
      - Icon
      - Label
  - Tab Content Panels
    - Panel 1
    - Panel 2
    - etc.
```

---

## 4. Создание типовых страниц

### 4.1 Главная страница

**Структура:**

```
1. Header Block
   - Использовать: "Header - Вариант 1"

2. Hero Section
   - Использовать: "Hero - Вариант 1"
   - Настройки:
     * Background: фото офиса/продукта
     * Heading: "Решения для вашего бизнеса"
     * Subheading: краткое описание компании
     * Buttons: "Узнать больше" + "Связаться с нами"

3. About Company Brief
   - Использовать: "Two Column Text + Image"
   - Настройки:
     * Текст слева: краткая информация о компании
     * Изображение справа: команда или офис

4. Services/Products Section
   - Использовать: "Feature Cards Grid"
   - Настройки:
     * 6 карточек с основными услугами
     * Иконки для каждой услуги
     * Ссылки на детальные страницы

5. Statistics
   - Использовать: "Statistics Block"
   - Настройки:
     * Годы на рынке
     * Количество клиентов
     * Реализованных проектов
     * Сотрудников

6. Testimonials
   - Использовать: "Testimonials Slider"
   - Настройки:
     * 3-5 отзывов клиентов
     * Фото, имя, компания

7. CTA Section
   - Использовать: "CTA Banner - Вариант 1"
   - Настройки:
     * "Готовы начать сотрудничество?"
     * Кнопка: "Получить консультацию"

8. Footer
   - Использовать: "Footer - Вариант 1"
```

**Пошаговое создание:**

1. Открыть редактор
2. Создать новую страницу: "Главная"
3. Установить slug: "/"
4. Перетащить "Header - Вариант 1" из библиотеки блоков на canvas
5. Настроить свойства header:
   - Логотип: загрузить через медиа библиотеку
   - Пункты меню: Главная, Услуги, О нас, Портфолио, Контакты
   - CTA кнопка: "Заказать звонок"
6. Перетащить "Hero - Вариант 1"
7. Настроить hero секцию:
   - Загрузить фоновое изображение
   - Изменить текст заголовка
   - Настроить кнопки
8. Продолжить добавление остальных блоков...
9. Сохранить страницу
10. Опубликовать

---

### 4.2 Страница "О компании"

**Структура:**

```
1. Header Block
   - Переиспользовать тот же header

2. Page Header
   - Создать новый блок:
     * Breadcrumbs
     * Page Title (h1): "О компании"
     * Page Description

3. Company Story
   - Использовать: "Two Column Text + Image"
   - Настройки:
     * История компании слева
     * Timeline изображение справа

4. Mission & Values
   - Использовать: "Feature Cards Grid" (модифицировать)
   - Настройки:
     * 4 карточки с ценностями
     * Иконки для каждой ценности

5. Team Section
   - Использовать: "Team Grid"
   - Настройки:
     * Фото всей команды
     * Руководители с подробной информацией

6. Achievements
   - Использовать: "Statistics Block" + сертификаты
   - Настройки:
     * Награды
     * Сертификаты (изображения)

7. CTA
   - Использовать: "CTA Card"
   - Настройки:
     * "Хотите работать с нами?"
     * Кнопка: "Посмотреть вакансии"

8. Footer
```

---

### 4.3 Страница услуги

**Структура:**

```
1. Header Block

2. Service Hero
   - Использовать: "Hero - Вариант 2"
   - Настройки:
     * Название услуги
     * Краткое описание
     * Основные преимущества
     * Кнопка: "Заказать услугу"

3. Service Details
   - Использовать: "Two Column Text + Image" x 2
   - Настройки:
     * Чередующиеся секции с деталями
     * Изображения/иллюстрации

4. What's Included
   - Использовать: "Feature Cards Grid"
   - Настройки:
     * Что входит в услугу
     * Этапы работы

5. Pricing
   - Использовать: "Pricing Cards"
   - Настройки:
     * Различные пакеты услуг
     * Цены
     * Что входит

6. Case Studies
   - Создать новый блок: "Case Cards"
   - Настройки:
     * 2-3 релевантных кейса
     * Ссылки на детальные страницы

7. FAQ
   - Создать новый блок: "Accordion"
   - Настройки:
     * Частые вопросы по услуге

8. Contact Form
   - Использовать: "Advanced Contact Form"
   - Настройки:
     * Предзаполнить "Услуга" текущей услугой

9. Footer
```

---

### 4.4 Страница портфолио

**Структура:**

```
1. Header Block

2. Portfolio Header
   - Page Title
   - Filter Tabs (по категориям проектов)

3. Projects Grid
   - Создать новый блок: "Portfolio Grid"
   - Layout: Grid (3 columns)
   - Структура:
     * Project Card x N
       - Project Image (с hover эффектом)
       - Project Info
         - Title
         - Category Tags
         - Brief Description
       - View Case Button

4. Load More Button (опционально)

5. CTA Banner
   - "Обсудить ваш проект?"

6. Footer
```

---

### 4.5 Страница блога

**Структура:**

```
1. Header Block

2. Blog Header
   - Page Title: "Блог"
   - Featured Post (большая карточка)

3. Categories Filter
   - Tabs или кнопки категорий

4. Blog Posts Grid
   - Layout: Grid (2 columns)
   - Структура:
     * Blog Post Card x N
       - Featured Image
       - Category Tag
       - Title
       - Excerpt
       - Author & Date
       - Read More Link

5. Pagination

6. Newsletter Subscription
   - Использовать: "Newsletter Subscription"

7. Footer
```

---

### 4.6 Страница контактов

**Структура:**

```
1. Header Block

2. Contact Hero
   - Page Title: "Контакты"
   - Subtitle: "Свяжитесь с нами удобным способом"

3. Contact Methods Grid
   - Layout: Grid (3 columns)
   - Структура:
     * Contact Card x 3
       - Icon (Phone, Email, Location)
       - Title
       - Info
       - Action Link

4. Two Column: Form + Map
   - Layout: Grid (1fr 1fr)
   - Left: Contact Form - Simple
   - Right: Embedded Map

5. Offices (если есть несколько)
   - Office Cards
     * Address
     * Phone
     * Working Hours
     * Image

6. Footer
```

---

## 5. Процесс внедрения для компании

### Этап 1: Подготовка (1-2 недели)

**Задачи:**
1. ✅ Собрать все материалы:
   - Логотип компании (в разных форматах)
   - Фотографии (офиса, команды, продуктов)
   - Тексты для всех страниц
   - Контактная информация
   - Видео (если есть)

2. ✅ Определить структуру сайта:
   - Список всех страниц
   - Иерархия меню
   - Схема навигации

3. ✅ Подготовить контент:
   - SEO метаданные для всех страниц
   - Заголовки, описания
   - Категории для блога/услуг
   - FAQ

4. ✅ Определить дизайн систему:
   - Цветовая палитра (primary, secondary, accent)
   - Типографика (шрифты)
   - Стиль иконок
   - Паттерны (кнопки, карточки, и т.д.)

---

### Этап 2: Создание библиотеки блоков (2-3 недели)

**Задачи:**
1. ✅ Создать группы блоков:
   - Navigation
   - Hero
   - Content
   - Forms
   - Footer
   - CTA

2. ✅ Создать все базовые блоки (см. раздел 3):
   - Header (2-3 варианта)
   - Hero секции (3-4 варианта)
   - Контентные блоки (10-15 блоков)
   - Формы (3-4 варианта)
   - Footer (2-3 варианта)
   - CTA блоки (3-4 варианта)

3. ✅ Настроить стили для блоков:
   - Применить корпоративные цвета
   - Настроить типографику
   - Адаптивность (desktop, tablet, mobile)

4. ✅ Протестировать блоки:
   - Визуальная проверка
   - Адаптивность
   - Совместимость при комбинировании

---

### Этап 3: Создание страниц (3-4 недели)

**Неделя 1:**
1. ✅ Создать главную страницу
2. ✅ Создать страницу "О компании"
3. ✅ Настроить header и footer (будут общими)

**Неделя 2:**
1. ✅ Создать страницы услуг:
   - Страница-каталог со всеми услугами
   - Детальная страница для каждой услуги (шаблон)
   - Заполнить контентом 3-5 услуг

**Неделя 3:**
1. ✅ Создать портфолио:
   - Страница со всеми проектами
   - Детальная страница проекта (шаблон)
   - Заполнить 5-10 кейсов

2. ✅ Создать блог:
   - Страница списка статей
   - Детальная страница статьи (шаблон)
   - Подготовить 3-5 статей

**Неделя 4:**
1. ✅ Создать страницу контактов
2. ✅ Создать дополнительные страницы:
   - Политика конфиденциальности
   - Пользовательское соглашение
   - FAQ
3. ✅ Создать страницу 404

---

### Этап 4: Настройка и оптимизация (1-2 недели)

**Задачи:**
1. ✅ SEO оптимизация:
   - Заполнить meta теги для всех страниц
   - Настроить заголовки (H1-H6)
   - Оптимизировать изображения
   - Создать sitemap.xml

2. ✅ Производительность:
   - Оптимизация изображений (WebP, lazy loading)
   - Минификация CSS/JS
   - CDN для статики

3. ✅ Адаптивность:
   - Проверить все страницы на разных устройствах
   - Настроить responsive варианты блоков
   - Тестирование на реальных устройствах

4. ✅ Интеграции:
   - Подключить Google Analytics
   - Настроить формы (отправка на email/CRM)
   - Интегрировать чат (если нужен)
   - Подключить социальные сети

---

### Этап 5: Тестирование (1 неделя)

**Задачи:**
1. ✅ Функциональное тестирование:
   - Все ссылки работают
   - Формы отправляются
   - Навигация корректна

2. ✅ Кросс-браузерность:
   - Chrome, Firefox, Safari, Edge
   - Мобильные браузеры

3. ✅ Валидация:
   - HTML валидация
   - CSS валидация
   - Accessibility (WCAG)

4. ✅ Контент:
   - Проверка текстов на ошибки
   - Корректность контактов
   - Актуальность информации

---

### Этап 6: Запуск (1 неделя)

**Задачи:**
1. ✅ Pre-launch checklist:
   - Резервная копия
   - SSL сертификат
   - Настройка DNS
   - Robots.txt и sitemap

2. ✅ Деплой:
   - Выгрузка на production сервер
   - Настройка домена
   - Проверка после деплоя

3. ✅ Мониторинг:
   - Настроить uptime мониторинг
   - Проверить аналитику
   - Тестирование форм в production

4. ✅ Документация:
   - Инструкция по добавлению контента
   - Руководство по редактированию страниц
   - Контакты поддержки

---

## 6. Поддержка и развитие

### 6.1 Регулярные задачи

**Еженедельно:**
- Добавление новых статей в блог
- Обновление новостей
- Проверка форм обратной связи

**Ежемесячно:**
- Добавление новых кейсов в портфолио
- Обновление контента на страницах
- Анализ метрик и оптимизация

**Ежеквартально:**
- Обновление библиотеки блоков
- Создание новых страниц (по необходимости)
- A/B тестирование элементов
- Обновление дизайна (при необходимости)

---

### 6.2 Обучение команды

**Для контент-менеджера:**
1. Как добавлять новые страницы
2. Как редактировать существующие блоки
3. Как работать с медиа библиотекой
4. Как публиковать статьи в блог

**Для маркетолога:**
1. Как изменять CTA элементы
2. Как проводить A/B тесты
3. Как анализировать метрики
4. Как создавать лендинги для кампаний

**Для разработчика:**
1. Как создавать новые типы блоков
2. Как интегрировать внешние сервисы
3. Как оптимизировать производительность
4. Как делать резервные копии

---

## 7. Пример: Создание страницы услуги "Веб-разработка"

### Шаг 1: Подготовка контента

**Собрать:**
- Название: "Веб-разработка"
- Описание: краткое и полное
- Что входит: список услуг
- Процесс работы: этапы
- Цены: пакеты
- Кейсы: 2-3 релевантных проекта
- FAQ: 5-7 вопросов
- Изображения: иллюстрации, скриншоты

---

### Шаг 2: Создание страницы в редакторе

1. **Открыть редактор**
   - Перейти в раздел "Страницы"
   - Нажать "Создать страницу"
   - Выбрать группу: "Услуги"

2. **Настроить базовую информацию**
   ```
   Название: Веб-разработка
   Slug: /services/web-development
   Meta Title: Веб-разработка | Название компании
   Meta Description: Профессиональная разработка веб-сайтов и веб-приложений. Создаем современные, быстрые и удобные решения для вашего бизнеса.
   ```

3. **Добавить Header**
   - Перетащить блок "Header - Вариант 1" из библиотеки
   - Он уже настроен, ничего менять не нужно

4. **Добавить Hero секцию**
   - Перетащить "Hero - Вариант 2"
   - Кликнуть на блок для выбора
   - В панели свойств справа:
     * Background Color: #f8f9fa
     * Padding: 80px 0
   - Выбрать текстовую часть:
     * Heading: "Веб-разработка"
     * Subheading: "Создаем современные веб-сайты и приложения, которые помогают бизнесу расти"
     * Description: добавить 2-3 абзаца описания
   - Выбрать изображение:
     * Загрузить иллюстрацию через медиа библиотеку
   - Настроить кнопку:
     * Text: "Обсудить проект"
     * Link: #contact-form
     * Style: Primary

5. **Добавить секцию "Что входит"**
   - Перетащить "Feature Cards Grid"
   - Настроить заголовок секции: "Что входит в услугу"
   - Изменить количество карточек на 6:
     * Выбрать grid container
     * В свойствах: Grid Template Columns: "repeat(3, 1fr)"
   - Настроить каждую карточку:
     * Карточка 1:
       - Icon: выбрать иконку "Code"
       - Title: "Frontend разработка"
       - Description: "React, Vue.js, Angular"
     * Карточка 2:
       - Icon: "Server"
       - Title: "Backend разработка"
       - Description: "Node.js, Python, PHP"
     * ... (продолжить для остальных)

6. **Добавить секцию процесса**
   - Перетащить "Two Column Text + Image"
   - Текст слева:
     * Heading: "Как мы работаем"
     * Добавить 5 этапов с описаниями
   - Изображение справа:
     * Загрузить диаграмму процесса

7. **Добавить секцию с технологиями**
   - Создать новый контейнер:
     * Перетащить "Container" из библиотеки элементов
     * Layout Mode: Grid
     * Grid Template Columns: "repeat(6, 1fr)"
     * Gap: 20px
   - Добавить логотипы технологий:
     * Перетащить 6 изображений
     * Настроить размеры: width: 100px, height: 100px

8. **Добавить тарифы**
   - Перетащить "Pricing Cards"
   - Настроить 3 тарифа:
     * Базовый:
       - Цена: от 50 000 ₽
       - Что входит: список фич
       - Кнопка: "Выбрать тариф"
     * Стандарт:
       - Добавить Badge: "Популярный"
       - Цена: от 100 000 ₽
       - Выделить карточку (border, shadow)
     * Премиум:
       - Цена: от 200 000 ₽

9. **Добавить кейсы**
   - Создать новый блок "Service Cases":
     * Container (flex, column)
     * Section Heading: "Наши работы"
     * Cases Grid (grid, 2 columns)
       - Case Card 1
         - Image
         - Project Name
         - Description
         - Technologies Used
         - Results
         - View Case Button
       - Case Card 2
         - ... (аналогично)

10. **Добавить FAQ**
    - Создать новый блок "FAQ Accordion":
      * Section Heading: "Частые вопросы"
      * Accordion Container
        - Accordion Item x 7
          - Question (button)
          - Answer (expandable)
    - Заполнить вопросы и ответы

11. **Добавить форму**
    - Перетащить "Advanced Contact Form"
    - Настроить:
      * Heading: "Обсудить проект"
      * Service Select: предзаполнить "Веб-разработка"
      * Submit Button: "Отправить заявку"

12. **Добавить Footer**
    - Перетащить "Footer - Вариант 1"
    - Уже настроен, используется на всех страницах

---

### Шаг 3: Адаптивная версия

1. **Переключиться на режим Tablet**
   - Кликнуть на иконку Tablet в toolbar
   - Canvas изменит ширину на 768px

2. **Настроить адаптивность:**
   - Hero Grid: изменить на 1 column
   - Feature Cards: изменить на 2 columns
   - Pricing Cards: изменить на 1 column (стек)
   - Cases Grid: изменить на 1 column

3. **Переключиться на Mobile**
   - Кликнуть на иконку Mobile (375px)
   - Все grid должны стать 1 column
   - Уменьшить отступы и шрифты

---

### Шаг 4: Кастомизация через CSS

1. **Добавить custom CSS для hero секции:**
   - Выбрать hero container
   - В панели свойств открыть "Custom CSS"
   - Добавить:
   ```css
   background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
   color: white;
   
   h1 {
     font-size: 48px;
     font-weight: 700;
     margin-bottom: 20px;
   }
   
   @media (max-width: 768px) {
     padding: 40px 20px;
     
     h1 {
       font-size: 32px;
     }
   }
   ```

2. **Добавить hover эффекты для карточек:**
   - Выбрать feature card
   - Custom CSS:
   ```css
   transition: transform 0.3s ease, box-shadow 0.3s ease;
   
   &:hover {
     transform: translateY(-10px);
     box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
   }
   ```

---

### Шаг 5: Сохранение и публикация

1. **Сохранить черновик**
   - Нажать "Сохранить" в toolbar
   - Система сохраняет изменения

2. **Предпросмотр**
   - Нажать "Предпросмотр"
   - Открывается в новой вкладке
   - Проверить все на разных устройствах

3. **Опубликовать**
   - Если все ОК, нажать "Опубликовать"
   - Страница становится доступной по URL

---

## 8. Метрики успеха внедрения

### 8.1 Технические метрики

- ✅ **Performance:**
  - Lighthouse Score > 90
  - First Contentful Paint < 1.5s
  - Time to Interactive < 3s

- ✅ **SEO:**
  - All pages имеют уникальные meta tags
  - Lighthouse SEO Score > 95
  - Mobile-friendly test passed

- ✅ **Accessibility:**
  - WCAG 2.1 Level AA compliance
  - Keyboard navigation works
  - Screen reader compatible

### 8.2 Бизнес метрики

- ✅ **Конверсия:**
  - Форма обратной связи: > 3% конверсия
  - Время на сайте: > 2 минуты
  - Bounce rate: < 40%

- ✅ **Эффективность:**
  - Создание новой страницы: < 2 часов
  - Обновление контента: < 30 минут
  - Не требуется помощь разработчика для базовых задач

---

## 9. Чек-лист для запуска

### Pre-launch checklist

**Контент:**
- [ ] Все тексты проверены на ошибки
- [ ] Все изображения оптимизированы
- [ ] Все ссылки работают
- [ ] Контактная информация актуальна
- [ ] Footer заполнен полностью

**SEO:**
- [ ] Meta tags на всех страницах
- [ ] Open Graph tags настроены
- [ ] Sitemap.xml создан
- [ ] Robots.txt настроен
- [ ] 404 страница создана
- [ ] Canonical URLs настроены

**Технические:**
- [ ] SSL сертификат установлен
- [ ] Google Analytics подключен
- [ ] Формы работают и отправляют email
- [ ] Сайт адаптивен (mobile, tablet, desktop)
- [ ] Кросс-браузерность проверена
- [ ] Performance оптимизирован

**Безопасность:**
- [ ] Формы защищены от спама (captcha)
- [ ] Headers безопасности настроены
- [ ] Резервное копирование настроено

**Юридические:**
- [ ] Политика конфиденциальности
- [ ] Пользовательское соглашение
- [ ] Cookie policy
- [ ] Контактная информация для GDPR

---

## 10. Итоговый timeline

```
Неделя 1-2:   Подготовка материалов
Неделя 3-5:   Создание библиотеки блоков
Неделя 6:     Главная + О компании
Неделя 7:     Услуги (каталог + детальные)
Неделя 8:     Портфолио + Блог
Неделя 9:     Контакты + дополнительные страницы
Неделя 10-11: Оптимизация и адаптивность
Неделя 12:    Тестирование и запуск

Итого: 12 недель (3 месяца)
```

---

**Готово!** Полная документация по созданию корпоративного сайта с использованием визуального конструктора. 🎉

Каждая секция детально описывает процесс от архитектуры до конкретных шагов по созданию страниц. Готов ответить на вопросы или помочь с реализацией!
