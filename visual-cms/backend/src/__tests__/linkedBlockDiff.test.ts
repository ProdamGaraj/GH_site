/**
 * Golden-тесты для diffLinkedInstance — детектора расхождения linked-инстанса
 * против library-структуры.
 *
 * Ключевой инвариант: разворачивание (_applyLinkedBlocks) накладывает на корень
 * инстанса id placeholder'а и его attributes (overlay), поэтому эти поля НЕ должны
 * считаться правкой контента. Контент (текст/стили/дети/variations) — должен.
 */

import { diffLinkedInstance } from '../services/linkedBlockDiff'

/** Структура, как она лежит в библиотеке. */
const libraryFooter = (): any => ({
  id: 'lib-footer-root',
  tagName: 'footer',
  elementType: 'container',
  content: '',
  styles: { properties: { padding: '40px' } },
  attributes: { class: 'footer' },
  metadata: { name: 'Footer' },
  children: [
    {
      id: 'copyright',
      tagName: 'p',
      content: '© 2026 Golden House',
      styles: { properties: { color: '#888' } },
      attributes: {},
      metadata: {},
      children: [],
    },
  ],
})

/**
 * Инстанс, как он приходит с фронта после разворачивания неизменённого placeholder:
 * корневой id заменён на placeholder, attributes — overlay (placeholder поверх library),
 * metadata.linkedBlockId проставлен. Контент идентичен библиотеке.
 */
const expandedUnchanged = (): any => ({
  ...libraryFooter(),
  id: 'placeholder-footer-id',
  attributes: { class: 'footer', 'data-instance': 'page-1' }, // overlay placeholder'а
  metadata: { name: 'Footer', linkedBlockId: 'lib-footer-root' },
})

