/**
 * Чистые функции AnalyticsService (без БД).
 *
 * Регресс-кейсы дашборда «SEO Аналитика»:
 *  - «Реферреры» показывали собственные страницы сайта (self-referral);
 *  - спарклайны «Просмотры/Посетители/Ср. время отклика» пустовали при данных
 *    за один день — временной ряд возвращал одну точку.
 */
import { stripSameHostReferrer, zeroFillTimeSeries } from '../services/AnalyticsService'

describe('stripSameHostReferrer', () => {
  const pageUrl = 'https://test_analytics.gh.uz/news/'

  it('реферер с того же хоста зануляется', () => {
    expect(stripSameHostReferrer('https://test_analytics.gh.uz/commercev2/', pageUrl)).toBeNull()
  })

  it('внешний реферер сохраняется', () => {
    expect(stripSameHostReferrer('https://google.com/search?q=x', pageUrl))
      .toBe('https://google.com/search?q=x')
  })

  it('пустой/отсутствующий реферер → null', () => {
    expect(stripSameHostReferrer('', pageUrl)).toBeNull()
    expect(stripSameHostReferrer(null, pageUrl)).toBeNull()
    expect(stripSameHostReferrer(undefined, pageUrl)).toBeNull()
  })

  it('без url страницы реферер не трогаем', () => {
    expect(stripSameHostReferrer('https://google.com/', null)).toBe('https://google.com/')
  })

  it('невалидный реферер оставляем как есть', () => {
    expect(stripSameHostReferrer('android-app://org.telegram', pageUrl)).toBe('android-app://org.telegram')
  })
})

describe('zeroFillTimeSeries', () => {
  const point = (date: string, pageviews: number) => ({
    date,
    pageviews,
    visitors: 1,
    sessions: 1,
    avgResponseTime: 100,
    bounceRate: 0,
  })

  it('данные за один день в 30-дневном диапазоне → 31 точка, одна ненулевая', () => {
    const from = new Date('2026-06-07T00:00:00Z')
    const to = new Date('2026-07-07T00:00:00Z')
    const filled = zeroFillTimeSeries([point('2026-07-07T00:00:00Z', 14)], from, to, 'day')

    expect(filled.length).toBe(31)
    expect(filled[filled.length - 1].pageviews).toBe(14)
    expect(filled.slice(0, -1).every(p => p.pageviews === 0)).toBe(true)
  })

  it('часовая гранулярность заполняет часы', () => {
    const from = new Date('2026-07-07T00:00:00Z')
    const to = new Date('2026-07-07T05:30:00Z')
    const filled = zeroFillTimeSeries([point('2026-07-07T03:00:00Z', 5)], from, to, 'hour')

    expect(filled.length).toBe(6) // 00..05
    expect(filled[3].pageviews).toBe(5)
    expect(filled[0].pageviews).toBe(0)
  })

  it('существующие точки не искажаются, порядок по времени', () => {
    const from = new Date('2026-07-01T00:00:00Z')
    const to = new Date('2026-07-03T00:00:00Z')
    const filled = zeroFillTimeSeries(
      [point('2026-07-03T00:00:00Z', 2), point('2026-07-01T00:00:00Z', 7)],
      from, to, 'day',
    )
    expect(filled.map(p => p.pageviews)).toEqual([7, 0, 2])
  })

  it('пустой вход → все нули по диапазону', () => {
    const from = new Date('2026-07-01T00:00:00Z')
    const to = new Date('2026-07-02T00:00:00Z')
    const filled = zeroFillTimeSeries([], from, to, 'day')
    expect(filled.length).toBe(2)
    expect(filled.every(p => p.pageviews === 0)).toBe(true)
  })
})
