import { AppDataSource } from '../config/database'
import { AnalyticsEvent, AnalyticsEventType, DeviceCategory, RequestCategory } from '../models/AnalyticsEvent'
import { AnalyticsSession } from '../models/AnalyticsSession'
import { logger } from './Logger'
import { Between, In, IsNull, Not } from 'typeorm'

// ─── Типы для API ответов ──────────────────────────────────────

export interface DateRange {
  from: Date
  to: Date
}

export interface OverviewStats {
  totalVisitors: number
  totalSessions: number
  totalPageviews: number
  totalEvents: number
  bounceRate: number           // %
  avgSessionDuration: number   // мс
  avgPagesPerSession: number
  avgResponseTime: number      // мс
  totalRequestsSent: number
  totalRequestsReceived: number
  totalFormSubmissions: number
  totalErrors: number
}

export interface TrafficSource {
  source: string
  sessions: number
  visitors: number
  bounceRate: number
  avgDuration: number
}

export interface PageStats {
  pageSlug: string
  pageId: string | null
  pageviews: number
  uniqueVisitors: number
  avgTimeOnPage: number        // мс
  bounceRate: number
  avgScrollDepth: number
  entryCount: number           // сколько раз была первой страницей
  exitCount: number            // сколько раз была последней
}

export interface BlockStats {
  blockId: string
  blockType: string
  views: number
  avgViewDuration: number      // мс
  clicks: number
  ctr: number                  // click-through rate %
}

export interface RequestStats {
  totalSent: number
  totalReceived: number
  avgResponseTime: number
  medianResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  errorRate: number            // % запросов с 4xx/5xx
  byStatus: { status: number; count: number }[]
  byMethod: { method: string; count: number }[]
  slowestEndpoints: { url: string; avgTime: number; count: number }[]
  byCategory: { category: string; count: number }[]
  endpoints: { url: string; method: string; category: string; avgTime: number; count: number; errorRate: number }[]
}

export interface WebVitalsStats {
  lcp: { avg: number; p75: number; good: number; needsImprovement: number; poor: number }
  fcp: { avg: number; p75: number; good: number; needsImprovement: number; poor: number }
  cls: { avg: number; p75: number; good: number; needsImprovement: number; poor: number }
  ttfb: { avg: number; p75: number; good: number; needsImprovement: number; poor: number }
  fid: { avg: number; p75: number; good: number; needsImprovement: number; poor: number }
  inp: { avg: number; p75: number; good: number; needsImprovement: number; poor: number }
}

export interface DeviceBreakdown {
  device: DeviceCategory
  count: number
  percentage: number
}

export interface BrowserBreakdown {
  browser: string
  count: number
  percentage: number
}

export interface CountryBreakdown {
  country: string
  count: number
  percentage: number
}

export interface TimeSeriesPoint {
  date: string            // ISO date (YYYY-MM-DD) или час (HH:00)
  pageviews: number
  visitors: number
  sessions: number
  avgResponseTime: number
  bounceRate: number
}

export interface RealTimeStats {
  activeVisitors: number
  activeSessions: number
  recentPageviews: { pageSlug: string; count: number }[]
  recentEvents: AnalyticsEvent[]
}

export interface FullAnalyticsReport {
  overview: OverviewStats
  timeSeries: TimeSeriesPoint[]
  pages: PageStats[]
  blocks: BlockStats[]
  requests: RequestStats
  webVitals: WebVitalsStats
  devices: DeviceBreakdown[]
  browsers: BrowserBreakdown[]
  countries: CountryBreakdown[]
  trafficSources: TrafficSource[]
  topReferrers: { referrer: string; count: number }[]
}

// ─── User-Agent Parser (lightweight) ───────────────────────────

function parseUserAgent(ua: string | null): {
  browser: string | null
  browserVersion: string | null
  os: string | null
  device: DeviceCategory
} {
  if (!ua) return { browser: null, browserVersion: null, os: null, device: 'unknown' }

  // Device
  let device: DeviceCategory = 'desktop'
  if (/bot|crawl|spider|slurp|googlebot/i.test(ua)) device = 'bot'
  else if (/mobile|android.*mobile|iphone|ipod|blackberry|opera mini|iemobile/i.test(ua)) device = 'mobile'
  else if (/tablet|ipad|android(?!.*mobile)|kindle|silk/i.test(ua)) device = 'tablet'

  // Browser
  let browser: string | null = null
  let browserVersion: string | null = null
  const browserPatterns: [RegExp, string][] = [
    [/edg(?:e|a)?\/(\S+)/i, 'Edge'],
    [/firefox\/(\S+)/i, 'Firefox'],
    [/opr\/(\S+)/i, 'Opera'],
    [/chrome\/(\S+)/i, 'Chrome'],
    [/safari\/(\S+)/i, 'Safari'],
    [/msie (\S+)/i, 'IE'],
    [/trident.*rv:(\S+)/i, 'IE'],
  ]
  for (const [pattern, name] of browserPatterns) {
    const match = ua.match(pattern)
    if (match) {
      browser = name
      browserVersion = match[1]?.split('.')[0] || null
      break
    }
  }

  // OS
  let os: string | null = null
  if (/windows/i.test(ua)) os = 'Windows'
  else if (/macintosh|mac os/i.test(ua)) os = 'macOS'
  else if (/linux/i.test(ua)) os = 'Linux'
  else if (/android/i.test(ua)) os = 'Android'
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS'

  return { browser, browserVersion, os, device }
}

