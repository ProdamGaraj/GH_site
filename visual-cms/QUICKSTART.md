# 🚀 Быстрый старт Visual CMS

## Шаг 1: Установка зависимостей

```bash
# Корневые зависимости
npm install

# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install
```

## Шаг 2: Настройка окружения

Скопируйте файл с переменными окружения:

```bash
cd backend
copy .env.example .env
```

Отредактируйте `.env` файл если нужно изменить настройки.

## Шаг 3: Запуск инфраструктуры

### Вариант А: Использовать Docker

```bash
# Из корневой директории
docker-compose up -d

# Проверить статус
docker-compose ps
```

Это запустит:
- PostgreSQL на порту 5432
- Redis на порту 6379
- MinIO на портах 9000/9001

### Вариант Б: Локальная установка

Установите PostgreSQL, Redis и MinIO локально и настройте переменные окружения в `.env`.

## Шаг 4: Запуск приложения

### Запуск Frontend и Backend вместе

```bash
# Из корневой директории
npm run dev
```

### Или по отдельности

**Frontend (в одном терминале):**
```bash
cd frontend
npm run dev
```

**Backend (в другом терминале):**
```bash
cd backend
npm run dev
```

## Шаг 5: Открыть приложение

Откройте браузер и перейдите на:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)

## 📖 Структура проекта

```
visual-cms/
├── frontend/              # React приложение
│   ├── src/
│   │   ├── app/          # Redux store, routes
│   │   ├── features/     # Feature-based modules
│   │   ├── pages/        # Page components
│   │   ├── shared/       # Shared components, types
│   │   └── widgets/      # Composite components
│   └── package.json
├── backend/               # Node.js API
│   ├── src/
│   │   ├── config/       # Configuration
│   │   ├── controllers/  # Route controllers
│   │   ├── models/       # TypeORM entities
│   │   └── routes/       # API routes
│   └── package.json
├── docker-compose.yml     # Docker services
└── package.json          # Root package.json
```

## 🎯 Первые шаги

1. **Создайте первую страницу:**
   - Нажмите "Создать страницу" на главной
   - Перетащите элементы из левой панели на холст
   - Настройте свойства в правой панели
   - Сохраните

2. **Попробуйте разные режимы layout:**
   - Выберите контейнер
   - В правой панели выберите: Flex, Grid, Absolute или Table
   - Настройте специфичные свойства

3. **Создайте переиспользуемый блок:**
   - Перейдите в раздел "Блоки"
   - Создайте новый блок
   - Сохраните его
   - Используйте в других страницах через библиотеку

## 🛠️ Полезные команды

```bash
# Остановить Docker контейнеры
docker-compose down

# Пересобрать контейнеры
docker-compose up --build

# Просмотр логов
docker-compose logs -f

# Очистить все (включая volumes)
docker-compose down -v

# Build для production
npm run build
```

## ⚡ Горячие клавиши

- `Ctrl + S` - Сохранить (скоро)
- `Ctrl + Z` - Отменить (скоро)
- `Ctrl + Y` - Повторить (скоро)
- `Delete` - Удалить выбранный элемент (скоро)

## 🐛 Отладка

### Frontend не запускается
- Проверьте что Node.js версии 18+
- Удалите `node_modules` и переустановите: `npm install`
- Проверьте порт 3000 свободен

### Backend не подключается к БД
- Убедитесь что PostgreSQL запущен: `docker-compose ps`
- Проверьте `.env` файл
- Проверьте логи: `docker-compose logs postgres`

### Drag & Drop не работает
- Откройте консоль браузера (F12)
- Проверьте ошибки в консоли
- Убедитесь что элемент перетаскивается на контейнер

## 📚 Документация

- [Архитектура проекта](../docs/visual-constructor-architecture.md)
- [План реализации](../docs/visual-constructor-implementation-plan.md)
- [Использование CMS](../docs/company-website-cms-plan.md)

## 💡 Что дальше?

- [ ] Добавить Undo/Redo
- [ ] Реализовать адаптивность (tablet, mobile views)
- [ ] Добавить Custom CSS редактор (Monaco)
- [ ] Создать больше готовых блоков
- [ ] Добавить экспорт в HTML/CSS
- [ ] Реализовать сохранение на backend

Удачи в разработке! 🚀
