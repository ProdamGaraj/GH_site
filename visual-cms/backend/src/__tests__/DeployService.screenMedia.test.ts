/**
 * Публикация коллекции: слайд со значениями по экранам (item._responsive, так
 * их отдаёт estate-service для слайдов ЖК) — правила CSS страницы для фона и
 * позиции кадра и карта атрибутов для видео слайда.
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

const BREAKPOINTS = [
  { id: 'desktop-hd', name: 'Desktop HD', width: 1440 },
  { id: 'tablet', name: 'Tablet', width: 768 },
  { id: 'mobile', name: 'Mobile', width: 375 },
]

/** Слайд hero, как его делает миграция слайдеров: фон из --image, видео — атрибутом. */
const slideTemplate = {
  id: 'slide',
  tagName: 'div',
  attributes: { 'data-carousel-slide': 'true', 'data-slide-video': '{{$.video}}', 'data-slide-fit': '{{$.fit}}' },
  styles: { properties: { '--image': 'url("{{$.image}}")', backgroundPosition: '{{$.position}}' } },
  children: [{ id: 'caption', tagName: 'span', content: '{{item.name}}', children: [] }],
}

const page = (globalCss?: string) => ({
  id: 'root',
  tagName: 'div',
  metadata: { breakpoints: BREAKPOINTS, ...(globalCss ? { globalCss } : {}) },
  children: [{ id: 'track', tagName: 'div', _repeat: { source: 'item.heroSlides' }, children: [slideTemplate] }],
})

const slide = (extra: Record<string, unknown> = {}) => ({
  image: '/wide.jpg',
  video: '/wide.mp4',
  position: '10% 20%',
  fit: 'cover',
  ...extra,
})

describe('substituteItemData: медиа по экранам', () => {
  it('без _responsive — как раньше: ни ключей, ни правил', () => {
    const out = substitute(page(), { name: 'Harizma', heroSlides: [slide()] })
    const [s] = out.children[0].children
    expect(s.attributes).not.toHaveProperty('data-screen-key')
    expect(s.attributes).not.toHaveProperty('data-screen-attrs')
    expect(out.metadata.globalCss).toBeUndefined()
  })

  it('фото на телефоне вместо видео: фон и кадр — правилом экрана, видео — картой атрибутов', () => {
    const responsive = { image: { mobile: '/tall.jpg' }, video: { mobile: '' }, position: { mobile: '50% 30%' } }
    const out = substitute(page('.own { color: red; }'), { name: 'Harizma', heroSlides: [slide({ _responsive: responsive }), slide()] })
    const [first, second] = out.children[0].children

    expect(first.styles.properties['--image']).toBe('url("/wide.jpg")')
    expect(first.attributes['data-slide-video']).toBe('/wide.mp4')
    expect(first.attributes['data-screen-key']).toBe('s1')
    expect(JSON.parse(first.attributes['data-screen-attrs'])).toEqual({ 'data-slide-video': { mobile: '' } })
    expect(second.attributes).not.toHaveProperty('data-screen-key')

    const css: string = out.metadata.globalCss
    expect(css.startsWith('.own { color: red; }')).toBe(true)
    expect(css).toContain('@media (max-width: 767px) {\n  [data-screen-key="s1"] { --image: url("/tall.jpg") !important; background-position: 50% 30% !important; }\n}')
  })

  it('свои экраны у нескольких слайдов — разные ключи; данные элемента в копии экрана те же', () => {
    const r = (img: string) => ({ image: { tablet: img } })
    const out = substitute(page(), { name: 'Harizma', heroSlides: [slide({ _responsive: r('/t1.jpg') }), slide({ _responsive: r('/t2.jpg') })] })
    const [a, b] = out.children[0].children
    expect([a.attributes['data-screen-key'], b.attributes['data-screen-key']]).toEqual(['s1', 's2'])
    expect(a.children[0].content).toBe('Harizma')
    expect(out.metadata.globalCss).toContain('[data-screen-key="s2"] { --image: url("/t2.jpg") !important; }')
  })

  it('исходная структура не меняется (шаблон публикуется для каждого проекта)', () => {
    const tpl = page()
    const before = JSON.stringify(tpl)
    substitute(tpl, { heroSlides: [slide({ _responsive: { image: { mobile: '/m.jpg' } } })] })
    expect(JSON.stringify(tpl)).toBe(before)
  })
})
