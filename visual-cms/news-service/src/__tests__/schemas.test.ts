import { createNewsSchema, deployedSchema, dictionarySchema, sectionSchema, updateNewsSchema } from '../schemas/news.schema'
import { S1 } from './helpers/newsFixtures'

describe('схемы ввода', () => {
  it('секция: id обязателен и uuid; тип и сторона — из списка; значения по умолчанию', () => {
    expect(sectionSchema.parse({ id: S1, type: 'text' })).toEqual({ id: S1, type: 'text', html: '', media: [], side: 'right' })
    expect(sectionSchema.safeParse({ type: 'text' }).success).toBe(false)
    expect(sectionSchema.safeParse({ id: 'x', type: 'text' }).success).toBe(false)
    expect(sectionSchema.safeParse({ id: S1, type: 'video' }).success).toBe(false)
    expect(sectionSchema.safeParse({ id: S1, type: 'text', side: 'top' }).success).toBe(false)
  })

  it('создание: нужен непустой заголовок; адрес — латиница, цифры, дефисы', () => {
    expect(createNewsSchema.safeParse({ title: 'Новость' }).success).toBe(true)
    expect(createNewsSchema.safeParse({}).success).toBe(false)
    expect(createNewsSchema.safeParse({ title: '   ' }).success).toBe(false)
    expect(createNewsSchema.safeParse({ title: 'x', slug: 'Новость' }).success).toBe(false)
    expect(createNewsSchema.safeParse({ title: 'x', slug: 'a--b' }).success).toBe(false)
    expect(createNewsSchema.safeParse({ title: 'x', slug: 'vaucher-makro-2' }).success).toBe(true)
  })

  it('обновление частичное; языки — только uz/en; переводы секций по uuid', () => {
    expect(updateNewsSchema.safeParse({}).success).toBe(true)
    expect(updateNewsSchema.safeParse({ publishOn: ['ru'] }).success).toBe(false)
    expect(updateNewsSchema.safeParse({ translations: { kk: { title: 'x' } } }).success).toBe(false)
    expect(updateNewsSchema.safeParse({ translations: { uz: { sections: { [S1]: '<p>a</p>' } } } }).success).toBe(true)
    expect(updateNewsSchema.safeParse({ translations: { uz: { sections: { 'not-uuid': '<p>a</p>' } } } }).success).toBe(false)
    expect(updateNewsSchema.safeParse({ publishedAt: '2026-10-05T10:00:00+05:00' }).success).toBe(true)
    expect(updateNewsSchema.safeParse({ publishedAt: '5 октября' }).success).toBe(false)
  })

  it('словарь: ключ латиницей, имя ru обязательно', () => {
    expect(dictionarySchema.parse({ key: 'promo', nameRu: 'Акции' })).toEqual({ key: 'promo', nameRu: 'Акции', nameUz: '', nameEn: '', order: 0, hidden: false })
    expect(dictionarySchema.safeParse({ key: 'Акции', nameRu: 'Акции' }).success).toBe(false)
    expect(dictionarySchema.safeParse({ key: 'promo', nameRu: '' }).success).toBe(false)
  })

  it('отчёт о деплое', () => {
    expect(deployedSchema.safeParse({ locale: 'uz', slugs: ['a', 'b'] }).success).toBe(true)
    expect(deployedSchema.safeParse({ locale: 'kk', slugs: [] }).success).toBe(false)
  })
})
