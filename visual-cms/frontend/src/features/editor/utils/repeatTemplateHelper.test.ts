import { describe, expect, it } from 'vitest'
import type { BlockNode } from '@/shared/types'
import {
  detachLinkedTemplate,
  getRepeatTemplate,
  getRepeatTemplateDisplayName,
  getRepeatTemplateKind,
  isHybridStaticSlide,
} from './repeatTemplateHelper'

const mk = (overrides: Partial<BlockNode> = {}): BlockNode => ({
  id: 'n',
  tag: 'div',
  tagName: 'div',
  elementType: 'container',
  styles: { properties: {} },
  children: [],
  attributes: {},
  metadata: {},
  ...overrides,
})

describe('getRepeatTemplate', () => {
  it('null когда track=null/undefined', () => {
    expect(getRepeatTemplate(null)).toBeNull()
    expect(getRepeatTemplate(undefined)).toBeNull()
  })

  it('null когда у track нет children', () => {
    expect(getRepeatTemplate(mk({ children: [] }))).toBeNull()
  })

  it('null когда children не массив (защита от грязных данных)', () => {
    const dirty = { ...mk(), children: undefined as unknown as BlockNode[] }
    expect(getRepeatTemplate(dirty)).toBeNull()
  })

  it('возвращает первый child даже если их несколько', () => {
    const a = mk({ id: 'a' })
    const b = mk({ id: 'b' })
    const track = mk({ id: 't', children: [a, b] })
    expect(getRepeatTemplate(track)?.id).toBe('a')
  })

  it('пропускает hybrid-static-children при поиске template', () => {
    const s1 = mk({ id: 's1', attributes: { 'data-carousel-static': 'true' } })
    const tpl = mk({ id: 'tpl' })
    const s2 = mk({ id: 's2', attributes: { 'data-carousel-static': 'true' } })
    const track = mk({ id: 't', children: [s1, tpl, s2] })
    expect(getRepeatTemplate(track)?.id).toBe('tpl')
  })

  it('null если в треке только static-children (нет template)', () => {
    const s1 = mk({ id: 's1', attributes: { 'data-carousel-static': 'true' } })
    const s2 = mk({ id: 's2', attributes: { 'data-carousel-static': 'true' } })
    expect(getRepeatTemplate(mk({ children: [s1, s2] }))).toBeNull()
  })
})

describe('isHybridStaticSlide', () => {
  it('true если data-carousel-static=true (string)', () => {
    expect(isHybridStaticSlide(mk({ attributes: { 'data-carousel-static': 'true' } }))).toBe(true)
  })

  it('false без атрибута', () => {
    expect(isHybridStaticSlide(mk({}))).toBe(false)
  })

  it('false для null/undefined', () => {
    expect(isHybridStaticSlide(null)).toBe(false)
    expect(isHybridStaticSlide(undefined)).toBe(false)
  })

  it('false если значение != "true"', () => {
    expect(isHybridStaticSlide(mk({ attributes: { 'data-carousel-static': 'false' } }))).toBe(false)
    expect(isHybridStaticSlide(mk({ attributes: { 'data-carousel-static': '' } }))).toBe(false)
  })
})

describe('getRepeatTemplateKind', () => {
  it('null если template отсутствует', () => {
    expect(getRepeatTemplateKind(mk({ children: [] }))).toBeNull()
  })

  it("'linked' если у первого child есть metadata.linkedBlockId", () => {
    const tpl = mk({ id: 'tpl', metadata: { linkedBlockId: 'lib-1' } })
    expect(getRepeatTemplateKind(mk({ children: [tpl] }))).toBe('linked')
  })

  it("'inline' если linkedBlockId отсутствует или пустая строка", () => {
    const inlineNoMeta = mk({ id: 'tpl' })
    expect(getRepeatTemplateKind(mk({ children: [inlineNoMeta] }))).toBe('inline')

    const inlineEmpty = mk({ id: 'tpl', metadata: { linkedBlockId: '' } })
    expect(getRepeatTemplateKind(mk({ children: [inlineEmpty] }))).toBe('inline')
  })

  it('игнорирует hybrid-static при определении kind', () => {
    const s = mk({ id: 's', attributes: { 'data-carousel-static': 'true' }, metadata: { linkedBlockId: 'lib-s' } })
    const tpl = mk({ id: 'tpl', metadata: { linkedBlockId: 'lib-1' } })
    expect(getRepeatTemplateKind(mk({ children: [s, tpl] }))).toBe('linked')
  })
})

