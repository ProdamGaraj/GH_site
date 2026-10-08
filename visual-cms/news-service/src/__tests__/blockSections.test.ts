/**
 * Секция-блок: блок данных из библиотеки CMS и значения его якорей.
 * Ввод чистится, переводятся только тексты (картинки и адреса — общие),
 * полнота перевода, данные для шаблона, поиск.
 */
import { sectionSchema, translationsSchema } from '../schemas/news.schema'
import { safeHref } from '../services/html'
import { blockValuesIn, buildSection, missingTranslation, searchText, type NewsSection, type TrRow } from '../services/news'
import { normalizeBlockValues, normalizeSections, translationRows, translationsForAdmin } from '../services/newsInput'
import { S1, S2, newsRow, section } from './helpers/newsFixtures'

const BLOCK = '44444444-4444-4444-8444-444444444444'

const blockSection = (overrides: Partial<NewsSection> = {}): NewsSection => ({
  id: S2,
  type: 'block',
  html: '',
  media: [],
  side: 'right',
  blockId: BLOCK,
  values: {
    title: { kind: 'text', value: 'Ипотека 12%' },
    body: { kind: 'richtext', value: '<p>Без <strong>переплат</strong></p>' },
    photo: { kind: 'image', value: '/media/p.jpg' },
    cta: { kind: 'link', value: { href: '/apply', text: 'Подать заявку' } },
  },
  ...overrides,
})

describe('схема', () => {
  it('секция-блок без blockId — ошибка; с ним — значения проверяются по виду', () => {
    expect(sectionSchema.safeParse({ id: S2, type: 'block' }).success).toBe(false)
    expect(sectionSchema.safeParse({ id: S2, type: 'block', blockId: BLOCK, values: { title: { kind: 'text', value: 'x' } } }).success).toBe(true)
    expect(sectionSchema.safeParse({ id: S2, type: 'block', blockId: BLOCK, values: { 'bad key': { kind: 'text', value: 'x' } } }).success).toBe(false)
    expect(sectionSchema.safeParse({ id: S2, type: 'block', blockId: BLOCK, values: { t: { kind: 'video', value: 'x' } } }).success).toBe(false)
  })

  it('переводы секций-блоков: id секции → ключ → текст', () => {
    expect(translationsSchema.safeParse({ uz: { blocks: { [S2]: { title: 'Ipoteka' } } } }).success).toBe(true)
  })
})

describe('чистка значений', () => {
  it('HTML — белый список; текст без пробелов по краям; адрес ссылки — безопасные схемы', () => {
    const out = normalizeBlockValues({
      body: { kind: 'richtext', value: '<p onclick="x">Т<script>alert(1)</script></p>' },
      title: { kind: 'text', value: '  Заголовок  ' },
      cta: { kind: 'link', value: { href: 'javascript:alert(1)', text: ' Жми ' } },
      broken: { kind: 'link', value: 'не объект' },
    })
    expect(out).toEqual({
      body: { kind: 'richtext', value: '<p>Т</p>' },
      title: { kind: 'text', value: 'Заголовок' },
      cta: { kind: 'link', value: { href: '', text: 'Жми' } },
    })
  })

  it('safeHref', () => {
    expect(safeHref('https://gh.uz')).toBe('https://gh.uz')
    expect(safeHref('tel:+998781501111')).toBe('tel:+998781501111')
    expect(safeHref('/ru/news/')).toBe('/ru/news/')
    expect(safeHref('#top')).toBe('#top')
    expect(safeHref('data:text/html,x')).toBe('')
    expect(safeHref('//evil.com')).toBe('')
  })

  it('normalizeSections: у секции-блока нет html и медиа, есть blockId и значения', () => {
    const [s] = normalizeSections([{ ...blockSection(), html: '<p>лишнее</p>', media: ['/x.jpg'] }])
    expect(s).toMatchObject({ type: 'block', html: '', media: [], blockId: BLOCK })
    expect(Object.keys(s.values!)).toEqual(['title', 'body', 'photo', 'cta'])
  })
})

describe('переводы', () => {
  const sections = [section(S1), blockSection()]

  it('сохраняются только тексты своих ключей; картинка и чужой ключ — нет; HTML чистится', () => {
    const rows = translationRows('n1', { uz: { blocks: { [S2]: { title: 'Ipoteka 12%', body: '<p>X<script>1</script></p>', photo: '/media/uz.jpg', ghost: 'x', cta: 'Ariza' } } } }, sections)
    const stored = JSON.parse(rows.find((r) => r.field === 'sections')!.value)
    expect(stored[S2]).toEqual({ values: { title: 'Ipoteka 12%', body: '<p>X</p>', cta: 'Ariza' } })
    expect(translationsForAdmin(rows).uz.blocks).toEqual({ [S2]: { title: 'Ipoteka 12%', body: '<p>X</p>', cta: 'Ariza' } })
  })

  it('перевод секции-блока, которой уже нет, отбрасывается', () => {
    expect(translationRows('n1', { uz: { blocks: { [S2]: { title: 'x' } } } }, [section(S1)])).toEqual([])
  })

  it('полнота: секция-блок не переведена, пока не переведены все тексты; картинки не ждут перевода', () => {
    const news = newsRow({ sections: [blockSection()], lead: '' })
    const tr = (values: Record<string, string>): TrRow[] => [
      { newsId: news.id, locale: 'uz', field: 'title', value: 'T' },
      { newsId: news.id, locale: 'uz', field: 'sections', value: JSON.stringify({ [S2]: { values } }) },
    ]
    expect(missingTranslation(news, tr({ title: 'a', body: '<p>b</p>' }), 'uz')).toEqual(['section:1'])
    expect(missingTranslation(news, tr({ title: 'a', body: '<p>b</p>', cta: 'c' }), 'uz')).toEqual([])
    const imageOnly = newsRow({ lead: '', sections: [blockSection({ values: { photo: { kind: 'image', value: '/p.jpg' } } })] })
    expect(missingTranslation(imageOnly, [{ newsId: imageOnly.id, locale: 'uz', field: 'title', value: 'T' }], 'uz')).toEqual([])
  })
})

describe('данные для шаблона', () => {
  it('ru — значения из базы; секция-блок — только заготовка block', () => {
    const dto = buildSection(blockSection(), '')
    expect(dto.text).toEqual([])
    expect(dto.block).toHaveLength(1)
    expect(dto.block[0].blockId).toBe(BLOCK)
  })

  it('значения на языке: тексты — перевод, картинка и адрес ссылки — общие', () => {
    const values = blockValuesIn(blockSection(), { title: 'Ipoteka', body: '<p>UZ</p>', cta: 'Ariza' })
    expect(values).toEqual({ title: 'Ipoteka', body: '<p>UZ</p>', photo: '/media/p.jpg', cta: { href: '/apply', text: 'Ariza' } })
    const dto = buildSection(blockSection(), '', { title: 'Ipoteka', body: '<p>UZ</p>', cta: 'Ariza' })
    expect(JSON.parse(dto.block[0].valuesJson)).toEqual(values)
  })

  it('без blockId — пустая секция (ничего не рисуется)', () => {
    expect(buildSection(blockSection({ blockId: undefined }), '').block).toEqual([])
  })
})

describe('поиск', () => {
  it('тексты значений секции-блока попадают в тело поиска', () => {
    const news = newsRow({ sections: [blockSection()] })
    const { body } = searchText(news, [], 'ru')
    expect(body).toContain('Ипотека 12%')
    expect(body).toContain('Без переплат')
    expect(body).toContain('Подать заявку')
    expect(body).not.toContain('/media/p.jpg')
  })
})
