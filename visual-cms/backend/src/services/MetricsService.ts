/**
 * Monitoring & Metrics Service
 * 
 * Сбор метрик приложения для мониторинга
 */

interface Metric {
  name: string
  value: number
  timestamp: Date
  labels: Record<string, string>
}

interface HistogramMetric {
  name: string
  values: number[]
  labels: Record<string, string>
}

class MetricsService {
  private counters: Map<string, number> = new Map()
  private gauges: Map<string, number> = new Map()
  private histograms: Map<string, HistogramMetric> = new Map()
  private startTime = Date.now()

  /**
   * Increment a counter
   */
  incrementCounter(name: string, labels: Record<string, string> = {}, value = 1): void {
    const key = this.buildKey(name, labels)
    const current = this.counters.get(key) || 0
    this.counters.set(key, current + value)
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.buildKey(name, labels)
    this.gauges.set(key, value)
  }

  /**
   * Record a histogram observation
   */
  recordHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.buildKey(name, labels)
    let histogram = this.histograms.get(key)
    
    if (!histogram) {
      histogram = { name, values: [], labels }
      this.histograms.set(key, histogram)
    }
    
    histogram.values.push(value)
    
    // Keep only last 1000 observations
    if (histogram.values.length > 1000) {
      histogram.values = histogram.values.slice(-1000)
    }
  }

  /**
   * Get all metrics in Prometheus format
   */
  getPrometheusMetrics(): string {
    const lines: string[] = []
    
    // Counters
    this.counters.forEach((value, key) => {
      lines.push(`# TYPE ${key.replace(/[{}\[\]]/g, '')} counter`)
      lines.push(`${key} ${value}`)
    })
    
    // Gauges
    this.gauges.forEach((value, key) => {
      lines.push(`# TYPE ${key.replace(/[{}\[\]]/g, '')} gauge`)
      lines.push(`${key} ${value}`)
    })
    
    // Histograms - compute percentiles
    this.histograms.forEach((histogram, key) => {
      const sorted = [...histogram.values].sort((a, b) => a - b)
      const count = sorted.length
      
      if (count > 0) {
        const sum = sorted.reduce((a, b) => a + b, 0)
        const p50 = sorted[Math.floor(count * 0.5)]
        const p90 = sorted[Math.floor(count * 0.9)]
        const p99 = sorted[Math.floor(count * 0.99)]
        
        lines.push(`# TYPE ${key.replace(/[{}\[\]]/g, '')} histogram`)
        lines.push(`${key}_count ${count}`)
        lines.push(`${key}_sum ${sum}`)
        lines.push(`${key}_p50 ${p50}`)
        lines.push(`${key}_p90 ${p90}`)
        lines.push(`${key}_p99 ${p99}`)
      }
    })
    
    // Add system metrics
    const memory = process.memoryUsage()
    lines.push(`# TYPE process_memory_heap_used_bytes gauge`)
    lines.push(`process_memory_heap_used_bytes ${memory.heapUsed}`)
    lines.push(`# TYPE process_memory_heap_total_bytes gauge`)
    lines.push(`process_memory_heap_total_bytes ${memory.heapTotal}`)
    lines.push(`# TYPE process_memory_external_bytes gauge`)
    lines.push(`process_memory_external_bytes ${memory.external}`)
    lines.push(`# TYPE process_uptime_seconds gauge`)
    lines.push(`process_uptime_seconds ${Math.floor((Date.now() - this.startTime) / 1000)}`)
    
    return lines.join('\n')
  }

  /**
   * Get metrics as JSON
   */
  getJsonMetrics(): object {
    const histogramStats: Record<string, object> = {}
    
    this.histograms.forEach((histogram, key) => {
      const sorted = [...histogram.values].sort((a, b) => a - b)
      const count = sorted.length
      
      if (count > 0) {
        histogramStats[key] = {
          count,
          sum: sorted.reduce((a, b) => a + b, 0),
          avg: sorted.reduce((a, b) => a + b, 0) / count,
          min: sorted[0],
          max: sorted[count - 1],
          p50: sorted[Math.floor(count * 0.5)],
          p90: sorted[Math.floor(count * 0.9)],
          p99: sorted[Math.floor(count * 0.99)],
        }
      }
    })
    
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: histogramStats,
      system: {
        memory: process.memoryUsage(),
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        nodeVersion: process.version,
        platform: process.platform,
      },
    }
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear()
    this.gauges.clear()
    this.histograms.clear()
  }

  private buildKey(name: string, labels: Record<string, string>): string {
    if (Object.keys(labels).length === 0) {
      return name
    }
    
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',')
    
    return `${name}{${labelStr}}`
  }
}

// Singleton instance
export const metricsService = new MetricsService()

/**
 * Common metric names
 */
export const MetricNames = {
  // HTTP
  HTTP_REQUESTS_TOTAL: 'http_requests_total',
  HTTP_REQUEST_DURATION_MS: 'http_request_duration_ms',
  HTTP_RESPONSE_SIZE_BYTES: 'http_response_size_bytes',
  
  // Database
  DB_QUERY_TOTAL: 'db_query_total',
  DB_QUERY_DURATION_MS: 'db_query_duration_ms',
  DB_CONNECTION_POOL_SIZE: 'db_connection_pool_size',
  
  // Cache
  CACHE_HITS: 'cache_hits_total',
  CACHE_MISSES: 'cache_misses_total',
  CACHE_SIZE: 'cache_size',
  
  // Business
  PAGES_CREATED: 'pages_created_total',
  BLOCKS_CREATED: 'blocks_created_total',
  DEPLOYS_TOTAL: 'deploys_total',
  
  // Errors
  ERRORS_TOTAL: 'errors_total',
}