// Анонимизация IP: обнуляем последний октет
function anonymizeIp(ip: string | null): string | null {
  if (!ip) return null
  if (ip.includes(':')) {
    // IPv6: обрезаем последние 80 бит
    const parts = ip.split(':')
    return parts.slice(0, 4).join(':') + '::'
  }
  const parts = ip.split('.')
  parts[3] = '0'
  return parts.join('.')
}

// Классификация запроса на сервере (fallback если клиент не прислал)
function classifyRequest(url: string | null | undefined, method: string | null | undefined): RequestCategory {
  if (!url) return 'service'
  const lUrl = url.toLowerCase()
  const lMethod = (method || '').toUpperCase()

  if (lMethod === 'OPTIONS') return 'preflight'
  if (lUrl.includes('/api/analytics')) return 'analytics'
  if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map|webp|avif)(\?|$)/i.test(lUrl)) return 'static'
  if (/\/(favicon|manifest|robots|sitemap|sw|service-worker|workbox)/i.test(lUrl)) return 'service'
  if (/^(chrome-extension|moz-extension|data:|blob:)/i.test(lUrl)) return 'service'
  return 'api'
}

// ─── Сервис ────────────────────────────────────────────────────

class AnalyticsService {
  private eventRepo = AppDataSource.getRepository(AnalyticsEvent)
  private sessionRepo = AppDataSource.getRepository(AnalyticsSession)

  // ─── Приём событий (public endpoint) ─────────────────────────

  async trackEvents(
    events: Array<{
      eventType: AnalyticsEventType
      sessionId: string
      visitorId: string
      pageId?: string
      pageSlug?: string
      url?: string
      referrer?: string
      eventTarget?: string
      blockId?: string
      blockType?: string
      blockViewDuration?: number
      responseTime?: number
      pageLoadTime?: number
      scrollDepth?: number
      lcp?: number
      fcp?: number
      cls?: number
      fid?: number
      ttfb?: number
      inp?: number
      requestUrl?: string
      requestMethod?: string
      requestStatus?: number
      requestSize?: number
      responseSize?: number
      screenWidth?: number
      screenHeight?: number
      metadata?: Record<string, unknown>
    }>,
    ip: string | null,
    userAgent: string | null,
  ): Promise<{ saved: number }> {
    const parsed = parseUserAgent(userAgent)
    const anonIp = anonymizeIp(ip)

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    const entities = events.map(ev => {
      const entity = new AnalyticsEvent()
      // Sanitize pageId — must be a valid UUID or null
      const pageId = ev.pageId && uuidRe.test(ev.pageId) ? ev.pageId : null
      // Auto-classify request category if not provided by client
      let requestCategory = (ev as any).requestCategory as RequestCategory | null
      if ((ev.eventType === 'request_sent' || ev.eventType === 'request_received') && !requestCategory) {
        requestCategory = classifyRequest(ev.requestUrl, ev.requestMethod)
      }
      Object.assign(entity, {
        ...ev,
        pageId,
        requestCategory,
        ip: anonIp,
        userAgent,
        browser: parsed.browser,
        browserVersion: parsed.browserVersion,
        os: parsed.os,
        device: parsed.device,
      })
      return entity
    })

    const saved = await this.eventRepo.save(entities)

    // Обновляем/создаём сессии в фоне (не блокируем ответ)
    this.updateSessions(events, anonIp, userAgent, parsed).catch(err =>
      logger.error('Failed to update analytics sessions:', err)
    )

    return { saved: saved.length }
  }

  // ─── Обновление сессий ───────────────────────────────────────

