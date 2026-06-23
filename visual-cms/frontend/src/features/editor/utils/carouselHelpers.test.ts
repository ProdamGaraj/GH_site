import { describe, it, expect, beforeEach } from 'vitest'
import type { BlockNode } from '@/shared/types'
import type { Block } from '@/shared/types'
import type { DataBinding } from '@/shared/types/dataBinding'
import {
  findTrackNode,
  findCarouselRootFor,
  getCarouselMode,
  createBlockReferenceNode,
  deepCloneNode,
  buildCarouselConversion,
  assignControlRole,
  findControlHolderId,
  flattenForPicker,
  CAROUSEL_MODE_ATTR,
} from './carouselHelpers'

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

const mkNode = (overrides: Partial<BlockNode> & { id: string }): BlockNode => {
  // Спредим overrides ПЕРВЫМИ, потом базу, потом id ещё раз — чтобы и
  // расширения (content, animations и т.п.) пробрасывались, и обязательные
  // дефолты не были undefined.
  const base = {
    tag: 'div',
    tagName: 'div',
    elementType: 'container' as const,
    styles: { properties: {} },
    children: [],
    attributes: {},
    metadata: {},
  }
  return { ...base, ...overrides } as BlockNode
}

const mkBinding = (overrides: Partial<DataBinding>): DataBinding =>
  ({
    id: overrides.id ?? 'b-' + Math.random(),
    blockId: overrides.blockId ?? 'block-x',
    pageId: overrides.pageId ?? 'page-x',
    dataSourceId: overrides.dataSourceId ?? 'ds-x',
    bindingType: overrides.bindingType ?? 'input',
    config: overrides.config ?? {},
    isActive: overrides.isActive ?? true,
    priority: overrides.priority ?? 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  } as DataBinding)

const carousel = (): BlockNode =>
  mkNode({
    id: 'root',
    attributes: { 'data-carousel': 'true' },
    children: [
      mkNode({
        id: 'track',
        attributes: { 'data-carousel-track': 'true' },
        children: [
          mkNode({ id: 'slide-1', attributes: { 'data-carousel-slide': 'true' } }),
        ],
      }),
      mkNode({
        id: 'dots',
        attributes: { 'data-carousel-dots': 'true' },
      }),
    ],
  })

// ─────────────────────────────────────────────────────────────────────────────
// findTrackNode
// ─────────────────────────────────────────────────────────────────────────────

