import { describe, it, expect } from 'vitest'
import type { BlockNode } from '@/shared/types'
import {
  applyNodeCss,
  cssPropertyName,
  formatNodeCss,
  parseNodeCss,
  readNodeCss,
  stylePropertyKey,
  type NodeCssScreen,
} from './nodeCss'
import { resolveScreenOverrides } from './screenOverrides'

const n = (id: string, overrides: Partial<BlockNode> = {}): BlockNode =>
  ({
    id,
    tagName: 'div',
    elementType: 'container',
    styles: { properties: {} },
    attributes: {},
    metadata: {},
    children: [],
    ...overrides,
  }) as BlockNode

const io = (entries: Record<string, any>) => ({ inheritedOverrides: entries })

// Порядок как в metadata страницы — не по ширине.
const standard = [
  { id: 'desktop-hd', name: 'Desktop HD', width: 1440 },
  { id: 'desktop-fhd', name: 'Desktop FHD', width: 1920 },
  { id: 'tablet', name: 'Tablet', width: 768 },
  { id: 'mobile', name: 'Mobile', width: 375 },
]

/**
 * page (tablet: promo → gap) ─ complexes ─ wrap (tablet: promo → display:grid — «чужая» запись)
 *                            └ promo (display:flex; gridTemplateColumns)
 */
const tree = (): BlockNode =>
  n('page', {
    variations: {
      tablet: io({ promo: { styles: { gap: '8px' } } }),
      mobile: io({ promo: { hidden: true } }),
    },
    children: [
      n('complexes', {
        children: [n('wrap', { variations: { tablet: io({ promo: { styles: { display: 'grid' } } }) } })],
      }),
      n('promo', { styles: { properties: { display: 'flex', gridTemplateColumns: '250px 1fr' } } }),
    ],
  })

const find = (root: BlockNode, id: string): BlockNode | null => {
  if (root.id === id) return root
  for (const child of root.children || []) {
    const found = find(child, id)
    if (found) return found
  }
  return null
}
const entry = (root: BlockNode, holderId: string, bp: string, targetId = 'promo') =>
  find(root, holderId)?.variations?.[bp]?.inheritedOverrides?.[targetId]

const screensOf = (root: BlockNode, id = 'promo'): NodeCssScreen[] => readNodeCss(root, id, standard).screens

describe('имена свойств', () => {
  it('camelCase ↔ kebab-case, вендорные префиксы', () => {
    expect(cssPropertyName('gridTemplateColumns')).toBe('grid-template-columns')
    expect(stylePropertyKey('grid-template-columns')).toBe('gridTemplateColumns')
    expect(cssPropertyName('WebkitBackdropFilter')).toBe('-webkit-backdrop-filter')
    expect(stylePropertyKey('-webkit-backdrop-filter')).toBe('WebkitBackdropFilter')
  })

  it('пользовательские свойства (--x) не меняются в обе стороны', () => {
    expect(cssPropertyName('--image')).toBe('--image')
    expect(stylePropertyKey('--image')).toBe('--image')
    expect(stylePropertyKey('--card-bg')).toBe('--card-bg')
  })
})

