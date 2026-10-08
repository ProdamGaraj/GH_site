/**
 * Ядро: языки, полнота перевода, доступность и данные шаблонов (секции
 * шаблона-конструктора — ровно одна непустая заготовка на секцию).
 */
import {
  buildCard,
  buildDetail,
  buildSection,
  byNewest,
  isAvailableIn,
  missingTranslation,
  normalizeLocale,
  searchText,
  textIn,
} from '../services/news'
import { S1, S2, S3, dictionaries, fullTranslation, newsRow, section } from './helpers/newsFixtures'

describe('языки', () => {
  it('normalizeLocale: неизвестное — ru', () => {
    expect(normalizeLocale('UZ')).toBe('uz')
    expect(normalizeLocale('kk')).toBe('ru')
    expect(normalizeLocale(undefined)).toBe('ru')
  })

  it('ru — база; перевод без фолбэка на ru', () => {
    const news = newsRow()
    expect(textIn(news, [], 'ru').title).toBe('Заголовок')
    expect(textIn(news, [], 'uz')).toEqual({ title: '', lead: '', sections: {}, blocks: {} })
    expect(textIn(news, fullTranslation(news, 'uz'), 'uz').title).toBe('UZ заголовок')
  })

  it('чужие переводы и битый json секций не мешают', () => {
    const news = newsRow()
    const other = newsRow()
    const rows = [
      ...fullTranslation(other, 'uz'),
      { newsId: news.id, locale: 'uz', field: 'sections', value: '{не json' },
    ]
    expect(textIn(news, rows, 'uz')).toEqual({ title: '', lead: '', sections: {}, blocks: {} })
  })
})

describe('missingTranslation', () => {
  it('ничего не переведено — заголовок, анонс и каждая секция с текстом', () => {
    const news = newsRow({ sections: [section(S1), section(S2, { html: '<p></p>' }), section(S3)] })
    expect(missingTranslation(news, [], 'uz')).toEqual(['title', 'lead', 'section:1', 'section:3'])
  })

  it('пустой анонс и секция без текста перевода не ждут', () => {
    const news = newsRow({ lead: '', sections: [section(S1, { type: 'photoText', html: '', media: ['/a.webp'] })] })
    expect(missingTranslation(news, [{ newsId: news.id, locale: 'uz', field: 'title', value: 'Sarlavha' }], 'uz')).toEqual([])
  })

  it('полный перевод — пусто; ru — всегда пусто', () => {
    const news = newsRow({ sections: [section(S1), section(S2)] })
    expect(missingTranslation(news, fullTranslation(news, 'uz'), 'uz')).toEqual([])
    expect(missingTranslation(news, [], 'ru')).toEqual([])
  })

  it('перевод секции пустым абзацем — не перевод', () => {
    const news = newsRow()
    const rows = fullTranslation(news, 'uz').map((r) => (r.field === 'sections' ? { ...r, value: JSON.stringify({ [S1]: { html: '<p> </p>' } }) } : r))
    expect(missingTranslation(news, rows, 'uz')).toEqual(['section:1'])
  })
})

describe('isAvailableIn', () => {
  it('черновик и архив не видны нигде', () => {
    for (const status of ['draft', 'archived'] as const) {
      const news = newsRow({ status, publishOn: ['uz'] })
      expect(isAvailableIn(news, fullTranslation(news, 'uz'), 'ru')).toBe(false)
      expect(isAvailableIn(news, fullTranslation(news, 'uz'), 'uz')).toBe(false)
    }
  })

  it('опубликованная видна на ru всегда, на uz — только с отметкой и полным переводом', () => {
    const news = newsRow()
    const tr = fullTranslation(news, 'uz')
    expect(isAvailableIn(news, [], 'ru')).toBe(true)
    expect(isAvailableIn(news, tr, 'uz')).toBe(false) // перевод есть, отметки нет
    expect(isAvailableIn({ ...news, publishOn: ['uz'] }, [], 'uz')).toBe(false) // отметка есть, перевода нет
    expect(isAvailableIn({ ...news, publishOn: ['uz'] }, tr, 'uz')).toBe(true)
    expect(isAvailableIn({ ...news, publishOn: ['uz'] }, tr, 'en')).toBe(false)
  })

  it('отметка стоит, добавили секцию без перевода — выпадает из uz до перевода', () => {
    const news = newsRow({ publishOn: ['uz'] })
    const tr = fullTranslation(news, 'uz')
    const grown = { ...news, sections: [...news.sections, section(S2)] }
    expect(isAvailableIn(grown, tr, 'uz')).toBe(false)
    expect(isAvailableIn(grown, tr, 'ru')).toBe(true)
  })

  it('без даты публикации не видна', () => {
    expect(isAvailableIn(newsRow({ publishedAt: null }), [], 'ru')).toBe(false)
  })
})

