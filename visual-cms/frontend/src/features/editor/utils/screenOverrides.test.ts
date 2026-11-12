import { describe, it, expect } from 'vitest'
import type { BlockNode } from '@/shared/types'
import { adoptStrayOverrides, mergeScreenOverride, resolveScreenOverrides } from './screenOverrides'

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

const standard = [
  { id: 'desktop-hd', width: 1440 },
  { id: 'desktop-fhd', width: 1920 },
  { id: 'tablet', width: 768 },
  { id: 'mobile', width: 375 },
]

/**
 * Реальный случай (Main page, секция «Акции и поддержка»): правку секции
 * `promo` держит элемент ДРУГОГО блока (`wrap` внутри `complexes`), не родитель.
 *
 * page
 * ├─ complexes ─ wrap   (wrap держит tablet-правку для promo — «чужая»)
 * └─ promo ─ head ─ grid
 */
const realCase = (): BlockNode =>
  n('page', {
    children: [
      n('complexes', {
        children: [n('wrap', { variations: { tablet: io({ promo: { styles: { display: 'grid' } } }) } })],
      }),
      n('promo', {
        styles: { properties: { display: 'flex', gridTemplateColumns: '250px 1fr' } },
        children: [n('head', { children: [n('grid')] })],
      }),
    ],
  })

describe('mergeScreenOverride — каскад двух правил деплоя', () => {
  it('поздние стили перебивают ранние по свойствам', () => {
    expect(
      mergeScreenOverride({ styles: { color: 'red', gap: '4px' } }, { styles: { color: 'blue' } }),
    ).toEqual({ styles: { color: 'blue', gap: '4px' } })
  })

  it('пустые значения ничего не перебивают (деплой их не эмитит)', () => {
    expect(
      mergeScreenOverride({ styles: { color: 'red' } }, { styles: { color: '', gap: undefined } as any }),
    ).toEqual({ styles: { color: 'red' } })
  })

  it('hidden прячет узел; стили скрывающей записи игнорируются', () => {
    expect(
      mergeScreenOverride({ styles: { color: 'red' } }, { hidden: true, styles: { color: 'blue' } }),
    ).toEqual({ hidden: true, styles: { color: 'red' } })
  })

  it('поздний display возвращает скрытый узел, прочие стили — нет', () => {
    expect(mergeScreenOverride({ hidden: true }, { styles: { display: 'flex' } })).toEqual({
      styles: { display: 'flex' },
    })
    expect(mergeScreenOverride({ hidden: true }, { styles: { color: 'red' } })).toEqual({
      hidden: true,
      styles: { color: 'red' },
    })
  })

  it('атрибуты сливаются, content берётся поздний', () => {
    expect(
      mergeScreenOverride(
        { attributes: { src: '/a.png', alt: 'a' }, content: 'old' },
        { attributes: { src: '/b.png' }, content: 'new' },
      ),
    ).toEqual({ attributes: { src: '/b.png', alt: 'a' }, content: 'new' })
  })

  it('не мутирует входы', () => {
    const acc = { styles: { color: 'red' } }
    const next = { styles: { color: 'blue' } }
    mergeScreenOverride(acc, next)
    expect(acc).toEqual({ styles: { color: 'red' } })
    expect(next).toEqual({ styles: { color: 'blue' } })
  })
})