describe('readNodeCss', () => {
  it('основная версия и все экраны в порядке деплоя, с теми же условиями @media', () => {
    const model = readNodeCss(tree(), 'promo', standard)
    expect(model.base).toEqual({ display: 'flex', gridTemplateColumns: '250px 1fr' })
    expect(model.screens.map(s => [s.id, s.media, s.label])).toEqual([
      ['desktop-fhd', '(min-width: 1920px)', 'Desktop FHD (1920px)'],
      ['desktop-hd', '(max-width: 1919px)', 'Desktop HD (1440px)'],
      ['tablet', '(max-width: 1439px)', 'Tablet (768px)'],
      ['mobile', '(max-width: 767px)', 'Mobile (375px)'],
    ])
  })

  it('стили экрана — только его правки, без каскада; «чужие» записи учтены', () => {
    const [fhd, hd, tablet] = screensOf(tree())
    expect(fhd.styles).toEqual({})
    expect(hd.styles).toEqual({})
    expect(tablet.styles).toEqual({ gap: '8px', display: 'grid' })
  })

  it('скрытый на экране узел показывается как display: none', () => {
    expect(screensOf(tree())[3].styles).toEqual({ display: 'none' })
  })

  it('основная версия не смешивается с правками экрана', () => {
    expect(readNodeCss(tree(), 'promo', standard).base.display).toBe('flex')
  })

  it('корень и неизвестный узел — без экранов', () => {
    expect(readNodeCss(tree(), 'page', standard).screens).toEqual([])
    expect(readNodeCss(tree(), 'nope', standard)).toEqual({ base: {}, screens: [] })
  })

  it('элемент, добавленный для одного экрана, — только основные стили', () => {
    const root = n('page', {
      variations: { tablet: { specificChildren: [n('extra', { styles: { properties: { color: 'red' } } })] } } as any,
    })
    expect(readNodeCss(root, 'extra', standard)).toEqual({ base: { color: 'red' }, screens: [] })
  })

  it('пустые значения стилей пропускаются, числа приводятся к строке', () => {
    const root = n('page', {
      children: [n('a', { styles: { properties: { opacity: 1, color: '', gap: undefined } as any } })],
    })
    expect(readNodeCss(root, 'a', standard).base).toEqual({ opacity: '1' })
  })
})

describe('formatNodeCss', () => {
  it('основная версия сверху, затем блок @media на каждый экран (пустые тоже)', () => {
    expect(formatNodeCss(readNodeCss(tree(), 'promo', standard))).toBe(
      [
        '  display: flex;',
        '  grid-template-columns: 250px 1fr;',
        '',
        '/* Desktop FHD (1920px) */',
        '@media (min-width: 1920px) {',
        '}',
        '',
        '/* Desktop HD (1440px) */',
        '@media (max-width: 1919px) {',
        '}',
        '',
        '/* Tablet (768px) */',
        '@media (max-width: 1439px) {',
        '  gap: 8px;',
        '  display: grid;',
        '}',
        '',
        '/* Mobile (375px) */',
        '@media (max-width: 767px) {',
        '  display: none;',
        '}',
      ].join('\n'),
    )
  })

  it('узел без основных стилей — только блоки экранов; корень — только свойства', () => {
    const root = n('page', { styles: { properties: { color: 'red' } }, children: [n('a')] })
    expect(formatNodeCss(readNodeCss(root, 'a', standard)).startsWith('/* Desktop FHD')).toBe(true)
    expect(formatNodeCss(readNodeCss(root, 'page', standard))).toBe('  color: red;')
  })
})