  private async updateSessions(
    events: Array<{
      eventType: AnalyticsEventType
      sessionId: string
      visitorId: string
      pageSlug?: string
      pageId?: string
      referrer?: string
      scrollDepth?: number
      responseTime?: number
      screenWidth?: number
      screenHeight?: number
      blockId?: string
      blockType?: string
      blockViewDuration?: number
    }>,
    ip: string | null,
    userAgent: string | null,
    parsed: ReturnType<typeof parseUserAgent>,
  ): Promise<void> {
    const sessionMap = new Map<string, typeof events>()
    for (const ev of events) {
      const arr = sessionMap.get(ev.sessionId) || []
      arr.push(ev)
      sessionMap.set(ev.sessionId, arr)
    }

    for (const [sessionId, sessionEvents] of sessionMap) {
      let session = await this.sessionRepo.findOneBy({ sessionId })
      const first = sessionEvents[0]

      // UTM params из referrer/url
      let utmSource: string | null = null
      let utmMedium: string | null = null
      let utmCampaign: string | null = null
      let utmContent: string | null = null
      let utmTerm: string | null = null
      try {
        const urlStr = first.referrer || ''
        if (urlStr) {
          const u = new URL(urlStr)
          utmSource = u.searchParams.get('utm_source')
          utmMedium = u.searchParams.get('utm_medium')
          utmCampaign = u.searchParams.get('utm_campaign')
          utmContent = u.searchParams.get('utm_content')
          utmTerm = u.searchParams.get('utm_term')
        }
      } catch {}

      if (!session) {
        session = this.sessionRepo.create({
          sessionId,
          visitorId: first.visitorId,
          pageId: first.pageId || null,
          entryPageSlug: first.pageSlug || null,
          referrer: first.referrer || null,
          ip,
          userAgent,
          browser: parsed.browser,
          os: parsed.os,
          device: parsed.device,
          screenWidth: first.screenWidth || null,
          screenHeight: first.screenHeight || null,
          utmSource,
          utmMedium,
          utmCampaign,
          utmContent,
          utmTerm,
          duration: 0,
          pagesViewed: 0,
          eventsCount: 0,
          bounced: true,
          maxScrollDepth: 0,
          totalRequestsSent: 0,
          totalRequestsReceived: 0,
          formSubmissions: 0,
          clicksCount: 0,
          errorsCount: 0,
        })
      }

      // Агрегируем метрики
      for (const ev of sessionEvents) {
        session.eventsCount++

        if (ev.eventType === 'pageview') {
          session.pagesViewed++
          session.exitPageSlug = ev.pageSlug || null
        }
        if (ev.eventType === 'click') session.clicksCount++
        if (ev.eventType === 'form_submit') session.formSubmissions++
        if (ev.eventType === 'request_sent') session.totalRequestsSent++
        if (ev.eventType === 'request_received') session.totalRequestsReceived++
        if (ev.eventType === 'error') session.errorsCount++

        if (ev.scrollDepth && ev.scrollDepth > session.maxScrollDepth) {
          session.maxScrollDepth = ev.scrollDepth
        }

        if (ev.responseTime) {
          if (session.avgResponseTime) {
            session.avgResponseTime = (session.avgResponseTime + ev.responseTime) / 2
          } else {
            session.avgResponseTime = ev.responseTime
          }
        }

        // Block engagement
        if (ev.blockId && ev.blockViewDuration) {
          if (!session.blockEngagement) session.blockEngagement = []
          const existing = session.blockEngagement.find(b => b.blockId === ev.blockId)
          if (existing) {
            existing.viewDuration += ev.blockViewDuration
            if (ev.eventType === 'click') existing.clicks++
          } else {
            session.blockEngagement.push({
              blockId: ev.blockId,
              blockType: ev.blockType || 'unknown',
              viewDuration: ev.blockViewDuration,
              clicks: ev.eventType === 'click' ? 1 : 0,
              visible: true,
              scrolledPast: false,
            })
          }
        }
      }

      // Bounce: 1 pageview и < 10 секунд
      session.bounced = session.pagesViewed <= 1 && session.duration < 10000

      await this.sessionRepo.save(session)
    }
  }

  // ─── Heartbeat (обновляет длительность сессии) ───────────────

  async heartbeat(sessionId: string, duration: number): Promise<void> {
    await this.sessionRepo.update(
      { sessionId },
      {
        duration,
        bounced: duration >= 10000 ? false : undefined,
      } as any,
    )
  }

  // ─── Полный отчёт ───────────────────────────────────────────

  async getFullReport(
    pageId?: string,
    range?: DateRange,
  ): Promise<FullAnalyticsReport> {
    const [overview, timeSeries, pages, blocks, requests, webVitals, devices, browsers, countries, trafficSources, topReferrers] =
      await Promise.all([
        this.getOverview(pageId, range),
        this.getTimeSeries(pageId, range),
        this.getPageStats(pageId, range),
        this.getBlockStats(pageId, range),
        this.getRequestStats(pageId, range, 'all'),  // Full report includes all categories
        this.getWebVitals(pageId, range),
        this.getDeviceBreakdown(pageId, range),
        this.getBrowserBreakdown(pageId, range),
        this.getCountryBreakdown(pageId, range),
        this.getTrafficSources(pageId, range),
        this.getTopReferrers(pageId, range),
      ])

    return { overview, timeSeries, pages, blocks, requests, webVitals, devices, browsers, countries, trafficSources, topReferrers }
  }

  // ─── Overview ────────────────────────────────────────────────

  async getOverview(pageId?: string, range?: DateRange): Promise<OverviewStats> {
    const qb = this.sessionRepo.createQueryBuilder('s')
    if (pageId) qb.andWhere('s.pageId = :pageId', { pageId })
    if (range) qb.andWhere('s.startedAt BETWEEN :from AND :to', { from: range.from, to: range.to })

    const result = await qb
      .select([
        'COUNT(DISTINCT s.visitorId) as "totalVisitors"',
        'COUNT(s.id) as "totalSessions"',
        'SUM(s.pagesViewed) as "totalPageviews"',
        'SUM(s.eventsCount) as "totalEvents"',
        'AVG(CASE WHEN s.bounced THEN 1 ELSE 0 END) * 100 as "bounceRate"',
        'AVG(s.duration) as "avgSessionDuration"',
        'AVG(s.pagesViewed) as "avgPagesPerSession"',
        'AVG(s.avgResponseTime) as "avgResponseTime"',
        'SUM(s.totalRequestsSent) as "totalRequestsSent"',
        'SUM(s.totalRequestsReceived) as "totalRequestsReceived"',
        'SUM(s.formSubmissions) as "totalFormSubmissions"',
        'SUM(s.errorsCount) as "totalErrors"',
      ])
      .getRawOne()

    return {
      totalVisitors: parseInt(result?.totalVisitors || '0'),
      totalSessions: parseInt(result?.totalSessions || '0'),
      totalPageviews: parseInt(result?.totalPageviews || '0'),
      totalEvents: parseInt(result?.totalEvents || '0'),
      bounceRate: parseFloat(result?.bounceRate || '0'),
      avgSessionDuration: parseFloat(result?.avgSessionDuration || '0'),
      avgPagesPerSession: parseFloat(result?.avgPagesPerSession || '0'),
      avgResponseTime: parseFloat(result?.avgResponseTime || '0'),
      totalRequestsSent: parseInt(result?.totalRequestsSent || '0'),
      totalRequestsReceived: parseInt(result?.totalRequestsReceived || '0'),
      totalFormSubmissions: parseInt(result?.totalFormSubmissions || '0'),
      totalErrors: parseInt(result?.totalErrors || '0'),
    }
  }