describe('resolveScreenOverrides — как деплой', () => {
  it('«чужая» запись (держит не родитель) действует', () => {
    const resolved = resolveScreenOverrides(realCase(), 'tablet', standard)
    expect(resolved.get('promo')).toEqual({ styles: { display: 'grid' } })
  })

  it('планшетная правка доходит до телефона, но не до Desktop HD', () => {
    expect(resolveScreenOverrides(realCase(), 'mobile', standard).get('promo')).toEqual({
      styles: { display: 'grid' },
    })
    expect(resolveScreenOverrides(realCase(), 'desktop-hd', standard).has('promo')).toBe(false)
    expect(resolveScreenOverrides(realCase(), 'desktop-fhd', standard).has('promo')).toBe(false)
  })

  it('более узкий экран перебивает то же свойство, остальные наследует', () => {
    const root = n('page', {
      variations: {
        'desktop-hd': io({ a: { styles: { color: 'red', gap: '10px' } } }),
        tablet: io({ a: { styles: { color: 'green' } } }),
        mobile: io({ a: { styles: { color: 'blue' } } }),
      },
      children: [n('a')],
    })
    expect(resolveScreenOverrides(root, 'desktop-hd', standard).get('a')).toEqual({
      styles: { color: 'red', gap: '10px' },
    })
    expect(resolveScreenOverrides(root, 'tablet', standard).get('a')).toEqual({
      styles: { color: 'green', gap: '10px' },
    })
    expect(resolveScreenOverrides(root, 'mobile', standard).get('a')).toEqual({
      styles: { color: 'blue', gap: '10px' },
    })
  })

  it('правки FHD не попадают на более узкие экраны', () => {
    const root = n('page', {
      variations: { 'desktop-fhd': io({ a: { hidden: true } }) },
      children: [n('a')],
    })
    expect(resolveScreenOverrides(root, 'desktop-fhd', standard).get('a')).toEqual({ hidden: true })
    expect(resolveScreenOverrides(root, 'desktop-hd', standard).has('a')).toBe(false)
    expect(resolveScreenOverrides(root, 'mobile', standard).has('a')).toBe(false)
  })

  it('внутри одного экрана побеждает запись, встреченная позже по обходу дерева', () => {
    // Родитель (page) обходится раньше, «чужой» держатель (deep) — позже.
    const root = n('page', {
      variations: { tablet: io({ target: { styles: { display: 'flex', color: 'red' } } }) },
      children: [
        n('target'),
        n('box', { children: [n('deep', { variations: { tablet: io({ target: { styles: { display: 'grid' } } }) } })] }),
      ],
    })
    expect(resolveScreenOverrides(root, 'tablet', standard).get('target')).toEqual({
      styles: { display: 'grid', color: 'red' },
    })
  })

  it('скрытие на планшете действует и на телефоне; display на телефоне возвращает узел', () => {
    const hidden = n('page', { variations: { tablet: io({ a: { hidden: true } }) }, children: [n('a')] })
    expect(resolveScreenOverrides(hidden, 'mobile', standard).get('a')?.hidden).toBe(true)

    const shownAgain = n('page', {
      variations: {
        tablet: io({ a: { hidden: true } }),
        mobile: io({ a: { styles: { display: 'block' } } }),
      },
      children: [n('a')],
    })
    expect(resolveScreenOverrides(shownAgain, 'mobile', standard).get('a')).toEqual({
      styles: { display: 'block' },
    })
    expect(resolveScreenOverrides(shownAgain, 'tablet', standard).get('a')).toEqual({ hidden: true })
  })

  it('записи внутри specificChildren своего экрана учитываются', () => {
    const root = n('page', {
      variations: {
        tablet: {
          specificChildren: [n('extra', { variations: { tablet: io({ a: { styles: { color: 'red' } } }) } })],
        },
      } as any,
      children: [n('a')],
    })
    expect(resolveScreenOverrides(root, 'tablet', standard).get('a')).toEqual({ styles: { color: 'red' } })
  })

  it('без списка breakpoints — только свой экран, но по всему дереву', () => {
    expect(resolveScreenOverrides(realCase(), 'tablet').get('promo')).toEqual({ styles: { display: 'grid' } })
    expect(resolveScreenOverrides(realCase(), 'mobile').has('promo')).toBe(false)
  })

  it('дерево без вариаций и узлы без children — пустой результат без падения', () => {
    const bare = { id: 'root', tagName: 'div', children: [{ id: 'leaf', tagName: 'span' }] } as unknown as BlockNode
    expect(resolveScreenOverrides(bare, 'mobile', standard).size).toBe(0)
  })
})

