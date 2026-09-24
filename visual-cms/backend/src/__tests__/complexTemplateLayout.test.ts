/**
 * Раскладка шаблона страницы проекта на планшете и телефоне: встроенные
 * колонки и flex убраны из блоков, узкие экраны — переопределениями
 * брейкпоинтов CMS на странице шаблона.
 */
import { MigrationError, StructureNode } from '../scripts/choiceToPlanTypes'
import {
  EDITOR_PLACEHOLDER_BORDER,
  InstanceLayout,
  layoutTemplatePage,
  restoreStatsGrid,
  stripRootColumns,
} from '../scripts/complexTemplateLayout'
import { styleGenerator } from '../services/StyleGenerator'

const BREAKPOINTS = [
  { id: 'desktop-hd', name: 'Desktop HD', width: 1440 },
  { id: 'desktop-fhd', name: 'Desktop FHD', width: 1920 },
  { id: 'tablet', name: 'Tablet', width: 768 },
  { id: 'mobile', name: 'Mobile', width: 375 },
]

function section(): StructureNode {
  return {
    id: 'hall-root',
    tagName: 'section',
    attributes: { class: 'detail-section gallery-row' },
    styles: { properties: { display: 'grid', gridTemplateRows: 'auto', gridTemplateColumns: 'repeat(2, 1fr)' } },
    children: [{ id: 'card', attributes: { class: 'media-card' }, styles: { properties: {} }, children: [] }],
  }
}

