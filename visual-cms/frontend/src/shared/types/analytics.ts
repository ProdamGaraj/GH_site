// ─── Analytics Types ─────────────────────────────────────────────

export type AnalyticsEventType =
  | 'pageview'
  | 'block_view'
  | 'block_leave'
  | 'click'
  | 'scroll'
  | 'form_start'
  | 'form_submit'
  | 'request_sent'
  | 'request_received'
  | 'error'
  | 'performance'
  | 'session_start'
  | 'session_end'
  | 'custom'

export type DeviceCategory = 'desktop' | 'tablet' | 'mobile' | 'bot' | 'unknown'

export interface DateRange {
  from: string  // ISO date
  to: string    // ISO date
}

// ─── Overview ───────────────────────────────────────────────────

export interface OverviewStats {
  totalVisitors: number
  totalSessions: number
  totalPageviews: number
  totalEvents: number
  bounceRate: number
  avgSessionDuration: number
  avgPagesPerSession: number
  avgResponseTime: number
  totalRequestsSent: number
  totalRequestsReceived: number
  totalFormSubmissions: number
  totalErrors: number
}

// ─── Time Series ────────────────────────────────────────────────

export interface TimeSeriesPoint {
  date: string
  pageviews: number
  visitors: number
  sessions: number
  avgResponseTime: number
  bounceRate: number
}

// ─── Page Stats ─────────────────────────────────────────────────

export interface PageStats {
  pageSlug: string
  pageId: string | null
  pageviews: number
  uniqueVisitors: number
  avgTimeOnPage: number
  bounceRate: number
  avgScrollDepth: number
  entryCount: number
  exitCount: number
}

// ─── Block Stats ────────────────────────────────────────────────

export interface BlockStats {
  blockId: string
  blockType: string
  views: number
  avgViewDuration: number
  clicks: number
  ctr: number
}

// ─── Request Stats ──────────────────────────────────────────────

export type RequestCategory = 'api' | 'preflight' | 'static' | 'analytics' | 'service'

export interface RequestStats {
  totalSent: number
  totalReceived: number
  avgResponseTime: number
  medianResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  errorRate: number
  byStatus: { status: number; count: number }[]
  byMethod: { method: string; count: number }[]
  slowestEndpoints: { url: string; avgTime: number; count: number }[]
  byCategory: { category: string; count: number }[]
  endpoints: RequestEndpoint[]
}

export interface RequestEndpoint {
  url: string
  method: string
  category: string
  avgTime: number
  count: number
  errorRate: number
}

// ─── Web Vitals ─────────────────────────────────────────────────

export interface VitalMetric {
  avg: number
  p75: number
  good: number
  needsImprovement: number
  poor: number
}

export interface WebVitalsStats {
  lcp: VitalMetric
  fcp: VitalMetric
  cls: VitalMetric
  ttfb: VitalMetric
  fid: VitalMetric
  inp: VitalMetric
}

// ─── Breakdowns ─────────────────────────────────────────────────

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

// ─── Traffic ────────────────────────────────────────────────────

export interface TrafficSource {
  source: string
  sessions: number
  visitors: number
  bounceRate: number
  avgDuration: number
}

// ─── Realtime ───────────────────────────────────────────────────

export interface RealTimeStats {
  activeVisitors: number
  activeSessions: number
  recentPageviews: { pageSlug: string; count: number }[]
  recentEvents: unknown[]
}

// ─── Full Report ────────────────────────────────────────────────

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

// ─── Page Detailed Analytics ────────────────────────────────────

export interface PageDetailedAnalytics {
  overview: OverviewStats
  timeSeries: TimeSeriesPoint[]
  blocks: BlockStats[]
  requests: RequestStats
  webVitals: WebVitalsStats
  scrollDepthDistribution: { depth: number; count: number }[]
  clickHeatmap: { target: string; clicks: number }[]
}

// ─── Query params ───────────────────────────────────────────────

export interface AnalyticsQuery {
  pageId?: string
  /** Фильтр по сайту: агрегирует все страницы сайта (взаимоисключим с pageId). */
  siteId?: string
  from?: string
  to?: string
  category?: string
}
