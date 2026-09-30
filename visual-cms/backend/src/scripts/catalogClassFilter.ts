/**
 * Каталог ЖК на главной (блок «Complexes»): рабочий фильтр по классу.
 *
 * Кнопки «Все / Комфорт / Бизнес / Премиум» и data-class у карточек были в
 * разметке, а скрипта не было: он остался в экспорте дизайна
 * (gh-export/bloks/complexes-section) и в мёртвом блоке «Complexes section», а
 * в рабочий блок при переносе не попал. Кнопки ничего не делали, а карточка
 * с курсором-«рукой» не открывалась по клику.
 *
 * Что делает миграция:
 * - скрипт блока: фильтр карточек по data-class, заголовок над видео — из
 *   data-title кнопки; кнопка класса без проектов спрятана (появится сама,
 *   когда в estate будет проект этого класса); клик по карточке — как по её
 *   ссылке «Подробнее»;
 * - CSS-секция блока: скрытые карточки и кнопки (не полагаемся на чужой CSS);
 * - у кнопок убираются data-video: в дизайне класс менял и видео, но там
 *   стояли стоковые демо-ролики mixkit с чужого CDN. Видео не меняется.
 *
 * Подписи data-title переводятся (TranslationService знает этот атрибут);
 * план переводов — catalogTitleTranslationPlan. Запись — в
 * `migrate-catalog-class-filter.ts`. Идемпотентно.
 */
import { MigrationError, MigrationResult, StructureNode, findAll, findOne, hasClass } from './choiceToPlanTypes'
import { upsertCssSection } from './complexMedia'

const JS_HEAD = '/* ==== catalog-class-filter'
export const CATALOG_FILTER_JS_MARKER = `${JS_HEAD} v1 ====`

export const CATALOG_FILTER_JS = `${CATALOG_FILTER_JS_MARKER}
   Каталог ЖК на главной: фильтр по классу (data-filter кнопки ↔ data-class
   карточки), заголовок над видео — data-title кнопки, клик по карточке —
   как по её ссылке. Класс без проектов — без кнопки. Видео не меняется. */
(function () {
  var filter = document.querySelector('.class-filter');
  if (!filter) return;
  var section = filter.closest('#complexes, .complexes-section') || document;
  var buttons = Array.prototype.slice.call(filter.querySelectorAll('button[data-filter]'));
  var cards = Array.prototype.slice.call(section.querySelectorAll('.project-card'));
  var title = section.querySelector('#complexesVideoTitle');
  var ALL = 'all';

  function classOf(card) {
    return (card.getAttribute('data-class') || '').trim();
  }

  /* Класс без проектов — без кнопки: пустой список выглядел бы поломкой.
     Кнопка вернётся сама, когда в estate появится проект этого класса. */
  buttons.forEach(function (button) {
    var value = button.getAttribute('data-filter');
    var used = cards.some(function (card) { return classOf(card) === value; });
    if (value !== ALL && !used) button.classList.add('is-empty');
  });

  function mark(button) {
    buttons.forEach(function (b) {
      var on = b === button;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function select(button) {
    var value = button.getAttribute('data-filter') || ALL;
    mark(button);
    cards.forEach(function (card) {
      card.classList.toggle('is-hidden', value !== ALL && classOf(card) !== value);
    });
    if (title && button.hasAttribute('data-title')) {
      var text = button.getAttribute('data-title') || '';
      title.textContent = text;
      title.hidden = !text;
    }
  }

  filter.addEventListener('click', function (event) {
    var button = event.target.closest('button[data-filter]');
    if (!button || !filter.contains(button) || button.classList.contains('is-empty')) return;
    select(button);
  });

  /* Вся карточка ведёт на страницу проекта — как её ссылка «Подробнее»:
     адрес один (уже с языком), и работают средства ссылки. */
  cards.forEach(function (card) {
    card.addEventListener('click', function (event) {
      if (event.target.closest('a, button')) return;
      var link = card.querySelector('a[href]');
      if (link) {
        link.click();
        return;
      }
      var href = card.getAttribute('data-href');
      if (href) window.location.href = href;
    });
  });

  /* Исходное состояние — «Все»: только отметка кнопки. Заголовок не трогаем:
     он уже на языке страницы. */
  var initial = filter.querySelector('button[data-filter].active') || buttons[0];
  if (initial) mark(initial);
})();
`