function stats(): StructureNode {
  return {
    id: 'stats-root',
    tagName: 'section',
    attributes: { class: 'stats-row' },
    styles: {
      properties: { gap: '8px', display: 'flex', marginTop: '40px', justifyItems: 'center', justifyContent: 'space-around' },
    },
    children: [
      {
        id: 'stat',
        attributes: { class: 'stat-item' },
        _repeat: { source: 'item.stats' },
        styles: {
          properties: { width: '100%', display: 'grid', gridTemplateRows: 'auto', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' },
        },
        children: [],
      },
    ],
  }
}

const instance = (id: string, blockId: string): StructureNode => ({
  id,
  tagName: 'section',
  metadata: { linkedBlockId: blockId },
  styles: { properties: {} },
  children: [],
})

/** Страница шаблона: корень с рамкой-заглушкой, в нём контейнер с экземплярами блоков. */
function page(): StructureNode {
  return {
    id: 'root',
    tagName: 'div',
    metadata: { breakpoints: BREAKPOINTS },
    styles: { properties: { display: 'flex', border: EDITOR_PLACEHOLDER_BORDER, minWidth: '200px' } },
    variations: { 'desktop-hd': { inheritedOverrides: { main: { styles: { maxWidth: '90vw' } } } } },
    children: [
      {
        id: 'main',
        tagName: 'section',
        styles: { properties: { display: 'flex' } },
        variations: { mobile: { inheritedOverrides: { 'inst-hall': { styles: { padding: '8px' } } } } },
        children: [instance('inst-stats', 'b-stats'), instance('inst-hall', 'b-hall'), instance('inst-lead', 'b-lead')],
      },
    ],
  }
}

const STACKED = { tablet: { gridTemplateColumns: '1fr' }, mobile: { gridTemplateColumns: '1fr' } }
const PLAN: InstanceLayout[] = [
  { blockId: 'b-hall', label: 'Холлы', overrides: STACKED },
  { blockId: 'b-lead', label: 'Заявка', overrides: STACKED },
  { blockId: 'b-stats', label: 'Параметры', overrides: { tablet: { gridTemplateColumns: 'repeat(2, 1fr)' }, mobile: { gridTemplateColumns: '1fr' } } },
]

const overridesOf = (root: StructureNode, parentId: string) => {
  const stack = [root]
  while (stack.length) {
    const n = stack.pop()!
    if (n.id === parentId) return n.variations as Record<string, { inheritedOverrides: Record<string, { styles: Record<string, string> }> }>
    stack.push(...(n.children ?? []))
  }
  throw new Error(parentId)
}

describe('stripRootColumns', () => {
  const result = stripRootColumns(section(), 'Холлы')

  it('убирает только встроенные колонки, прочие стили остаются', () => {
    expect(result.structure.styles!.properties).toEqual({ display: 'grid', gridTemplateRows: 'auto' })
    expect(result.changes).toEqual(['Холлы: убраны встроенные колонки (gridTemplateColumns: repeat(2, 1fr))'])
  })

  it('повторный запуск ничего не меняет, вход не мутируется', () => {
    expect(stripRootColumns(result.structure, 'Холлы').alreadyMigrated).toBe(true)
    const input = section()
    const snapshot = JSON.stringify(input)
    stripRootColumns(input, 'Холлы')
    expect(JSON.stringify(input)).toBe(snapshot)
  })
})

describe('restoreStatsGrid', () => {
  const result = restoreStatsGrid(stats(), 'Параметры')

  it('строка теряет встроенный flex — работает сетка дизайна; отступ сверху остаётся', () => {
    expect(result.structure.styles!.properties).toEqual({ marginTop: '40px' })
  })

  it('плашка теряет встроенную сетку с минимумом 200px, ширина остаётся', () => {
    expect(result.structure.children![0].styles!.properties).toEqual({ width: '100%' })
    expect(result.structure.children![0]._repeat).toEqual({ source: 'item.stats' })
  })

  it('повторный запуск ничего не меняет', () => {
    expect(restoreStatsGrid(result.structure, 'Параметры').alreadyMigrated).toBe(true)
  })

  it('чужой блок или блок без плашки — ошибка', () => {
    expect(() => restoreStatsGrid(section(), 'Параметры')).toThrow(MigrationError)
    const noItem = stats()
    noItem.children = []
    expect(() => restoreStatsGrid(noItem, 'Параметры')).toThrow(MigrationError)
  })
})

describe('layoutTemplatePage', () => {
  const result = layoutTemplatePage(page(), PLAN)
  const main = overridesOf(result.structure, 'main')

  it('переопределения ставятся у родителя экземпляра, по id экземпляра, на Tablet и Mobile', () => {
    expect(main.tablet.inheritedOverrides['inst-hall'].styles).toEqual({ gridTemplateColumns: '1fr' })
    expect(main.tablet.inheritedOverrides['inst-lead'].styles).toEqual({ gridTemplateColumns: '1fr' })
    expect(main.tablet.inheritedOverrides['inst-stats'].styles).toEqual({ gridTemplateColumns: 'repeat(2, 1fr)' })
    expect(main.mobile.inheritedOverrides['inst-stats'].styles).toEqual({ gridTemplateColumns: '1fr' })
  })

  it('существующие переопределения сохраняются — дописываем, а не затираем', () => {
    expect(main.mobile.inheritedOverrides['inst-hall'].styles).toEqual({ padding: '8px', gridTemplateColumns: '1fr' })
    expect(overridesOf(result.structure, 'root')['desktop-hd'].inheritedOverrides.main.styles).toEqual({ maxWidth: '90vw' })
  })

  it('рамка-заглушка редактора снята с корня, прочие стили корня на месте', () => {
    expect(result.structure.styles!.properties).toEqual({ display: 'flex', minWidth: '200px' })
  })

  it('настоящая рамка корня (не заглушка) не трогается', () => {
    const custom = page()
    custom.styles!.properties!.border = '1px solid red'
    expect(layoutTemplatePage(custom, PLAN).structure.styles!.properties!.border).toBe('1px solid red')
  })

  it('генератор CSS выводит правила в @media брейкпоинтов по id экземпляра', () => {
    const css = styleGenerator.generateResponsiveCSS(result.structure as never)
    expect(css).toMatch(/@media \(max-width: 1439px\) \{[^}]*\[data-element-id="inst-hall"\] \{ grid-template-columns: 1fr !important \}/)
    expect(css).toMatch(/@media \(max-width: 767px\) \{[^@]*\[data-element-id="inst-stats"\] \{ grid-template-columns: 1fr !important \}/)
  })

  it('повторный запуск ничего не меняет, вход не мутируется', () => {
    expect(layoutTemplatePage(result.structure, PLAN).alreadyMigrated).toBe(true)
    const input = page()
    const snapshot = JSON.stringify(input)
    layoutTemplatePage(input, PLAN)
    expect(JSON.stringify(input)).toBe(snapshot)
  })

  it('каждый экземпляр блока на странице получает свои переопределения', () => {
    const twice = page()
    twice.children![0].children!.push(instance('inst-hall-2', 'b-hall'))
    const main2 = overridesOf(layoutTemplatePage(twice, PLAN).structure, 'main')
    expect(main2.tablet.inheritedOverrides['inst-hall-2'].styles).toEqual({ gridTemplateColumns: '1fr' })
  })

  it('блока нет на странице или нет брейкпоинта — ошибка, а не тихий пропуск', () => {
    expect(() => layoutTemplatePage(page(), [{ blockId: 'b-none', label: 'X', overrides: STACKED }])).toThrow(MigrationError)
    expect(() => layoutTemplatePage(page(), [{ blockId: 'b-hall', label: 'X', overrides: { laptop: { gap: '0' } } }])).toThrow(MigrationError)
  })
})