describe('buildSection — ровно одна заготовка', () => {
  it('текст', () => {
    expect(buildSection(section(S1), '<p>т</p>')).toEqual({ id: S1, type: 'text', side: 'right', text: [{ html: '<p>т</p>' }], photoText: [], sliderText: [], block: [] })
  })

  it('фото + текст: первое фото, точка фокуса, сторона', () => {
    const dto = buildSection(section(S1, { type: 'photoText', side: 'left', media: [{ url: '/a.webp', focus: { x: 30, y: 70 } }, '/b.webp'] }), '<p>т</p>')
    expect(dto.text).toEqual([])
    expect(dto.sliderText).toEqual([])
    expect(dto.photoText).toEqual([{ html: '<p>т</p>', image: '/a.webp', position: '30% 70%', fit: 'cover', side: 'left' }])
  })

  it('слайдер + текст: все слайды, видео с постером из фото галереи', () => {
    const dto = buildSection(section(S1, { type: 'sliderText', media: ['/a.webp', '/v.mp4'] }), '<p>т</p>')
    expect(dto.sliderText).toHaveLength(1)
    expect(dto.sliderText[0].slides.map((s) => [s.image, s.video])).toEqual([
      ['/a.webp', ''],
      ['/a.webp', '/v.mp4'],
    ])
  })

  it('фото + текст без фото и слайдер без слайдов — как текст (без пустой рамки)', () => {
    for (const type of ['photoText', 'sliderText'] as const) {
      const dto = buildSection(section(S1, { type, media: [] }), '<p>т</p>')
      expect(dto.text).toEqual([{ html: '<p>т</p>' }])
      expect(dto.photoText).toEqual([])
      expect(dto.sliderText).toEqual([])
    }
  })
})

describe('карточка и страница', () => {
  const dict = dictionaries()

  it('карточка: адрес с языком, дата, рубрика 0..1, теги, обложка — первое фото hero', () => {
    const news = newsRow({ slug: 'vaucher-makro', tagKeys: ['mortgage', 'unknown'], hero: [{ url: '/h.webp', focus: { x: 10, y: 20 } }] })
    const card = buildCard(news, [], 'ru', dict)
    expect(card).toMatchObject({
      slug: 'vaucher-makro',
      url: '/ru/news/vaucher-makro/',
      lang: 'ru',
      date: '2026-10-01',
      dateLabel: '1 октября 2026',
      category: [{ key: 'news', name: 'Новости' }],
      categoryKey: 'news',
      tags: [{ key: 'mortgage', name: 'Ипотека' }],
      cover: [{ image: '/h.webp', position: '10% 20%' }],
    })
  })

  it('своя обложка главнее hero; без фото — обложки нет', () => {
    expect(buildCard(newsRow({ cover: '/c.webp' }), [], 'ru', dict).cover).toEqual([{ image: '/c.webp', position: '50% 50%' }])
    expect(buildCard(newsRow({ hero: [] }), [], 'ru', dict).cover).toEqual([])
    expect(buildCard(newsRow({ hero: ['/only-video.mp4'] }), [], 'ru', dict).cover).toEqual([])
  })

  it('на uz: перевод текста, названия словарей — перевод или ru', () => {
    const news = newsRow({ publishOn: ['uz'], tagKeys: ['mortgage', 'installment'] })
    const card = buildCard(news, fullTranslation(news, 'uz'), 'uz', dict)
    expect(card.title).toBe('UZ заголовок')
    expect(card.url).toBe(`/uz/news/${news.slug}/`)
    expect(card.dateLabel).toBe('1-oktabr, 2026')
    expect(card.category).toEqual([{ key: 'news', name: 'Yangiliklar' }])
    expect(card.tags).toEqual([
      { key: 'mortgage', name: 'Ipoteka' },
      { key: 'installment', name: 'Рассрочка' },
    ])
  })

  it('страница: hero-слайды и секции в порядке хранения с текстом языка', () => {
    const news = newsRow({ publishOn: ['uz'], hero: ['/1.webp', '/2.webp'], sections: [section(S2), section(S1, { type: 'photoText', media: ['/p.webp'] })] })
    const detail = buildDetail(news, fullTranslation(news, 'uz'), 'uz', dict)
    expect(detail.hero.map((s) => s.image)).toEqual(['/1.webp', '/2.webp'])
    expect(detail.sections.map((s) => s.id)).toEqual([S2, S1])
    expect(detail.sections[0].text[0].html).toBe('<p>UZ 2222</p>')
    expect(detail.sections[1].photoText[0].html).toBe('<p>UZ 1111</p>')
  })

  it('без рубрики — пустой массив бейджа', () => {
    expect(buildCard(newsRow({ categoryKey: null }), [], 'ru', dict).category).toEqual([])
  })
})

describe('порядок и поиск', () => {
  it('от новых к старым; без даты публикации — по дате создания', () => {
    const a = newsRow({ publishedAt: new Date('2026-01-01') })
    const b = newsRow({ publishedAt: new Date('2026-05-01') })
    const c = newsRow({ publishedAt: null, createdAt: new Date('2026-03-01') })
    expect([a, b, c].sort(byNewest).map((n) => n.id)).toEqual([b.id, c.id, a.id])
  })

  it('текст для поиска: заголовок отдельно, тело — анонс и секции без разметки', () => {
    const news = newsRow({ title: 'Ипотека', lead: 'Анонс', sections: [section(S1, { html: '<p>Банк <strong>партнёр</strong></p>' })] })
    expect(searchText(news, [], 'ru')).toEqual({ title: 'Ипотека', body: 'Анонс Банк партнёр' })
  })
})
