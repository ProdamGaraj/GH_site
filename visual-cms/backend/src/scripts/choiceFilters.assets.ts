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
export const FILTERS_JS_MARKER = `${FILTERS_JS_HEAD}, v6.`

/** Начало скрипта первой версии (до миграций) — для тестов обновления. */
export const FILTERS_JS_V1_START = `${FILTERS_JS_HEAD}. Работают по data-атрибутам`

export const FILTERS_JS = `${FILTERS_JS_MARKER} Работают по data-атрибутам уже
   отрисованных карточек: разметка приходит с деплоя через _repeat, браузер
   ничего не грузит.
   Выбранные чипсы одного поля объединяются по ИЛИ, разные поля — по И.
   Варианты сужаются под остальные условия: чипс, который при них ничего не
   покажет, выключается; выбранный остаётся кликабельным, чтобы его можно было
   снять. Площадь и этаж — диапазоны «от/до»: карточка группы планировок
   подходит, если хоть одна её квартира попадает в заданный диапазон. Цены на
   сайте нет (v6).
   На десктопе комнатность, площадь и этаж стоят строкой, без панелей; на
   телефоне — кнопки, панель открывается под своей кнопкой. */
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

  function num(value) {
    if (value === null || value === undefined) return null;
    var text = String(value).replace(/\\s/g, '').replace(',', '.');
    if (text === '') return null;
    var n = Number(text);
    return isFinite(n) ? n : null;
  }

  /* Диапазоны «от/до». Поля ввода — data-filter="<имя>Min" / "<имя>Max".
     Карточка группы планировок объединяет квартиры, поэтому у неё не одно
     значение, а набор отрезков: площадь — один отрезок «от и до» группы,
     этажи — по точке на каждый этаж, где есть квартира. Карточка подходит,
     если хоть один её отрезок пересекается с заданным. Нулевая площадь —
     это отсутствие данных, а не квартира в 0 м². */
  var RANGES = {
    area: function (card) {
      var lo = num(card.getAttribute('data-area-min'));
      var hi = num(card.getAttribute('data-area-max'));
      if (!(lo > 0)) lo = hi;
      if (!(hi > 0)) hi = lo;
      return lo > 0 ? [[Math.min(lo, hi), Math.max(lo, hi)]] : [];
    },
    floor: function (card) {
      return (card.getAttribute('data-floors') || '').split(/[,|]/).map(num)
        .filter(function (f) { return f !== null; })
        .map(function (f) { return [f, f]; });
    }
  };
  var RANGE_NAMES = Object.keys(RANGES);
  var allCards = Array.prototype.slice.call(grid.querySelectorAll('.apartment-card'));

  /* Диапазон, по которому данных нет ни у одной карточки, не показываем:
     фильтр по нему отсёк бы всё. */
  var rangeHasData = {};
  RANGE_NAMES.forEach(function (name) {
    rangeHasData[name] = allCards.some(function (card) { return RANGES[name](card).length > 0; });
    if (rangeHasData[name]) return;
    toolbar.querySelectorAll('[data-filter="' + name + 'Min"]').forEach(function (input) {
      var group = input.closest('.filter-group');
      if (group) group.hidden = true;
    });
  });

  /* Строка фильтров для десктопа. Собирается из копий тех же чипсов и полей
     диапазонов, что и в панелях: состояние у них общее (выбор хранится по
     полю, поля диапазонов синхронизируются), так что строка и панели — одно
     и то же. Что показать — строку или кнопки с панелями, — решает CSS по
     ширине экрана. Поле без вариантов в строку не попадает. */
  var INLINE_PANELS = ['rooms', 'area', 'floor'];
  var main = toolbar.querySelector('.filter-main');
  var inline = document.createElement('div');
  inline.className = 'filter-inline';
  INLINE_PANELS.forEach(function (name) {
    if (RANGES[name] && !rangeHasData[name]) return;
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
  var applyButtons = toolbar.querySelectorAll('[data-filter-action="apply"]');
  function rangeInputs(name) {
    return toolbar.querySelectorAll('[data-filter="' + name + 'Min"], [data-filter="' + name + 'Max"]');
  }

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
    var usable = panel.querySelector('.filter-group:not([hidden]) [data-filter][data-value]') ||
      panel.querySelector('.filter-group:not([hidden]) .range-box');
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

  /* Поле диапазона есть в нескольких местах (строка, своя панель, «Все
     фильтры»): ввод в одном копируется в остальные, иначе фильтр зависел бы
     от того, какое поле заполнено последним. */
  RANGE_NAMES.forEach(function (name) {
    rangeInputs(name).forEach(function (input) {
      input.setAttribute('data-placeholder', input.getAttribute('placeholder') || '');
      input.addEventListener('input', function () {
        var kind = input.getAttribute('data-filter');
        toolbar.querySelectorAll('[data-filter="' + kind + '"]').forEach(function (other) {
          if (other !== input) other.value = input.value;
        });
        apply();
      });
    });
  });

  /* Заданный диапазон; перепутанные «от» и «до» меняются местами — пустая
     выдача из-за порядка полей выглядела бы поломкой. */
  function readRange(name) {
    var lo = toolbar.querySelector('[data-filter="' + name + 'Min"]');
    var hi = toolbar.querySelector('[data-filter="' + name + 'Max"]');
    var min = lo ? num(lo.value) : null;
    var max = hi ? num(hi.value) : null;
    if (min !== null && max !== null && min > max) return { min: max, max: min };
    return { min: min, max: max };
  }

  function rangeSet(name) {
    var want = readRange(name);
    return want.min !== null || want.max !== null;
  }

  function rangeOk(card, name) {
    var want = readRange(name);
    if (want.min === null && want.max === null) return true;
    /* Карточка без данных под заданный диапазон не попадает: подтвердить,
       что она в нём, нечем. */
    return RANGES[name](card).some(function (span) {
      return (want.max === null || span[0] <= want.max) && (want.min === null || span[1] >= want.min);
    });
  }

  function valuesOf(card, field) {
    var raw = card.getAttribute('data-' + field);
    /* Карточка группы планировок объединяет квартиры с разными видами из окон
       и сроками, поэтому значение атрибута — множество через «|». */
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
    for (var r = 0; r < RANGE_NAMES.length; r++) {
      if (RANGE_NAMES[r] !== skip && !rangeOk(card, RANGE_NAMES[r])) return false;
    }
    return true;
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

    /* Подсказка в полях диапазона — реальные границы при остальных условиях,
       с запасом до целого: «от 34» у площади 34.87 не отсекает её. */
    RANGE_NAMES.forEach(function (name) {
      var lo = Infinity;
      var hi = -Infinity;
      cards.forEach(function (card) {
        if (!matches(card, name)) return;
        RANGES[name](card).forEach(function (span) {
          if (span[0] < lo) lo = span[0];
          if (span[1] > hi) hi = span[1];
        });
      });
      rangeInputs(name).forEach(function (input) {
        var isMin = input.getAttribute('data-filter') === name + 'Min';
        var hint = hi >= lo
          ? (isMin ? T.from : T.to).replace('{n}', String(isMin ? Math.floor(lo) : Math.ceil(hi)))
          : input.getAttribute('data-placeholder');
        input.setAttribute('placeholder', hint);
      });
    });
  }

  function refreshTriggers() {
    var anySet = RANGE_NAMES.some(rangeSet) ||
      fields.some(function (f) { return selected[f] && selected[f].length > 0; });
    triggers.forEach(function (trigger) {
      var name = trigger.getAttribute('data-panel');
      var on = name === 'all' ? anySet : RANGES[name] ? rangeSet(name) : !!(selected[name] && selected[name].length);
      trigger.classList.toggle('has-value', on);
    });
  }

  function reset() {
    selected = {};
    toolbar.querySelectorAll('[data-filter][data-value]').forEach(function (c) { c.classList.remove('active'); });
    RANGE_NAMES.forEach(function (name) {
      rangeInputs(name).forEach(function (i) { i.value = ''; });
    });
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

/** Начало CSS-дополнения любой версии: с него секция заменяется при обновлении. */
export const FILTERS_CSS_HEAD = '/* ==== choice-filters'

/** Маркер текущей версии — по нему миграция узнаёт, что уже применена. */
export const FILTERS_CSS_MARKER = `${FILTERS_CSS_HEAD} v7 ====`

/** Панели диапазонов: площадь и этаж (v7; до неё — цена). */
const RANGE_PANELS = ['area', 'floor']
const CHIP_PANELS = ['rooms', 'deadline', 'windowViews']
const panelSel = (names: string[]) => names.map((n) => `.filter-panel[data-panel="${n}"]`).join(',\n')

export const FILTERS_CSS = `
${FILTERS_CSS_MARKER}
   Поверх исходного CSS блока (scripts/migrate-choice-filters.ts): панель
   фильтров поверх карточек и под своей кнопкой, веса под Inter, галочка
   вместо символа «⌄», выключенные варианты. Фильтры площади и этажа вместо
   цены (v7). Обновление заменяет секцию до заголовка следующей. */

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
${panelSel(RANGE_PANELS)},
.filter-panel[data-panel="all"] {
  top: 0;
}

