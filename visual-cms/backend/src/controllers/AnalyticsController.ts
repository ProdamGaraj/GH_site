import { Request, Response } from 'express'
import { analyticsService, DateRange } from '../services/AnalyticsService'
import { logger } from '../services/Logger'

export class AnalyticsController {
  // ─── Tracking endpoint (вызывается из published-сайтов) ──────

  track = async (req: Request, res: Response) => {
    try {
      const { events } = req.body
      if (!events || !Array.isArray(events) || events.length === 0) {
        return res.status(400).json({ error: 'events array is required' })
      }
      if (events.length > 50) {
        return res.status(400).json({ error: 'Maximum 50 events per batch' })
      }

      const ip = req.ip || req.headers['x-forwarded-for']?.toString() || null
      const userAgent = req.headers['user-agent'] || null

      const result = await analyticsService.trackEvents(events, ip, userAgent)
      res.status(201).json(result)
    } catch (err: any) {
      logger.error('Analytics track error:', err)
      res.status(500).json({ error: 'Failed to track events' })
    }
  }

  // ─── Heartbeat (обновление длительности сессии) ──────────────

  heartbeat = async (req: Request, res: Response) => {
    try {
      const { sessionId, duration } = req.body
      if (!sessionId || typeof duration !== 'number') {
        return res.status(400).json({ error: 'sessionId and duration are required' })
      }
      await analyticsService.heartbeat(sessionId, duration)
      res.json({ ok: true })
    } catch (err: any) {
      logger.error('Analytics heartbeat error:', err)
      res.status(500).json({ error: 'Failed to update heartbeat' })
    }
  }

  // ─── Полный отчёт (для CMS-дашборда) ────────────────────────

  getFullReport = async (req: Request, res: Response) => {
    try {
      const { pageId, siteId, from, to } = req.query
      const range = this.parseRange(from as string, to as string)
      const report = await analyticsService.getFullReport(
        pageId as string | undefined,
        range,
        siteId as string | undefined,
      )
      res.json(report)
    } catch (err: any) {
      logger.error('Analytics full report error:', err)
      res.status(500).json({ error: 'Failed to get analytics report' })
    }
  }

  // ─── Overview ────────────────────────────────────────────────

  getOverview = async (req: Request, res: Response) => {
    try {
      const { pageId, siteId, from, to } = req.query
      const range = this.parseRange(from as string, to as string)
      const overview = await analyticsService.getOverview(
        pageId as string | undefined,
        range,
        siteId as string | undefined,
      )
      res.json(overview)
    } catch (err: any) {
      logger.error('Analytics overview error:', err)
      res.status(500).json({ error: 'Failed to get overview' })
    }
  }

  // ─── Time series ────────────────────────────────────────────

  getTimeSeries = async (req: Request, res: Response) => {
    try {
      const { pageId, siteId, from, to } = req.query
      const range = this.parseRange(from as string, to as string)
      const data = await analyticsService.getTimeSeries(
        pageId as string | undefined,
        range,
        siteId as string | undefined,
      )
      res.json(data)
    } catch (err: any) {
      logger.error('Analytics timeseries error:', err)
      res.status(500).json({ error: 'Failed to get time series' })
    }
  }

  // ─── Статистика страниц ─────────────────────────────────────

  getPageStats = async (req: Request, res: Response) => {
    try {
      const { pageId, siteId, from, to } = req.query
      const range = this.parseRange(from as string, to as string)
      const data = await analyticsService.getPageStats(
        pageId as string | undefined,
        range,
        siteId as string | undefined,
      )
      res.json(data)
    } catch (err: any) {
      logger.error('Analytics pageStats error:', err)
      res.status(500).json({ error: 'Failed to get page stats' })
    }
  }

  // ─── Статистика блоков ──────────────────────────────────────

  getBlockStats = async (req: Request, res: Response) => {
    try {
      const { pageId, siteId, from, to } = req.query
      const range = this.parseRange(from as string, to as string)
      const data = await analyticsService.getBlockStats(
        pageId as string | undefined,
        range,
        siteId as string | undefined,
      )
      res.json(data)
    } catch (err: any) {
      logger.error('Analytics blockStats error:', err)
      res.status(500).json({ error: 'Failed to get block stats' })
    }
  }

  // ─── Статистика запросов ────────────────────────────────────