  // ─── Временной ряд ──────────────────────────────────────────

  async getTimeSeries(pageId?: string, range?: DateRange): Promise<TimeSeriesPoint[]> {
    const defaultFrom = new Date()
    defaultFrom.setDate(defaultFrom.getDate() - 30)
    const from = range?.from || defaultFrom
    const to = range?.to || new Date()

    // Определяем гранулярность: если < 3 дней — по часам, иначе — по дням
    const diffMs = to.getTime() - from.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    const granularity = diffDays <= 3 ? 'hour' : 'day'
    const dateTrunc = granularity === 'hour' ? "date_trunc('hour', s.\"startedAt\")" : "date_trunc('day', s.\"startedAt\")"

    const qb = this.sessionRepo.createQueryBuilder('s')
      .select([
        `${dateTrunc} as "date"`,
        'SUM(s."pagesViewed") as "pageviews"',
        'COUNT(DISTINCT s."visitorId") as "visitors"',
        'COUNT(s.id) as "sessions"',
        'AVG(s."avgResponseTime") as "avgResponseTime"',
        'AVG(CASE WHEN s.bounced THEN 1 ELSE 0 END) * 100 as "bounceRate"',
      ])
      .where('s."startedAt" BETWEEN :from AND :to', { from, to })
      .groupBy(dateTrunc)
      .orderBy(dateTrunc, 'ASC')

    if (pageId) qb.andWhere('s."pageId" = :pageId', { pageId })

    const rows = await qb.getRawMany()

    return rows.map(r => ({
      date: r.date instanceof Date ? r.date.toISOString() : r.date,
      pageviews: parseInt(r.pageviews || '0'),
      visitors: parseInt(r.visitors || '0'),
      sessions: parseInt(r.sessions || '0'),
      avgResponseTime: parseFloat(r.avgResponseTime || '0'),
      bounceRate: parseFloat(r.bounceRate || '0'),
    }))
  }

  // ─── Статистика страниц ─────────────────────────────────────

  async getPageStats(pageId?: string, range?: DateRange): Promise<PageStats[]> {
    const qb = this.eventRepo.createQueryBuilder('e')
      .select([
        'e."pageSlug" as "pageSlug"',
        'e."pageId" as "pageId"',
        'COUNT(*) FILTER (WHERE e."eventType" = \'pageview\') as "pageviews"',
        'COUNT(DISTINCT e."visitorId") as "uniqueVisitors"',
        'AVG(e."scrollDepth") as "avgScrollDepth"',
      ])
      .where('e."pageSlug" IS NOT NULL')
      .groupBy('e."pageSlug"')
      .addGroupBy('e."pageId"')
      .orderBy('"pageviews"', 'DESC')

    if (pageId) qb.andWhere('e."pageId" = :pageId', { pageId })
    if (range) qb.andWhere('e."createdAt" BETWEEN :from AND :to', { from: range.from, to: range.to })


    // Получаем entry/exit стастику
    const entryExitQb = this.sessionRepo.createQueryBuilder('s')
      .select([
        's."entryPageSlug" as "slug"',
        'COUNT(*) as "entryCount"',
      ])
      .groupBy('s."entryPageSlug"')
    if (range) entryExitQb.andWhere('s."startedAt" BETWEEN :from AND :to', { from: range.from, to: range.to })

    const exitQb = this.sessionRepo.createQueryBuilder('s')
      .select([
        's."exitPageSlug" as "slug"',
        'COUNT(*) as "exitCount"',
      ])
      .groupBy('s."exitPageSlug"')
    if (range) exitQb.andWhere('s."startedAt" BETWEEN :from AND :to', { from: range.from, to: range.to })

    // Bounce rate per page
    const bounceQb = this.sessionRepo.createQueryBuilder('s')
      .select([
        's."entryPageSlug" as "slug"',
        'AVG(CASE WHEN s.bounced THEN 1 ELSE 0 END) * 100 as "bounceRate"',
        'AVG(s.duration) as "avgTime"',
      ])
      .groupBy('s."entryPageSlug"')
    if (range) bounceQb.andWhere('s."startedAt" BETWEEN :from AND :to', { from: range.from, to: range.to })

    // Parallel: 4 independent queries via Promise.all
    const [rows, entries, exits, bounces] = await Promise.all([
      qb.getRawMany(),
      entryExitQb.getRawMany(),
      exitQb.getRawMany(),
      bounceQb.getRawMany(),
    ])
    const entryMap = new Map(entries.map(e => [e.slug, parseInt(e.entryCount || '0')]))
    const exitMap = new Map(exits.map(e => [e.slug, parseInt(e.exitCount || '0')]))
    const bounceMap = new Map(bounces.map(b => [b.slug, { rate: parseFloat(b.bounceRate || '0'), avgTime: parseFloat(b.avgTime || '0') }]))

    return rows.map(r => ({
      pageSlug: r.pageSlug,
      pageId: r.pageId,
      pageviews: parseInt(r.pageviews || '0'),
      uniqueVisitors: parseInt(r.uniqueVisitors || '0'),
      avgTimeOnPage: bounceMap.get(r.pageSlug)?.avgTime || 0,
      bounceRate: bounceMap.get(r.pageSlug)?.rate || 0,
      avgScrollDepth: parseFloat(r.avgScrollDepth || '0'),
      entryCount: entryMap.get(r.pageSlug) || 0,
      exitCount: exitMap.get(r.pageSlug) || 0,
    }))
  }

