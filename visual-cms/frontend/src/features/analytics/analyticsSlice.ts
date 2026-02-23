import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { analyticsApi } from '@/shared/api/analyticsApi'
import type {
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
} from '@/shared/types/analytics'

// ─── State ───────────────────────────────────────────────────────

interface AnalyticsState {
  // Filters
  dateRange: { from: string; to: string }
  selectedPageId: string | null
  requestCategory: string  // 'all' | 'api' | 'preflight' | 'static' | 'service'

  // Data
  overview: OverviewStats | null
  timeSeries: TimeSeriesPoint[]
  pages: PageStats[]
  blocks: BlockStats[]
  requests: RequestStats | null
  webVitals: WebVitalsStats | null
  devices: DeviceBreakdown[]
  browsers: BrowserBreakdown[]
  countries: CountryBreakdown[]
  trafficSources: TrafficSource[]
  topReferrers: { referrer: string; count: number }[]
  realtime: RealTimeStats | null
  pageDetailed: PageDetailedAnalytics | null

  // UI
  loading: boolean
  error: string | null
  activeTab: 'overview' | 'pages' | 'blocks' | 'requests' | 'vitals' | 'audience' | 'realtime'
}

const now = new Date()
const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

const initialState: AnalyticsState = {
  dateRange: {
    from: thirtyDaysAgo.toISOString().split('T')[0],
    to: now.toISOString().split('T')[0],
  },
  selectedPageId: null,
  requestCategory: 'all',

  overview: null,
  timeSeries: [],
  pages: [],
  blocks: [],
  requests: null,
  webVitals: null,
  devices: [],
  browsers: [],
  countries: [],
  trafficSources: [],
  topReferrers: [],
  realtime: null,
  pageDetailed: null,

  loading: false,
  error: null,
  activeTab: 'overview',
}

// ─── Thunks ──────────────────────────────────────────────────────

export const fetchFullReport = createAsyncThunk(
  'analytics/fetchFullReport',
  async (params?: AnalyticsQuery) => {
    return await analyticsApi.getFullReport(params)
  }
)

export const fetchOverview = createAsyncThunk(
  'analytics/fetchOverview',
  async (params?: AnalyticsQuery) => {
    return await analyticsApi.getOverview(params)
  }
)

export const fetchTimeSeries = createAsyncThunk(
  'analytics/fetchTimeSeries',
  async (params?: AnalyticsQuery) => {
    return await analyticsApi.getTimeSeries(params)
  }
)

export const fetchPageStats = createAsyncThunk(
  'analytics/fetchPageStats',
  async (params?: AnalyticsQuery) => {
    return await analyticsApi.getPageStats(params)
  }
)

export const fetchBlockStats = createAsyncThunk(
  'analytics/fetchBlockStats',
  async (params?: AnalyticsQuery) => {
    return await analyticsApi.getBlockStats(params)
  }
)

export const fetchRequestStats = createAsyncThunk(
  'analytics/fetchRequestStats',
  async (params?: AnalyticsQuery) => {
    return await analyticsApi.getRequestStats(params)
  }
)

export const fetchWebVitals = createAsyncThunk(
  'analytics/fetchWebVitals',
  async (params?: AnalyticsQuery) => {
    return await analyticsApi.getWebVitals(params)
  }
)

export const fetchDevices = createAsyncThunk(
  'analytics/fetchDevices',
  async (params?: AnalyticsQuery) => {
    return await analyticsApi.getDevices(params)
  }
)

export const fetchBrowsers = createAsyncThunk(
  'analytics/fetchBrowsers',
  async (params?: AnalyticsQuery) => {
    return await analyticsApi.getBrowsers(params)
  }
)

export const fetchCountries = createAsyncThunk(
  'analytics/fetchCountries',
  async (params?: AnalyticsQuery) => {
    return await analyticsApi.getCountries(params)
  }
)

export const fetchTrafficSources = createAsyncThunk(
  'analytics/fetchTrafficSources',
  async (params?: AnalyticsQuery) => {
    return await analyticsApi.getTrafficSources(params)
  }
)

export const fetchRealtime = createAsyncThunk(
  'analytics/fetchRealtime',
  async (params?: { pageId?: string }) => {
    return await analyticsApi.getRealtime(params)
  }
)

export const fetchPageDetailed = createAsyncThunk(
  'analytics/fetchPageDetailed',
  async ({ pageId, from, to }: { pageId: string; from?: string; to?: string }) => {
    return await analyticsApi.getPageDetailed(pageId, { from, to })
  }
)

// ─── Slice ───────────────────────────────────────────────────────

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    setDateRange(state, action: PayloadAction<{ from: string; to: string }>) {
      state.dateRange = action.payload
    },
    setSelectedPageId(state, action: PayloadAction<string | null>) {
      state.selectedPageId = action.payload
    },
    setActiveTab(state, action: PayloadAction<AnalyticsState['activeTab']>) {
      state.activeTab = action.payload
    },
    clearPageDetailed(state) {
      state.pageDetailed = null
    },
    setRequestCategory(state, action: PayloadAction<string>) {
      state.requestCategory = action.payload
    },
  },
  extraReducers: (builder) => {
    // Full Report
    builder
      .addCase(fetchFullReport.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchFullReport.fulfilled, (state, action) => {
        state.loading = false
        const r = action.payload
        state.overview = r.overview
        state.timeSeries = r.timeSeries
        state.pages = r.pages
        state.blocks = r.blocks
        state.requests = r.requests
        state.webVitals = r.webVitals
        state.devices = r.devices
        state.browsers = r.browsers
        state.countries = r.countries
        state.trafficSources = r.trafficSources
        state.topReferrers = r.topReferrers
      })
      .addCase(fetchFullReport.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch analytics'
      })

    // Overview
    builder
      .addCase(fetchOverview.fulfilled, (state, action) => {
        state.overview = action.payload
      })

    // Time Series
    builder
      .addCase(fetchTimeSeries.fulfilled, (state, action) => {
        state.timeSeries = action.payload
      })

    // Pages
    builder
      .addCase(fetchPageStats.fulfilled, (state, action) => {
        state.pages = action.payload
      })

    // Blocks
    builder
      .addCase(fetchBlockStats.fulfilled, (state, action) => {
        state.blocks = action.payload
      })

    // Requests
    builder
      .addCase(fetchRequestStats.fulfilled, (state, action) => {
        state.requests = action.payload
      })

    // Web Vitals
    builder
      .addCase(fetchWebVitals.fulfilled, (state, action) => {
        state.webVitals = action.payload
      })

    // Devices
    builder.addCase(fetchDevices.fulfilled, (state, action) => {
      state.devices = action.payload
    })

    // Browsers
    builder.addCase(fetchBrowsers.fulfilled, (state, action) => {
      state.browsers = action.payload
    })

    // Countries
    builder.addCase(fetchCountries.fulfilled, (state, action) => {
      state.countries = action.payload
    })

    // Traffic Sources
    builder.addCase(fetchTrafficSources.fulfilled, (state, action) => {
      state.trafficSources = action.payload
    })

    // Realtime
    builder.addCase(fetchRealtime.fulfilled, (state, action) => {
      state.realtime = action.payload
    })

    // Page Detailed
    builder
      .addCase(fetchPageDetailed.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchPageDetailed.fulfilled, (state, action) => {
        state.loading = false
        state.pageDetailed = action.payload
      })
      .addCase(fetchPageDetailed.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch page analytics'
      })
  },
})

export const { setDateRange, setSelectedPageId, setActiveTab, clearPageDetailed, setRequestCategory } = analyticsSlice.actions
export default analyticsSlice.reducer
