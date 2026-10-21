/**
 * «Создать блок из элемента»: экземпляр блока библиотеки копируется с
 * содержимым и CSS блока библиотеки, обычный элемент — как есть.
 */
import { blockStructureFromElement } from '../services/blockFromElement'

const library = {
  id: 'lib-root',
  tagName: 'section',
  attributes: { class: 'location-section', 'data-x': '1' },
  styles: { properties: { padding: '20px' } },
  metadata: { name: 'Complex location', globalCss: '.location-section { color: red; }' },
  children: [{ id: 'map', tagName: 'div', children: [] }],
}

describe('blockStructureFromElement', () => {
  it('экземпляр: дети, стили и CSS — из блока библиотеки, атрибуты экземпляра поверх, связи нет', async () => {
    const instance = {
      id: '1783408497258_9zasafbc1',
      tagName: 'section',
      attributes: { class: 'detail-section location-section' },
      styles: { properties: {} },
      metadata: { linkedBlockId: 'lib', name: 'Карта', styleOverrides: {} },
      children: [],
    }
    const load = jest.fn(async () => library)
    const out = await blockStructureFromElement(instance, load)
    expect(load).toHaveBeenCalledWith('lib')
    expect(out.id).toBe('1783408497258_9zasafbc1')
    expect(out.children).toEqual(library.children)
    expect(out.styles).toEqual(library.styles)
    expect(out.attributes).toEqual({ class: 'detail-section location-section', 'data-x': '1' })
    expect(out.metadata).toEqual({ name: 'Карта', globalCss: '.location-section { color: red; }' })
    // Блок библиотеки не изменился.
    expect(library.metadata).toEqual({ name: 'Complex location', globalCss: '.location-section { color: red; }' })
  })

  it('блока библиотеки нет (удалён) — копия узла без следов экземпляра', async () => {
    const out = await blockStructureFromElement(
      { id: 'n', tagName: 'section', metadata: { linkedBlockId: 'gone', styleOverrides: {} }, children: [] },
      async () => null,
    )
    expect(out.metadata).toEqual({})
  })

  it('обычный элемент — как есть, исходный объект не меняется', async () => {
    const element = { id: 'n', tagName: 'div', metadata: { name: 'Обёртка' }, children: [{ id: 'c' }] }
    const load = jest.fn()
    const out = await blockStructureFromElement(element, load)
    expect(load).not.toHaveBeenCalled()
    expect(out).toEqual(element)
    expect(out).not.toBe(element)
  })
})
