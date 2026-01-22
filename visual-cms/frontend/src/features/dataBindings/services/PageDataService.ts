import type { PageDataSource } from '../components/PageDataSourcesEditor'

type DataListener = (data: unknown, error?: Error) => void

interface DataSourceState {
  data: unknown
  error: Error | null
  loading: boolean
  lastFetchAt: number | null
  listeners: Set<DataListener>
  intervalId?: NodeJS.Timeout
}

interface FetchOptions {
  force?: boolean  // Ignore cache
  silent?: boolean // Don't update loading state
}

/**
 * Page Data Sources Runtime Service
 * 
 * Manages fetching and caching of page-level data sources:
 * - Automatic fetching on page load
 * - On-demand fetching
 * - Interval-based polling
 * - Caching with TTL
 * - Dependencies between sources
 */
class PageDataService {
  private sources: Map<string, PageDataSource> = new Map()
  private state: Map<string, DataSourceState> = new Map()
  private apiBaseUrl: string = '/api'

  /**
   * Initialize page data sources
   */
  initialize(dataSources: PageDataSource[], options?: { apiBaseUrl?: string }): void {
    if (options?.apiBaseUrl) {
      this.apiBaseUrl = options.apiBaseUrl
    }

    // Clear previous state
    this.cleanup()

    // Register sources
    dataSources.forEach(source => {
      this.sources.set(source.alias, source)
      this.state.set(source.alias, {
        data: null,
        error: null,
        loading: false,
        lastFetchAt: null,
        listeners: new Set()
      })
    })

    // Start fetching based on strategy
    this.startAutoFetch()
  }

  /**
   * Cleanup on page unload
   */
  cleanup(): void {
    // Stop all intervals
    this.state.forEach(s => {
      if (s.intervalId) clearInterval(s.intervalId)
    })
    this.sources.clear()
    this.state.clear()
  }

  /**
   * Get data by alias
   */
  getData<T = unknown>(alias: string): T | null {
    const normalizedAlias = this.normalizeAlias(alias)
    return this.state.get(normalizedAlias)?.data as T | null
  }

  /**
   * Get loading state
   */
  isLoading(alias: string): boolean {
    const normalizedAlias = this.normalizeAlias(alias)
    return this.state.get(normalizedAlias)?.loading ?? false
  }

  /**
   * Get error state
   */
  getError(alias: string): Error | null {
    const normalizedAlias = this.normalizeAlias(alias)
    return this.state.get(normalizedAlias)?.error ?? null
  }

  /**
   * Get full state for alias
   */
  getState(alias: string): { data: unknown; loading: boolean; error: Error | null } | null {
    const normalizedAlias = this.normalizeAlias(alias)
    const state = this.state.get(normalizedAlias)
    if (!state) return null
    return { data: state.data, loading: state.loading, error: state.error }
  }

  /**
   * Fetch data for a specific alias
   */
  async fetch(alias: string, options?: FetchOptions): Promise<unknown> {
    const normalizedAlias = this.normalizeAlias(alias)
    const source = this.sources.get(normalizedAlias)
    const state = this.state.get(normalizedAlias)

    if (!source || !state) {
      throw new Error(`Data source "${alias}" not found`)
    }

    // Check cache
    if (!options?.force && source.cacheEnabled && state.lastFetchAt) {
      const ttl = (source.cacheTTL || 300) * 1000
      if (Date.now() - state.lastFetchAt < ttl) {
        return state.data
      }
    }

    // Check dependencies
    await this.fetchDependencies(source)

    // Set loading state
    if (!options?.silent) {
      state.loading = true
      this.notifyListeners(normalizedAlias)
    }

    try {
      const data = await this.fetchFromApi(source)
      
      state.data = data
      state.error = null
      state.lastFetchAt = Date.now()
      state.loading = false

      this.notifyListeners(normalizedAlias)
      return data
    } catch (err) {
      state.error = err instanceof Error ? err : new Error(String(err))
      state.loading = false
      this.notifyListeners(normalizedAlias, state.error)
      throw state.error
    }
  }

  /**
   * Invalidate cache for alias
   */
  invalidateCache(alias: string): void {
    const normalizedAlias = this.normalizeAlias(alias)
    const state = this.state.get(normalizedAlias)
    if (state) {
      state.lastFetchAt = null
    }
  }

  /**
   * Invalidate all caches
   */
  invalidateAllCaches(): void {
    this.state.forEach(state => {
      state.lastFetchAt = null
    })
  }

  /**
   * Refetch data (invalidate + fetch)
   */
  async refetch(alias: string): Promise<unknown> {
    this.invalidateCache(alias)
    return this.fetch(alias, { force: true })
  }

  /**
   * Subscribe to data changes
   */
  subscribe(alias: string, listener: DataListener): () => void {
    const normalizedAlias = this.normalizeAlias(alias)
    const state = this.state.get(normalizedAlias)

    if (!state) {
      console.warn(`Cannot subscribe to unknown data source "${alias}"`)
      return () => {}
    }

    state.listeners.add(listener)

    // Immediately call with current data
    if (state.data !== null || state.error !== null) {
      listener(state.data, state.error || undefined)
    }

    return () => {
      state.listeners.delete(listener)
    }
  }

  /**
   * Get all data as object
   */
  getAllData(): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    this.state.forEach((state, alias) => {
      result[alias] = state.data
    })
    return result
  }

  // Private methods

  private normalizeAlias(alias: string): string {
    return alias.startsWith('$') ? alias.slice(1) : alias
  }

  private async startAutoFetch(): Promise<void> {
    // Sort by priority
    const sortedSources = Array.from(this.sources.values())
      .sort((a, b) => (a.priority || 0) - (b.priority || 0))

    for (const source of sortedSources) {
      const state = this.state.get(source.alias)
      if (!state) continue

      switch (source.loadStrategy) {
        case 'pageLoad':
          // Fetch immediately
          this.fetch(source.alias).catch(err => {
            console.error(`Auto-fetch failed for ${source.alias}:`, err)
          })
          break

        case 'interval': {
          // Fetch immediately, then set interval
          this.fetch(source.alias).catch(() => {})
          // loadInterval is in seconds, convert to ms
          const intervalMs = (source.loadInterval || 60) * 1000
          if (intervalMs > 0) {
            state.intervalId = setInterval(() => {
              this.fetch(source.alias, { silent: true }).catch(() => {})
            }, intervalMs)
          }
          break
        }

        case 'onDemand':
          // Don't fetch automatically
          break
      }
    }
  }

  private async fetchDependencies(source: PageDataSource): Promise<void> {
    if (!source.dependsOn || source.dependsOn.length === 0) return

    const promises = source.dependsOn.map(dep => {
      const depState = this.state.get(dep)
      // Only fetch if not already loaded
      if (!depState?.data && !depState?.loading) {
        return this.fetch(dep)
      }
      return Promise.resolve()
    })

    await Promise.all(promises)
  }

  private async fetchFromApi(source: PageDataSource): Promise<unknown> {
    const response = await fetch(`${this.apiBaseUrl}/data-fetch/fetch-with-binding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bindingId: source.dataSourceId,
        params: {}
      })
    })

    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.statusText}`)
    }

    const result = await response.json()
    return result.data
  }

  private notifyListeners(alias: string, error?: Error): void {
    const state = this.state.get(alias)
    if (!state) return

    state.listeners.forEach(listener => {
      try {
        listener(state.data, error)
      } catch (err) {
        console.error(`Data listener error for ${alias}:`, err)
      }
    })
  }
}

// Singleton instance
export const pageDataService = new PageDataService()

export default pageDataService
