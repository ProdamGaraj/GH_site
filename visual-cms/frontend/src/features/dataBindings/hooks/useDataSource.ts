/**
 * useDataSource hooks
 * 
 * Hooks для работы с источниками данных
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
// import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { api } from '@/shared/api'

// ==================== TYPES ====================

export interface DataSourceConfig {
  id: string
  name: string
  type: 'rest-api' | 'graphql' | 'static' | 'feed'
  url?: string
  method?: string
  headers?: Record<string, string>
  params?: Record<string, string>
}

interface UseDataSourcesResult {
  dataSources: DataSourceConfig[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

interface UseDataSourcePreviewResult {
  preview: unknown
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

// ==================== STATE ====================

let cachedDataSources: DataSourceConfig[] = []
let cacheTimestamp = 0
const CACHE_TTL = 60000 // 1 minute

const previewCache = new Map<string, { data: unknown; timestamp: number }>()
const PREVIEW_CACHE_TTL = 30000 // 30 seconds

// ==================== HOOKS ====================

/**
 * Hook для получения списка источников данных
 */
export function useDataSources(): UseDataSourcesResult {
  const [dataSources, setDataSources] = useState<DataSourceConfig[]>(cachedDataSources)
  const [loading, setLoading] = useState(cachedDataSources.length === 0)
  const [error, setError] = useState<string | null>(null)

  const fetchDataSources = useCallback(async () => {
    // Check cache
    if (cachedDataSources.length > 0 && Date.now() - cacheTimestamp < CACHE_TTL) {
      setDataSources(cachedDataSources)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await api.get('/data-sources') as { data?: { data?: DataSourceConfig[] } | DataSourceConfig[] }
      const rawData = response.data
      let sources: DataSourceConfig[] = []
      
      if (Array.isArray(rawData)) {
        sources = rawData
      } else if (rawData && typeof rawData === 'object' && 'data' in rawData && Array.isArray(rawData.data)) {
        sources = rawData.data
      }
      
      cachedDataSources = sources
      cacheTimestamp = Date.now()
      
      setDataSources(sources)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch data sources'
      setError(message)
      
      // Return some default sources if API fails
      if (cachedDataSources.length === 0) {
        const defaultSources: DataSourceConfig[] = [
          { id: 'manual', name: 'Manual Entry', type: 'static' },
        ]
        setDataSources(defaultSources)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDataSources()
  }, [fetchDataSources])

  return {
    dataSources,
    loading,
    error,
    refetch: fetchDataSources,
  }
}

/**
 * Hook для получения превью данных из источника
 */
export function useDataSourcePreview(dataSourceId: string): UseDataSourcePreviewResult {
  const [preview, setPreview] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPreview = useCallback(async () => {
    if (!dataSourceId) {
      setPreview(null)
      return
    }

    // Check cache
    const cached = previewCache.get(dataSourceId)
    if (cached && Date.now() - cached.timestamp < PREVIEW_CACHE_TTL) {
      setPreview(cached.data)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await api.get(`/data-sources/${dataSourceId}/preview`) as { data?: { data?: unknown } | unknown }
      const data = (response.data && typeof response.data === 'object' && 'data' in response.data ? response.data.data : response.data)
      
      previewCache.set(dataSourceId, { data, timestamp: Date.now() })
      setPreview(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch preview'
      setError(message)
      
      // Return sample data on error for development
      const sampleData = [
        { id: 1, name: 'Sample Item 1', price: 100, category: 'A' },
        { id: 2, name: 'Sample Item 2', price: 200, category: 'B' },
        { id: 3, name: 'Sample Item 3', price: 150, category: 'A' },
      ]
      setPreview(sampleData)
    } finally {
      setLoading(false)
    }
  }, [dataSourceId])

  useEffect(() => {
    fetchPreview()
  }, [fetchPreview])

  return {
    preview,
    loading,
    error,
    refetch: fetchPreview,
  }
}

/**
 * Hook для получения полей из превью данных
 */
export function useDataSourceFields(dataSourceId: string): {
  fields: string[]
  loading: boolean
} {
  const { preview, loading } = useDataSourcePreview(dataSourceId)

  const fields = useMemo(() => {
    if (!preview) return []
    const sample = Array.isArray(preview) ? preview[0] : preview
    if (!sample || typeof sample !== 'object') return []
    return Object.keys(sample as Record<string, unknown>)
  }, [preview])

  return { fields, loading }
}

/**
 * Clear all caches
 */
export function clearDataSourceCaches(): void {
  cachedDataSources = []
  cacheTimestamp = 0
  previewCache.clear()
}

export default {
  useDataSources,
  useDataSourcePreview,
  useDataSourceFields,
  clearDataSourceCaches,
}