describe('getRepeatTemplateDisplayName', () => {
  it('пустая строка если template отсутствует', () => {
    expect(getRepeatTemplateDisplayName(mk({ children: [] }))).toBe('')
  })

  it('берёт metadata.name когда задан', () => {
    const tpl = mk({ id: 'tpl', metadata: { name: 'Project Card' } })
    expect(getRepeatTemplateDisplayName(mk({ children: [tpl] }))).toBe('Project Card')
  })

  it('fallback на tagName в lowercase', () => {
    const tpl = mk({ id: 'tpl', tagName: 'SECTION' })
    expect(getRepeatTemplateDisplayName(mk({ children: [tpl] }))).toBe('section')
  })
})

describe('detachLinkedTemplate', () => {
  let counter = 0
  const genId = () => `gen-${++counter}`

  it('возвращает глубокую копию full structure с remap всех id', () => {
    counter = 0
    const placeholder = mk({
      id: 'placeholder-1',
      metadata: { linkedBlockId: 'lib-1' },
      attributes: { 'data-carousel-slide': 'true' },
    })
    const full: BlockNode = {
      ...mk({ id: 'orig-root' }),
      children: [
        mk({ id: 'orig-child-1' }),
        mk({ id: 'orig-child-2' }),
      ],
    }
    const result = detachLinkedTemplate(placeholder, full, 'My Block', genId)

    expect(result.id).toBe('gen-1')
    expect(result.children[0].id).toBe('gen-2')
    expect(result.children[1].id).toBe('gen-3')
    // Не мутируем full structure
    expect(full.id).toBe('orig-root')
  })

  it('удаляет linkedBlockId из copy', () => {
    counter = 0
    const placeholder = mk({ id: 'p', metadata: { linkedBlockId: 'lib-1' } })
    const full = mk({ id: 'orig', metadata: { linkedBlockId: 'lib-1', name: 'Block' } })
    const result = detachLinkedTemplate(placeholder, full, 'Block', genId)
    expect(result.metadata.linkedBlockId).toBeUndefined()
  })

  it('сохраняет имя: placeholder.metadata.name → full.metadata.name → blockName', () => {
    counter = 0
    // placeholder имеет своё имя — оно НЕ должно перезаписать имя из full structure
    // (consistency с createBlockReferenceNode-copy: copy.metadata.name = full.metadata.name || block.name).
    const placeholder = mk({ id: 'p', metadata: { linkedBlockId: 'lib-1', name: 'placeholder name' } })
    const fullWithName = mk({ id: 'orig', metadata: { name: 'full name' } })
    const r1 = detachLinkedTemplate(placeholder, fullWithName, 'Block', genId)
    expect(r1.metadata.name).toBe('full name')

    counter = 0
    const fullNoName = mk({ id: 'orig' })
    const r2 = detachLinkedTemplate(placeholder, fullNoName, 'Block', genId)
    expect(r2.metadata.name).toBe('placeholder name')

    counter = 0
    const placeholderNoName = mk({ id: 'p', metadata: { linkedBlockId: 'lib-1' } })
    const r3 = detachLinkedTemplate(placeholderNoName, fullNoName, 'Block', genId)
    expect(r3.metadata.name).toBe('Block')
  })

  it('сливает атрибуты: full.attributes базой, placeholder.attributes сверху', () => {
    counter = 0
    const placeholder = mk({
      id: 'p',
      metadata: { linkedBlockId: 'lib-1' },
      attributes: { 'data-carousel-slide': 'true', 'data-custom': 'placeholder' },
    })
    const full = mk({
      id: 'orig',
      attributes: { 'data-bind': 'item', 'data-custom': 'full' },
    })
    const result = detachLinkedTemplate(placeholder, full, 'Block', genId)
    expect(result.attributes['data-carousel-slide']).toBe('true')
    expect(result.attributes['data-bind']).toBe('item')
    // placeholder побеждает при конфликте — это явный intent пользователя
    expect(result.attributes['data-custom']).toBe('placeholder')
  })
})