describe('adoptStrayOverrides — сборка записей узла к родителю', () => {
  const find = (root: BlockNode, id: string): BlockNode | null => {
    if (root.id === id) return root
    for (const child of root.children || []) {
      const found = find(child, id)
      if (found) return found
    }
    return null
  }
  const entry = (root: BlockNode, holderId: string, bp: string, targetId: string) =>
    find(root, holderId)?.variations?.[bp]?.inheritedOverrides?.[targetId]

  it('«чужая» запись переезжает к родителю, у держателя исчезает', () => {
    const next = adoptStrayOverrides(realCase(), 'promo', 'tablet')
    expect(entry(next, 'page', 'tablet', 'promo')).toEqual({ styles: { display: 'grid' } })
    expect(entry(next, 'wrap', 'tablet', 'promo')).toBeUndefined()
  })

  it('вид узла после сборки не меняется', () => {
    const before = resolveScreenOverrides(realCase(), 'tablet', standard).get('promo')
    const after = resolveScreenOverrides(adoptStrayOverrides(realCase(), 'promo', 'tablet'), 'tablet', standard).get('promo')
    expect(after).toEqual(before)
  })

  it('запись родителя и «чужая» сливаются в порядке деплоя (поздняя побеждает)', () => {
    const root = n('page', {
      variations: { tablet: io({ target: { styles: { display: 'flex', color: 'red' } } }) },
      children: [
        n('target'),
        n('deep', { variations: { tablet: io({ target: { styles: { display: 'grid' } }, other: { hidden: true } }) } }),
      ],
    })
    const next = adoptStrayOverrides(root, 'target', 'tablet')
    expect(entry(next, 'page', 'tablet', 'target')).toEqual({ styles: { display: 'grid', color: 'red' } })
    expect(entry(next, 'deep', 'tablet', 'target')).toBeUndefined()
    // Чужие записи ДРУГИХ узлов не трогаем.
    expect(entry(next, 'deep', 'tablet', 'other')).toEqual({ hidden: true })
  })

  it('несколько «чужих» держателей — остаётся одна запись у родителя', () => {
    const root = n('page', {
      children: [
        n('a', { variations: { mobile: io({ target: { styles: { color: 'red' } } }) } }),
        n('parent', { children: [n('target')] }),
        n('b', { variations: { mobile: io({ target: { hidden: true } }) } }),
      ],
    })
    const next = adoptStrayOverrides(root, 'target', 'mobile')
    expect(entry(next, 'parent', 'mobile', 'target')).toEqual({ hidden: true, styles: { color: 'red' } })
    expect(entry(next, 'a', 'mobile', 'target')).toBeUndefined()
    expect(entry(next, 'b', 'mobile', 'target')).toBeUndefined()
  })

  it('другие экраны не затрагиваются', () => {
    const root = realCase()
    find(root, 'wrap')!.variations!.mobile = io({ promo: { styles: { display: 'block' } } })
    const next = adoptStrayOverrides(root, 'promo', 'tablet')
    expect(entry(next, 'wrap', 'mobile', 'promo')).toEqual({ styles: { display: 'block' } })
    expect(entry(next, 'page', 'mobile', 'promo')).toBeUndefined()
  })

  it('«чужих» записей нет — возвращает тот же корень', () => {
    const root = n('page', {
      variations: { tablet: io({ a: { styles: { color: 'red' } } }) },
      children: [n('a')],
    })
    expect(adoptStrayOverrides(root, 'a', 'tablet')).toBe(root)
    expect(adoptStrayOverrides(root, 'a', 'mobile')).toBe(root)
    expect(adoptStrayOverrides(root, 'nope', 'tablet')).toBe(root)
  })

  it('не мутирует вход и сохраняет ссылки на нетронутые поддеревья', () => {
    const input = n('page', {
      children: [
        n('complexes', { children: [n('wrap', { variations: { tablet: io({ promo: { styles: { display: 'grid' } } }) } })] }),
        n('promo', { children: [n('head')] }),
        n('untouched', { children: [n('leaf')] }),
      ],
    })
    const snapshot = JSON.stringify(input)
    const next = adoptStrayOverrides(input, 'promo', 'tablet')
    expect(JSON.stringify(input)).toBe(snapshot)
    expect(next).not.toBe(input)
    expect(next.children[1]).toBe(input.children[1]) // promo
    expect(next.children[2]).toBe(input.children[2]) // untouched
    expect(next.children[0]).not.toBe(input.children[0]) // complexes: запись убрана
  })

  it('правка корня: владелец — сам корень', () => {
    const root = n('page', {
      children: [n('deep', { variations: { tablet: io({ page: { styles: { padding: '0' } } }) } })],
    })
    const next = adoptStrayOverrides(root, 'page', 'tablet')
    expect(entry(next, 'page', 'tablet', 'page')).toEqual({ styles: { padding: '0' } })
    expect(entry(next, 'deep', 'tablet', 'page')).toBeUndefined()
  })

  it('«чужая» запись внутри specificChildren тоже собирается', () => {
    const root = n('page', {
      variations: {
        tablet: {
          specificChildren: [n('extra', { variations: { tablet: io({ a: { styles: { color: 'red' } } }) } })],
        },
      } as any,
      children: [n('a')],
    })
    const next = adoptStrayOverrides(root, 'a', 'tablet')
    expect(next.variations!.tablet.inheritedOverrides).toEqual({ a: { styles: { color: 'red' } } })
    expect(next.variations!.tablet.specificChildren![0].variations!.tablet.inheritedOverrides).toEqual({})
  })
})