  // ─── Статистика блоков ──────────────────────────────────────

  async getBlockStats(pageId?: string, range?: DateRange): Promise<BlockStats[]> {
    const qb = this.eventRepo.createQueryBuilder('e')
      .select([
        'e."blockId" as "blockId"',
        'e."blockType" as "blockType"',
        'COUNT(*) FILTER (WHERE e."eventType" = \'block_view\') as "views"',
        'AVG(e."blockViewDuration") FILTER (WHERE e."blockViewDuration" IS NOT NULL) as "avgViewDuration"',
        'COUNT(*) FILTER (WHERE e."eventType" = \'click\' AND e."blockId" IS NOT NULL) as "clicks"',
      ])
      .where('e."blockId" IS NOT NULL')
      .groupBy('e."blockId"')
      .addGroupBy('e."blockType"')
      .orderBy('"views"', 'DESC')

    if (pageId) qb.andWhere('e."pageId" = :pageId', { pageId })
    if (range) qb.andWhere('e."createdAt" BETWEEN :from AND :to', { from: range.from, to: range.to })

    const rows = await qb.getRawMany()

    return rows.map(r => {
      const views = parseInt(r.views || '0')
      const clicks = parseInt(r.clicks || '0')
      return {
        blockId: r.blockId,
        blockType: r.blockType || 'unknown',
        views,
        avgViewDuration: parseFloat(r.avgViewDuration || '0'),
        clicks,
        ctr: views > 0 ? (clicks / views) * 100 : 0,
      }
    })
  }

  // ─── Статистика запросов ────────────────────────────────────

