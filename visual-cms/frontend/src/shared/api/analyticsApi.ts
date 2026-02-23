import { api } from './index'
import type {
  FullAnalyticsReport,
  OverviewStats,
  TimeSeriesPoint,
  PageStats,
  BlockStats,
  RequestStats,
  WebVitalsStats,
  DeviceBreakdown,
  BrowserBreakdown,
  CountryBreakdown,
  TrafficSource,
  RealTimeStats,
  PageDetailedAnalytics,
  AnalyticsQuery,
} from '../types/analytics'

// ─── Analytics API ───────────────────────────────────────────────

export const analyticsApi = {
  // Полный отчёт
  getFullReport: (params?: AnalyticsQuery) =>
    api.get<FullAnalyticsReport>('/analytics/report', { params: params as any }),

  // Overview
  getOverview: (params?: AnalyticsQuery) =>
    api.get<OverviewStats>('/analytics/overview', { params: params as any }),

  // Временные ряды
  getTimeSeries: (params?: AnalyticsQuery) =>
    api.get<TimeSeriesPoint[]>('/analytics/timeseries', { params: params as any }),

  // Статистика страниц
  getPageStats: (params?: AnalyticsQuery) =>
    api.get<PageStats[]>('/analytics/pages', { params: params as any }),

  // Детальная аналитика страницы
  getPageDetailed: (pageId: string, params?: { from?: string; to?: string }) =>
    api.get<PageDetailedAnalytics>(`/analytics/pages/${pageId}`, { params: params as any }),

  // Статистика блоков
  getBlockStats: (params?: AnalyticsQuery) =>
    api.get<BlockStats[]>('/analytics/blocks', { params: params as any }),

  // Статистика запросов
  getRequestStats: (params?: AnalyticsQuery) =>
    api.get<RequestStats>('/analytics/requests', { params: params as any }),

  // Web Vitals
  getWebVitals: (params?: AnalyticsQuery) =>
    api.get<WebVitalsStats>('/analytics/web-vitals', { params: params as any }),

  // Устройства
  getDevices: (params?: AnalyticsQuery) =>
    api.get<DeviceBreakdown[]>('/analytics/devices', { params: params as any }),

  // Браузеры
  getBrowsers: (params?: AnalyticsQuery) =>
    api.get<BrowserBreakdown[]>('/analytics/browsers', { params: params as any }),

  // Страны
  getCountries: (params?: AnalyticsQuery) =>
    api.get<CountryBreakdown[]>('/analytics/countries', { params: params as any }),

  // Источники трафика
  getTrafficSources: (params?: AnalyticsQuery) =>
    api.get<TrafficSource[]>('/analytics/traffic-sources', { params: params as any }),

  // Realtime
  getRealtime: (params?: { pageId?: string }) =>
    api.get<RealTimeStats>('/analytics/realtime', { params: params as any }),
}
