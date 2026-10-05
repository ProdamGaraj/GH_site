import { describe, expect, it } from 'vitest'
import {
  describeBlockedLocales,
  draftOf,
  fromLocalInput,
  hasText,
  isDirty,
  missingLabel,
  missingTranslation,
  moveSection,
  newSection,
  removeSection,
  toLocalInput,
  updateSection,
} from './newsForm'
import type { NewsDetail, NewsDraft } from './types'

const S1 = '11111111-1111-4111-8111-111111111111'
const S2 = '22222222-2222-4222-8222-222222222222'

function detail(overrides: Partial<NewsDetail> = {}): NewsDetail {
  return {
    id: 'n1',
    slug: 'vaucher',
    slugLocked: false,
    status: 'draft',
    publishedAt: null,
    categoryKey: 'promo',
    tagKeys: ['mortgage'],
    title: 'Ваучер',
    lead: 'Анонс',
    cover: null,
    hero: ['/media/a.webp'],
    sections: [{ id: S1, type: 'text', html: '<p>Текст</p>', media: [], side: 'right' }],
    publishOn: [],
    translations: { uz: { title: '', lead: '', sections: {} }, en: { title: '', lead: '', sections: {} } },
    locales: { uz: { enabled: false, missing: [] }, en: { enabled: false, missing: [] } },
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    ...overrides,
  }
}

describe('draftOf', () => {
  it('только правимые поля; копии, а не ссылки на ответ сервиса', () => {
    const news = detail()
    const draft = draftOf(news)
    expect(draft).not.toHaveProperty('id')
    expect(draft).not.toHaveProperty('status')
    draft.sections[0].html = 'изменено'
    draft.tagKeys.push('x')
    expect(news.sections[0].html).toBe('<p>Текст</p>')
    expect(news.tagKeys).toEqual(['mortgage'])
  })

  it('нет перевода на язык в ответе — пустой перевод', () => {
    const news = detail({ translations: { uz: { title: 'T', lead: '', sections: {} } } as NewsDetail['translations'] })
    expect(draftOf(news).translations.en).toEqual({ title: '', lead: '', sections: {} })
  })
})

describe('секции', () => {
  const list = [
    { id: 'a', type: 'text' as const, html: '', media: [], side: 'right' as const },
    { id: 'b', type: 'photoText' as const, html: '', media: [], side: 'left' as const },
    { id: 'c', type: 'sliderText' as const, html: '', media: [], side: 'right' as const },
  ]

  it('новый блок: уникальный uuid, пустой текст, медиа справа', () => {
    const a = newSection('photoText')
    const b = newSection('photoText')
    expect(a).toMatchObject({ type: 'photoText', html: '', media: [], side: 'right' })
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(a.id).not.toBe(b.id)
  })

  it('перемещение вверх/вниз; за край — без изменений', () => {
    expect(moveSection(list, 1, -1).map((s) => s.id)).toEqual(['b', 'a', 'c'])
    expect(moveSection(list, 1, 1).map((s) => s.id)).toEqual(['a', 'c', 'b'])
    expect(moveSection(list, 0, -1).map((s) => s.id)).toEqual(['a', 'b', 'c'])
    expect(moveSection(list, 2, 1).map((s) => s.id)).toEqual(['a', 'b', 'c'])
  })

  it('правка и удаление не трогают исходный список', () => {
    expect(updateSection(list, 0, { html: '<p>x</p>' })[0].html).toBe('<p>x</p>')
    expect(removeSection(list, 1).map((s) => s.id)).toEqual(['a', 'c'])
    expect(list.map((s) => s.html)).toEqual(['', '', ''])
  })
})

describe('полнота перевода', () => {
  function draft(patch: Partial<NewsDraft> = {}): NewsDraft {
    return {
      ...draftOf(detail()),
      sections: [
        { id: S1, type: 'text', html: '<p>Текст</p>', media: [], side: 'right' },
        { id: S2, type: 'photoText', html: '<p></p>', media: ['/a.webp'], side: 'left' },
      ],
      ...patch,
    }
  }

  it('пусто переведено — заголовок, анонс и блоки с текстом', () => {
    expect(missingTranslation(draft(), 'uz')).toEqual(['title', 'lead', 'section:1'])
  })

  it('переведено всё нужное — пусто; блок без текста перевода не ждёт', () => {
    const d = draft()
    d.translations.uz = { title: 'T', lead: 'L', sections: { [S1]: '<p>Matn</p>' } }
    expect(missingTranslation(d, 'uz')).toEqual([])
  })

  it('пустой абзац редактора — не перевод', () => {
    const d = draft()
    d.translations.uz = { title: 'T', lead: 'L', sections: { [S1]: '<p> </p>' } }
    expect(missingTranslation(d, 'uz')).toEqual(['section:1'])
    expect(hasText('<p>&nbsp;</p>')).toBe(false)
    expect(hasText('<p>a</p>')).toBe(true)
  })

  it('без анонса — анонс не требуется', () => {
    const d = draft({ lead: '' })
    d.translations.en = { title: 'T', lead: '', sections: { [S1]: '<p>x</p>' } }
    expect(missingTranslation(d, 'en')).toEqual([])
  })
})

describe('подписи недостающего', () => {
  it('ключи сервиса по-человечески', () => {
    expect(['title', 'lead', 'section:3', 'other'].map(missingLabel)).toEqual(['заголовок', 'анонс', 'блок 3', 'other'])
  })

  it('ответ 400 сервиса → «UZ: заголовок, блок 2»; чужая ошибка — null', () => {
    expect(describeBlockedLocales({ error: 'x', missing: { uz: ['title', 'section:2'], en: [] } })).toBe('UZ: заголовок, блок 2')
    expect(describeBlockedLocales({ error: 'Адрес занят' })).toBeNull()
    expect(describeBlockedLocales(undefined)).toBeNull()
  })
})

describe('дата и несохранённые правки', () => {
  it('ISO ↔ поле datetime-local туда и обратно', () => {
    const iso = new Date(2026, 9, 5, 14, 30).toISOString()
    expect(toLocalInput(iso)).toBe('2026-10-05T14:30')
    expect(fromLocalInput('2026-10-05T14:30')).toBe(iso)
  })

  it('пусто и мусор', () => {
    expect(toLocalInput(null)).toBe('')
    expect(toLocalInput('не дата')).toBe('')
    expect(fromLocalInput('')).toBeNull()
    expect(fromLocalInput('abc')).toBeNull()
  })

  it('isDirty: черновик как в ответе сервиса — чисто, любая правка — грязно', () => {
    const news = detail()
    const draft = draftOf(news)
    expect(isDirty(draft, news)).toBe(false)
    expect(isDirty({ ...draft, title: 'Другой' }, news)).toBe(true)
    expect(isDirty({ ...draft, translations: { ...draft.translations, uz: { ...draft.translations.uz, title: 'x' } } }, news)).toBe(true)
  })
})
