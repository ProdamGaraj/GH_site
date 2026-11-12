import { describe, it, expect } from 'vitest'
import { countLinkedInstances, findOwningLinkedInstance, setLinkedBlockAsset } from './linkedBlockAssets'
import type { BlockNode } from '@/shared/types'

const n = (id: string, overrides: Partial<BlockNode> = {}): BlockNode =>
  ({
    id,
    tag: 'div',
    tagName: 'div',
    elementType: 'container',
    styles: { properties: {} },
    attributes: {},
    metadata: {},
    children: [],
    ...overrides,
  }) as BlockNode

const linked = (id: string, blockId: string, children: BlockNode[] = [], meta: Record<string, any> = {}) =>
  n(id, { metadata: { linkedBlockId: blockId, name: `Блок ${blockId}`, ...meta } as any, children })

/**
 * page
 * ├─ lead-1 (linked lib-lead) ─ form ─ input
 * ├─ plain ─ text
 * ├─ catalog (linked lib-catalog) ─ card (linked lib-card) ─ title
 * └─ lead-2 (linked lib-lead)
 */
const page = (): BlockNode =>
  n('page', {
    metadata: { globalCss: '.page{}' },
    children: [
      linked('lead-1', 'lib-lead', [n('form', { children: [n('input')] })], { globalCss: '.lead{}', globalJs: 'lead()' }),
      n('plain', { children: [n('text')] }),
      linked('catalog', 'lib-catalog', [linked('card', 'lib-card', [n('title')], { globalCss: '.card{}' })]),
      linked('lead-2', 'lib-lead', [], { globalCss: '.lead{}' }),
    ],
  })

describe('findOwningLinkedInstance', () => {
  it('корень linked-блока → он сам', () => {
    expect(findOwningLinkedInstance(page(), 'lead-1')?.id).toBe('lead-1')
  })

  it('глубокий потомок → ближайший linked-предок', () => {
    expect(findOwningLinkedInstance(page(), 'input')?.id).toBe('lead-1')
  })

  it('элемент вложенного блока → ВНУТРЕННИЙ блок, а не внешний', () => {
    expect(findOwningLinkedInstance(page(), 'title')?.id).toBe('card')
    expect(findOwningLinkedInstance(page(), 'card')?.id).toBe('card')
    expect(findOwningLinkedInstance(page(), 'catalog')?.id).toBe('catalog')
  })

  it('обычный узел страницы и сама страница → null', () => {
    expect(findOwningLinkedInstance(page(), 'text')).toBeNull()
    expect(findOwningLinkedInstance(page(), 'plain')).toBeNull()
    expect(findOwningLinkedInstance(page(), 'page')).toBeNull()
  })

  it('корень дерева с linkedBlockId не считается вставкой', () => {
    const root = linked('root', 'lib-self', [n('child')])
    expect(findOwningLinkedInstance(root, 'child')).toBeNull()
    expect(findOwningLinkedInstance(root, 'root')).toBeNull()
  })

  it('неизвестный id / пустые входы → null', () => {
    expect(findOwningLinkedInstance(page(), 'nope')).toBeNull()
    expect(findOwningLinkedInstance(null, 'input')).toBeNull()
    expect(findOwningLinkedInstance(page(), null)).toBeNull()
  })

  it('ищет и в specificChildren вариаций', () => {
    const root = n('page', {
      variations: { mobile: { specificChildren: [linked('m-lead', 'lib-lead', [n('m-input')])] } } as any,
    })
    expect(findOwningLinkedInstance(root, 'm-input')?.id).toBe('m-lead')
  })
})

describe('countLinkedInstances', () => {
  it('считает все вставки блока, включая вложенные и specificChildren', () => {
    const root = page()
    root.variations = { mobile: { specificChildren: [linked('m-lead', 'lib-lead')] } } as any
    expect(countLinkedInstances(root, 'lib-lead')).toBe(3)
    expect(countLinkedInstances(root, 'lib-card')).toBe(1)
    expect(countLinkedInstances(root, 'lib-none')).toBe(0)
  })

  it('корень дерева не считается; пустые входы → 0', () => {
    expect(countLinkedInstances(linked('root', 'lib-x'), 'lib-x')).toBe(0)
    expect(countLinkedInstances(null, 'lib-x')).toBe(0)
  })
})

describe('setLinkedBlockAsset', () => {
  const meta = (root: BlockNode, id: string): any => {
    const find = (x: BlockNode): BlockNode | null =>
      x.id === id ? x : x.children.map(find).find(Boolean) || null
    return find(root)?.metadata
  }

  it('пишет CSS во ВСЕ вставки блока на странице', () => {
    const next = setLinkedBlockAsset(page(), 'lib-lead', 'globalCss', '.lead{color:red}')
    expect(meta(next, 'lead-1').globalCss).toBe('.lead{color:red}')
    expect(meta(next, 'lead-2').globalCss).toBe('.lead{color:red}')
  })

  it('JS пишется отдельно и не трогает CSS', () => {
    const next = setLinkedBlockAsset(page(), 'lib-lead', 'globalJs', 'lead2()')
    expect(meta(next, 'lead-1').globalJs).toBe('lead2()')
    expect(meta(next, 'lead-1').globalCss).toBe('.lead{}')
  })

  it('пустая строка удаляет поле', () => {
    const next = setLinkedBlockAsset(page(), 'lib-lead', 'globalCss', '')
    expect('globalCss' in meta(next, 'lead-1')).toBe(false)
    expect('globalCss' in meta(next, 'lead-2')).toBe(false)
  })

  it('прочие блоки, CSS страницы и прочая metadata не трогаются', () => {
    const next = setLinkedBlockAsset(page(), 'lib-lead', 'globalCss', 'x{}')
    expect(meta(next, 'card').globalCss).toBe('.card{}')
    expect(meta(next, 'page').globalCss).toBe('.page{}')
    expect(meta(next, 'lead-1').linkedBlockId).toBe('lib-lead')
    expect(meta(next, 'lead-1').name).toBe('Блок lib-lead')
  })

  it('вложенный блок обновляется внутри внешнего', () => {
    const next = setLinkedBlockAsset(page(), 'lib-card', 'globalCss', '.card2{}')
    expect(meta(next, 'card').globalCss).toBe('.card2{}')
    expect(meta(next, 'catalog').globalCss).toBeUndefined()
  })

  it('обновляет вставки в specificChildren вариаций', () => {
    const root = n('page', { variations: { mobile: { specificChildren: [linked('m-lead', 'lib-lead')] } } as any })
    const next = setLinkedBlockAsset(root, 'lib-lead', 'globalCss', 'm{}')
    expect((next.variations as any).mobile.specificChildren[0].metadata.globalCss).toBe('m{}')
  })

  it('не мутирует вход и сохраняет ссылки на нетронутые поддеревья', () => {
    const input = page()
    const next = setLinkedBlockAsset(input, 'lib-lead', 'globalCss', 'x{}')
    expect(meta(input, 'lead-1').globalCss).toBe('.lead{}')
    expect(next.children[1]).toBe(input.children[1]) // plain
    expect(next.children[2]).toBe(input.children[2]) // catalog
    expect(next.children[0]).not.toBe(input.children[0])
  })

  it('корень дерева с тем же linkedBlockId не меняется', () => {
    const root = linked('root', 'lib-x', [], { globalCss: 'root{}' })
    expect(setLinkedBlockAsset(root, 'lib-x', 'globalCss', 'y{}')).toBe(root)
  })
})
