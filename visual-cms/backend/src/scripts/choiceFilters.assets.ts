/**
 * Код и стили фильтров секции «Выбрать», которые миграция кладёт в блок
 * «Complex choice». Вынесены из `choiceFilters.ts`, чтобы логику преобразования
 * было видно без 300 строк встроенного скрипта.
 *
 * Скрипт написан на ES5 (var, function): он встраивается в страницу как есть,
 * без сборки, как и остальной globalJs блока.
 */

/** Первая строка скрипта фильтров версии 2 — по ней миграция узнаёт, что уже применена. */
export const FILTERS_JS_MARKER = '/* Фильтры квартир (#choice), v2.'

/** Начало скрипта фильтров первой версии: с него хвост globalJs заменяется целиком. */
export const FILTERS_JS_V1_START = '/* Фильтры квартир (#choice). Работают по data-атрибутам'

export const FILTERS_JS = `${FILTERS_JS_MARKER} Работают по data-атрибутам уже
   отрисованных карточек: разметка приходит с деплоя через _repeat, браузер
   ничего не грузит.
   Выбранные чипсы одного поля объединяются по ИЛИ, разные поля — по И.
   Варианты сужаются под остальные условия: чипс, который при них ничего не
   покажет, выключается; выбранный остаётся кликабельным, чтобы его можно было
   снять. Цена карточки — диапазон «от priceMin до priceMax»: карточка подходит,
   если он пересекается с заданным. */
(function () {
  var section = document.getElementById('choice');
  if (!section) return;
  var toolbar = section.querySelector('.apartment-toolbar');
  var grid = section.querySelector('.apartments-grid');
  if (!toolbar || !grid) return;

  var TEXTS = {
    ru: { empty: 'По выбранным условиям планировок нет. Измените фильтры или сбросьте их.', from: 'от {n}', to: 'до {n}' },
    uz: { empty: "Tanlangan shartlarga mos rejalar yo'q. Filtrlarni o'zgartiring yoki tozalang.", from: '{n} dan', to: '{n} gacha' },
    en: { empty: 'No layouts match these filters. Change or reset them.', from: 'from {n}', to: 'up to {n}' }
  };
  var lang = (document.documentElement.getAttribute('lang') || 'ru').slice(0, 2).toLowerCase();
  var T = TEXTS[lang] || TEXTS.ru;

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

  triggers.forEach(function (trigger) {
    trigger.addEventListener('click', function (event) {
      event.stopPropagation();
      var name = trigger.getAttribute('data-panel');
      var panel = toolbar.querySelector('.filter-panel[data-panel="' + name + '"]');
      var wasOpen = trigger.classList.contains('is-open');
      closePanels();
      if (!wasOpen && panel) {
        trigger.classList.add('is-open');
        panel.classList.add('is-open');
      }
    });
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

/** Маркер CSS-дополнения — по нему миграция узнаёт, что уже применена. */
export const FILTERS_CSS_MARKER = '/* ==== choice-filters v2 ===='

export const FILTERS_CSS = `
${FILTERS_CSS_MARKER}
   Поверх исходного CSS блока (scripts/migrate-choice-filters.ts): панель
   фильтров поверх карточек, веса под Inter, галочка вместо символа «⌄»,
   выключенные варианты. */

/* Секция обрезала панель, когда после фильтра карточек оставалось мало и
   «Все фильтры» оказывались выше самой секции. */
#choice.detail-section {
  overflow: visible;
}

/* Без z-index панель рисовалась под карточками: у них позиционированные
   потомки, и они идут в разметке позже. */
.apartment-toolbar {
  z-index: 20;
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
`