describe('parseNodeCss', () => {
  const screens = screensOf(tree())

  it('текст formatNodeCss разбирается обратно в ту же модель', () => {
    const model = readNodeCss(tree(), 'promo', standard)
    const parsed = parseNodeCss(formatNodeCss(model), model.screens)
    expect(parsed.errors).toEqual([])
    expect(parsed.base).toEqual(model.base)
    expect(parsed.screens).toEqual(Object.fromEntries(model.screens.map(s => [s.id, s.styles])))
  })

  it('экран без блока в тексте — пустые стили (блок удалён)', () => {
    const parsed = parseNodeCss('color: red;', screens)
    expect(parsed.errors).toEqual([])
    expect(parsed.base).toEqual({ color: 'red' })
    expect(parsed.screens).toEqual({ 'desktop-fhd': {}, 'desktop-hd': {}, tablet: {}, mobile: {} })
  })

  it('условие экрана узнаётся при любых пробелах и регистре', () => {
    const parsed = parseNodeCss('@MEDIA ( max-width:1439px ){ gap: 4px }', screens)
    expect(parsed.errors).toEqual([])
    expect(parsed.screens.tablet).toEqual({ gap: '4px' })
  })

  it('блоки в любом порядке; свойства основной версии можно писать и после блоков', () => {
    const parsed = parseNodeCss(
      '@media (max-width: 767px) { color: blue; }\ncolor: red;\n@media (max-width: 1439px) { color: green; }\ngap: 1px;',
      screens,
    )
    expect(parsed.errors).toEqual([])
    expect(parsed.base).toEqual({ color: 'red', gap: '1px' })
    expect(parsed.screens.mobile).toEqual({ color: 'blue' })
    expect(parsed.screens.tablet).toEqual({ color: 'green' })
  })

  it('два блока одного экрана сливаются, поздний побеждает', () => {
    const parsed = parseNodeCss(
      '@media (max-width: 767px) { color: blue; gap: 1px; }\n@media (max-width: 767px) { color: red; }',
      screens,
    )
    expect(parsed.screens.mobile).toEqual({ color: 'red', gap: '1px' })
  })

  it('комментарии игнорируются; `;` в конце не обязателен; несколько свойств в строке', () => {
    const parsed = parseNodeCss('/* шапка */\ncolor: red; gap: 2px\n  width: 10px', screens)
    expect(parsed.errors).toEqual([])
    expect(parsed.base).toEqual({ color: 'red', gap: '2px', width: '10px' })
  })

  it('значения с `:` и `;` внутри url()/кавычек и многострочные значения не рвутся', () => {
    const parsed = parseNodeCss(
      [
        'background-image: url("data:image/svg+xml;base64,AAA=");',
        "content: 'a;b';",
        'background: linear-gradient(',
        '  red,',
        '  blue',
        ');',
        '--image: url(https://example.com/a.png);',
      ].join('\n'),
      screens,
    )
    expect(parsed.errors).toEqual([])
    expect(parsed.base.backgroundImage).toBe('url("data:image/svg+xml;base64,AAA=")')
    expect(parsed.base.content).toBe("'a;b'")
    expect(parsed.base.background).toBe('linear-gradient(\n  red,\n  blue\n)')
    expect(parsed.base['--image']).toBe('url(https://example.com/a.png)')
  })

  it('свойство без значения — как удалённая строка', () => {
    const parsed = parseNodeCss('color: ;\ngap: 2px;', screens)
    expect(parsed.errors).toEqual([])
    expect(parsed.base).toEqual({ gap: '2px' })
  })

  it('пустой текст — всё пусто, без ошибок', () => {
    expect(parseNodeCss('', screens)).toEqual({
      base: {},
      screens: { 'desktop-fhd': {}, 'desktop-hd': {}, tablet: {}, mobile: {} },
      errors: [],
    })
  })

  it('чужое условие @media — ошибка с перечнем экранов', () => {
    const parsed = parseNodeCss('@media (max-width: 900px) { color: red; }', screens)
    expect(parsed.errors).toHaveLength(1)
    expect(parsed.errors[0]).toContain('(max-width: 900px)')
    expect(parsed.errors[0]).toContain('(max-width: 1439px)')
  })

  it('строка без двоеточия, селектор, незакрытый блок — ошибки', () => {
    expect(parseNodeCss('color red', screens).errors[0]).toContain('color red')
    expect(parseNodeCss('.card { color: red; }', screens).errors[0]).toContain('Основная версия')
    expect(parseNodeCss('@media (max-width: 767px) { color: red;', screens).errors[0]).toContain('закрывающей')
    expect(parseNodeCss('@media (max-width: 767px)', screens).errors[0]).toContain('открывающей')
    expect(parseNodeCss('@media (max-width: 767px) { .a { color: red; } }', screens).errors[0]).toContain('Mobile')
  })

  it('у узла без экранов любой @media — ошибка', () => {
    const parsed = parseNodeCss('@media (max-width: 767px) { color: red; }', [])
    expect(parsed.errors[0]).toContain('нет экранных стилей')
  })
})

