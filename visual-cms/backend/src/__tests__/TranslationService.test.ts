/**
 * TranslationService — юнит-тесты чистых функций (без БД).
 * Мокаем config/database, т.к. модуль создаёт синглтон с репозиториями на импорте.
 */
jest.mock('../config/database', () => ({
  AppDataSource: { getRepository: () => ({}) },
}))

import {
  parseCssUrl,
  toCssUrl,
  extractTranslatableFields,
  applyTranslationsToTree,
  BG_IMAGE_FIELD,
  looksLikeMediaUrl,
  extractVariableMediaFields,
  applyVariableMediaTranslations,
  extractResponsiveMediaFields,
} from '../services/TranslationService'

describe('parseCssUrl', () => {
  it('url("...")', () => expect(parseCssUrl('url("https://cdn/a.jpg")')).toBe('https://cdn/a.jpg'))
  it("url('...')", () => expect(parseCssUrl("url('https://cdn/a.jpg')")).toBe('https://cdn/a.jpg'))
  it('url(...) без кавычек', () => expect(parseCssUrl('url(https://cdn/a.jpg)')).toBe('https://cdn/a.jpg'))
  it('лишние пробелы внутри url()', () =>
    expect(parseCssUrl('  url(  "https://cdn/a.jpg"  )  ')).toBe('https://cdn/a.jpg'))
  it('градиент → null', () => expect(parseCssUrl('linear-gradient(#000, #fff)')).toBeNull())
  it('несколько фонов → null', () => expect(parseCssUrl('url(a.jpg), url(b.jpg)')).toBeNull())
  it('none / пусто / не строка → null', () => {
    expect(parseCssUrl('none')).toBeNull()
    expect(parseCssUrl('')).toBeNull()
    expect(parseCssUrl(undefined)).toBeNull()
    expect(parseCssUrl(123)).toBeNull()
  })
})

describe('toCssUrl', () => {
  it('оборачивает в url("...")', () =>
    expect(toCssUrl('https://cdn/a.jpg')).toBe('url("https://cdn/a.jpg")'))
  it('экранирует двойные кавычки', () => expect(toCssUrl('a"b.jpg')).toBe('url("a%22b.jpg")'))
})

describe('extractTranslatableFields — медиа', () => {
  it('извлекает data-slide-video', () => {
    const node = { id: 'n1', attributes: { 'data-slide-video': 'https://cdn/v.mp4' } }
    expect(extractTranslatableFields(node)).toContainEqual({
      nodeId: 'n1',
      field: 'data-slide-video',
      value: 'https://cdn/v.mp4',
    })
  })

  it('извлекает background-image как bg:image (голый URL)', () => {
    const node = { id: 'n1', styles: { properties: { backgroundImage: 'url("https://cdn/p.png")' } } }
    expect(extractTranslatableFields(node)).toContainEqual({
      nodeId: 'n1',
      field: BG_IMAGE_FIELD,
      value: 'https://cdn/p.png',
    })
  })

  it('градиентный фон НЕ извлекается', () => {
    const node = { id: 'n1', styles: { properties: { backgroundImage: 'linear-gradient(#000,#fff)' } } }
    expect(extractTranslatableFields(node).find((x) => x.field === BG_IMAGE_FIELD)).toBeUndefined()
  })

  it('рекурсивно проходит детей', () => {
    const tree = { id: 'root', children: [{ id: 'c1', attributes: { 'data-slide-video': 'v.mp4' } }] }
    expect(extractTranslatableFields(tree)).toContainEqual({
      nodeId: 'c1',
      field: 'data-slide-video',
      value: 'v.mp4',
    })
  })
})

describe('applyTranslationsToTree — медиа', () => {
  it('применяет перевод data-slide-video и bg:image, не мутируя оригинал', () => {
    const structure: any = {
      id: 'root',
      children: [
        { id: 'vid', attributes: { 'data-slide-video': 'orig.mp4' } },
        { id: 'photo', styles: { properties: { backgroundImage: 'url("orig.png")' } } },
      ],
    }
    const map = {
      vid: { 'data-slide-video': 'en.mp4' },
      photo: { [BG_IMAGE_FIELD]: 'en.png' },
    }
    const { structure: out } = applyTranslationsToTree(structure, map)
    expect(out.children[0].attributes['data-slide-video']).toBe('en.mp4')
    expect(out.children[1].styles.properties.backgroundImage).toBe('url("en.png")')
    // оригинал не тронут (работаем на глубокой копии)
    expect(structure.children[0].attributes['data-slide-video']).toBe('orig.mp4')
    expect(structure.children[1].styles.properties.backgroundImage).toBe('url("orig.png")')
  })

  it('создаёт styles.properties, если их не было', () => {
    const structure = { id: 'x' }
    const { structure: out } = applyTranslationsToTree(structure, { x: { [BG_IMAGE_FIELD]: 'a.png' } })
    expect(out.styles.properties.backgroundImage).toBe('url("a.png")')
  })

  it('переводит page-meta (title/description/ogImage)', () => {
    const { metadata } = applyTranslationsToTree(
      { id: 'root' },
      { __page__: { 'meta:title': 'T', 'meta:description': 'D', 'meta:ogImage': 'og.png' } },
      { title: 'orig', description: 'orig', ogImage: 'orig.png' }
    )
    expect(metadata).toMatchObject({ title: 'T', description: 'D', ogImage: 'og.png' })
  })
})