  getRequestStats = async (req: Request, res: Response) => {
    try {
      const { pageId, siteId, from, to, category } = req.query
      const range = this.parseRange(from as string, to as string)
      const data = await analyticsService.getRequestStats(
        pageId as string | undefined,
        range,
        category as string | undefined,
        siteId as string | undefined,
      )
      res.json(data)
    } catch (err: any) {
      logger.error('Analytics requestStats error:', err)
      res.status(500).json({ error: 'Failed to get request stats' })
    }
  }

  // ─── Web Vitals ─────────────────────────────────────────────

  getWebVitals = async (req: Request, res: Response) => {
    try {
      const { pageId, siteId, from, to } = req.query
      const range = this.parseRange(from as string, to as string)
      const data = await analyticsService.getWebVitals(
        pageId as string | undefined,
        range,
        siteId as string | undefined,
      )
      res.json(data)
    } catch (err: any) {
      logger.error('Analytics webVitals error:', err)
      res.status(500).json({ error: 'Failed to get web vitals' })
    }
  }

  // ─── Устройства / Браузеры / Страны ─────────────────────────

  getDevices = async (req: Request, res: Response) => {
    try {
      const { pageId, siteId, from, to } = req.query
      const range = this.parseRange(from as string, to as string)
      const data = await analyticsService.getDeviceBreakdown(
        pageId as string | undefined,
        range,
        siteId as string | undefined,
      )
      res.json(data)
    } catch (err: any) {
      logger.error('Analytics devices error:', err)
      res.status(500).json({ error: 'Failed to get device stats' })
    }
  }

  getBrowsers = async (req: Request, res: Response) => {
    try {
      const { pageId, siteId, from, to } = req.query
      const range = this.parseRange(from as string, to as string)
      const data = await analyticsService.getBrowserBreakdown(
        pageId as string | undefined,
        range,
        siteId as string | undefined,
      )
      res.json(data)
    } catch (err: any) {
      logger.error('Analytics browsers error:', err)
      res.status(500).json({ error: 'Failed to get browser stats' })
    }
  }

  getCountries = async (req: Request, res: Response) => {
    try {
      const { pageId, siteId, from, to } = req.query
      const range = this.parseRange(from as string, to as string)
      const data = await analyticsService.getCountryBreakdown(
        pageId as string | undefined,
        range,
        siteId as string | undefined,
      )
      res.json(data)
    } catch (err: any) {
      logger.error('Analytics countries error:', err)
      res.status(500).json({ error: 'Failed to get country stats' })
    }
  }

  // ─── Источники трафика ──────────────────────────────────────

  getTrafficSources = async (req: Request, res: Response) => {
    try {
      const { pageId, siteId, from, to } = req.query
      const range = this.parseRange(from as string, to as string)
      const data = await analyticsService.getTrafficSources(
        pageId as string | undefined,
        range,
        siteId as string | undefined,
      )
      res.json(data)
    } catch (err: any) {
      logger.error('Analytics trafficSources error:', err)
      res.status(500).json({ error: 'Failed to get traffic sources' })
    }
  }

  // ─── Realtime ───────────────────────────────────────────────

  getRealtime = async (req: Request, res: Response) => {
    try {
      const { pageId, siteId } = req.query
      const data = await analyticsService.getRealtime(
        pageId as string | undefined,
        siteId as string | undefined,
      )
      res.json(data)
    } catch (err: any) {
      logger.error('Analytics realtime error:', err)
      res.status(500).json({ error: 'Failed to get realtime stats' })
    }
  }

  // ─── Детальная аналитика конкретной страницы ─────────────────

  getPageDetailed = async (req: Request, res: Response) => {
    try {
      const { id } = req.params
      const { from, to } = req.query
      const range = this.parseRange(from as string, to as string)
      const data = await analyticsService.getPageDetailedAnalytics(id, range)
      res.json(data)
    } catch (err: any) {
      logger.error('Analytics pageDetailed error:', err)
      res.status(500).json({ error: 'Failed to get page analytics' })
    }
  }

  // ─── Helper ─────────────────────────────────────────────────

  private parseRange(from?: string, to?: string): DateRange | undefined {
    if (!from && !to) return undefined
    const now = new Date()
    const fromDate = from ? new Date(from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    // 'to' date should cover the entire day (end-of-day 23:59:59.999)
    let toDate: Date
    if (to) {
      toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
    } else {
      toDate = now
    }
    return { from: fromDate, to: toDate }
  }
}
