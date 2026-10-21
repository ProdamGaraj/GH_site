/**
 * Медиа элементов повтора по экранам: item._responsive → правила CSS страницы
 * (фон, позиция кадра) и карта атрибутов узла (видео слайда).
 */
import {
  SCREEN_ATTRS_ATTR,
  SCREEN_KEY_ATTR,
  ScreenMediaCollector,
  applyScreenVariant,
  itemForScreen,
  screenIdsOf,
  templateScreens,
} from '../services/screenMedia'

const BREAKPOINTS = [
  { id: 'desktop-hd', name: 'Desktop HD', width: 1440 },
  { id: 'desktop-fhd', name: 'Desktop FHD', width: 1920 },
  { id: 'tablet', name: 'Tablet', width: 768 },
  { id: 'mobile', name: 'Mobile', width: 375 },
]

describe('screenIdsOf / itemForScreen', () => {
  const item = {
    image: '/wide.jpg',
    video: '/wide.mp4',
    _responsive: { image: { mobile: '/tall.jpg' }, video: { mobile: '', tablet: '/mid.mp4' }, junk: 'x' },
  }

  it('экраны — все, у которых есть хоть одно строковое значение', () => {
    expect(screenIdsOf(item).sort()).toEqual(['mobile', 'tablet'])
    expect(screenIdsOf({ image: '/a.jpg' })).toEqual([])
    expect(screenIdsOf(null)).toEqual([])
    expect(screenIdsOf({ _responsive: [1, 2] })).toEqual([])
  })

  it('элемент на экране: подменены поля этого экрана, пустая строка — тоже значение', () => {
    expect(itemForScreen(item, 'mobile')).toMatchObject({ image: '/tall.jpg', video: '' })
    expect(itemForScreen(item, 'tablet')).toMatchObject({ image: '/wide.jpg', video: '/mid.mp4' })
    expect(itemForScreen(item, 'desktop-hd')).toMatchObject({ image: '/wide.jpg', video: '/wide.mp4' })
  })
})

describe('applyScreenVariant', () => {
  const node = (props: Record<string, string>, attrs: Record<string, string> = {}, children: any[] = []) => ({
    styles: { properties: props },
    attributes: attrs,
    children,
  })

  it('разница стилей — ключ узлу и правило экрана; одинаковые стили — без правила', () => {
    const c = new ScreenMediaCollector()
    const base = node({ '--image': 'url("/wide.jpg")', backgroundPosition: '10% 20%', width: '100%' })
    applyScreenVariant(base, node({ '--image': 'url("/tall.jpg")', backgroundPosition: '50% 30%', width: '100%' }), 'mobile', c)
    expect(base.attributes[SCREEN_KEY_ATTR]).toBe('s1')
    const css = c.css(BREAKPOINTS)
    expect(css).toContain('[data-screen-key="s1"] { --image: url("/tall.jpg") !important; background-position: 50% 30% !important; }')
    expect(css).not.toContain('width: 100%')

    const same = node({ '--image': 'url("/a.jpg")' })
    applyScreenVariant(same, node({ '--image': 'url("/a.jpg")' }), 'tablet', c)
    expect(same.attributes).not.toHaveProperty(SCREEN_KEY_ATTR)
  })

  it('разница атрибутов — карта по экранам на узле, экраны копятся', () => {
    const c = new ScreenMediaCollector()
    const base = node({}, { 'data-slide-video': '/wide.mp4', class: 'slide' })
    applyScreenVariant(base, node({}, { 'data-slide-video': '', class: 'slide' }), 'mobile', c)
    applyScreenVariant(base, node({}, { 'data-slide-video': '/mid.mp4', class: 'slide' }), 'tablet', c)
    expect(JSON.parse(base.attributes[SCREEN_ATTRS_ATTR] as string)).toEqual({ 'data-slide-video': { mobile: '', tablet: '/mid.mp4' } })
    expect(c.size).toBe(0)
  })

  it('дети сравниваются по порядку; другое число детей — вглубь не идём', () => {
    const c = new ScreenMediaCollector()
    const base = node({}, {}, [node({ backgroundImage: 'url("/a.jpg")' })])
    applyScreenVariant(base, node({}, {}, [node({ backgroundImage: 'url("/m.jpg")' })]), 'mobile', c)
    expect(base.children[0].attributes[SCREEN_KEY_ATTR]).toBe('s1')

    const other = node({}, {}, [node({ backgroundImage: 'url("/a.jpg")' })])
    applyScreenVariant(other, node({}, {}, [node({}), node({})]), 'mobile', c)
    expect(other.children[0].attributes).not.toHaveProperty(SCREEN_KEY_ATTR)
  })

  it('значение, которое закрыло бы правило или тег, в CSS не попадает', () => {
    const c = new ScreenMediaCollector()
    const base = node({ backgroundImage: 'url("/a.jpg")', backgroundPosition: 'center' })
    applyScreenVariant(base, node({ backgroundImage: 'url("/x.jpg");}</style><script>', backgroundPosition: 'top' }), 'mobile', c)
    const css = c.css(BREAKPOINTS)
    expect(css).not.toContain('</style>')
    expect(css).toContain('background-position: top !important;')
  })
})

describe('ScreenMediaCollector.css', () => {
  it('от широкого к узкому; самый широкий — без условия, остальные — до верхней границы экрана', () => {
    const c = new ScreenMediaCollector()
    const key = c.keyOf({})
    c.addRule('mobile', key, { backgroundImage: 'url("/m.jpg")' })
    c.addRule('desktop-fhd', key, { backgroundImage: 'url("/f.jpg")' })
    c.addRule('tablet', key, { backgroundImage: 'url("/t.jpg")' })
    const css = c.css(BREAKPOINTS)
    const fhd = css.indexOf('/f.jpg')
    const tablet = css.indexOf('@media (max-width: 1439px)')
    const mobile = css.indexOf('@media (max-width: 767px)')
    expect(fhd).toBeGreaterThan(-1)
    expect(fhd).toBeLessThan(tablet)
    expect(tablet).toBeLessThan(mobile)
    expect(css.slice(0, fhd)).not.toContain('@media')
  })

  it('экран, которого нет у страницы, и страница без экранов — без CSS', () => {
    const c = new ScreenMediaCollector()
    c.addRule('watch', c.keyOf({}), { backgroundImage: 'url("/w.jpg")' })
    expect(c.css(BREAKPOINTS)).toBe('')
    expect(c.css(undefined)).toBe('')
    expect(new ScreenMediaCollector().css(BREAKPOINTS)).toBe('')
  })

  it('ключи уникальны на страницу, у узла — один', () => {
    const c = new ScreenMediaCollector()
    const a = {}
    expect(c.keyOf(a)).toBe('s1')
    expect(c.keyOf(a)).toBe('s1')
    expect(c.keyOf({})).toBe('s2')
  })
})

describe('templateScreens', () => {
  it('экраны шаблонов: без повторов по id, от широкого к узкому, мусор отброшен', () => {
    expect(
      templateScreens([
        [{ id: 'desktop-hd', name: 'Desktop HD', width: 1440 }, { id: 'mobile', name: 'Mobile', width: 375 }],
        [{ id: 'mobile', name: 'Другой', width: 390 }, { id: 'tablet', width: 768 }, { id: '', width: 1 }, { id: 'x' }, null],
        null,
        'junk',
      ]),
    ).toEqual([
      { id: 'desktop-hd', name: 'Desktop HD', width: 1440 },
      { id: 'tablet', name: 'tablet', width: 768 },
      { id: 'mobile', name: 'Mobile', width: 375 },
    ])
  })
})