const CSS_HEAD = '/* ==== catalog-class-filter'
export const CATALOG_FILTER_CSS_MARKER = `${CSS_HEAD} v1 ====`
export const CATALOG_FILTER_CSS = `${CATALOG_FILTER_CSS_MARKER} */
/* Фильтр каталога по классу: скрытые карточки и кнопки класса без проектов. */
.project-card.is-hidden,
.class-filter button.is-empty {
  display: none;
}
`

/** Подписи заголовка над видео: ru (как в блоке) → другие языки сайта. */
export const TITLE_TRANSLATIONS: Record<string, { uz: string; en: string }> = {
  'Подборка всех проектов': { uz: 'Barcha loyihalar to‘plami', en: 'All projects' },
  'Проекты комфорт-класса': { uz: 'Komfort-klass loyihalari', en: 'Comfort-class projects' },
  'Бизнес-класс': { uz: 'Biznes-klass', en: 'Business class' },
  'Премиум проекты': { uz: 'Premium loyihalar', en: 'Premium projects' },
}

export interface FilterTitle {
  nodeId: string
  ru: string
}

export interface CatalogFilterResult extends MigrationResult {
  /** Кнопки с подписью заголовка: по ним заводятся переводы data-title. */
  titles: FilterTitle[]
}

export function migrateCatalogClassFilter(input: StructureNode): CatalogFilterResult {
  const structure: StructureNode = JSON.parse(JSON.stringify(input))
  const changes: string[] = []

  const filter = findOne(structure, (n) => hasClass(n, 'class-filter'), '.class-filter')
  const buttons = findAll(filter, (n) => n.tagName === 'button' && n.attributes?.['data-filter'] !== undefined)
  if (buttons.length === 0) throw new MigrationError('В .class-filter нет кнопок с data-filter')
  findOne(structure, (n) => hasClass(n, 'project-grid'), '.project-grid')

  for (const button of buttons) {
    if (button.attributes?.['data-video'] !== undefined) {
      delete button.attributes!['data-video']
      changes.push(`кнопка «${button.content}»: без демо-ролика data-video`)
    }
  }

  const metadata = (structure.metadata ??= {}) as Record<string, unknown>
  const js = typeof metadata.globalJs === 'string' ? metadata.globalJs : ''
  if (!js.includes(CATALOG_FILTER_JS_MARKER)) {
    const start = js.indexOf(JS_HEAD)
    const base = start === -1 ? js : js.slice(0, start)
    metadata.globalJs = (base.trim() ? base.trimEnd() + '\n\n' : '') + CATALOG_FILTER_JS
    changes.push('globalJs: фильтр по классу, заголовок над видео, клик по карточке')
  }
  if (upsertCssSection(metadata, CSS_HEAD, CATALOG_FILTER_CSS_MARKER, CATALOG_FILTER_CSS)) {
    changes.push('globalCss: скрытые карточки и кнопки пустых классов')
  }

  const titles = buttons
    .filter((b) => typeof b.attributes?.['data-title'] === 'string' && b.id)
    .map((b) => ({ nodeId: b.id!, ru: b.attributes!['data-title'] }))

  if (changes.length === 0) return { structure: input, changes, alreadyMigrated: true, titles }
  return { structure, changes, alreadyMigrated: false, titles }
}

/** Строка перевода страницы (pageId задаёт раннер). */
export interface PageTranslationRow {
  nodeId: string
  locale: string
  field: string
  value?: string
}

/**
 * Переводы data-title для страницы: языки — те, на которые страница уже
 * переводится; существующие строки не трогаются. Подпись без перевода в
 * словаре — в `missing` (на странице этого языка останется ru).
 */
export function catalogTitleTranslationPlan(
  titles: FilterTitle[],
  rows: PageTranslationRow[]
): { add: Array<Required<PageTranslationRow>>; missing: string[] } {
  const locales = [...new Set(rows.map((r) => r.locale))].sort()
  const exists = new Set(rows.map((r) => `${r.nodeId}|${r.locale}|${r.field}`))
  const add: Array<Required<PageTranslationRow>> = []
  const missing: string[] = []
  for (const { nodeId, ru } of titles) {
    const texts = TITLE_TRANSLATIONS[ru]
    if (!texts) {
      if (ru) missing.push(ru)
      continue
    }
    for (const locale of locales) {
      const value = texts[locale as keyof typeof texts]
      if (!value || exists.has(`${nodeId}|${locale}|data-title`)) continue
      add.push({ nodeId, locale, field: 'data-title', value })
    }
  }
  return { add, missing }
}
