import React, { useEffect, useCallback, useMemo } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { Header } from '@/shared/components/Header'
import {
  fetchFullReport,
  fetchRealtime,
  fetchRequestStats,
  setDateRange,
  setSelectedSiteId,
  setActiveTab,
  setRequestCategory,
} from '@/features/analytics/analyticsSlice'
import { fetchSites } from '@/features/sites/sitesSlice'
import {
  BarChart3,
  Users,
  Eye,
  Clock,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Zap,
  AlertTriangle,
  Send,
  Inbox,
  FileText,
  Layers,
  TrendingUp,
  Timer,
  Gauge,
  RefreshCw,
  Filter,
} from 'lucide-react'

// ─── Утилиты форматирования ─────────────────────────────────

function fmtMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} мс`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} с`
  const min = Math.floor(ms / 60000)
  const sec = Math.round((ms % 60000) / 1000)
  return `${min}м ${sec}с`
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return Math.round(n).toString()
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`
}

// ─── Компоненты карточек ─────────────────────────────────────

const StatCard: React.FC<{
  label: string
  value: string
  icon: React.ReactNode
  subtext?: string
  trend?: 'up' | 'down' | 'neutral'
  color?: string
}> = ({ label, value, icon, subtext, trend, color = 'blue' }) => {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    pink: 'bg-pink-50 text-pink-600',
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3 hover:shadow-sm transition-shadow">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color] || colorMap.blue}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</div>
        <div className="text-xl font-bold text-gray-900 mt-0.5">{value}</div>
        {subtext && (
          <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
            {trend === 'up' && <ArrowUpRight className="w-3 h-3 text-green-500" />}
            {trend === 'down' && <ArrowDownRight className="w-3 h-3 text-red-500" />}
            {subtext}
          </div>
        )}
      </div>
    </div>
  )
}

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string }> = ({ icon, title, subtitle }) => (
  <div className="flex items-center gap-2 mb-4 mt-8">
    <div className="text-gray-400">{icon}</div>
    <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
    {subtitle && <span className="text-sm text-gray-400">— {subtitle}</span>}
  </div>
)

// ─── Mini bar chart (CSS-only) ──────────────────────────────

const MiniBar: React.FC<{ value: number; max: number; color?: string }> = ({ value, max, color = 'bg-blue-500' }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ─── Sparkline (SVG) ────────────────────────────────────────

const Sparkline: React.FC<{
  data: number[]
  width?: number
  height?: number
  color?: string
}> = ({ data, width = 200, height = 40, color = '#3b82f6' }) => {
  if (data.length < 2) return <div className="w-full h-10 bg-gray-50 rounded" />

  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const step = width / (data.length - 1)

  const points = data.map((v, i) => {
    const x = i * step
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')

  const areaPoints = `0,${height} ${points} ${width},${height}`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#grad-${color.replace('#', '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ─── Web Vitals gauge ───────────────────────────────────────

const VitalGauge: React.FC<{
  label: string
  value: number
  unit: string
  good: number
  poor: number
  goodCount: number
  niCount: number
  poorCount: number
}> = ({ label, value, unit, good, poor, goodCount, niCount, poorCount }) => {
  const total = goodCount + niCount + poorCount
  const status = value <= good ? 'good' : value <= poor ? 'needs-improvement' : 'poor'
  const statusColors = {
    good: 'text-green-600 bg-green-50 border-green-200',
    'needs-improvement': 'text-yellow-600 bg-yellow-50 border-yellow-200',
    poor: 'text-red-600 bg-red-50 border-red-200',
  }
  const statusLabels = {
    good: 'Хорошо',
    'needs-improvement': 'Требует улучшения',
    poor: 'Плохо',
  }

  return (
    <div className={`rounded-xl border p-4 ${statusColors[status]}`}>
      <div className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-2xl font-bold mt-1">
        {unit === 'ms' ? fmtMs(value) : value.toFixed(3)}
      </div>
      <div className="text-xs font-medium mt-1">{statusLabels[status]}</div>
      {total > 0 && (
        <div className="flex gap-1 mt-3 h-1.5 rounded-full overflow-hidden">
          <div className="bg-green-500 rounded-full" style={{ width: `${(goodCount / total) * 100}%` }} />
          <div className="bg-yellow-500 rounded-full" style={{ width: `${(niCount / total) * 100}%` }} />
          <div className="bg-red-500 rounded-full" style={{ width: `${(poorCount / total) * 100}%` }} />
        </div>
      )}
      <div className="flex justify-between text-[10px] mt-1 opacity-60">
        <span>{goodCount} ✓</span>
        <span>{niCount} ~</span>
        <span>{poorCount} ✗</span>
      </div>
    </div>
  )
}

// ─── Device icon helper ─────────────────────────────────────

const DeviceIcon: React.FC<{ device: string }> = ({ device }) => {
  switch (device) {
    case 'mobile': return <Smartphone className="w-4 h-4" />
    case 'tablet': return <Tablet className="w-4 h-4" />
    case 'desktop': return <Monitor className="w-4 h-4" />
    default: return <Globe className="w-4 h-4" />
  }
}

// ─── Date Range picker ──────────────────────────────────────

const PRESETS = [
  { label: 'Сегодня', days: 0 },
  { label: '7 дней', days: 7 },
  { label: '30 дней', days: 30 },
  { label: '90 дней', days: 90 },
]

// ═══════════════════════════════════════════════════════════════
// ─── MAIN PAGE ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

export const AnalyticsPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const {
    dateRange,
    selectedPageId,
    selectedSiteId,
    overview,
    timeSeries,
    pages,
    blocks,
    requests,
    webVitals,
    devices,
    browsers,
    countries,
    trafficSources,
    topReferrers,
    realtime,
    loading,
    error,
    activeTab,
    requestCategory,
  } = useAppSelector((state) => state.analytics)

  const allSites = useAppSelector((state) => state.sites.items)

  // ─── Data fetching ──────────────────────────────────────────

  const fetchData = useCallback(() => {
    const params = {
      pageId: selectedPageId || undefined,
      siteId: selectedSiteId || undefined,
      from: dateRange.from,
      to: dateRange.to,
    }
    dispatch(fetchFullReport(params))
  }, [dispatch, selectedPageId, selectedSiteId, dateRange])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Список сайтов для фильтра: аналитика открывается напрямую, и без этого
  // запроса селектор пуст (items наполнялся только визитом в раздел «Сайты»).
  useEffect(() => {
    dispatch(fetchSites())
  }, [dispatch])

  // Realtime auto-refresh
  useEffect(() => {
    if (activeTab !== 'realtime') return
    const poll = () => dispatch(fetchRealtime({
      pageId: selectedPageId || undefined,
      siteId: selectedSiteId || undefined,
    }))
    poll()
    const iv = setInterval(poll, 10000)
    return () => clearInterval(iv)
  }, [dispatch, activeTab, selectedPageId, selectedSiteId])

  // Re-fetch requests when category filter changes
  useEffect(() => {
    if (activeTab !== 'requests') return
    dispatch(fetchRequestStats({
      pageId: selectedPageId || undefined,
      siteId: selectedSiteId || undefined,
      from: dateRange.from,
      to: dateRange.to,
      category: requestCategory,
    }))
  }, [dispatch, requestCategory, activeTab, selectedPageId, selectedSiteId, dateRange])

  // ─── Date preset handler ───────────────────────────────────

  const handlePreset = (days: number) => {
    const to = new Date()
    const from = new Date()
    if (days > 0) from.setDate(from.getDate() - days)
    dispatch(setDateRange({
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0],
    }))
  }

  // ─── Tabs ──────────────────────────────────────────────────

  const tabs = [
    { key: 'overview' as const, label: 'Обзор', icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'pages' as const, label: 'Страницы', icon: <FileText className="w-4 h-4" /> },
    { key: 'blocks' as const, label: 'Блоки', icon: <Layers className="w-4 h-4" /> },
    { key: 'requests' as const, label: 'Запросы', icon: <Send className="w-4 h-4" /> },
    { key: 'vitals' as const, label: 'Web Vitals', icon: <Zap className="w-4 h-4" /> },
    { key: 'audience' as const, label: 'Аудитория', icon: <Users className="w-4 h-4" /> },
    { key: 'realtime' as const, label: 'Realtime', icon: <Activity className="w-4 h-4" /> },
  ]

  // ─── Sparkline data ────────────────────────────────────────

  const pvSparkline = useMemo(() => timeSeries.map(p => p.pageviews), [timeSeries])
  const visitorsSparkline = useMemo(() => timeSeries.map(p => p.visitors), [timeSeries])
  const responseSparkline = useMemo(() => timeSeries.map(p => p.avgResponseTime), [timeSeries])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* ─── Title & Filters ──────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              SEO Аналитика
            </h1>
            <p className="text-sm text-gray-500 mt-1">Полная статистика сайтов и каждого блока</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Site filter (разбиение по страницам — во вкладке «Страницы») */}
            <select
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              value={selectedSiteId || ''}
              onChange={e => dispatch(setSelectedSiteId(e.target.value || null))}
            >
              <option value="">Все сайты</option>
              {allSites.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            {/* Date presets */}
            <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
              {PRESETS.map(p => (
                <button
                  key={p.days}
                  onClick={() => handlePreset(p.days)}
                  className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 border-r border-gray-100 last:border-r-0 transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom range */}
            <input
              type="date"
              value={dateRange.from}
              onChange={e => dispatch(setDateRange({ ...dateRange, from: e.target.value }))}
              className="px-2 py-2 border border-gray-200 rounded-lg text-sm"
            />
            <span className="text-gray-400">—</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={e => dispatch(setDateRange({ ...dateRange, to: e.target.value }))}
              className="px-2 py-2 border border-gray-200 rounded-lg text-sm"
            />

            <button
              onClick={fetchData}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              title="Обновить"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ─── Tabs ─────────────────────────────────────────── */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => dispatch(setActiveTab(tab.key))}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── Error ────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* ─── Loading ──────────────────────────────────────── */}
        {loading && !overview && (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* ─── TAB: OVERVIEW ──────────────────────────────── */}
        {/* ═══════════════════════════════════════════════════ */}
        {activeTab === 'overview' && overview && (
          <div>
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              <StatCard label="Посетители" value={fmtNum(overview.totalVisitors)} icon={<Users className="w-5 h-5" />} color="blue" />
              <StatCard label="Сессии" value={fmtNum(overview.totalSessions)} icon={<Activity className="w-5 h-5" />} color="purple" />
              <StatCard label="Просмотры" value={fmtNum(overview.totalPageviews)} icon={<Eye className="w-5 h-5" />} color="green" />
              <StatCard label="Bounce Rate" value={fmtPct(overview.bounceRate)} icon={<ArrowDownRight className="w-5 h-5" />} color="orange" />
              <StatCard label="Ср. время сессии" value={fmtMs(overview.avgSessionDuration)} icon={<Clock className="w-5 h-5" />} color="cyan" />
              <StatCard label="Стр./сессия" value={overview.avgPagesPerSession.toFixed(1)} icon={<FileText className="w-5 h-5" />} color="pink" />
            </div>

            {/* Sparklines row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-xs text-gray-500 font-medium mb-2">Просмотры</div>
                <Sparkline data={pvSparkline} color="#3b82f6" />
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-xs text-gray-500 font-medium mb-2">Посетители</div>
                <Sparkline data={visitorsSparkline} color="#8b5cf6" />
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-xs text-gray-500 font-medium mb-2">Ср. время отклика</div>
                <Sparkline data={responseSparkline} color="#f59e0b" />
              </div>
            </div>

            {/* Request & Error summary */}
            <SectionTitle icon={<Send className="w-5 h-5" />} title="Запросы и ошибки" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Отправлено запросов" value={fmtNum(overview.totalRequestsSent)} icon={<Send className="w-5 h-5" />} color="blue" />
              <StatCard label="Получено ответов" value={fmtNum(overview.totalRequestsReceived)} icon={<Inbox className="w-5 h-5" />} color="green" />
              <StatCard label="Ср. время отклика" value={fmtMs(overview.avgResponseTime)} icon={<Timer className="w-5 h-5" />} color="purple" />
              <StatCard label="Форм отправлено" value={fmtNum(overview.totalFormSubmissions)} icon={<FileText className="w-5 h-5" />} color="cyan" />
            </div>

            {/* Traffic Sources */}
            {trafficSources.length > 0 && (
              <>
                <SectionTitle icon={<TrendingUp className="w-5 h-5" />} title="Источники трафика" />
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Источник</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Сессии</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Посетители</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Bounce Rate</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Ср. время</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trafficSources.map((s, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900 capitalize">{s.source}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{fmtNum(s.sessions)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{fmtNum(s.visitors)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{fmtPct(s.bounceRate)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{fmtMs(s.avgDuration)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Top Referrers */}
            {topReferrers.length > 0 && (
              <>
                <SectionTitle icon={<Globe className="w-5 h-5" />} title="Реферреры" />
                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                  {topReferrers.slice(0, 10).map((r, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-6">{i + 1}.</span>
                      <span className="text-sm text-gray-700 flex-1 truncate">{r.referrer}</span>
                      <span className="text-sm font-medium text-gray-900">{r.count}</span>
                      <div className="w-24">
                        <MiniBar value={r.count} max={topReferrers[0]?.count || 1} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* ─── TAB: PAGES ─────────────────────────────────── */}
        {/* ═══════════════════════════════════════════════════ */}
        {activeTab === 'pages' && (
          <div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Страница</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Просмотры</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Уник. посетители</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Ср. время</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Bounce Rate</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Ср. скролл</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Вход</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Выход</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                        Нет данных по страницам
                      </td>
                    </tr>
                  )}
                  {pages.map((p, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{p.pageSlug}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtNum(p.pageviews)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmtNum(p.uniqueVisitors)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmtMs(p.avgTimeOnPage)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          p.bounceRate < 40 ? 'bg-green-100 text-green-700' :
                          p.bounceRate < 70 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {fmtPct(p.bounceRate)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmtPct(p.avgScrollDepth)}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{p.entryCount}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{p.exitCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* ─── TAB: BLOCKS ────────────────────────────────── */}
        {/* ═══════════════════════════════════════════════════ */}
        {activeTab === 'blocks' && (
          <div>
            <p className="text-sm text-gray-500 mb-4">
              Время удержания и вовлечённость по каждому блоку сайта
            </p>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Блок</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Тип</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Просмотры</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Ср. время просмотра</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Клики</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">CTR</th>
                    <th className="px-4 py-3 font-medium text-gray-600 w-32">Engagement</th>
                  </tr>
                </thead>
                <tbody>
                  {blocks.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                        Нет данных по блокам
                      </td>
                    </tr>
                  )}
                  {blocks.map((b, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{b.blockId.slice(0, 12)}...</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                          {b.blockType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtNum(b.views)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmtMs(b.avgViewDuration)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmtNum(b.clicks)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          b.ctr > 5 ? 'bg-green-100 text-green-700' :
                          b.ctr > 1 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {fmtPct(b.ctr)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <MiniBar
                          value={b.avgViewDuration}
                          max={Math.max(...blocks.map(x => x.avgViewDuration), 1)}
                          color={b.avgViewDuration > 5000 ? 'bg-green-500' : b.avgViewDuration > 2000 ? 'bg-yellow-500' : 'bg-red-400'}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* ─── TAB: REQUESTS ──────────────────────────────── */}
        {/* ═══════════════════════════════════════════════════ */}
        {activeTab === 'requests' && requests && (
          <div>
            {/* Category filter */}
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500 font-medium">Категория:</span>
              {[
                { key: 'all',        label: 'Все',          color: 'gray' },
                { key: 'api',        label: 'API',          color: 'blue' },
                { key: 'static',     label: 'Статика',      color: 'green' },
                { key: 'preflight',  label: 'Preflight',    color: 'yellow' },
                { key: 'analytics',  label: 'Аналитика',    color: 'purple' },
                { key: 'service',    label: 'Сервисные',    color: 'red' },
              ].map(cat => {
                const isActive = requestCategory === cat.key
                const colorMap: Record<string, string> = {
                  gray:   isActive ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                  blue:   isActive ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100',
                  green:  isActive ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100',
                  yellow: isActive ? 'bg-yellow-500 text-white' : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100',
                  purple: isActive ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100',
                  red:    isActive ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100',
                }
                return (
                  <button
                    key={cat.key}
                    onClick={() => dispatch(setRequestCategory(cat.key))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${colorMap[cat.color]}`}
                  >
                    {cat.label}
                    {requests.byCategory?.find(c => c.category === cat.key)
                      ? ` (${requests.byCategory.find(c => c.category === cat.key)!.count})`
                      : cat.key === 'all' ? ` (${requests.byCategory?.reduce((s, c) => s + c.count, 0) || 0})` : ''}
                  </button>
                )
              })}
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatCard label="Отправлено" value={fmtNum(requests.totalSent)} icon={<Send className="w-5 h-5" />} color="blue" />
              <StatCard label="Получено" value={fmtNum(requests.totalReceived)} icon={<Inbox className="w-5 h-5" />} color="green" />
              <StatCard label="Ср. время" value={fmtMs(requests.avgResponseTime)} icon={<Timer className="w-5 h-5" />} color="purple" />
              <StatCard label="Ошибок" value={fmtPct(requests.errorRate)} icon={<AlertTriangle className="w-5 h-5" />} color="red" />
            </div>

            {/* Percentiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatCard label="Медиана" value={fmtMs(requests.medianResponseTime)} icon={<Gauge className="w-5 h-5" />} color="cyan" />
              <StatCard label="P95" value={fmtMs(requests.p95ResponseTime)} icon={<Gauge className="w-5 h-5" />} color="orange" />
              <StatCard label="P99" value={fmtMs(requests.p99ResponseTime)} icon={<Gauge className="w-5 h-5" />} color="red" />
              <StatCard label="Ошибки (4xx/5xx)" value={fmtPct(requests.errorRate)} icon={<AlertTriangle className="w-5 h-5" />} color="red" />
            </div>

            {/* Category breakdown */}
            {requests.byCategory && requests.byCategory.length > 0 && (
              <>
                <SectionTitle icon={<Layers className="w-5 h-5" />} title="По категориям" />
                <div className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
                  {requests.byCategory.map((c, i) => {
                    const catLabels: Record<string, string> = {
                      api: 'API', preflight: 'Preflight', static: 'Статика',
                      analytics: 'Аналитика', service: 'Сервисные',
                    }
                    const catColors: Record<string, string> = {
                      api: 'bg-blue-100 text-blue-800 border-blue-200',
                      preflight: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                      static: 'bg-green-100 text-green-800 border-green-200',
                      analytics: 'bg-purple-100 text-purple-800 border-purple-200',
                      service: 'bg-red-100 text-red-800 border-red-200',
                    }
                    return (
                      <div key={i} className={`rounded-lg border px-3 py-2 text-center ${catColors[c.category] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                        <div className="text-xs font-medium opacity-70">{catLabels[c.category] || c.category}</div>
                        <div className="text-lg font-bold">{fmtNum(c.count)}</div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* By Status */}
            {requests.byStatus.length > 0 && (
              <>
                <SectionTitle icon={<Activity className="w-5 h-5" />} title="По статусу ответа" />
                <div className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  {requests.byStatus.map((s, i) => {
                    const statusColor =
                      s.status < 300 ? 'bg-green-100 text-green-800 border-green-200' :
                      s.status < 400 ? 'bg-blue-100 text-blue-800 border-blue-200' :
                      s.status < 500 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                      'bg-red-100 text-red-800 border-red-200'
                    return (
                      <div key={i} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${statusColor}`}>
                        <span className="font-mono text-sm font-bold">{s.status}</span>
                        <span className="text-sm font-medium">× {fmtNum(s.count)}</span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* By Method */}
            {requests.byMethod.length > 0 && (
              <>
                <SectionTitle icon={<Send className="w-5 h-5" />} title="По методу" />
                <div className="bg-white rounded-xl border border-gray-200 p-4 flex gap-3 flex-wrap">
                  {requests.byMethod.map((m, i) => {
                    const methodColors: Record<string, string> = {
                      GET: 'bg-blue-100 text-blue-800 border-blue-200',
                      POST: 'bg-green-100 text-green-800 border-green-200',
                      PUT: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                      PATCH: 'bg-orange-100 text-orange-800 border-orange-200',
                      DELETE: 'bg-red-100 text-red-800 border-red-200',
                      OPTIONS: 'bg-gray-100 text-gray-700 border-gray-200',
                    }
                    return (
                      <div key={i} className={`px-4 py-2 rounded-lg border ${methodColors[m.method] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                        <span className="font-mono text-sm font-bold">{m.method}</span>
                        <span className="text-sm ml-2 opacity-70">{fmtNum(m.count)}</span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* All endpoints table */}
            {requests.endpoints && requests.endpoints.length > 0 && (
              <>
                <SectionTitle icon={<Timer className="w-5 h-5" />} title="Все эндпоинты" subtitle="отсортировано по количеству" />
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 font-medium text-gray-600">URL</th>
                        <th className="text-center px-3 py-3 font-medium text-gray-600">Метод</th>
                        <th className="text-center px-3 py-3 font-medium text-gray-600">Категория</th>
                        <th className="text-right px-3 py-3 font-medium text-gray-600">Ср. время</th>
                        <th className="text-right px-3 py-3 font-medium text-gray-600">Запросов</th>
                        <th className="text-right px-3 py-3 font-medium text-gray-600">Ошибки</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.endpoints.map((e, i) => {
                        const catBadge: Record<string, string> = {
                          api: 'bg-blue-100 text-blue-700',
                          preflight: 'bg-yellow-100 text-yellow-700',
                          static: 'bg-green-100 text-green-700',
                          analytics: 'bg-purple-100 text-purple-700',
                          service: 'bg-red-100 text-red-700',
                        }
                        const catLabels: Record<string, string> = {
                          api: 'API', preflight: 'Preflight', static: 'Статика',
                          analytics: 'Аналитика', service: 'Сервисные',
                        }
                        const methodBadge: Record<string, string> = {
                          GET: 'bg-blue-50 text-blue-700',
                          POST: 'bg-green-50 text-green-700',
                          PUT: 'bg-yellow-50 text-yellow-700',
                          PATCH: 'bg-orange-50 text-orange-700',
                          DELETE: 'bg-red-50 text-red-700',
                          OPTIONS: 'bg-gray-100 text-gray-600',
                        }
                        return (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-xs text-gray-700 truncate max-w-sm">{e.url}</td>
                            <td className="px-3 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${methodBadge[e.method] || 'bg-gray-100 text-gray-700'}`}>
                                {e.method}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${catBadge[e.category] || 'bg-gray-100 text-gray-700'}`}>
                                {catLabels[e.category] || e.category}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                e.avgTime < 200 ? 'bg-green-100 text-green-800' :
                                e.avgTime < 1000 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {fmtMs(e.avgTime)}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right text-gray-600 font-medium">{fmtNum(e.count)}</td>
                            <td className="px-3 py-3 text-right">
                              {e.errorRate > 0 ? (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                  {fmtPct(e.errorRate)}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">0%</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Slowest endpoints */}
            {requests.slowestEndpoints.length > 0 && (
              <>
                <SectionTitle icon={<AlertTriangle className="w-5 h-5" />} title="Самые медленные эндпоинты" />
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 font-medium text-gray-600">URL</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Ср. время</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Запросов</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.slowestEndpoints.map((e, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs text-gray-700 truncate max-w-sm">{e.url}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              e.avgTime < 200 ? 'bg-green-100 text-green-800' :
                              e.avgTime < 1000 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {fmtMs(e.avgTime)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600 font-medium">{fmtNum(e.count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* ─── TAB: WEB VITALS ────────────────────────────── */}
        {/* ═══════════════════════════════════════════════════ */}
        {activeTab === 'vitals' && webVitals && (
          <div>
            <p className="text-sm text-gray-500 mb-4">
              Core Web Vitals — ключевые показатели качества пользовательского опыта (по стандартам Google)
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <VitalGauge
                label="LCP — Largest Contentful Paint"
                value={webVitals.lcp.avg}
                unit="ms"
                good={2500}
                poor={4000}
                goodCount={webVitals.lcp.good}
                niCount={webVitals.lcp.needsImprovement}
                poorCount={webVitals.lcp.poor}
              />
              <VitalGauge
                label="FCP — First Contentful Paint"
                value={webVitals.fcp.avg}
                unit="ms"
                good={1800}
                poor={3000}
                goodCount={webVitals.fcp.good}
                niCount={webVitals.fcp.needsImprovement}
                poorCount={webVitals.fcp.poor}
              />
              <VitalGauge
                label="CLS — Cumulative Layout Shift"
                value={webVitals.cls.avg}
                unit="score"
                good={0.1}
                poor={0.25}
                goodCount={webVitals.cls.good}
                niCount={webVitals.cls.needsImprovement}
                poorCount={webVitals.cls.poor}
              />
              <VitalGauge
                label="TTFB — Time to First Byte"
                value={webVitals.ttfb.avg}
                unit="ms"
                good={800}
                poor={1800}
                goodCount={webVitals.ttfb.good}
                niCount={webVitals.ttfb.needsImprovement}
                poorCount={webVitals.ttfb.poor}
              />
              <VitalGauge
                label="FID — First Input Delay"
                value={webVitals.fid.avg}
                unit="ms"
                good={100}
                poor={300}
                goodCount={webVitals.fid.good}
                niCount={webVitals.fid.needsImprovement}
                poorCount={webVitals.fid.poor}
              />
              <VitalGauge
                label="INP — Interaction to Next Paint"
                value={webVitals.inp.avg}
                unit="ms"
                good={200}
                poor={500}
                goodCount={webVitals.inp.good}
                niCount={webVitals.inp.needsImprovement}
                poorCount={webVitals.inp.poor}
              />
            </div>

            {/* P75 summary */}
            <SectionTitle icon={<Gauge className="w-5 h-5" />} title="75-й перцентиль (P75)" subtitle="Рекомендуемый порог Google" />
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {Object.entries(webVitals).map(([key, val]) => (
                <div key={key} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                  <div className="text-xs text-gray-500 uppercase font-bold">{key}</div>
                  <div className="text-lg font-bold text-gray-900 mt-1">
                    {key === 'cls' ? val.p75.toFixed(3) : fmtMs(val.p75)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* ─── TAB: AUDIENCE ──────────────────────────────── */}
        {/* ═══════════════════════════════════════════════════ */}
        {activeTab === 'audience' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Devices */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Monitor className="w-4 h-4 text-gray-400" />
                Устройства
              </h3>
              {devices.length === 0 && <p className="text-sm text-gray-400">Нет данных</p>}
              <div className="space-y-3">
                {devices.map((d, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <DeviceIcon device={d.device} />
                        <span className="capitalize">{d.device}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{fmtPct(d.percentage)}</span>
                    </div>
                    <MiniBar
                      value={d.percentage}
                      max={100}
                      color={d.device === 'desktop' ? 'bg-blue-500' : d.device === 'mobile' ? 'bg-green-500' : 'bg-purple-500'}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Browsers */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4 text-gray-400" />
                Браузеры
              </h3>
              {browsers.length === 0 && <p className="text-sm text-gray-400">Нет данных</p>}
              <div className="space-y-3">
                {browsers.slice(0, 8).map((b, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700">{b.browser}</span>
                      <span className="text-sm font-medium text-gray-900">{fmtPct(b.percentage)}</span>
                    </div>
                    <MiniBar value={b.percentage} max={100} color="bg-indigo-500" />
                  </div>
                ))}
              </div>
            </div>

            {/* Countries */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4 text-gray-400" />
                География
              </h3>
              {countries.length === 0 && <p className="text-sm text-gray-400">Нет данных</p>}
              <div className="space-y-3">
                {countries.slice(0, 10).map((c, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700">{c.country}</span>
                      <span className="text-sm font-medium text-gray-900">{fmtNum(c.count)} ({fmtPct(c.percentage)})</span>
                    </div>
                    <MiniBar value={c.percentage} max={100} color="bg-emerald-500" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* ─── TAB: REALTIME ──────────────────────────────── */}
        {/* ═══════════════════════════════════════════════════ */}
        {activeTab === 'realtime' && (
          <div>
            {/* Live counters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                <div className="text-4xl font-bold text-green-700">{realtime?.activeVisitors ?? 0}</div>
                <div className="text-sm text-green-600 mt-1">Онлайн сейчас</div>
                <div className="w-2 h-2 bg-green-500 rounded-full mx-auto mt-2 animate-pulse" />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
                <div className="text-4xl font-bold text-blue-700">{realtime?.activeSessions ?? 0}</div>
                <div className="text-sm text-blue-600 mt-1">Активных сессий</div>
              </div>
            </div>

            {/* Recent pageviews */}
            {realtime?.recentPageviews && realtime.recentPageviews.length > 0 && (
              <>
                <SectionTitle icon={<Eye className="w-5 h-5" />} title="Просмотры (последние 5 мин)" />
                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                  {realtime.recentPageviews.map((p, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-sm text-gray-700 flex-1">{p.pageSlug}</span>
                      <span className="text-sm font-medium text-gray-900">{p.count}</span>
                      <div className="w-20">
                        <MiniBar value={p.count} max={realtime.recentPageviews[0]?.count || 1} color="bg-green-500" />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <p className="text-xs text-gray-400 mt-4">Обновляется автоматически каждые 10 секунд</p>
          </div>
        )}

        {/* ─── Empty state ─────────────────────────────────── */}
        {!loading && !overview && !error && (
          <div className="text-center py-20">
            <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">Нет данных аналитики</h3>
            <p className="text-sm text-gray-400 max-w-md mx-auto">
              Встройте скрипт аналитики на ваш опубликованный сайт, чтобы начать собирать данные:
            </p>
            <code className="mt-4 inline-block px-4 py-2 bg-gray-100 rounded-lg text-sm text-gray-700 font-mono">
              {'<script src="/api/analytics/tracker.js" data-page-id="PAGE_ID"></script>'}
            </code>
          </div>
        )}
      </div>
    </div>
  )
}

export default AnalyticsPage
