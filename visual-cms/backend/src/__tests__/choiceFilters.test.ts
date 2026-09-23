/**
 * Фильтры секции «Выбрать»: преобразование блока и обновление прежних версий.
 *
 * Поведение самого скрипта фильтров в браузере — в choiceFilters.runtime.test.ts.
 */
import {
  chevronTranslationFixes,
  migrateChoiceFilters,
  migrateFiltersCss,
  migrateFiltersJs,
  stripChevron,
} from '../scripts/choiceFilters'
import {
  FILTERS_CSS_MARKER,
  FILTERS_JS,
  FILTERS_JS_MARKER,
  FILTERS_JS_V1_START,
} from '../scripts/choiceFilters.assets'
import { MigrationError, StructureNode } from '../scripts/choiceToPlanTypes'

const PREFIX_JS = 'function bootTechnicalFeatures() {}\n\n'
const V1_JS = `${FILTERS_JS_V1_START}
   карточек. */
(function () {
  var section = document.getElementById('choice');
})();
`

function trigger(id: string, content: string): StructureNode {
  return { id, tagName: 'button', content, attributes: { class: 'filter-trigger', 'data-panel': id } }
}

function block(): StructureNode {
  return {
    id: 'root',
    tagName: 'section',
    metadata: { globalJs: PREFIX_JS + V1_JS, globalCss: '.filter-panel { display: none; }\n' },
    children: [
      {
        id: 'toolbar',
        attributes: { class: 'apartment-toolbar' },
        children: [
          trigger('rooms', 'Комнатность ⌄'),
          trigger('price', 'Цена ⌄'),
          { id: 'all', tagName: 'button', content: 'Все фильтры', attributes: { class: 'filter-trigger' } },
          { id: 'other', tagName: 'span', content: 'Прочее ⌄' },
        ],
      },
      {
        id: 'grid',
        attributes: { class: 'apartments-grid' },
        _repeat: { source: 'item.planTypes' },
        children: [
          {
            id: 'card',
            tagName: 'article',
            attributes: { class: 'apartment-card', 'data-price': '{{$.priceMin}}', 'data-rooms': '{{$.rooms}}' },
          },
        ],
      },
    ],
  }
}

function find(root: StructureNode, id: string): StructureNode {
  const stack = [root]
  while (stack.length) {
    const n = stack.pop()!
    if (n.id === id) return n
    stack.push(...(n.children ?? []))
  }
  throw new Error(id)
}

describe('stripChevron', () => {
  it('убирает символ ⌄ в конце вместе с пробелами', () => {
    expect(stripChevron('Комнатность ⌄')).toBe('Комнатность')
    expect(stripChevron('Narx ⌄ ')).toBe('Narx')
  })

  it('не трогает текст без символа и символ в середине', () => {
    expect(stripChevron('Все фильтры')).toBe('Все фильтры')
    expect(stripChevron('a ⌄ b')).toBe('a ⌄ b')
  })
})

describe('migrateChoiceFilters', () => {
  const result = migrateChoiceFilters(block())
  const out = result.structure

  it('карточка получает верхнюю границу цены', () => {
    expect(find(out, 'card').attributes!['data-price-max']).toBe('{{$.priceMax}}')
  })

  it('у кнопок фильтра символ ⌄ убран, чужие узлы не тронуты', () => {
    expect(find(out, 'rooms').content).toBe('Комнатность')
    expect(find(out, 'price').content).toBe('Цена')
    expect(find(out, 'all').content).toBe('Все фильтры')
    expect(find(out, 'other').content).toBe('Прочее ⌄')
  })

  it('скрипт фильтров заменён на v2, код до него сохранён', () => {
    const js = out.metadata!.globalJs as string
    expect(js.startsWith(PREFIX_JS)).toBe(true)
    expect(js).toContain(FILTERS_JS_MARKER)
    expect(js).not.toContain(FILTERS_JS_V1_START)
    expect(js.endsWith(FILTERS_JS)).toBe(true)
  })

  it('CSS дополнен один раз, исходный сохранён', () => {
    const css = out.metadata!.globalCss as string
    expect(css.startsWith('.filter-panel { display: none; }')).toBe(true)
    expect(css.split(FILTERS_CSS_MARKER)).toHaveLength(2)
  })

  it('перечисляет правки', () => {
    expect(result.alreadyMigrated).toBe(false)
    expect(result.changes.length).toBeGreaterThanOrEqual(5)
  })

  it('исходная структура не мутируется', () => {
    const input = block()
    const snapshot = JSON.stringify(input)
    migrateChoiceFilters(input)
    expect(JSON.stringify(input)).toBe(snapshot)
  })

  it('повторный запуск ничего не меняет', () => {
    const again = migrateChoiceFilters(out)
    expect(again.alreadyMigrated).toBe(true)
    expect(again.changes).toEqual([])
    expect(JSON.stringify(again.structure)).toBe(JSON.stringify(out))
  })

  it('без карточки с data-price — ошибка, а не тихий пропуск', () => {
    const broken = block()
    delete find(broken, 'card').attributes!['data-price']
    expect(() => migrateChoiceFilters(broken)).toThrow(MigrationError)
  })

  it('без globalJs — ошибка: это не тот блок', () => {
    const broken = block()
    broken.metadata = {}
    expect(() => migrateChoiceFilters(broken)).toThrow(MigrationError)
  })
})