/* В панелях с чипсами пара кнопок — на 780 px это была пустая плашка. */
${panelSel(CHIP_PANELS)} {
  width: min(420px, calc(100vw - 42px));
}

/* Два поля «от/до» — тоже не на 780 px. */
${panelSel(RANGE_PANELS)} {
  width: min(460px, calc(100vw - 42px));
}

/* «Все фильтры» в одну колонку: в две поля «от/до» сжимались. */
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

/* На телефоне — во всю ширину тулбара. Селекторы панелей перечислены явно:
   иначе их width (выше) побеждал по специфичности и панель вылезала за край
   экрана. */
@media (max-width: 760px) {
  .filter-panel,
  ${panelSel([...RANGE_PANELS, 'all', ...CHIP_PANELS])} {
    left: 0;
    right: 0;
    width: auto;
  }
}

/* На телефоне поля «от/до» друг под другом. «—» и «м²» убираем: единица
   уже в заголовке группы. */
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

/* ---- Десктоп: комнатность, площадь и этаж строкой, без панелей ----
   Строку собирает скрипт из копий чипсов и полей диапазонов. На десктопе
   прячем кнопки этих панелей и «Все фильтры» (всё основное уже на виду; срок
   сдачи и вид из окна, если они есть у проекта, остаются своими кнопками). */
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

/* В строке поля стоят сами по себе, без общей рамки вокруг: рамка вокруг
   полей с рамками выглядела двойной. Ширина — под самую длинную подсказку:
   узбекское «234 gacha» в 104 px обрезалось. */
.filter-inline .range-box {
  min-height: 0;
  grid-template-columns: 120px auto 120px;
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

/* «м²» уже в подписи группы. */
.filter-inline .range-unit {
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
  .filter-trigger[data-panel="area"],
  .filter-trigger[data-panel="floor"],
  .filter-trigger[data-panel="all"] {
    display: none;
  }
}
`