  async getRequestStats(pageId?: string, range?: DateRange, category?: string): Promise<RequestStats> {
    const where: string[] = ['e."eventType" IN (\'request_sent\', \'request_received\')']
    const params: Record<string, unknown> = {}
    if (pageId) { where.push('e."pageId" = :pageId'); params.pageId = pageId }
    if (range) { where.push('e."createdAt" BETWEEN :from AND :to'); params.from = range.from; params.to = range.to }
    // Category filter: 'api' = only real API, 'all' = everything, specific = that category
    if (category && category !== 'all') {
      where.push('e."requestCategory" = :cat')
      params.cat = category
    }
    const whereClause = where.join(' AND ')

    // Totals
    const totalsQb = this.eventRepo.createQueryBuilder('e')
      .select([
        'COUNT(*) FILTER (WHERE e."eventType" = \'request_sent\') as "totalSent"',
        'COUNT(*) FILTER (WHERE e."eventType" = \'request_received\') as "totalReceived"',
        'AVG(e."responseTime") FILTER (WHERE e."responseTime" IS NOT NULL) as "avgResponseTime"',
        'PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY e."responseTime") FILTER (WHERE e."responseTime" IS NOT NULL) as "medianResponseTime"',
        'PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY e."responseTime") FILTER (WHERE e."responseTime" IS NOT NULL) as "p95ResponseTime"',
        'PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY e."responseTime") FILTER (WHERE e."responseTime" IS NOT NULL) as "p99ResponseTime"',
        'AVG(CASE WHEN e."requestStatus" >= 400 THEN 1 ELSE 0 END) * 100 as "errorRate"',
      ])
      .where(whereClause, params)

    // By status
    const byStatusQb = this.eventRepo.createQueryBuilder('e')
      .select(['e."requestStatus" as "status"', 'COUNT(*) as "count"'])
      .where(whereClause + ' AND e."requestStatus" IS NOT NULL', params)
      .groupBy('e."requestStatus"')
      .orderBy('"count"', 'DESC')

    // By method
    const byMethodQb = this.eventRepo.createQueryBuilder('e')
      .select(['e."requestMethod" as "method"', 'COUNT(*) as "count"'])
      .where(whereClause + ' AND e."requestMethod" IS NOT NULL', params)
      .groupBy('e."requestMethod"')
      .orderBy('"count"', 'DESC')

    // Slowest endpoints
    const slowestQb = this.eventRepo.createQueryBuilder('e')
      .select([
        'e."requestUrl" as "url"',
        'AVG(e."responseTime") as "avgTime"',
        'COUNT(*) as "count"',
      ])
      .where(whereClause + ' AND e."requestUrl" IS NOT NULL AND e."responseTime" IS NOT NULL', params)
      .groupBy('e."requestUrl"')
      .orderBy('"avgTime"', 'DESC')
      .limit(20)

    // By category (always unfiltered to show distribution)
    const catWhere: string[] = ['e."eventType" IN (\'request_sent\', \'request_received\')']
    const catParams: Record<string, unknown> = {}
    if (pageId) { catWhere.push('e."pageId" = :pageId'); catParams.pageId = pageId }
    if (range) { catWhere.push('e."createdAt" BETWEEN :from AND :to'); catParams.from = range.from; catParams.to = range.to }
    const byCategoryQb = this.eventRepo.createQueryBuilder('e')
      .select(['COALESCE(e."requestCategory", \'api\') as "category"', 'COUNT(*) as "count"'])
      .where(catWhere.join(' AND '), catParams)
      .groupBy('COALESCE(e."requestCategory", \'api\')')
      .orderBy('"count"', 'DESC')

    // All individual endpoints (for the table)
    const endpointsQb = this.eventRepo.createQueryBuilder('e')
      .select([
        'e."requestUrl" as "url"',
        'e."requestMethod" as "method"',
        'COALESCE(e."requestCategory", \'api\') as "category"',
        'AVG(e."responseTime") as "avgTime"',
        'COUNT(*) as "count"',
        'AVG(CASE WHEN e."requestStatus" >= 400 THEN 1 ELSE 0 END) * 100 as "errorRate"',
      ])
      .where(whereClause + ' AND e."requestUrl" IS NOT NULL', params)
      .groupBy('e."requestUrl"')
      .addGroupBy('e."requestMethod"')
      .addGroupBy('COALESCE(e."requestCategory", \'api\')')
      .orderBy('"count"', 'DESC')
      .limit(50)


    // Parallel: 6 independent queries via Promise.all
    const [totals, byStatus, byMethod, slowest, byCategory, endpoints] = await Promise.all([
      totalsQb.getRawOne(),
      byStatusQb.getRawMany(),
      byMethodQb.getRawMany(),
      slowestQb.getRawMany(),
      byCategoryQb.getRawMany(),
      endpointsQb.getRawMany(),
    ])

    return {
      totalSent: parseInt(totals?.totalSent || '0'),
      totalReceived: parseInt(totals?.totalReceived || '0'),
      avgResponseTime: parseFloat(totals?.avgResponseTime || '0'),
      medianResponseTime: parseFloat(totals?.medianResponseTime || '0'),
      p95ResponseTime: parseFloat(totals?.p95ResponseTime || '0'),
      p99ResponseTime: parseFloat(totals?.p99ResponseTime || '0'),
      errorRate: parseFloat(totals?.errorRate || '0'),
      byStatus: byStatus.map(r => ({ status: parseInt(r.status), count: parseInt(r.count) })),
      byMethod: byMethod.map(r => ({ method: r.method, count: parseInt(r.count) })),
      slowestEndpoints: slowest.map(r => ({ url: r.url, avgTime: parseFloat(r.avgTime), count: parseInt(r.count) })),
      byCategory: byCategory.map(r => ({ category: r.category as string, count: parseInt(r.count) })),
      endpoints: endpoints.map(r => ({
        url: r.url as string,
        method: r.method as string,
        category: r.category as string,
        avgTime: parseFloat(r.avgTime || '0'),
        count: parseInt(r.count),
        errorRate: parseFloat(r.errorRate || '0'),
      })),
    }
  }

  // ─── Web Vitals ─────────────────────────────────────────────

  async getWebVitals(pageId?: string, range?: DateRange): Promise<WebVitalsStats> {
    const qb = this.eventRepo.createQueryBuilder('e')
      .where('e."eventType" = \'performance\'')
    if (pageId) qb.andWhere('e."pageId" = :pageId', { pageId })
    if (range) qb.andWhere('e."createdAt" BETWEEN :from AND :to', { from: range.from, to: range.to })

    const buildVitalQuery = async (field: string, goodThreshold: number, poorThreshold: number) => {
      const r = await this.eventRepo.createQueryBuilder('e')
        .select([
          `AVG(e."${field}") as "avg"`,
          `PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY e."${field}") as "p75"`,
          `COUNT(*) FILTER (WHERE e."${field}" <= ${goodThreshold}) as "good"`,
          `COUNT(*) FILTER (WHERE e."${field}" > ${goodThreshold} AND e."${field}" <= ${poorThreshold}) as "needsImprovement"`,
          `COUNT(*) FILTER (WHERE e."${field}" > ${poorThreshold}) as "poor"`,
        ])
        .where(`e."eventType" = 'performance' AND e."${field}" IS NOT NULL`)
        .andWhere(pageId ? 'e."pageId" = :pageId' : '1=1', { pageId })
        .andWhere(range ? 'e."createdAt" BETWEEN :from AND :to' : '1=1', range ? { from: range.from, to: range.to } : {})
        .getRawOne()

      return {
        avg: parseFloat(r?.avg || '0'),
        p75: parseFloat(r?.p75 || '0'),
        good: parseInt(r?.good || '0'),
        needsImprovement: parseInt(r?.needsImprovement || '0'),
        poor: parseInt(r?.poor || '0'),
      }
    }

    const [lcp, fcp, cls, ttfb, fid, inp] = await Promise.all([
      buildVitalQuery('lcp', 2500, 4000),
      buildVitalQuery('fcp', 1800, 3000),
      buildVitalQuery('cls', 0.1, 0.25),
      buildVitalQuery('ttfb', 800, 1800),
      buildVitalQuery('fid', 100, 300),
      buildVitalQuery('inp', 200, 500),
    ])

    return { lcp, fcp, cls, ttfb, fid, inp }
  }

