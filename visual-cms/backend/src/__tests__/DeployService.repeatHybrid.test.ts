/**
 * Гибридная карусель на сервере: шаблон повтора и статические слайды
 * (data-carousel-static="true", в т.ч. слайды-блоки) в одном треке.
 *
 * Сервер (коллекции, данные при публикации) обязан собирать трек так же, как
 * браузер (DataBindingGenerator): шаблон — первый нестатический ребёнок,
 * статика остаётся до и после копий. Раньше шаблоном брался children[0].
 */
jest.mock('../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockReturnValue({
      findOne: jest.fn(), find: jest.fn(), save: jest.fn(), findByIds: jest.fn(),
    }),
  },
}))

import { deployService } from '../services/DeployService'

const substitute = (structure: unknown, item: unknown) => (deployService as any).substituteItemData(structure, item)

const staticSlide = (id: string, extra: Record<string, string> = {}) => ({
  id, tagName: 'div', children: [],
  attributes: { 'data-carousel-static': 'true', 'data-carousel-slide': 'true', ...extra },
})
const template = { id: 'tpl', tagName: 'div', content: '{{$}}', attributes: { 'data-carousel-slide': 'true' }, children: [] }
const track = (children: unknown[], source = 'item.s') => ({
  id: 'track', tagName: 'div', attributes: { 'data-carousel-track': 'true' }, _repeat: { source }, children,
})
/** Слайды трека: id и подставленный текст. */
const shape = (out: any) => out.children.map((c: any) => (c.content ? `${c.id}:${c.content}` : c.id))

describe('_repeat + статические слайды', () => {
  it('статика до и после шаблона остаётся на месте, копии — между ними', () => {
    const out = substitute(track([staticSlide('before'), template, staticSlide('after')]), { s: ['a', 'b'] })
    expect(shape(out)).toEqual(['before', 'tpl:a', 'tpl:b', 'after'])
  })

  it('несколько статических с каждой стороны — порядок сохраняется', () => {
    const out = substitute(track([staticSlide('b1'), staticSlide('b2'), template, staticSlide('a1'), staticSlide('a2')]), { s: ['x'] })
    expect(shape(out)).toEqual(['b1', 'b2', 'tpl:x', 'a1', 'a2'])
  })

  it('атрибуты статического слайда (тема шапки, привязка блока) не теряются', () => {
    const out = substitute(track([staticSlide('before', { 'data-header-theme': 'light' }), template]), { s: ['a'] })
    expect(out.children[0].attributes).toMatchObject({ 'data-carousel-static': 'true', 'data-header-theme': 'light' })
  })

  it('в статике подставляются данные элемента ({{item.*}})', () => {
    const s = { ...staticSlide('promo'), content: '{{item.title}}' }
    const out = substitute(track([s, template]), { s: ['a'], title: 'Акция' })
    expect(out.children[0].content).toBe('Акция')
  })

  it('пустой массив или нет данных — статика остаётся, копий нет', () => {
    expect(shape(substitute(track([staticSlide('before'), template, staticSlide('after')]), { s: [] }))).toEqual(['before', 'after'])
    expect(shape(substitute(track([staticSlide('before'), template]), {}))).toEqual(['before'])
  })

  it('без статики — как раньше: соседи шаблона (образцы данных) отпадают', () => {
    const sample = { id: 'sample', tagName: 'div', content: 'образец', children: [] }
    const out = substitute(track([template, sample]), { s: ['a', 'b'] })
    expect(shape(out)).toEqual(['tpl:a', 'tpl:b'])
  })

  it('нестатический сосед перед шаблоном — сам шаблон (первый нестатический)', () => {
    const first = { id: 'first', tagName: 'div', content: '1:{{$}}', children: [] }
    const out = substitute(track([staticSlide('s'), first, template]), { s: ['a'] })
    expect(shape(out)).toEqual(['s', 'first:1:a'])
  })

  it('только статика, без шаблона — слайды остаются', () => {
    expect(shape(substitute(track([staticSlide('a'), staticSlide('b')]), { s: ['x'] }))).toEqual(['a', 'b'])
  })

  it('offset/limit режут только копии', () => {
    const t = { ...track([staticSlide('before'), template]), _repeat: { source: 'item.s', offset: 1, limit: 1 } }
    expect(shape(substitute(t, { s: ['a', 'b', 'c'] }))).toEqual(['before', 'tpl:b'])
  })
})
