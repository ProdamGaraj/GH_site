# Фикстуры MacroCRM

Первая страница выдачи по дому 5139395, снята вручную 2026-09-08.
Поля exportUrl и specialNotes вырезаны — в них рабочие ссылки в CRM.

Полный набор собирается скриптом:

    cd visual-cms/estate-service/docs
    MACRO_TOKEN=... MACRO_APP_ID=... node macro-fetch.js --all-plans

| файл | что внутри |
|---|---|
| 01-houses.json | два дома: 5139395 и 5622025 |
| 02-apartments.json | 100 квартир в продаже, все category=flat |
| 03-apartments-all.json | 100 объектов без фильтра статусов |
| 04-flatplans-sample.json | одна планировка: К2-54.65-6 |
| 07-house-stats.json | агрегаты Macro по обоим домам |