describe('diffLinkedInstance', () => {
  it('неизменённый инстанс (overlay id/attributes/metadata) → НЕ изменён', () => {
    const result = diffLinkedInstance(expandedUnchanged(), libraryFooter())
    expect(result.changed).toBe(false)
    expect(result.changes).toEqual([])
  })

  it('отсутствие library-структуры → НЕ изменён (не можем доказать расхождение)', () => {
    expect(diffLinkedInstance(expandedUnchanged(), null).changed).toBe(false)
    expect(diffLinkedInstance(expandedUnchanged(), undefined).changed).toBe(false)
    expect(diffLinkedInstance(null, libraryFooter()).changed).toBe(false)
  })

  it('изменён текст вложенного узла → changed, kind=content', () => {
    const inst = expandedUnchanged()
    inst.children[0].content = '© 2026 ИЗМЕНЕНО'
    const result = diffLinkedInstance(inst, libraryFooter())
    expect(result.changed).toBe(true)
    expect(result.changes.some((c) => c.kind === 'content')).toBe(true)
  })

  it('изменены стили вложенного узла → changed, kind=styles', () => {
    const inst = expandedUnchanged()
    inst.children[0].styles = { properties: { color: '#000' } }
    const result = diffLinkedInstance(inst, libraryFooter())
    expect(result.changed).toBe(true)
    expect(result.changes.some((c) => c.kind === 'styles')).toBe(true)
  })

  it('добавлен ребёнок → changed, kind=child-added', () => {
    const inst = expandedUnchanged()
    inst.children.push({
      id: 'new-link', tagName: 'a', content: 'Контакты',
      styles: { properties: {} }, attributes: {}, metadata: { name: 'Ссылка' }, children: [],
    })
    const result = diffLinkedInstance(inst, libraryFooter())
    expect(result.changed).toBe(true)
    expect(result.changes.some((c) => c.kind === 'child-added')).toBe(true)
  })

  it('удалён ребёнок → changed, kind=child-removed', () => {
    const inst = expandedUnchanged()
    inst.children = []
    const result = diffLinkedInstance(inst, libraryFooter())
    expect(result.changed).toBe(true)
    expect(result.changes.some((c) => c.kind === 'child-removed')).toBe(true)
  })

  it('изменён styles КОРНЯ → changed (контент корня учитывается)', () => {
    const inst = expandedUnchanged()
    inst.styles = { properties: { padding: '999px' } }
    const result = diffLinkedInstance(inst, libraryFooter())
    expect(result.changed).toBe(true)
    expect(result.changes.some((c) => c.kind === 'styles')).toBe(true)
  })

  describe('hybrid-карусель: placeholder-маркеры на корне НЕ считаются правкой', () => {
    const libSlide = (): any => ({
      id: 'lib-slide',
      tagName: 'div',
      content: '',
      styles: { properties: {} },
      attributes: { class: 'slide' },
      metadata: { name: 'Promo slide' },
      children: [{ id: 'img', tagName: 'img', content: '', styles: { properties: {} }, attributes: {}, metadata: {}, children: [] }],
    })

    it('инстанс с data-carousel-static на корне, контент идентичен → НЕ изменён', () => {
      const inst = {
        ...libSlide(),
        id: 'slide-placeholder',
        // overlay карусели: маркеров нет в library, но это не правка контента
        attributes: { class: 'slide', 'data-carousel-slide': '4', 'data-carousel-static': 'true' },
        metadata: { name: 'Promo slide', linkedBlockId: 'lib-slide' },
      }
      const result = diffLinkedInstance(inst, libSlide())
      expect(result.changed).toBe(false)
    })

    it('инстанс с правкой во вложенном узле + карусель-маркеры → изменён (по контенту, не по маркерам)', () => {
      const inst: any = {
        ...libSlide(),
        id: 'slide-placeholder',
        attributes: { class: 'slide', 'data-carousel-static': 'true' },
        metadata: { name: 'Promo slide', linkedBlockId: 'lib-slide' },
      }
      inst.children = [{ ...inst.children[0], attributes: { src: '/new.png' } }]
      const result = diffLinkedInstance(inst, libSlide())
      expect(result.changed).toBe(true)
      expect(result.changes.some((c) => c.kind === 'attributes')).toBe(true)
    })
  })

  it('изменены variations → changed, kind=variations', () => {
    const inst: any = expandedUnchanged()
    inst.variations = { mobile: { specificChildren: [{ id: 'm1', tagName: 'div' }] } }
    const result = diffLinkedInstance(inst, libraryFooter())
    expect(result.changed).toBe(true)
    expect(result.changes.some((c) => c.kind === 'variations')).toBe(true)
  })

  describe('reorder детей (перетаскивание)', () => {
    // Контейнер с тремя именованными детьми со стабильными id (как после
    // разворачивания из библиотеки _applyLinkedBlocks).
    const libRow = (): any => ({
      id: 'row',
      tagName: 'div',
      styles: { properties: {} },
      attributes: {},
      metadata: { name: 'Footer Top' },
      children: [
        { id: 'nav1', tagName: 'div', content: '', styles: { properties: {} }, attributes: {}, metadata: { name: 'Компания' }, children: [] },
        { id: 'nav2', tagName: 'div', content: '', styles: { properties: {} }, attributes: {}, metadata: { name: 'Проекты' }, children: [] },
        { id: 'nav3', tagName: 'div', content: '', styles: { properties: {} }, attributes: {}, metadata: { name: 'Контакты' }, children: [] },
      ],
    })

    it('перестановка детей → одно изменение reorder, БЕЗ ложных «изменён текст»', () => {
      const inst = libRow()
      // Поменяли местами «Компания» и «Проекты» (как в репродукции владельца).
      inst.children = [inst.children[1], inst.children[0], inst.children[2]]

      const result = diffLinkedInstance(inst, libRow())
      expect(result.changed).toBe(true)
      const kinds = result.changes.map((c) => c.kind)
      expect(kinds).toContain('reorder')
      // Никаких ложных изменений содержимого/добавления/удаления.
      expect(kinds).not.toContain('content')
      expect(kinds).not.toContain('child-added')
      expect(kinds).not.toContain('child-removed')
      expect(result.changes.filter((c) => c.kind === 'reorder')).toHaveLength(1)
    })

    it('тот же порядок → НЕ изменён (reorder не срабатывает зря)', () => {
      expect(diffLinkedInstance(libRow(), libRow()).changed).toBe(false)
    })

    it('reorder + правка текста перемещённого узла → и reorder, и content', () => {
      const inst = libRow()
      inst.children = [inst.children[1], inst.children[0], inst.children[2]]
      inst.children[0] = { ...inst.children[0], content: 'НовоеИмя' } // правим перемещённый nav2
      const result = diffLinkedInstance(inst, libRow())
      const kinds = result.changes.map((c) => c.kind)
      expect(kinds).toContain('reorder')
      expect(kinds).toContain('content')
    })

    it('свежая вставка с перевыданными id (нет общих id) → позиционный fallback, идентичный контент НЕ изменён', () => {
      const lib = libRow()
      const inst = libRow()
      // Перевыдаём все id (как cloneNodeWithNewIds), порядок и контент сохранены.
      inst.id = 'new-row'
      inst.children = inst.children.map((c: any, i: number) => ({ ...c, id: `new-${i}` }))
      const result = diffLinkedInstance(inst, lib)
      expect(result.changed).toBe(false)
    })
  })

  it('изменён только корневой id/attributes/metadata → НЕ изменён', () => {
    const inst = expandedUnchanged()
    inst.id = 'совсем-другой-id'
    inst.attributes = { class: 'footer', 'data-x': 'y', 'data-z': '1' }
    inst.metadata = { name: 'Footer', linkedBlockId: 'lib-footer-root', locked: true } as any
    const result = diffLinkedInstance(inst, libraryFooter())
    expect(result.changed).toBe(false)
  })
})