describe('applyNodeCss', () => {
  const parse = (root: BlockNode, text: string, id = 'promo') => {
    const parsed = parseNodeCss(text, screensOf(root, id))
    expect(parsed.errors).toEqual([])
    return parsed
  }

  it('текст без правок ничего не меняет, кроме сборки «чужих» записей к родителю', () => {
    const root = tree()
    const text = formatNodeCss(readNodeCss(root, 'promo', standard))
    const next = applyNodeCss(root, 'promo', parse(root, text))
    // «Чужая» запись переехала к родителю; вид узла на всех экранах прежний.
    expect(entry(next, 'wrap', 'tablet')).toBeUndefined()
    expect(entry(next, 'page', 'tablet')).toEqual({ styles: { gap: '8px', display: 'grid' } })
    for (const bp of standard) {
      expect(resolveScreenOverrides(next, bp.id, standard).get('promo')).toEqual(
        resolveScreenOverrides(root, bp.id, standard).get('promo'),
      )
    }
    expect(find(next, 'promo')).toBe(find(root, 'promo'))
  })

  it('совсем без изменений — тот же корень', () => {
    const root = n('page', {
      variations: { tablet: io({ a: { styles: { color: 'red' } } }) },
      children: [n('a', { styles: { properties: { gap: '1px' } } })],
    })
    const text = formatNodeCss(readNodeCss(root, 'a', standard))
    expect(applyNodeCss(root, 'a', parse(root, text, 'a'))).toBe(root)
  })

  it('основная версия заменяется целиком: удалённая строка исчезает', () => {
    const root = tree()
    const next = applyNodeCss(root, 'promo', parse(root, 'display: flex;'))
    expect(find(next, 'promo')!.styles.properties).toEqual({ display: 'flex' })
  })

  it('стили экрана заменяются целиком; другие экраны не затронуты', () => {
    const root = tree()
    const text = [
      'display: flex;',
      'grid-template-columns: 250px 1fr;',
      '@media (max-width: 1439px) { display: flex; }',
      '@media (max-width: 767px) { display: none; }',
    ].join('\n')
    const next = applyNodeCss(root, 'promo', parse(root, text))
    expect(entry(next, 'page', 'tablet')).toEqual({ styles: { display: 'flex' } })
    expect(entry(next, 'wrap', 'tablet')).toBeUndefined()
    expect(entry(next, 'page', 'mobile')).toEqual({ hidden: true })
    expect(find(next, 'promo')!.styles.properties).toEqual({ display: 'flex', gridTemplateColumns: '250px 1fr' })
  })

  it('новый блок экрана создаёт правку у родителя', () => {
    const root = n('page', { children: [n('box', { children: [n('leaf')] })] })
    const next = applyNodeCss(root, 'leaf', parse(root, '@media (max-width: 1919px) { color: red; }', 'leaf'))
    expect(entry(next, 'box', 'desktop-hd', 'leaf')).toEqual({ styles: { color: 'red' } })
    expect(find(next, 'page')!.variations).toBeUndefined()
  })

  it('опустевший блок удаляет правку; атрибуты правки сохраняются', () => {
    const root = n('page', {
      variations: {
        tablet: io({ a: { styles: { color: 'red' } }, b: { styles: { color: 'red' }, attributes: { src: '/t.png' } } }),
      },
      children: [n('a'), n('b')],
    })
    const afterA = applyNodeCss(root, 'a', parse(root, '', 'a'))
    expect(afterA.variations!.tablet.inheritedOverrides).toEqual({
      b: { styles: { color: 'red' }, attributes: { src: '/t.png' } },
    })
    const afterB = applyNodeCss(root, 'b', parseNodeCss('', screensOf(root, 'b')))
    expect(afterB.variations!.tablet.inheritedOverrides!.b).toEqual({ attributes: { src: '/t.png' } })
  })

  it('скрытый узел: строка display: none на месте — остаётся скрытым', () => {
    const root = tree()
    const text = '@media (max-width: 767px) { display: none; color: red; }'
    const next = applyNodeCss(root, 'promo', parse(root, text))
    expect(entry(next, 'page', 'mobile')).toEqual({ hidden: true, styles: { color: 'red' } })
  })

  it('скрытый узел: строку display: none убрали или заменили — скрытие снято', () => {
    const root = tree()
    const removed = applyNodeCss(root, 'promo', parse(root, '@media (max-width: 767px) { }'))
    expect(entry(removed, 'page', 'mobile')).toBeUndefined()

    const replaced = applyNodeCss(root, 'promo', parse(root, '@media (max-width: 767px) { display: block; }'))
    expect(entry(replaced, 'page', 'mobile')).toEqual({ styles: { display: 'block' } })
  })

  it('display: none у нескрытого узла — обычный стиль экрана', () => {
    const root = n('page', { children: [n('a')] })
    const next = applyNodeCss(root, 'a', parse(root, '@media (max-width: 767px) { display: none; }', 'a'))
    expect(entry(next, 'page', 'mobile', 'a')).toEqual({ styles: { display: 'none' } })
  })

  it('сброс свойства на экране пишется как обычное значение', () => {
    const root = tree()
    const next = applyNodeCss(root, 'promo', parse(root, 'display: flex;\n@media (max-width: 1439px) { grid-template-columns: revert; }'))
    expect(entry(next, 'page', 'tablet')).toEqual({ styles: { gridTemplateColumns: 'revert' } })
  })

  it('корень: пишутся только основные стили', () => {
    const root = n('page', { styles: { properties: { color: 'red' } }, children: [n('a')] })
    const next = applyNodeCss(root, 'page', { base: { color: 'blue' }, screens: {} })
    expect(next.styles.properties).toEqual({ color: 'blue' })
    expect(next.children[0]).toBe(root.children[0])
  })

  it('элемент одного экрана (specificChildren): основные стили пишутся, экраны игнорируются', () => {
    const root = n('page', {
      variations: { tablet: { specificChildren: [n('extra', { styles: { properties: { color: 'red' } } })] } } as any,
    })
    const next = applyNodeCss(root, 'extra', { base: { color: 'blue' }, screens: { tablet: { gap: '1px' } } })
    expect(next.variations!.tablet.specificChildren![0].styles.properties).toEqual({ color: 'blue' })
    expect(next.variations!.tablet.inheritedOverrides).toBeUndefined()
  })

  it('неизвестный узел — тот же корень; вход не мутируется', () => {
    const root = tree()
    const snapshot = JSON.stringify(root)
    expect(applyNodeCss(root, 'nope', { base: { color: 'red' }, screens: {} })).toBe(root)
    applyNodeCss(root, 'promo', parse(root, 'color: red;\n@media (max-width: 1439px) { color: blue; }'))
    expect(JSON.stringify(root)).toBe(snapshot)
  })

  it('полный круг: правка текста → дерево → тот же текст', () => {
    const root = tree()
    const text = [
      '  display: flex;',
      '  --image: url("/a.png");',
      '',
      '/* Desktop FHD (1920px) */',
      '@media (min-width: 1920px) {',
      '  gap: 40px;',
      '}',
      '',
      '/* Desktop HD (1440px) */',
      '@media (max-width: 1919px) {',
      '}',
      '',
      '/* Tablet (768px) */',
      '@media (max-width: 1439px) {',
      '  display: grid;',
      '  grid-template-columns: 1fr 1fr;',
      '}',
      '',
      '/* Mobile (375px) */',
      '@media (max-width: 767px) {',
      '  display: none;',
      '}',
    ].join('\n')
    const next = applyNodeCss(root, 'promo', parse(root, text))
    expect(formatNodeCss(readNodeCss(next, 'promo', standard))).toBe(text)
  })
})
