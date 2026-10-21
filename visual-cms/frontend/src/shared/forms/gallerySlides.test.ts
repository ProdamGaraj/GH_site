import { describe, it, expect } from 'vitest'
import { focusAt, isVideoUrl, readGallery, slidePosition, withScreen, withUrls, writeGallery, type SlideSettings } from './gallerySlides'

const plain = (url: string): SlideSettings => ({ url, focus: null, fit: 'cover', theme: null, screens: {} })

describe('readGallery', () => {
  it('строки — слайды без настроек, объекты — с настройками', () => {
    expect(readGallery(['/a.jpg', { url: '/b.jpg', focus: { x: 30, y: 80 }, fit: 'contain', theme: null }])).toEqual([
      plain('/a.jpg'),
      { url: '/b.jpg', focus: { x: 30, y: 80 }, fit: 'contain', theme: null, screens: {} },
    ])
  })

  it('пустые ссылки, объекты без ссылки и мусор отбрасываются; не массив — пусто', () => {
    expect(readGallery([' ', '', { focus: { x: 1, y: 1 } }, null, 5, ' /a.jpg '])).toEqual([plain('/a.jpg')])
    expect(readGallery(undefined)).toEqual([])
    expect(readGallery(null)).toEqual([])
  })

  it('фокус вне кадра прижимается к краю, неполный — сбрасывается; неизвестное вписывание — «заполнить»', () => {
    expect(readGallery([{ url: '/a', focus: { x: -5, y: 140 } }])[0].focus).toEqual({ x: 0, y: 100 })
    expect(readGallery([{ url: '/a', focus: { x: 20 } }])[0].focus).toBeNull()
    expect(readGallery([{ url: '/a', fit: 'stretch' }])[0].fit).toBe('cover')
  })
})

describe('writeGallery', () => {
  it('слайд без настроек пишется строкой — данные без кадрирования не меняются', () => {
    expect(writeGallery([plain('/a.jpg')])).toEqual(['/a.jpg'])
  })

  it('с фокусом или «целиком» — объект, только с заданными полями', () => {
    expect(writeGallery([{ url: '/a', focus: { x: 10, y: 20 }, fit: 'cover', theme: null, screens: {} }])).toEqual([{ url: '/a', focus: { x: 10, y: 20 } }])
    expect(writeGallery([{ url: '/a', focus: null, fit: 'contain', theme: null, screens: {} }])).toEqual([{ url: '/a', fit: 'contain' }])
  })

  it('чтение и запись обратимы', () => {
    const items = ['/a', { url: '/b', focus: { x: 1, y: 2 } }, { url: '/c', fit: 'contain' as const }]
    expect(writeGallery(readGallery(items))).toEqual(items)
  })
})

describe('withUrls', () => {
  const framed: SlideSettings = { url: '/b', focus: { x: 10, y: 90 }, fit: 'cover', theme: null, screens: {} }

  it('переставили строки — настройки переехали вместе с фото', () => {
    expect(withUrls([plain('/a'), framed], ['/b', '/a'])).toEqual([framed, plain('/a')])
  })

  it('новая ссылка без настроек, удалённая — пропадает', () => {
    expect(withUrls([plain('/a'), framed], ['/a', '/new'])).toEqual([plain('/a'), plain('/new')])
  })

  it('одинаковые ссылки разбираются по порядку', () => {
    const first: SlideSettings = { url: '/a', focus: { x: 1, y: 1 }, fit: 'cover', theme: null, screens: {} }
    const second: SlideSettings = { url: '/a', focus: null, fit: 'contain', theme: null, screens: {} }
    expect(withUrls([first, second], ['/a', '/a'])).toEqual([first, second])
  })
})

describe('focusAt', () => {
  const rect = { left: 100, top: 50, width: 200, height: 100 }

  it('точка клика — в целых процентах кадра', () => {
    expect(focusAt(150, 75, rect)).toEqual({ x: 25, y: 25 })
    expect(focusAt(233, 50, rect)).toEqual({ x: 67, y: 0 })
  })

  it('клик за краем прижимается к краю; пустой кадр — центр', () => {
    expect(focusAt(0, 999, rect)).toEqual({ x: 0, y: 100 })
    expect(focusAt(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ x: 50, y: 50 })
  })
})

describe('slidePosition', () => {
  it('фокус — позиция кадра, без фокуса — центр', () => {
    expect(slidePosition({ ...plain('/a'), focus: { x: 30, y: 80 } })).toBe('30% 80%')
    expect(slidePosition(plain('/a'))).toBe('50% 50%')
  })

  it('«целиком» — всегда центр', () => {
    expect(slidePosition({ ...plain('/a'), focus: { x: 0, y: 0 }, fit: 'contain' })).toBe('50% 50%')
  })
})

describe('isVideoUrl', () => {
  it('видео по расширению', () => {
    expect(isVideoUrl('/a.mp4')).toBe(true)
    expect(isVideoUrl('/a.WEBM?x=1')).toBe(true)
    expect(isVideoUrl('/mp4/a.jpg')).toBe(false)
  })
})

describe('медиа по экранам', () => {
  const withScreens = { url: '/wide.jpg', screens: { mobile: { url: '/tall.jpg', focus: { x: 40, y: 20 } }, tablet: { url: '/mid.mp4' } } }

  it('чтение: экраны со ссылкой и фокусом; мусор, пустые ссылки и блоки отбрасываются', () => {
    const [slide] = readGallery([
      { ...withScreens, screens: { ...withScreens.screens, 'bad id': { url: '/x' }, 'desktop-hd': { url: ' ' }, x: { url: 'block:b' } } },
    ])
    expect(slide.screens).toEqual({ mobile: { url: '/tall.jpg', focus: { x: 40, y: 20 } }, tablet: { url: '/mid.mp4', focus: null } })
    expect(readGallery([{ url: 'block:b', screens: { mobile: { url: '/x.jpg' } } }])[0].screens).toEqual({})
  })

  it('запись: объект с экранами (фокус — только если задан); чтение и запись обратимы', () => {
    expect(writeGallery(readGallery([withScreens]))).toEqual([withScreens])
  })

  it('слайд только с экранами — объект, не строка', () => {
    expect(writeGallery([{ ...plain('/a'), screens: { mobile: { url: '/m', focus: null } } }])).toEqual([{ url: '/a', screens: { mobile: { url: '/m' } } }])
  })

  it('withScreen: задать, заменить фокус, очистить (пустая ссылка — экран снова берёт экран шире)', () => {
    const set = withScreen(plain('/a'), 'mobile', { url: ' /m.jpg ', focus: null })
    expect(set.screens).toEqual({ mobile: { url: '/m.jpg', focus: null } })
    expect(withScreen(set, 'mobile', { url: '/m.jpg', focus: { x: 1, y: 2 } }).screens.mobile.focus).toEqual({ x: 1, y: 2 })
    expect(withScreen(set, 'mobile', null).screens).toEqual({})
    expect(withScreen(set, 'mobile', { url: '  ', focus: null }).screens).toEqual({})
  })

  it('настройки экранов переезжают со слайдом при перестановке строк', () => {
    const framed = { ...plain('/b'), screens: { mobile: { url: '/m', focus: null } } }
    expect(withUrls([plain('/a'), framed], ['/b', '/a'])[0].screens).toEqual(framed.screens)
  })
})