describe('looksLikeMediaUrl', () => {
  it('/media/... → true', () => expect(looksLikeMediaUrl('/media/x.png')).toBe(true))
  it('внешний mp4 → true', () => expect(looksLikeMediaUrl('https://cdn/v.mp4')).toBe(true))
  it('jpg с query → true', () => expect(looksLikeMediaUrl('/assets/a.jpg?v=2')).toBe(true))
  it('обычная ссылка → false', () => expect(looksLikeMediaUrl('/contact')).toBe(false))
  it('текст / не строка → false', () => {
    expect(looksLikeMediaUrl('Привет, мир')).toBe(false)
    expect(looksLikeMediaUrl(5)).toBe(false)
    expect(looksLikeMediaUrl(null)).toBe(false)
  })
})

describe('extractVariableMediaFields', () => {
  const envelope: any = {
    variables: [
      {
        name: 'heroSlides',
        type: 'array',
        defaultValue: [
          { _id: 'a', imageUrl: '/media/1.png', title: 'Заголовок', ctaHref: '/buy' },
          { _id: 'b', imageUrl: '/media/2.jpg', videoUrl: 'https://cdn/v.mp4' },
        ],
      },
      { name: 'count', type: 'number', defaultValue: 5 },
    ],
  }

  it('извлекает медиа-поля с синтетическими ключами pagevar:/media:', () => {
    const e = extractVariableMediaFields(envelope)
    expect(e).toContainEqual({ nodeId: 'pagevar:heroSlides', field: 'media:0:imageUrl', value: '/media/1.png' })
    expect(e).toContainEqual({ nodeId: 'pagevar:heroSlides', field: 'media:1:imageUrl', value: '/media/2.jpg' })
    expect(e).toContainEqual({ nodeId: 'pagevar:heroSlides', field: 'media:1:videoUrl', value: 'https://cdn/v.mp4' })
  })

  it('не берёт текст, ссылки и служебные поля (_*)', () => {
    const e = extractVariableMediaFields(envelope)
    expect(e.find((x) => x.field.includes('title'))).toBeUndefined()
    expect(e.find((x) => x.field.includes('ctaHref'))).toBeUndefined()
    expect(e.find((x) => x.field.includes('_id'))).toBeUndefined()
  })

  it('не-массивы / null игнорируются', () => {
    expect(extractVariableMediaFields({ variables: [{ name: 'count', defaultValue: 5 }] })).toEqual([])
    expect(extractVariableMediaFields(null)).toEqual([])
  })
})

describe('applyVariableMediaTranslations', () => {
  const makeVars = (): any => [
    {
      name: 'heroSlides',
      type: 'array',
      defaultValue: [{ imageUrl: '/media/orig1.png' }, { imageUrl: '/media/orig2.png' }],
    },
  ]

  it('накладывает перевод по ключам, не мутируя исходник', () => {
    const variables = makeVars()
    const map = { 'pagevar:heroSlides': { 'media:1:imageUrl': '/media/en2.png' } }
    const out: any = applyVariableMediaTranslations(variables, map)
    expect(out[0].defaultValue[1].imageUrl).toBe('/media/en2.png')
    expect(out[0].defaultValue[0].imageUrl).toBe('/media/orig1.png')
    // исходник не тронут (работаем на копии)
    expect(variables[0].defaultValue[1].imageUrl).toBe('/media/orig2.png')
  })

  it('нет подходящих ключей → возвращает исходный массив (без копии)', () => {
    const variables = makeVars()
    expect(applyVariableMediaTranslations(variables, { x: { content: 'y' } })).toBe(variables)
  })

  it('индекс за границей / отсутствующая переменная — безопасно игнорируются', () => {
    const variables = makeVars()
    const map = {
      'pagevar:heroSlides': { 'media:9:imageUrl': 'z' },
      'pagevar:missing': { 'media:0:imageUrl': 'z' },
    }
    const out: any = applyVariableMediaTranslations(variables, map)
    expect(out[0].defaultValue.length).toBe(2)
    expect(out[0].defaultValue[0].imageUrl).toBe('/media/orig1.png')
  })
})

describe('extractResponsiveMediaFields', () => {
  it('извлекает src@bp и bg:image@bp из inheritedOverrides variations', () => {
    const root = {
      id: 'root',
      children: [
        { id: 'img1', tagName: 'img', attributes: { src: '/base.jpg' } },
        { id: 'hero', styles: { properties: { backgroundImage: 'url("/base.png")' } } },
      ],
      variations: {
        mobile: {
          inheritedOverrides: {
            img1: { attributes: { src: '/m.jpg' } },
            hero: { styles: { backgroundImage: 'url("/m.png")' } },
          },
        },
      },
    }
    const out = extractResponsiveMediaFields(root)
    expect(out).toEqual(
      expect.arrayContaining([
        { nodeId: 'img1', field: 'src@mobile', value: '/m.jpg' },
        { nodeId: 'hero', field: `${BG_IMAGE_FIELD}@mobile`, value: '/m.png' },
      ]),
    )
  })

  it('градиент в оверрайде фона не даёт bg-поля (не url())', () => {
    const root = {
      id: 'root',
      children: [{ id: 'hero' }],
      variations: {
        tablet: { inheritedOverrides: { hero: { styles: { backgroundImage: 'linear-gradient(#000,#fff)' } } } },
      },
    }
    const out = extractResponsiveMediaFields(root)
    expect(out.find((e) => e.field.startsWith(BG_IMAGE_FIELD))).toBeUndefined()
  })

  it('нет variations — пустой список', () => {
    expect(extractResponsiveMediaFields({ id: 'x', children: [] })).toEqual([])
  })
})