  // ─── Device breakdown ───────────────────────────────────────

  async getDeviceBreakdown(pageId?: string, range?: DateRange): Promise<DeviceBreakdown[]> {
    const qb = this.sessionRepo.createQueryBuilder('s')
      .select(['s.device as "device"', 'COUNT(*) as "count"'])
      .groupBy('s.device')
      .orderBy('"count"', 'DESC')
    if (pageId) qb.andWhere('s."pageId" = :pageId', { pageId })
    if (range) qb.andWhere('s."startedAt" BETWEEN :from AND :to', { from: range.from, to: range.to })

    const rows = await qb.getRawMany()
    const total = rows.reduce((sum, r) => sum + parseInt(r.count || '0'), 0)

    return rows.map(r => ({
      device: (r.device || 'unknown') as DeviceCategory,
      count: parseInt(r.count || '0'),
      percentage: total > 0 ? (parseInt(r.count || '0') / total) * 100 : 0,
    }))
  }

  // ─── Browser breakdown ──────────────────────────────────────

  async getBrowserBreakdown(pageId?: string, range?: DateRange): Promise<BrowserBreakdown[]> {
    const qb = this.sessionRepo.createQueryBuilder('s')
      .select(['s.browser as "browser"', 'COUNT(*) as "count"'])
      .groupBy('s.browser')
      .orderBy('"count"', 'DESC')
      .limit(20)
    if (pageId) qb.andWhere('s."pageId" = :pageId', { pageId })
    if (range) qb.andWhere('s."startedAt" BETWEEN :from AND :to', { from: range.from, to: range.to })

    const rows = await qb.getRawMany()
    const total = rows.reduce((sum, r) => sum + parseInt(r.count || '0'), 0)

    return rows.map(r => ({
      browser: r.browser || 'Unknown',
      count: parseInt(r.count || '0'),
      percentage: total > 0 ? (parseInt(r.count || '0') / total) * 100 : 0,
    }))
  }

  // ─── Country breakdown ──────────────────────────────────────

  async getCountryBreakdown(pageId?: string, range?: DateRange): Promise<CountryBreakdown[]> {
    const qb = this.sessionRepo.createQueryBuilder('s')
      .select(['s.country as "country"', 'COUNT(*) as "count"'])
      .where('s.country IS NOT NULL')
      .groupBy('s.country')
      .orderBy('"count"', 'DESC')
      .limit(30)
    if (pageId) qb.andWhere('s."pageId" = :pageId', { pageId })
    if (range) qb.andWhere('s."startedAt" BETWEEN :from AND :to', { from: range.from, to: range.to })

    const rows = await qb.getRawMany()
    const total = rows.reduce((sum, r) => sum + parseInt(r.count || '0'), 0)

    return rows.map(r => ({
      country: r.country || 'Unknown',
      count: parseInt(r.count || '0'),
      percentage: total > 0 ? (parseInt(r.count || '0') / total) * 100 : 0,
    }))
  }

  // ─── Traffic Sources ────────────────────────────────────────

  async getTrafficSources(pageId?: string, range?: DateRange): Promise<TrafficSource[]> {
    const qb = this.sessionRepo.createQueryBuilder('s')
      .select([
        `COALESCE(s."utmSource", CASE
          WHEN s.referrer IS NULL OR s.referrer = '' THEN 'direct'
          WHEN s.referrer ILIKE '%google%' THEN 'google'
          WHEN s.referrer ILIKE '%yandex%' THEN 'yandex'
          WHEN s.referrer ILIKE '%facebook%' OR s.referrer ILIKE '%fb.com%' THEN 'facebook'
          WHEN s.referrer ILIKE '%instagram%' THEN 'instagram'
          WHEN s.referrer ILIKE '%t.me%' OR s.referrer ILIKE '%telegram%' THEN 'telegram'
          WHEN s.referrer ILIKE '%vk.com%' OR s.referrer ILIKE '%vkontakte%' THEN 'vk'
          WHEN s.referrer ILIKE '%twitter%' OR s.referrer ILIKE '%x.com%' THEN 'twitter/x'
          ELSE 'other'
        END) as "source"`,
        'COUNT(*) as "sessions"',
        'COUNT(DISTINCT s."visitorId") as "visitors"',
        'AVG(CASE WHEN s.bounced THEN 1 ELSE 0 END) * 100 as "bounceRate"',
        'AVG(s.duration) as "avgDuration"',
      ])
      .groupBy('"source"')
      .orderBy('"sessions"', 'DESC')

    if (pageId) qb.andWhere('s."pageId" = :pageId', { pageId })
    if (range) qb.andWhere('s."startedAt" BETWEEN :from AND :to', { from: range.from, to: range.to })

    const rows = await qb.getRawMany()

    return rows.map(r => ({
      source: r.source,
      sessions: parseInt(r.sessions || '0'),
      visitors: parseInt(r.visitors || '0'),
      bounceRate: parseFloat(r.bounceRate || '0'),
      avgDuration: parseFloat(r.avgDuration || '0'),
    }))
  }

  // ─── Top Referrers ──────────────────────────────────────────

