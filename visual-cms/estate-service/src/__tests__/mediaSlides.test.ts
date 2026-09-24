/**
 * Слайды медиа-каруселей: фото и видео в одной галерее.
 */
import { aboutSlides, isVideoUrl, toSlides } from '../services/mediaSlides'

describe('isVideoUrl', () => {
  it('видео по расширению, с query и без учёта регистра', () => {
    for (const url of ['/media/a.mp4', '/a.WEBM', 'https://cdn/x.mov?v=2', '/b.m4v#t=3', '/c.ogv']) {
      expect(isVideoUrl(url)).toBe(true)
    }
  })

  it('фото и прочее — не видео', () => {
    for (const url of ['/a.webp', '/a.opt.webp', '/mp4/a.jpg', '/video.png']) {
      expect(isVideoUrl(url)).toBe(false)
    }
  })
})

describe('toSlides', () => {
  it('фото — фон и есть фото, видео пусто', () => {
    expect(toSlides(['/a.webp'])).toEqual([{ url: '/a.webp', image: '/a.webp', video: '' }])
  })

  it('постер видео — первое фото той же галереи', () => {
    const slides = toSlides(['/v.mp4', '/p1.webp', '/p2.webp'], '/fallback.webp')
    expect(slides[0]).toEqual({ url: '/v.mp4', image: '/p1.webp', video: '/v.mp4' })
  })

  it('в галерее только видео — постер из запасной картинки', () => {
    expect(toSlides(['/v.mp4'], '/fallback.webp')[0].image).toBe('/fallback.webp')
  })

  it('мусор, пробелы и пустые строки отбрасываются; не массив — пусто', () => {
    expect(toSlides([' /a.webp ', '', null, 5] as unknown[])).toEqual([{ url: '/a.webp', image: '/a.webp', video: '' }])
    expect(toSlides(undefined)).toEqual([])
    expect(toSlides('a' as unknown)).toEqual([])
  })

  it('порядок слайдов = порядок в галерее', () => {
    expect(toSlides(['/1.webp', '/2.mp4', '/3.webp']).map((s) => s.url)).toEqual(['/1.webp', '/2.mp4', '/3.webp'])
  })
})

describe('aboutSlides', () => {
  const media = '/about.webp'

  it('заполненная галерея — её слайды, постер видео по умолчанию картинка проекта', () => {
    expect(aboutSlides({ gallery: ['/v1.mp4', '/v2.mp4'], aboutVideo: '/old.mp4', media })).toEqual([
      { url: '/v1.mp4', image: media, video: '/v1.mp4' },
      { url: '/v2.mp4', image: media, video: '/v2.mp4' },
    ])
  })

  it('галерея пуста, видео есть — один видеослайд (навигации не будет)', () => {
    expect(aboutSlides({ gallery: [], aboutVideo: ' /old.mp4 ', media })).toEqual([
      { url: '/old.mp4', image: media, video: '/old.mp4' },
    ])
  })

  it('ни галереи, ни видео — картинка проекта одним слайдом', () => {
    expect(aboutSlides({ gallery: [], aboutVideo: '', media })).toEqual([{ url: media, image: media, video: '' }])
  })

  it('совсем пусто — пусто', () => {
    expect(aboutSlides({})).toEqual([])
  })
})
