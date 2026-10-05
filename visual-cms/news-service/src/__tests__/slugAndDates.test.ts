import { SLUG_MAX_LENGTH, SLUG_RE, slugify, uniqueSlug } from '../services/slug'
import { dateLabel, isoDay } from '../services/dates'

describe('slugify', () => {
  it.each([
    ['русский', 'Ваучер Makro на 2 миллиона сум в подарок', 'vaucher-makro-na-2-milliona-sum-v-podarok'],
    ['ё, щ, ъ, ь', 'Ещё объявление: щедрый подъезд', 'eshchyo-obyavlenie-shchedryy-podezd'],
    ['узбекская кириллица', 'Ўзбекистон Қўқон Ғалаба Ҳовли', 'ozbekiston-qoqon-galaba-hovli'],
    ['узбекская латиница с апострофами', "O‘zMakon Business: yangi bosqich, g'alaba", 'ozmakon-business-yangi-bosqich-galaba'],
    ['латиница с диакритикой', 'Café Résidence', 'cafe-residence'],
    ['знаки и пробелы по краям, № → no', '  «Новости» — №1!!  ', 'novosti-no1'],
  ])('%s', (_name, title, slug) => {
    expect(slugify(title)).toBe(slug)
    expect(slugify(title)).toMatch(SLUG_RE)
  })

  it('без букв и цифр — запасной адрес', () => {
    expect(slugify('!!! — ???')).toBe('news')
    expect(slugify('')).toBe('news')
  })

  it('длинный заголовок обрезается по границе слова', () => {
    const slug = slugify('Очень длинный заголовок новости '.repeat(10))
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH)
    expect(slug).toMatch(SLUG_RE)
    expect(slug.endsWith('-')).toBe(false)
  })

  it('uniqueSlug: занятый адрес получает номер', () => {
    expect(uniqueSlug('news', new Set())).toBe('news')
    expect(uniqueSlug('news', new Set(['news']))).toBe('news-2')
    expect(uniqueSlug('news', new Set(['news', 'news-2', 'news-3']))).toBe('news-4')
  })
})

describe('даты по Ташкенту', () => {
  it('02:00 по Ташкенту — уже сегодня, хотя в UTC ещё вчера', () => {
    const date = new Date('2026-10-04T21:00:00Z') // 05.10 02:00 в Ташкенте
    expect(isoDay(date)).toBe('2026-10-05')
    expect(dateLabel(date, 'ru')).toBe('5 октября 2026')
  })

  it('подписи на трёх языках', () => {
    const date = new Date('2026-03-08T07:00:00Z')
    expect(dateLabel(date, 'ru')).toBe('8 марта 2026')
    expect(dateLabel(date, 'uz')).toBe('8-mart, 2026')
    expect(dateLabel(date, 'en')).toBe('March 8, 2026')
  })
})
