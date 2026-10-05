import type { Dictionaries, DictionaryRow, NewsRow, NewsSection, TrRow } from '../../services/news'

export const S1 = '11111111-1111-4111-8111-111111111111'
export const S2 = '22222222-2222-4222-8222-222222222222'
export const S3 = '33333333-3333-4333-8333-333333333333'

export function section(id: string, overrides: Partial<NewsSection> = {}): NewsSection {
  return { id, type: 'text', html: '<p>Текст секции</p>', media: [], side: 'right', ...overrides }
}

let counter = 0
export function newsRow(overrides: Partial<NewsRow> = {}): NewsRow {
  counter++
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    slug: `news-${counter}`,
    status: 'published',
    publishedAt: new Date('2026-10-01T06:00:00Z'),
    categoryKey: 'news',
    tagKeys: [],
    title: 'Заголовок',
    lead: 'Анонс',
    cover: null,
    hero: ['/media/hero.webp'],
    sections: [section(S1)],
    publishOn: [],
    createdAt: new Date('2026-09-30T06:00:00Z'),
    ...overrides,
  }
}

/** Полный перевод новости на язык. */
export function fullTranslation(news: NewsRow, locale: 'uz' | 'en', prefix = 'UZ'): TrRow[] {
  const sections: Record<string, { html: string }> = {}
  for (const s of news.sections) sections[s.id] = { html: `<p>${prefix} ${s.id.slice(0, 4)}</p>` }
  return [
    { newsId: news.id, locale, field: 'title', value: `${prefix} заголовок` },
    { newsId: news.id, locale, field: 'lead', value: `${prefix} анонс` },
    { newsId: news.id, locale, field: 'sections', value: JSON.stringify(sections) },
  ]
}

export function dictRow(key: string, nameRu: string, overrides: Partial<DictionaryRow> = {}): DictionaryRow {
  return { key, nameRu, nameUz: '', nameEn: '', order: 0, hidden: false, ...overrides }
}

export function dictionaries(): Dictionaries {
  return {
    categories: new Map([
      ['news', dictRow('news', 'Новости', { nameUz: 'Yangiliklar', order: 1 })],
      ['promo', dictRow('promo', 'Акции', { order: 2 })],
    ]),
    tags: new Map([
      ['mortgage', dictRow('mortgage', 'Ипотека', { nameUz: 'Ipoteka' })],
      ['installment', dictRow('installment', 'Рассрочка')],
      ['harizma', dictRow('harizma', 'Harizma')],
      ['old', dictRow('old', 'Старый', { hidden: true })],
    ]),
  }
}