describe('findTrackNode', () => {
  it('возвращает null для null/undefined', () => {
    expect(findTrackNode(null)).toBeNull()
    expect(findTrackNode(undefined)).toBeNull()
  })

  it('находит track как прямого ребёнка', () => {
    const root = carousel()
    expect(findTrackNode(root)?.id).toBe('track')
  })

  it('находит track вложенным глубже', () => {
    const root = mkNode({
      id: 'r',
      attributes: { 'data-carousel': 'true' },
      children: [
        mkNode({
          id: 'wrap',
          children: [
            mkNode({
              id: 'inner',
              children: [mkNode({ id: 't', attributes: { 'data-carousel-track': 'true' } })],
            }),
          ],
        }),
      ],
    })
    expect(findTrackNode(root)?.id).toBe('t')
  })

  it('возвращает сам carouselRoot, если он сам track', () => {
    const node = mkNode({ id: 'self', attributes: { 'data-carousel-track': 'true' } })
    expect(findTrackNode(node)?.id).toBe('self')
  })

  it('возвращает null, если track отсутствует', () => {
    const root = mkNode({
      id: 'r',
      children: [mkNode({ id: 'x' }), mkNode({ id: 'y' })],
    })
    expect(findTrackNode(root)).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getCarouselMode
// ─────────────────────────────────────────────────────────────────────────────

describe('getCarouselMode', () => {
  it('null root → static (безопасный default)', () => {
    expect(getCarouselMode(null, [])).toBe('static')
    expect(getCarouselMode(undefined, [])).toBe('static')
  })

  it('пустой список bindings → static', () => {
    expect(getCarouselMode(carousel(), [])).toBe('static')
  })

  it('repeater binding на track → repeat', () => {
    const root = carousel()
    const bindings = [
      mkBinding({
        blockId: 'track',
        bindingType: 'input',
        config: { inputConfig: { mode: 'repeater' } as any },
      }),
    ]
    expect(getCarouselMode(root, bindings)).toBe('repeat')
  })

  it('repeater binding на carousel-root (не на track) → repeat', () => {
    const root = carousel()
    const bindings = [
      mkBinding({
        blockId: 'root',
        bindingType: 'input',
        config: { inputConfig: { mode: 'repeater' } as any },
      }),
    ]
    expect(getCarouselMode(root, bindings)).toBe('repeat')
  })

  it('binding на чужом блоке → static', () => {
    const root = carousel()
    const bindings = [
      mkBinding({
        blockId: 'something-else',
        bindingType: 'input',
        config: { inputConfig: { mode: 'repeater' } as any },
      }),
    ]
    expect(getCarouselMode(root, bindings)).toBe('static')
  })

  it('binding на track, но с mode=single → static', () => {
    const root = carousel()
    const bindings = [
      mkBinding({
        blockId: 'track',
        bindingType: 'input',
        config: { inputConfig: { mode: 'single' } as any },
      }),
    ]
    expect(getCarouselMode(root, bindings)).toBe('static')
  })

  it('inactive repeater binding → static', () => {
    const root = carousel()
    const bindings = [
      mkBinding({
        blockId: 'track',
        bindingType: 'input',
        isActive: false,
        config: { inputConfig: { mode: 'repeater' } as any },
      }),
    ]
    expect(getCarouselMode(root, bindings)).toBe('static')
  })

  it('output binding → static (даже если mode=repeater каким-то странным образом)', () => {
    const root = carousel()
    const bindings = [
      mkBinding({
        blockId: 'track',
        bindingType: 'output',
        config: { inputConfig: { mode: 'repeater' } as any },
      }),
    ]
    expect(getCarouselMode(root, bindings)).toBe('static')
  })

  it('bidirectional с repeater → repeat', () => {
    const root = carousel()
    const bindings = [
      mkBinding({
        blockId: 'track',
        bindingType: 'bidirectional',
        config: { inputConfig: { mode: 'repeater' } as any },
      }),
    ]
    expect(getCarouselMode(root, bindings)).toBe('repeat')
  })

  // ── Приоритет явного атрибута data-carousel-mode ──
  it('data-carousel-mode="static" перебивает наличие repeater-binding', () => {
    const root = mkNode({
      id: 'root',
      attributes: { 'data-carousel': 'true', [CAROUSEL_MODE_ATTR]: 'static' },
      children: [mkNode({ id: 'track', attributes: { 'data-carousel-track': 'true' } })],
    })
    const bindings = [
      mkBinding({
        blockId: 'track',
        bindingType: 'input',
        config: { inputConfig: { mode: 'repeater' } as any },
      }),
    ]
    expect(getCarouselMode(root, bindings)).toBe('static')
  })

  it('data-carousel-mode="repeat" работает даже без bindings', () => {
    const root = mkNode({
      id: 'root',
      attributes: { 'data-carousel': 'true', [CAROUSEL_MODE_ATTR]: 'repeat' },
      children: [mkNode({ id: 'track', attributes: { 'data-carousel-track': 'true' } })],
    })
    expect(getCarouselMode(root, [])).toBe('repeat')
  })

  it('невалидное значение атрибута игнорируется → fallback на bindings', () => {
    const root = mkNode({
      id: 'root',
      attributes: { 'data-carousel': 'true', [CAROUSEL_MODE_ATTR]: 'garbage' },
      children: [mkNode({ id: 'track', attributes: { 'data-carousel-track': 'true' } })],
    })
    expect(getCarouselMode(root, [])).toBe('static')
    const bindings = [
      mkBinding({
        blockId: 'track',
        bindingType: 'input',
        config: { inputConfig: { mode: 'repeater' } as any },
      }),
    ]
    expect(getCarouselMode(root, bindings)).toBe('repeat')
  })
})

describe('createBlockReferenceNode', () => {
  let nextId = 0
  const genId = () => `gen-${++nextId}`

  beforeEach(() => {
    nextId = 0
  })

  const block: Pick<Block, 'id' | 'name' | 'structure'> = {
    id: 'lib-1',
    name: 'Hero Banner',
    structure: mkNode({
      id: 'orig-root',
      attributes: { class: 'hero' },
      children: [
        mkNode({ id: 'orig-c1', tagName: 'h1', content: 'Title' } as any),
        mkNode({
          id: 'orig-c2',
          children: [mkNode({ id: 'orig-c2-c1', tagName: 'span' })],
        }),
      ],
      metadata: { name: 'Hero (lib)' },
    }),
  }

  describe("mode='linked'", () => {
    it('возвращает плейсхолдер с metadata.linkedBlockId и пустыми children', () => {
      const node = createBlockReferenceNode(block, 'linked', { generateId: genId })
      expect(node.id).toBe('gen-1')
      expect(node.metadata.linkedBlockId).toBe('lib-1')
      expect(node.metadata.name).toBe('Hero Banner')
      expect(node.children).toEqual([])
      expect(node.tagName).toBe('div')
      expect(node.elementType).toBe('container')
    })

    it('применяет extraAttributes', () => {
      const node = createBlockReferenceNode(block, 'linked', {
        generateId: genId,
        extraAttributes: { 'data-carousel-slide': 'true', class: 'slide' },
      })
      expect(node.attributes).toEqual({
        'data-carousel-slide': 'true',
        class: 'slide',
      })
    })

    it('НЕ копирует структуру library-блока (placeholder лёгкий)', () => {
      const node = createBlockReferenceNode(block, 'linked', { generateId: genId })
      expect(node.children.length).toBe(0)
      // structure блока тоже не должна валяться в attributes/metadata как surplus
      expect((node.metadata as any).structure).toBeUndefined()
    })
  })

  describe("mode='copy'", () => {
    it('возвращает глубокую копию структуры с новыми id на всех уровнях', () => {
      const node = createBlockReferenceNode(block, 'copy', { generateId: genId })
      expect(node.id).toBe('gen-1')
      expect(node.children[0].id).toBe('gen-2')
      expect(node.children[1].id).toBe('gen-3')
      expect(node.children[1].children[0].id).toBe('gen-4')
    })

    it('сохраняет content, attributes, tagName и т.д.', () => {
      const node = createBlockReferenceNode(block, 'copy', { generateId: genId })
      expect(node.attributes.class).toBe('hero')
      expect(node.children[0].tagName).toBe('h1')
      expect((node.children[0] as any).content).toBe('Title')
    })

    it('УДАЛЯЕТ metadata.linkedBlockId если он был у оригинала (copy ≠ linked)', () => {
      const blockWithLink: Pick<Block, 'id' | 'name' | 'structure'> = {
        id: 'lib-2',
        name: 'X',
        structure: mkNode({
          id: 'r',
          metadata: { name: 'X', linkedBlockId: 'some-other-lib' },
        }),
      }
      const node = createBlockReferenceNode(blockWithLink, 'copy', { generateId: genId })
      expect(node.metadata.linkedBlockId).toBeUndefined()
    })

    it('применяет extraAttributes поверх структурных attributes', () => {
      const node = createBlockReferenceNode(block, 'copy', {
        generateId: genId,
        extraAttributes: { 'data-carousel-slide': 'true', class: 'overridden' },
      })
      expect(node.attributes['data-carousel-slide']).toBe('true')
      expect(node.attributes.class).toBe('overridden') // extra перезаписывает
    })

    it('не мутирует оригинальную структуру блока', () => {
      const originalSnapshot = JSON.stringify(block.structure)
      createBlockReferenceNode(block, 'copy', { generateId: genId })
      expect(JSON.stringify(block.structure)).toBe(originalSnapshot)
    })

    it('подставляет block.name если у оригинала нет metadata.name', () => {
      const blockNoName: Pick<Block, 'id' | 'name' | 'structure'> = {
        id: 'lib-3',
        name: 'Fallback Name',
        structure: mkNode({ id: 'r', metadata: {} }),
      }
      const node = createBlockReferenceNode(blockNoName, 'copy', { generateId: genId })
      expect(node.metadata.name).toBe('Fallback Name')
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// deepCloneNode
// ─────────────────────────────────────────────────────────────────────────────

describe('deepCloneNode', () => {
  it('создаёт независимую копию (мутация копии не трогает оригинал)', () => {
    const orig = mkNode({
      id: 'o',
      children: [mkNode({ id: 'c', attributes: { foo: 'bar' } })],
    })
    const clone = deepCloneNode(orig, () => 'new-id')
    clone.children[0].attributes.foo = 'CHANGED'
    expect(orig.children[0].attributes.foo).toBe('bar')
  })

  it('перевыдаёт id всем нодам поддерева', () => {
    let i = 0
    const gen = () => `g-${++i}`
    const orig = mkNode({
      id: 'o',
      children: [
        mkNode({ id: 'c1', children: [mkNode({ id: 'c1-1' })] }),
        mkNode({ id: 'c2' }),
      ],
    })
    const clone = deepCloneNode(orig, gen)
    expect(clone.id).toBe('g-1')
    expect(clone.children[0].id).toBe('g-2')
    expect(clone.children[0].children[0].id).toBe('g-3')
    expect(clone.children[1].id).toBe('g-4')
  })
})

describe('findCarouselRootFor', () => {
  const tree = mkNode({
    id: 'root',
    children: [
      mkNode({
        id: 'carousel',
        attributes: { 'data-carousel': 'true' },
        children: [
          mkNode({
            id: 'track',
            attributes: { 'data-carousel-track': 'true' },
            children: [
              mkNode({ id: 'slide-1' }),
              mkNode({ id: 'photo', attributes: { 'data-carousel-static': 'true' } }),
            ],
          }),
        ],
      }),
      mkNode({ id: 'unrelated' }),
    ],
  })

  it('сам узел, если он карусель', () => {
    expect(findCarouselRootFor(tree, 'carousel')?.id).toBe('carousel')
  })
  it('ближайший предок-карусель для слайда-ребёнка', () => {
    expect(findCarouselRootFor(tree, 'slide-1')?.id).toBe('carousel')
    expect(findCarouselRootFor(tree, 'photo')?.id).toBe('carousel')
    expect(findCarouselRootFor(tree, 'track')?.id).toBe('carousel')
  })
  it('null для узла вне карусели', () => {
    expect(findCarouselRootFor(tree, 'unrelated')).toBeNull()
    expect(findCarouselRootFor(tree, 'root')).toBeNull()
  })
  it('null для отсутствующего id / пустого входа', () => {
    expect(findCarouselRootFor(tree, 'nope')).toBeNull()
    expect(findCarouselRootFor(null, 'carousel')).toBeNull()
    expect(findCarouselRootFor(tree, undefined)).toBeNull()
  })
})

describe('buildCarouselConversion', () => {
  let counter = 0
  const genId = () => `gen-${++counter}`
  beforeEach(() => {
    counter = 0
  })

  const container = (children: BlockNode[]): BlockNode =>
    mkNode({ id: 'root', attributes: { class: 'box' }, children })

  it('ставит data-carousel/-mode и сохраняет прежние атрибуты', () => {
    const res = buildCarouselConversion(container([]), genId)
    expect(res.attributes['data-carousel']).toBe('true')
    expect(res.attributes['data-carousel-mode']).toBe('static')
    expect(res.attributes.class).toBe('box')
  })

  it('оборачивает существующих детей в трек как слайды (порядок сохранён)', () => {
    const res = buildCarouselConversion(
      container([mkNode({ id: 'a' }), mkNode({ id: 'b' })]),
      genId
    )
    const track = res.children[0]
    expect(track.attributes['data-carousel-track']).toBe('true')
    expect(track.children.map(c => c.id)).toEqual(['a', 'b'])
    expect(track.children[0].attributes['data-carousel-slide']).toBe('true')
    expect(track.children[1].attributes['data-carousel-slide']).toBe('true')
  })

  it('по умолчанию добавляет стрелки prev/next и точки', () => {
    const res = buildCarouselConversion(container([]), genId)
    expect(res.children.some(c => 'data-carousel-prev' in c.attributes)).toBe(true)
    expect(res.children.some(c => 'data-carousel-next' in c.attributes)).toBe(true)
    expect(res.children.some(c => 'data-carousel-dots' in c.attributes)).toBe(true)
  })

  it('withControls=false — только трек', () => {
    const res = buildCarouselConversion(container([]), genId, { withControls: false })
    expect(res.children).toHaveLength(1)
    expect(res.children[0].attributes['data-carousel-track']).toBe('true')
  })

  it('не мутирует исходный узел', () => {
    const node = container([mkNode({ id: 'a' })])
    const before = JSON.stringify(node)
    buildCarouselConversion(node, genId)
    expect(JSON.stringify(node)).toBe(before)
  })
})

describe('пикер управляющих элементов карусели', () => {
  const tree = (): BlockNode =>
    mkNode({
      id: 'root',
      attributes: { 'data-carousel': 'true' },
      children: [
        mkNode({ id: 'arrowOld', attributes: { 'data-carousel-prev': 'true' } }),
        mkNode({ id: 'arrowNew', metadata: { name: 'Моя стрелка' } }),
        mkNode({ id: 'counter', metadata: { name: 'Счётчик' } }),
      ],
    })

  describe('findControlHolderId', () => {
    it('находит текущего держателя роли', () => {
      expect(findControlHolderId(tree(), 'data-carousel-prev')).toBe('arrowOld')
    })
    it('пусто, если роль никому не назначена', () => {
      expect(findControlHolderId(tree(), 'data-carousel-counter')).toBe('')
    })
  })

  describe('flattenForPicker', () => {
    it('плоский список всех узлов с подписями', () => {
      const list = flattenForPicker(tree())
      expect(list.map(x => x.id)).toEqual(['root', 'arrowOld', 'arrowNew', 'counter'])
      expect(list.find(x => x.id === 'arrowNew')?.label).toContain('Моя стрелка')
    })
  })

  describe('assignControlRole', () => {
    it('переносит роль с прежнего держателя на нового', () => {
      const changes = assignControlRole(tree(), 'data-carousel-prev', 'arrowNew')
      const byId = Object.fromEntries(changes.map(c => [c.id, c.attributes]))
      // снято со старого
      expect(byId.arrowOld?.['data-carousel-prev']).toBeUndefined()
      // поставлено на новый
      expect(byId.arrowNew?.['data-carousel-prev']).toBe('true')
    })

    it('targetId="" — снимает роль со всех', () => {
      const changes = assignControlRole(tree(), 'data-carousel-prev', '')
      const byId = Object.fromEntries(changes.map(c => [c.id, c.attributes]))
      expect(byId.arrowOld?.['data-carousel-prev']).toBeUndefined()
    })

    it('назначение на нового держателя счётчика ставит data-carousel-counter', () => {
      const changes = assignControlRole(tree(), 'data-carousel-counter', 'counter')
      const byId = Object.fromEntries(changes.map(c => [c.id, c.attributes]))
      expect(byId.counter?.['data-carousel-counter']).toBe('true')
    })

    it('no-op, если роль уже на нужном узле', () => {
      const changes = assignControlRole(tree(), 'data-carousel-prev', 'arrowOld')
      expect(changes).toHaveLength(0)
    })
  })
})