describe('баннер «Оставить заявку»', () => {
  function withBanner(): StructureNode {
    const b = block()
    b.children!.push({
      id: 'banner',
      tagName: 'div',
      attributes: { id: 'choiceBanner', class: 'complex-banner' },
      children: [{ id: 'cta', tagName: 'a', attributes: { href: '#lead' }, content: 'Оставить заявку' }],
    })
    return b
  }

  it('убирается вместе с содержимым', () => {
    const out = migrateChoiceFilters(withBanner()).structure
    expect(() => find(out, 'banner')).toThrow()
    expect(() => find(out, 'cta')).toThrow()
    expect(find(out, 'grid')).toBeDefined()
  })

  it('без баннера — правки про баннер нет, повторный запуск ничего не меняет', () => {
    const once = migrateChoiceFilters(withBanner())
    expect(once.changes).toContain('баннер «Оставить заявку» над карточками убран')
    expect(migrateChoiceFilters(once.structure).alreadyMigrated).toBe(true)
  })
})

describe('migrateFiltersJs', () => {
  it('скрипт первой версии не найден — ошибка', () => {
    expect(() => migrateFiltersJs('var x = 1;', [])).toThrow(MigrationError)
  })

  it('после скрипта фильтров есть другой код — ошибка, чтобы его не отрезать', () => {
    expect(() => migrateFiltersJs(V1_JS + '\nconsole.log(1);\n', [])).toThrow(MigrationError)
  })

  it('текущая версия уже стоит — строка возвращается как есть', () => {
    const js = PREFIX_JS + FILTERS_JS
    const changes: string[] = []
    expect(migrateFiltersJs(js, changes)).toBe(js)
    expect(changes).toEqual([])
  })
})

describe('обновление с v2 (уже применённой на стенде) до текущей', () => {
  const V2_JS = `/* Фильтры квартир (#choice), v2. Работают по data-атрибутам. */
(function () {
  var old = 'v2';
})();
`
  const V2_CSS = `.filter-panel { display: none; }

/* ==== choice-filters v2 ====
   старая секция */
.apartment-toolbar { z-index: 20; }
`

  it('хвост JS v2 заменяется целиком, код до него сохранён', () => {
    const changes: string[] = []
    const js = migrateFiltersJs(PREFIX_JS + V2_JS, changes)
    expect(js).toBe(PREFIX_JS + FILTERS_JS)
    expect(js).not.toContain("var old = 'v2'")
    expect(changes).toHaveLength(1)
  })

  it('CSS-секция v2 заменяется, а не дописывается вторая', () => {
    const changes: string[] = []
    const css = migrateFiltersCss(V2_CSS, changes)
    expect(css.startsWith('.filter-panel { display: none; }')).toBe(true)
    expect(css).not.toContain('choice-filters v2')
    expect(css.split('/* ==== choice-filters')).toHaveLength(2)
    expect(css).toContain(FILTERS_CSS_MARKER)
    expect(changes).toHaveLength(1)
  })

  it('весь блок с v2 обновляется, повторный запуск ничего не меняет', () => {
    const v2 = block()
    v2.metadata = { globalJs: PREFIX_JS + V2_JS, globalCss: V2_CSS }
    const once = migrateChoiceFilters(v2)
    expect(once.alreadyMigrated).toBe(false)
    const twice = migrateChoiceFilters(once.structure)
    expect(twice.alreadyMigrated).toBe(true)
  })
})

describe('chevronTranslationFixes', () => {
  const structure = block()
  const rows = [
    { id: '1', nodeId: 'rooms', field: 'content', value: 'Xonalar soni ⌄' },
    { id: '2', nodeId: 'price', field: 'content', value: 'Narx ⌄' },
    { id: '3', nodeId: 'other', field: 'content', value: 'Boshqa ⌄' },
    { id: '4', nodeId: 'rooms', field: 'title', value: 'Xonalar ⌄' },
    { id: '5', nodeId: 'all', field: 'content', value: 'Barcha filtrlar' },
  ]

  it('чистит только content кнопок фильтра с символом', () => {
    expect(chevronTranslationFixes(structure, rows)).toEqual([
      { id: '1', before: 'Xonalar soni ⌄', after: 'Xonalar soni' },
      { id: '2', before: 'Narx ⌄', after: 'Narx' },
    ])
  })

  it('после миграции блока кнопки находятся так же', () => {
    const migrated = migrateChoiceFilters(block()).structure
    expect(chevronTranslationFixes(migrated, rows).map((f) => f.id)).toEqual(['1', '2'])
  })
})
