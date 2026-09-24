/**
 * Код и стили фильтров секции «Выбрать», которые миграция кладёт в блок
 * «Complex choice». Вынесены из `choiceFilters.ts`, чтобы логику преобразования
 * было видно без 300 строк встроенного скрипта.
 *
 * Скрипт написан на ES5 (var, function): он встраивается в страницу как есть,
 * без сборки, как и остальной globalJs блока.
 */

/**
 * Общее начало заголовка скрипта фильтров любой версии: с него хвост globalJs
 * заменяется целиком при обновлении.
 */
export const FILTERS_JS_HEAD = '/* Фильтры квартир (#choice)'

/** Заголовок текущей версии — по нему миграция узнаёт, что уже применена. */
export const FILTERS_JS_MARKER = `${FILTERS_JS_HEAD}, v5.`

/** Начало скрипта первой версии (до миграций) — для тестов обновления. */
export const FILTERS_JS_V1_START = `${FILTERS_JS_HEAD}. Работают по data-атрибутам`

export const FILTERS_JS = `${FILTERS_JS_MARKER} Работают по data-атрибутам уже
   отрисованных карточек: разметка приходит с деплоя через _repeat, браузер
   ничего не грузит.
   Выбранные чипсы одного поля объединяются по ИЛИ, разные поля — по И.
   Варианты сужаются под остальные условия: чипс, который при них ничего не
   покажет, выключается; выбранный остаётся кликабельным, чтобы его можно было
   снять. Цена карточки — диапазон «от priceMin до priceMax»: карточка подходит,
   если он пересекается с заданным.
   На десктопе комнатность и цена стоят строкой, без панелей; на телефоне —
   кнопки, панель открывается под своей кнопкой. */
(function () {
  var section = document.getElementById('choice');
  if (!section) return;
  var toolbar = section.querySelector('.apartment-toolbar');
  var grid = section.querySelector('.apartments-grid');
  if (!toolbar || !grid) return;

  var TEXTS = {
    ru: { empty: 'По выбранным условиям планировок нет. Измените фильтры или сбросьте их.', from: 'от {n}', to: 'до {n}', found: 'Найдено: {n}' },
    uz: { empty: "Tanlangan shartlarga mos rejalar yo'q. Filtrlarni o'zgartiring yoki tozalang.", from: '{n} dan', to: '{n} gacha', found: 'Topildi: {n}' },
    en: { empty: 'No layouts match these filters. Change or reset them.', from: 'from {n}', to: 'up to {n}', found: 'Found: {n}' }
  };
  var lang = (document.documentElement.getAttribute('lang') || 'ru').slice(0, 2).toLowerCase();
  var T = TEXTS[lang] || TEXTS.ru;

  /* Строка фильтров для десктопа. Собирается из копий тех же чипсов и полей
     цены, что и в панелях: состояние у них общее (выбор хранится по полю, поля
     цены синхронизируются), так что строка и панели — одно и то же. Что
     показать — строку или кнопки с панелями, — решает CSS по ширине экрана.
     Поле без вариантов в строку не попадает. */
  var INLINE_PANELS = ['rooms', 'price'];
  var main = toolbar.querySelector('.filter-main');
  var inline = document.createElement('div');
  inline.className = 'filter-inline';
  INLINE_PANELS.forEach(function (name) {
    var panel = toolbar.querySelector('.filter-panel[data-panel="' + name + '"]');
    var control = panel && (panel.querySelector('.chip-row') || panel.querySelector('.range-box'));
    if (!control) return;
    if (control.classList.contains('chip-row') && !control.querySelector('[data-value]')) return;
    var group = document.createElement('div');
    group.className = 'filter-inline-group';
    group.setAttribute('data-panel', name);
    var title = panel.querySelector('h3');
    if (title) {
      var label = document.createElement('span');
      label.className = 'filter-inline-label';
      label.textContent = title.textContent;
      group.appendChild(label);
    }
    group.appendChild(control.cloneNode(true));
    inline.appendChild(group);
  });
  /* Счётчик и «Сбросить» — одна пара: когда строка переносится (много
     комнатностей + кнопка вида из окна), они уходят на новую строку вместе,
     а не «Сбросить» в одиночку. На телефоне пара прозрачна для раскладки
     (display: contents), и кнопка встаёт в сетку, как раньше. */
  var countLabel = null;
  if (main && inline.children.length) {
    main.insertBefore(inline, main.firstChild);
    var summary = document.createElement('span');
    summary.className = 'filter-summary';
    var resetInMain = main.querySelector(':scope > .reset-filter');
    main.insertBefore(summary, resetInMain);
    countLabel = document.createElement('span');
    countLabel.className = 'filter-count';
    summary.appendChild(countLabel);
    if (resetInMain) summary.appendChild(resetInMain);
  }

  var triggers = toolbar.querySelectorAll('.filter-trigger[data-panel]');
  var panels = toolbar.querySelectorAll('.filter-panel');
  var priceInputs = toolbar.querySelectorAll('[data-filter="priceMin"], [data-filter="priceMax"]');
  var applyButtons = toolbar.querySelectorAll('[data-filter-action="apply"]');

  /* Чипсы разворачиваются из данных проекта (срок сдачи, виды из окон), и у
     проекта их может не быть. Пустую группу прячем и в своей панели, и в
     «Все фильтры»; кнопку панели, в которой не осталось ничего, — тоже. */
  toolbar.querySelectorAll('.filter-group').forEach(function (group) {
    var row = group.querySelector('.chip-row');
    if (row && !row.querySelector('[data-value]')) group.hidden = true;
  });
  /* display, а не [hidden]: правило вида .filter-trigger { display: flex }
     перебивает скрытие из браузерной таблицы стилей. */
  triggers.forEach(function (trigger) {
    var panel = toolbar.querySelector('.filter-panel[data-panel="' + trigger.getAttribute('data-panel') + '"]');
    if (!panel) return;
    var usable = panel.querySelector('[data-filter][data-value]') || panel.querySelector('.range-box');
    if (!usable) trigger.style.display = 'none';
  });

  function closePanels() {
    triggers.forEach(function (t) { t.classList.remove('is-open'); });
    panels.forEach(function (p) { p.classList.remove('is-open'); });
  }

  function panelFor(trigger) {
    return toolbar.querySelector('.filter-panel[data-panel="' + trigger.getAttribute('data-panel') + '"]');
  }

  /* Панель открывается прямо под своей кнопкой. В первых версиях она стояла
     под всем тулбаром (ниже его отступа и нижней границы) и на фиксированном
     left — выглядела оторванной, а «Все фильтры» уезжали к правому краю.
     На узком экране ширину задаёт CSS (во всю ширину тулбара), здесь — только
     высота. */
  var narrow = window.matchMedia ? window.matchMedia('(max-width: 760px)') : null;
  function placePanel(trigger, panel) {
    var box = toolbar.getBoundingClientRect();
    var t = trigger.getBoundingClientRect();
    panel.style.top = Math.round(t.bottom - box.top + 8) + 'px';
    if (narrow && narrow.matches) {
      panel.style.left = '';
      panel.style.right = '';
      return;
    }
    var left = t.left - box.left;
    var overflow = left + panel.offsetWidth - box.width;
    if (overflow > 0) left = Math.max(0, left - overflow);
    panel.style.left = Math.round(left) + 'px';
    panel.style.right = 'auto';
  }

  triggers.forEach(function (trigger) {
    trigger.addEventListener('click', function (event) {
      event.stopPropagation();
      var panel = panelFor(trigger);
      var wasOpen = trigger.classList.contains('is-open');
      closePanels();
      if (!wasOpen && panel) {
        trigger.classList.add('is-open');
        panel.classList.add('is-open');
        placePanel(trigger, panel);
      }
    });
  });
  window.addEventListener('resize', function () {
    var open = toolbar.querySelector('.filter-trigger.is-open');
    var panel = open && panelFor(open);
    if (panel) placePanel(open, panel);
  });
  /* Клик внутри панели её не закрывает. В первой версии это делал
     stopPropagation на самой панели — и заодно глушил клики по чипсам:
     делегат на toolbar их не получал, и выбор в панелях не срабатывал. */
  document.addEventListener('click', function (event) {
    var target = event.target;
    if (target && target.closest && target.closest('.filter-panel')) return;
    closePanels();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePanels(); });

  /* Чипсы одного поля живут в нескольких панелях (своя + «Все фильтры»),
     поэтому состояние храним в наборе значений, а не в DOM одной кнопки. */
  var selected = {};
  var fields = [];
  toolbar.querySelectorAll('[data-filter][data-value]').forEach(function (chip) {
    var field = chip.getAttribute('data-filter');
    if (fields.indexOf(field) === -1) fields.push(field);
  });
  function chipsFor(field) {
    return toolbar.querySelectorAll('[data-filter="' + field + '"][data-value]');
  }
  function syncChips(field) {
    var set = selected[field] || [];
    chipsFor(field).forEach(function (chip) {
      chip.classList.toggle('active', set.indexOf(chip.getAttribute('data-value')) !== -1);
    });
  }

  toolbar.addEventListener('click', function (event) {
    var chip = event.target.closest('[data-filter][data-value]');
    if (!chip || !toolbar.contains(chip) || chip.disabled) return;
    var field = chip.getAttribute('data-filter');
    var value = chip.getAttribute('data-value');
    var set = selected[field] || (selected[field] = []);
    var at = set.indexOf(value);
    if (at === -1) set.push(value); else set.splice(at, 1);
    syncChips(field);
    apply();
  });

  /* Поле цены тоже есть в двух панелях: ввод в одной копируется в другую,
     иначе фильтр зависел бы от того, какое поле заполнено последним. */
  priceInputs.forEach(function (input) {
    input.setAttribute('data-placeholder', input.getAttribute('placeholder') || '');
    input.addEventListener('input', function () {
      var kind = input.getAttribute('data-filter');
      toolbar.querySelectorAll('[data-filter="' + kind + '"]').forEach(function (other) {
        if (other !== input) other.value = input.value;
      });
      apply();
    });
  });

  function readPrice(kind) {
    var input = toolbar.querySelector('[data-filter="' + kind + '"]');
    if (!input || input.value === '') return null;
    var n = Number(input.value);
    return isFinite(n) ? n : null;
  }

  function cardPrice(card) {
    var min = Number(card.getAttribute('data-price')) || 0;
    var max = Number(card.getAttribute('data-price-max')) || 0;
    return { min: min, max: Math.max(min, max) };
  }

  function priceOk(card) {
    var min = readPrice('priceMin');
    var max = readPrice('priceMax');
    if (min === null && max === null) return true;
    var p = cardPrice(card);
    /* Карточка без цены под ценовой фильтр не попадает: «0 UZS» — это
       отсутствие цены, а не бесплатная квартира. */
    if (!(p.min > 0)) return false;
    if (max !== null && p.min > max) return false;
    if (min !== null && p.max < min) return false;
    return true;
  }

  function valuesOf(card, field) {
    var raw = card.getAttribute('data-' + field);
    /* Карточка типа планировки объединяет квартиры с разными видами из окон и
       этажами, поэтому значение атрибута — множество через «|». */
    return raw ? raw.split('|') : [];
  }

  /* skip — поле, которое не учитываем: так считаются доступные варианты этого
     поля при всех остальных условиях. */
  function matches(card, skip) {
    for (var i = 0; i < fields.length; i++) {
      var field = fields[i];
      if (field === skip) continue;
      var set = selected[field];
      if (!set || !set.length) continue;
      var values = valuesOf(card, field);
      var hit = set.some(function (v) { return values.indexOf(v) !== -1; });
      if (!hit) return false;
    }
    return skip === 'price' || priceOk(card);
  }

  function groupDigits(n) {
    return String(Math.round(n)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ' ');
  }

  function refreshFacets(cards) {
    fields.forEach(function (field) {
      var available = {};
      cards.forEach(function (card) {
        if (!matches(card, field)) return;
        valuesOf(card, field).forEach(function (v) { available[v] = true; });
      });
      var set = selected[field] || [];
      chipsFor(field).forEach(function (chip) {
        var value = chip.getAttribute('data-value');
        chip.disabled = set.indexOf(value) === -1 && !available[value];
      });
    });

    /* Подсказка в полях цены — реальный диапазон при остальных условиях. */
    var lo = Infinity;
    var hi = 0;
    cards.forEach(function (card) {
      if (!matches(card, 'price')) return;
      var p = cardPrice(card);
      if (!(p.min > 0)) return;
      if (p.min < lo) lo = p.min;
      if (p.max > hi) hi = p.max;
    });
    priceInputs.forEach(function (input) {
      var isMin = input.getAttribute('data-filter') === 'priceMin';
      var hint = hi > 0
        ? (isMin ? T.from : T.to).replace('{n}', groupDigits(isMin ? lo : hi))
        : input.getAttribute('data-placeholder');
      input.setAttribute('placeholder', hint);
    });
  }

  function refreshTriggers() {
    var priceSet = readPrice('priceMin') !== null || readPrice('priceMax') !== null;
    var anySet = priceSet || fields.some(function (f) { return selected[f] && selected[f].length > 0; });
    triggers.forEach(function (trigger) {
      var name = trigger.getAttribute('data-panel');
      var on = name === 'all' ? anySet : name === 'price' ? priceSet : !!(selected[name] && selected[name].length);
      trigger.classList.toggle('has-value', on);
    });
  }

  function reset() {
    selected = {};
    toolbar.querySelectorAll('[data-filter][data-value]').forEach(function (c) { c.classList.remove('active'); });
    priceInputs.forEach(function (i) { i.value = ''; });
    apply();
  }
  toolbar.querySelectorAll('[data-filter-action="reset"], .reset-filter').forEach(function (b) {
    b.addEventListener('click', function (e) { e.stopPropagation(); reset(); });
  });
  applyButtons.forEach(function (b) {
    b.setAttribute('data-label', b.textContent.trim());
    b.addEventListener('click', function (e) { e.stopPropagation(); closePanels(); });
  });

  var empty = null;
  function apply() {
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.apartment-card'));
    var shown = 0;
    cards.forEach(function (card) {
      var ok = matches(card, null);
      card.hidden = !ok;
      if (ok) shown++;
    });
    refreshFacets(cards);
    refreshTriggers();
    /* «Показать · 3»: сколько останется, видно до закрытия панели. */
    applyButtons.forEach(function (b) {
      b.textContent = b.getAttribute('data-label') + ' · ' + shown;
    });
    if (countLabel) countLabel.textContent = T.found.replace('{n}', shown);
    if (!empty) {
      empty = document.createElement('p');
      empty.className = 'apartments-empty';
      empty.textContent = T.empty;
      grid.parentNode.insertBefore(empty, grid.nextSibling);
    }
    empty.hidden = shown !== 0 || cards.length === 0;
  }

  apply();
})();
`

