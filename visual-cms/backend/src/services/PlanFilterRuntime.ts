/**
 * Фильтр карточек по данным в data-атрибутах.
 *
 * Задача не такая, как у обычного фильтра списка. Карточка на странице проекта
 * показывает ТИП ПЛАНИРОВКИ, а фильтруют покупатели по свойствам квартир: цена,
 * этаж, подъезд, вид из окон. Один тип объединяет десятки квартир, поэтому его
 * карточка несёт не значения, а диапазоны и множества:
 *
 *   data-price-min / data-price-max   диапазон цен квартир этого типа
 *   data-area-min  / data-area-max    диапазон площадей
 *   data-floors="3,4,7,12"            на каких этажах встречается
 *   data-views="двор|бульвар"         какие виды из окон бывают
 *
 * Правило показа: планировка видна, если ХОТЯ БЫ ОДНА её квартира проходит
 * фильтр. Для диапазона это пересечение отрезков, для множества — непустое
 * пересечение. Обычное сравнение «значение равно значению» здесь дало бы
 * пустую выдачу на любом фильтре.
 *
 * Контракт разметки:
 *   [data-filter-root]                   контейнер (в нём и карточки, и элементы управления)
 *   [data-filter-item]                   карточка
 *   [data-filter-chip][data-filter-field][data-filter-value]   чипс-переключатель
 *   input[data-filter-field][data-filter-bound="min|max"]      границы диапазона
 *   [data-filter-reset]                  сброс
 *   [data-filter-count]                  счётчик найденного
 *   [data-filter-empty]                  заглушка «ничего не найдено»
 *
 * Как поле сравнивается, задаётся на элементе управления:
 *   data-filter-op="set"     пересечение множеств (этажи, виды, подъезды)
 *   data-filter-op="range"   пересечение диапазонов (цена, площадь)
 *   без атрибута             равенство скаляру (комнатность)
 *
 * Инжектится генератором, как рантайм карусели, и только когда на странице
 * есть [data-filter-root]: обычные страницы лишний скрипт не тащат.
 */

/** Есть ли на странице то, что этот рантайм обслуживает. */
export function hasPlanFilters(bodyHtml: string): boolean {
  return bodyHtml.includes('data-filter-root')
}