  async getTopReferrers(pageId?: string, range?: DateRange): Promise<{ referrer: string; count: number }[]> {
    const qb = this.sessionRepo.createQueryBuilder('s')
      .select(['s.referrer as "referrer"', 'COUNT(*) as "count"'])
      .where('s.referrer IS NOT NULL AND s.referrer != \'\'')
      .groupBy('s.referrer')
      .orderBy('"count"', 'DESC')
      .limit(30)

    if (pageId) qb.andWhere('s."pageId" = :pageId', { pageId })
    if (range) qb.andWhere('s."startedAt" BETWEEN :from AND :to', { from: range.from, to: range.to })

    const rows = await qb.getRawMany()

    return rows.map(r => ({
      referrer: r.referrer,
      count: parseInt(r.count || '0'),
    }))
  }

  // ─── Realtime ───────────────────────────────────────────────

  async getRealtime(pageId?: string): Promise<RealTimeStats> {
    // 45s = 3× heartbeat interval (15s). After 45s with no heartbeat, user is considered gone.
    const activeThreshold = new Date(Date.now() - 45 * 1000)
    // 2-minute window for recent pageviews and event feed (informational)
    const recentWindow = new Date(Date.now() - 2 * 60 * 1000)

    // Active visitors/sessions — from sessions table using endedAt (updated by heartbeats every 15s)
    const sessionQb = this.sessionRepo.createQueryBuilder('s')
      .where('s."endedAt" >= :activeThreshold', { activeThreshold })
    if (pageId) sessionQb.andWhere('s."pageId" = :pageId', { pageId })

    // Recent events — from events table (informational feed)
    const eventQb = this.eventRepo.createQueryBuilder('e')
      .where('e."createdAt" >= :recentWindow', { recentWindow })
    if (pageId) eventQb.andWhere('e."pageId" = :pageId', { pageId })

    const [activeVisitors, activeSessions, recentPageviews, recentEvents] = await Promise.all([
      sessionQb.clone().select('COUNT(DISTINCT s."visitorId")', 'count').getRawOne().then(r => parseInt(r?.count || '0')),
      sessionQb.clone().select('COUNT(*)', 'count').getRawOne().then(r => parseInt(r?.count || '0')),
      eventQb.clone()
        .select(['e."pageSlug" as "pageSlug"', 'COUNT(*) as "count"'])
        .andWhere('e."eventType" = \'pageview\'')
        .groupBy('e."pageSlug"')
        .orderBy('"count"', 'DESC')
        .limit(10)
        .getRawMany()
        .then(rows => rows.map(r => ({ pageSlug: r.pageSlug || '/', count: parseInt(r.count || '0') }))),
      this.eventRepo.find({
        where: { createdAt: Between(recentWindow, new Date()) as any },
        order: { createdAt: 'DESC' },
        take: 20,
      }),
    ])

    return { activeVisitors, activeSessions, recentPageviews, recentEvents }
  }

  // ─── Детальная аналитика для конкретной страницы ─────────────

  async getPageDetailedAnalytics(pageId: string, range?: DateRange): Promise<{
    overview: OverviewStats
    timeSeries: TimeSeriesPoint[]
    blocks: BlockStats[]
    requests: RequestStats
    webVitals: WebVitalsStats
    scrollDepthDistribution: { depth: number; count: number }[]
    clickHeatmap: { target: string; clicks: number }[]
  }> {
    const [overview, timeSeries, blocks, requests, webVitals] = await Promise.all([
      this.getOverview(pageId, range),
      this.getTimeSeries(pageId, range),
      this.getBlockStats(pageId, range),
      this.getRequestStats(pageId, range),
      this.getWebVitals(pageId, range),
    ])

    // Scroll depth distribution
    const scrollQb = this.eventRepo.createQueryBuilder('e')
      .select([
        'FLOOR(e."scrollDepth" / 10) * 10 as "depth"',
        'COUNT(*) as "count"',
      ])
      .where('e."pageId" = :pageId AND e."eventType" = \'scroll\' AND e."scrollDepth" IS NOT NULL', { pageId })
      .groupBy('"depth"')
      .orderBy('"depth"', 'ASC')
    if (range) scrollQb.andWhere('e."createdAt" BETWEEN :from AND :to', { from: range.from, to: range.to })
    const scrollRows = await scrollQb.getRawMany()

    // Click heatmap (top clicked elements)
    const clickQb = this.eventRepo.createQueryBuilder('e')
      .select(['e."eventTarget" as "target"', 'COUNT(*) as "clicks"'])
      .where('e."pageId" = :pageId AND e."eventType" = \'click\' AND e."eventTarget" IS NOT NULL', { pageId })
      .groupBy('e."eventTarget"')
      .orderBy('"clicks"', 'DESC')
      .limit(50)
    if (range) clickQb.andWhere('e."createdAt" BETWEEN :from AND :to', { from: range.from, to: range.to })
    const clickRows = await clickQb.getRawMany()

    return {
      overview,
      timeSeries,
      blocks,
      requests,
      webVitals,
      scrollDepthDistribution: scrollRows.map(r => ({ depth: parseInt(r.depth || '0'), count: parseInt(r.count || '0') })),
      clickHeatmap: clickRows.map(r => ({ target: r.target, clicks: parseInt(r.clicks || '0') })),
    }
  }
}

export const analyticsService = new AnalyticsService()