/** Начало CSS-дополнения любой версии: с него хвост globalCss заменяется при обновлении. */
export const FILTERS_CSS_HEAD = '/* ==== choice-filters'

/** Маркер текущей версии — по нему миграция узнаёт, что уже применена. */
export const FILTERS_CSS_MARKER = `${FILTERS_CSS_HEAD} v6 ====`

export const FILTERS_CSS = `
${FILTERS_CSS_MARKER}
   Поверх исходного CSS блока (scripts/migrate-choice-filters.ts): панель
   фильтров поверх карточек и под своей кнопкой, веса под Inter, галочка
   вместо символа «⌄», выключенные варианты. Секция должна оставаться
   последней в globalCss: обновление заменяет её до конца. */

/* Секция обрезала панель, когда после фильтра карточек оставалось мало и
   «Все фильтры» оказывались выше самой секции. */
#choice.detail-section {
  overflow: visible;
}

/* Без z-index панель рисовалась под карточками: у них позиционированные
   потомки, и они идут в разметке позже. Линия и большой отступ под
   фильтрами убраны: карточки идут сразу, панель может на них заезжать. */
.apartment-toolbar {
  z-index: 20;
  margin-bottom: 22px;
  padding-bottom: 0;
  border-bottom: 0;
}

.filter-trigger,
.reset-filter,
.filter-apply,
.filter-reset,
.chip-row button,
.view-toggle button {
  font-weight: 700;
  letter-spacing: 0;
}

.filter-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.filter-trigger:not([data-panel="all"])::after {
  content: "";
  width: 6px;
  height: 6px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: translateY(-2px) rotate(45deg);
  transition: transform .2s ease;
}

.filter-trigger.is-open:not([data-panel="all"])::after {
  transform: translateY(1px) rotate(-135deg);
}

.filter-trigger.has-value:not(.is-open) {
  border-color: #15181d;
  box-shadow: inset 0 0 0 1px #15181d;
}

.chip-row button:disabled {
  border-style: dashed;
  background: #fff;
  color: rgba(21, 24, 29, .3);
  cursor: not-allowed;
}

.filter-group[hidden] {
  display: none;
}

.range-box input {
  font-weight: 600;
}

.range-box input::placeholder {
  color: rgba(21, 24, 29, .38);
  font-weight: 500;
}

/* Высоту и левый край панели ставит скрипт — прямо под её кнопкой. */
.filter-panel,
.filter-panel[data-panel="price"],
.filter-panel[data-panel="all"] {
  top: 0;
}

/* В панелях с чипсами пара кнопок — на 780 px это была пустая плашка. */
.filter-panel[data-panel="rooms"],
.filter-panel[data-panel="deadline"],
.filter-panel[data-panel="windowViews"] {
  width: min(420px, calc(100vw - 42px));
}

/* «Все фильтры» в одну колонку: в две поля цены сжимались до «от 376 5…». */
.filter-panel[data-panel="all"] {
  left: 0;
  right: auto;
  width: min(560px, calc(100vw - 42px));
}

.all-filter-grid {
  grid-template-columns: 1fr;
  gap: 0;
}

.all-filter-grid .filter-group + .filter-group {
  margin-top: 22px;
}

/* На телефоне — во всю ширину тулбара. Селекторы панелей с чипсами
   перечислены явно: иначе их width: 420px (выше) побеждал по специфичности
   и панель вылезала за край экрана. */
@media (max-width: 760px) {
  .filter-panel,
  .filter-panel[data-panel="price"],
  .filter-panel[data-panel="all"],
  .filter-panel[data-panel="rooms"],
  .filter-panel[data-panel="deadline"],
  .filter-panel[data-panel="windowViews"] {
    left: 0;
    right: 0;
    width: auto;
  }
}

/* На телефоне поля цены друг под другом: в два столбца подсказка
   «от 376 511 429» обрезалась. «—» и «UZS» убираем, валюта уже есть в
   заголовке группы. */
@media (max-width: 560px) {
  .range-box {
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 10px 12px;
  }

  .range-box > span {
    display: none;
  }
}

/* ---- Десктоп: комнатность и цена строкой, без панелей ----
   Строку собирает скрипт из копий чипсов и полей цены. На десктопе прячем
   кнопки этих панелей и «Все фильтры» (всё основное уже на виду; срок сдачи и
   вид из окна, если они есть у проекта, остаются своими кнопками). */
.filter-inline,
.filter-count {
  display: none;
}

.filter-inline {
  align-items: center;
  flex-wrap: wrap;
  gap: 12px 28px;
}

.filter-inline-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-inline-label {
  color: rgba(21, 24, 29, .56);
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.filter-inline .chip-row {
  flex-wrap: nowrap;
}

/* В строке поля цены стоят сами по себе, без общей рамки вокруг: рамка
   вокруг полей с рамками выглядела двойной. Ширина — под самую длинную
   подсказку: узбекское «4 789 163 414 gacha» в 170 px обрезалось. */
.filter-inline .range-box {
  min-height: 0;
  grid-template-columns: 190px auto 190px;
  gap: 8px;
  padding: 0;
  border: 0;
  background: transparent;
}

.filter-inline .range-box input {
  min-height: 44px;
  padding: 0 12px;
  font-size: 15px;
  border: 1px solid rgba(21, 24, 29, .16);
  border-radius: 13px;
  background: #fff;
}

/* «UZS» уже в подписи группы. */
.filter-inline .range-box > span:last-child {
  display: none;
}

.filter-summary {
  display: contents;
}

.filter-count {
  color: rgba(21, 24, 29, .56);
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

/* Строка фильтров — во всю ширину тулбара. Переключатель «Плитка /
   Шахматка» убран (v6): шахматки не будет, а колонкой рядом со строкой он
   отнимал у неё ~200 px. */
@media (min-width: 1181px) {
  .apartment-toolbar > :first-child {
    flex: 1 1 auto;
  }
}

@media (min-width: 761px) {
  .filter-inline {
    display: flex;
  }

  /* Счётчик и «Сбросить» идут сразу за последним фильтром и не
     разрываются: прижатые вправо, они повисали посреди второй строки. */
  .filter-summary {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: 8px;
    white-space: nowrap;
  }

  .filter-count {
    display: inline;
  }

  .filter-trigger[data-panel="rooms"],
  .filter-trigger[data-panel="price"],
  .filter-trigger[data-panel="all"] {
    display: none;
  }
}
`
