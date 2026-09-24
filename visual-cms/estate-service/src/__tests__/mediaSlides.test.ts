/**
 * Слайды медиа-каруселей: фото и видео в одной галерее, кадрирование слайда.
 */
import { galleryItemSchema } from '../schemas/estate.schema'
import { aboutSlides, galleryUrls, isVideoUrl, readGallery, toSlides } from '../services/mediaSlides'

/** Слайд без настроек кадрирования. */
const plain = (url: string, image: string, video: string) => ({ url, image, video, position: '50% 50%', fit: 'cover' })

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
    expect(toSlides(['/a.webp'])).toEqual([plain('/a.webp', '/a.webp', '')])
  })

  it('постер видео — первое фото той же галереи', () => {
    const slides = toSlides(['/v.mp4', '/p1.webp', '/p2.webp'], '/fallback.webp')
    expect(slides[0]).toEqual(plain('/v.mp4', '/p1.webp', '/v.mp4'))
  })

  it('в галерее только видео — постер из запасной картинки', () => {
    expect(toSlides(['/v.mp4'], '/fallback.webp')[0].image).toBe('/fallback.webp')
  })

  it('мусор, пробелы и пустые строки отбрасываются; не массив — пусто', () => {
    expect(toSlides([' /a.webp ', '', null, 5] as unknown[])).toEqual([plain('/a.webp', '/a.webp', '')])
    expect(toSlides(undefined)).toEqual([])
    expect(toSlides('a' as unknown)).toEqual([])
  })

  it('порядок слайдов = порядок в галерее', () => {
    expect(toSlides(['/1.webp', '/2.mp4', '/3.webp']).map((s) => s.url)).toEqual(['/1.webp', '/2.mp4', '/3.webp'])
  })
})

describe('кадрирование слайда', () => {
  it('фокус становится позицией кадра', () => {
    expect(toSlides([{ url: '/a.webp', focus: { x: 30, y: 80 } }])[0]).toEqual({
      url: '/a.webp',
      image: '/a.webp',
      video: '',
      position: '30% 80%',
      fit: 'cover',
    })
  })

  it('у видео фокус тот же: по нему рантайм ставит object-position', () => {
    const [slide] = toSlides([{ url: '/v.mp4', focus: { x: 10, y: 20 } }, '/p.webp'])
    expect(slide).toMatchObject({ video: '/v.mp4', image: '/p.webp', position: '10% 20%' })
  })

  it('«целиком» — всегда по центру: кадр виден полностью, фокус лишь сдвинул бы его к краю', () => {
    expect(toSlides([{ url: '/a.webp', focus: { x: 0, y: 100 }, fit: 'contain' }])[0]).toMatchObject({
      position: '50% 50%',
      fit: 'contain',
    })
  })

  it('строки и объекты в одной галерее, объект без ссылки отбрасывается', () => {
    expect(toSlides(['/a.webp', { url: ' /b.webp ', fit: 'contain' }, { focus: { x: 1, y: 1 } }]).map((s) => [s.url, s.fit])).toEqual([
      ['/a.webp', 'cover'],
      ['/b.webp', 'contain'],
    ])
  })

  it('фокус за пределами кадра прижимается к краю, неполный или нечисловой — игнорируется', () => {
    expect(readGallery([{ url: '/a', focus: { x: -5, y: 140 } }])[0].focus).toEqual({ x: 0, y: 100 })
    expect(readGallery([{ url: '/a', focus: { x: 20 } }])[0].focus).toBeNull()
    expect(readGallery([{ url: '/a', focus: { x: '20', y: 5 } }])[0].focus).toBeNull()
    expect(readGallery([{ url: '/a', focus: { x: NaN, y: 5 } }])[0].focus).toBeNull()
  })

  it('неизвестное вписывание — «заполнить»', () => {
    expect(readGallery([{ url: '/a', fit: 'stretch' }])[0].fit).toBe('cover')
  })

  it('galleryUrls отдаёт только ссылки в исходном порядке', () => {
    expect(galleryUrls(['/a', { url: '/b', focus: { x: 1, y: 2 } }, ''])).toEqual(['/a', '/b'])
  })
})

describe('galleryItemSchema', () => {
  it('принимает строку и объект с кадрированием', () => {
    expect(galleryItemSchema.safeParse('/a.webp').success).toBe(true)
    expect(galleryItemSchema.safeParse({ url: '/a.webp', focus: { x: 0, y: 100 }, fit: 'contain' }).success).toBe(true)
    expect(galleryItemSchema.safeParse({ url: '/a.webp' }).success).toBe(true)
  })

  it('отклоняет фокус вне 0..100, неизвестное вписывание и объект без ссылки', () => {
    expect(galleryItemSchema.safeParse({ url: '/a', focus: { x: 101, y: 0 } }).success).toBe(false)
    expect(galleryItemSchema.safeParse({ url: '/a', fit: 'stretch' }).success).toBe(false)
    expect(galleryItemSchema.safeParse({ url: '' }).success).toBe(false)
    expect(galleryItemSchema.safeParse({ focus: { x: 1, y: 1 } }).success).toBe(false)
  })
})

describe('aboutSlides', () => {
  const media = '/about.webp'

  it('заполненная галерея — её слайды, постер видео по умолчанию картинка проекта', () => {
    expect(aboutSlides({ gallery: ['/v1.mp4', '/v2.mp4'], aboutVideo: '/old.mp4', media })).toEqual([
      plain('/v1.mp4', media, '/v1.mp4'),
      plain('/v2.mp4', media, '/v2.mp4'),
    ])
  })

  it('кадрирование галереи «О проекте» тоже доходит до слайдов', () => {
    expect(aboutSlides({ gallery: [{ url: '/a.webp', focus: { x: 40, y: 60 } }], media })[0].position).toBe('40% 60%')
  })

  it('галерея пуста, видео есть — один видеослайд (навигации не будет)', () => {
    expect(aboutSlides({ gallery: [], aboutVideo: ' /old.mp4 ', media })).toEqual([plain('/old.mp4', media, '/old.mp4')])
  })

  it('ни галереи, ни видео — картинка проекта одним слайдом', () => {
    expect(aboutSlides({ gallery: [], aboutVideo: '', media })).toEqual([plain(media, media, '')])
  })

  it('совсем пусто — пусто', () => {
    expect(aboutSlides({})).toEqual([])
  })
})