const RUNTIME = `
<script>
(function () {
  'use strict';

  var ACTIVE_CLASS = 'is-active';

  function num(value) {
    if (value === null || value === undefined || value === '') return null;
    var n = Number(String(value).replace(/\\s/g, '').replace(',', '.'));
    return isFinite(n) ? n : null;
  }

  /** Список из атрибута: «3,4,7» или «двор|бульвар». Пустые элементы отбрасываем. */
  function list(value) {
    if (!value) return [];
    return String(value).split(/[|,]/).map(function (part) {
      return part.trim();
    }).filter(function (part) {
      return part !== '';
    });
  }

  /**
   * Пересечение отрезков.
   *
   * Открытая граница означает «без ограничения», а не ноль: пустое поле «до»
   * не должно отсекать всё дороже нуля.
   */
  function rangesOverlap(itemMin, itemMax, wantMin, wantMax) {
    if (wantMin !== null && itemMax !== null && itemMax < wantMin) return false;
    if (wantMax !== null && itemMin !== null && itemMin > wantMax) return false;
    return true;
  }

  function intersects(itemValues, wanted) {
    for (var i = 0; i < wanted.length; i++) {
      if (itemValues.indexOf(wanted[i]) !== -1) return true;
    }
    return false;
  }

  /** Атрибуты карточки для поля: сначала пара min/max, иначе одиночный. */
  function itemAttr(item, field, suffix) {
    return item.getAttribute('data-' + field + (suffix ? '-' + suffix : ''));
  }

  function matches(item, state) {
    for (var field in state) {
      if (!Object.prototype.hasOwnProperty.call(state, field)) continue;
      var filter = state[field];

      if (filter.op === 'range') {
        if (filter.min === null && filter.max === null) continue;
        var itemMin = num(itemAttr(item, field, 'min'));
        var itemMax = num(itemAttr(item, field, 'max'));
        // Карточка без диапазона по этому полю ничего не утверждает —
        // прятать её было бы догадкой, а не фильтрацией.
        if (itemMin === null && itemMax === null) continue;
        if (!rangesOverlap(itemMin, itemMax, filter.min, filter.max)) return false;
        continue;
      }

      if (!filter.values || filter.values.length === 0) continue;
      var itemValues = list(itemAttr(item, field));
      if (itemValues.length === 0) return false;
      if (!intersects(itemValues, filter.values)) return false;
    }
    return true;
  }

  function collectState(root) {
    var state = {};

    var chips = root.querySelectorAll('[data-filter-chip][data-filter-field]');
    for (var i = 0; i < chips.length; i++) {
      var chip = chips[i];
      var field = chip.getAttribute('data-filter-field');
      if (!field) continue;
      if (!state[field]) {
        state[field] = { op: chip.getAttribute('data-filter-op') || 'set', values: [] };
      }
      if (chip.classList.contains(ACTIVE_CLASS)) {
        var value = (chip.getAttribute('data-filter-value') || '').trim();
        // Чипс без значения — это «Все»: он ничего не добавляет в фильтр.
        if (value !== '') state[field].values.push(value);
      }
    }

    var inputs = root.querySelectorAll('input[data-filter-field][data-filter-bound]');
    for (var j = 0; j < inputs.length; j++) {
      var input = inputs[j];
      var rangeField = input.getAttribute('data-filter-field');
      if (!rangeField) continue;
      if (!state[rangeField] || state[rangeField].op !== 'range') {
        state[rangeField] = { op: 'range', min: null, max: null };
      }
      var bound = input.getAttribute('data-filter-bound');
      var parsed = num(input.value);
      if (bound === 'min') state[rangeField].min = parsed;
      else if (bound === 'max') state[rangeField].max = parsed;
    }

    return state;
  }

  function apply(root) {
    var state = collectState(root);
    var items = root.querySelectorAll('[data-filter-item]');
    var visible = 0;

    for (var i = 0; i < items.length; i++) {
      var ok = matches(items[i], state);
      // hidden, а не style.display: карточка может быть flex или grid-ячейкой,
      // и восстанавливать её исходный display пришлось бы угадыванием.
      items[i].hidden = !ok;
      if (ok) visible++;
    }

    var counters = root.querySelectorAll('[data-filter-count]');
    for (var c = 0; c < counters.length; c++) counters[c].textContent = String(visible);

    var empties = root.querySelectorAll('[data-filter-empty]');
    for (var e = 0; e < empties.length; e++) empties[e].hidden = visible !== 0;

    root.setAttribute('data-filter-visible', String(visible));
    root.dispatchEvent(new CustomEvent('planfilter:change', {
      bubbles: true,
      detail: { visible: visible, total: items.length, state: state }
    }));
  }

  /**
   * Переключение чипса.
   *
   * Чипс без значения работает как «Все»: гасит остальные в своей группе.
   * Выбор конкретного значения, наоборот, гасит «Все» — иначе «Все» и «2
   * комнаты» одновременно активны, и непонятно, что показано.
   */
  function toggleChip(root, chip) {
    var field = chip.getAttribute('data-filter-field');
    var value = (chip.getAttribute('data-filter-value') || '').trim();
    var group = root.querySelectorAll('[data-filter-chip][data-filter-field="' + field + '"]');
    var single = chip.getAttribute('data-filter-multiple') !== 'true';

    if (value === '') {
      for (var i = 0; i < group.length; i++) group[i].classList.remove(ACTIVE_CLASS);
      chip.classList.add(ACTIVE_CLASS);
      return;
    }

    if (single) {
      for (var j = 0; j < group.length; j++) {
        if (group[j] !== chip) group[j].classList.remove(ACTIVE_CLASS);
      }
      chip.classList.toggle(ACTIVE_CLASS);
    } else {
      chip.classList.toggle(ACTIVE_CLASS);
      for (var k = 0; k < group.length; k++) {
        if ((group[k].getAttribute('data-filter-value') || '').trim() === '') {
          group[k].classList.remove(ACTIVE_CLASS);
        }
      }
    }

    // Ни одного выбранного — возвращаем «Все», иначе группа выглядит выключенной.
    var anyActive = false;
    for (var m = 0; m < group.length; m++) {
      if (group[m].classList.contains(ACTIVE_CLASS)) anyActive = true;
    }
    if (!anyActive) {
      for (var n = 0; n < group.length; n++) {
        if ((group[n].getAttribute('data-filter-value') || '').trim() === '') {
          group[n].classList.add(ACTIVE_CLASS);
        }
      }
    }
  }

  function reset(root) {
    var chips = root.querySelectorAll('[data-filter-chip][data-filter-field]');
    for (var i = 0; i < chips.length; i++) {
      var value = (chips[i].getAttribute('data-filter-value') || '').trim();
      chips[i].classList.toggle(ACTIVE_CLASS, value === '');
    }
    var inputs = root.querySelectorAll('input[data-filter-field][data-filter-bound]');
    for (var j = 0; j < inputs.length; j++) inputs[j].value = '';
  }

  function init(root) {
    if (root.getAttribute('data-filter-ready') === 'true') return;
    root.setAttribute('data-filter-ready', 'true');

    root.addEventListener('click', function (event) {
      var chip = event.target.closest ? event.target.closest('[data-filter-chip]') : null;
      if (chip && root.contains(chip)) {
        event.preventDefault();
        toggleChip(root, chip);
        apply(root);
        return;
      }
      var resetButton = event.target.closest ? event.target.closest('[data-filter-reset]') : null;
      if (resetButton && root.contains(resetButton)) {
        event.preventDefault();
        reset(root);
        apply(root);
      }
    });

    root.addEventListener('input', function (event) {
      var input = event.target;
      if (input && input.hasAttribute && input.hasAttribute('data-filter-bound')) apply(root);
    });

    root.addEventListener('change', function (event) {
      var input = event.target;
      if (input && input.hasAttribute && input.hasAttribute('data-filter-bound')) apply(root);
    });

    apply(root);
  }

  function initAll() {
    var roots = document.querySelectorAll('[data-filter-root]');
    for (var i = 0; i < roots.length; i++) init(roots[i]);
  }

  window.ghPlanFilter = { init: init, initAll: initAll, apply: apply, reset: reset };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
</script>`

/**
 * Скрипт фильтра для страницы. Пустая строка, если фильтровать нечего:
 * обычные страницы сайта лишний рантайм не тащат.
 */
export function generatePlanFilterRuntime(bodyHtml: string): string {
  return hasPlanFilters(bodyHtml) ? RUNTIME : ''
}
