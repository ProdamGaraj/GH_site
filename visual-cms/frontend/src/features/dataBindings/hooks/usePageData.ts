import { useState, useEffect, useCallback } from 'react'
import { pageDataService } from '../services/PageDataService'

interface UsePageDataOptions {
  /** Fetch on mount (default: true for pageLoad sources) */
  fetchOnMount?: boolean
  /** Refetch interval in ms (overrides source config) */
  refetchInterval?: number
}

interface UsePageDataResult<T> {
  data: T | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
  invalidate: () => void
}

/**
 * Hook for accessing page-level data source
 * 
 * @example
 * const { data: products, loading, error, refetch } = usePageData<Product[]>('$products')
 */
export function usePageData<T = unknown>(
  alias: string,
  options?: UsePageDataOptions
): UsePageDataResult<T> {
  const normalizedAlias = alias.startsWith('$') ? alias.slice(1) : alias

  const [data, setData] = useState<T | null>(() => 
    pageDataService.getData<T>(normalizedAlias)
  )
  const [loading, setLoading] = useState(() => 
    pageDataService.isLoading(normalizedAlias)
  )
  const [error, setError] = useState<Error | null>(() => 
    pageDataService.getError(normalizedAlias)
  )

  // Subscribe to data changes
  useEffect(() => {
    const unsubscribe = pageDataService.subscribe(normalizedAlias, (newData, err) => {
      setData(newData as T | null)
      setError(err || null)
      setLoading(pageDataService.isLoading(normalizedAlias))
    })

    // Get current state
    const state = pageDataService.getState(normalizedAlias)
    if (state) {
      setData(state.data as T | null)
      setLoading(state.loading)
      setError(state.error)
    }

    return unsubscribe
  }, [normalizedAlias])

  // Fetch on mount if specified
  useEffect(() => {
    if (options?.fetchOnMount) {
      pageDataService.fetch(normalizedAlias).catch(() => {})
    }
  }, [normalizedAlias, options?.fetchOnMount])

  // Setup refetch interval
  useEffect(() => {
    if (!options?.refetchInterval) return

    const interval = setInterval(() => {
      pageDataService.fetch(normalizedAlias, { silent: true }).catch(() => {})
    }, options.refetchInterval)

    return () => clearInterval(interval)
  }, [normalizedAlias, options?.refetchInterval])

  const refetch = useCallback(async () => {
    await pageDataService.refetch(normalizedAlias)
  }, [normalizedAlias])

  const invalidate = useCallback(() => {
    pageDataService.invalidateCache(normalizedAlias)
  }, [normalizedAlias])

  return { data, loading, error, refetch, invalidate }
}

/**
 * Hook for fetching page data on demand
 * 
 * @example
 * const fetchProducts = usePageDataFetcher('$products')
 * // Later:
 * const data = await fetchProducts()
 */
export function usePageDataFetcher<T = unknown>(
  alias: string
): () => Promise<T | null> {
  const normalizedAlias = alias.startsWith('$') ? alias.slice(1) : alias

  return useCallback(async () => {
    try {
      const data = await pageDataService.fetch(normalizedAlias)
      return data as T
    } catch {
      return null
    }
  }, [normalizedAlias])
}

/**
 * Hook for accessing multiple page data sources
 * 
 * @example
 * const { products, categories, orders } = usePageDataMultiple(['$products', '$categories', '$orders'])
 */
export function usePageDataMultiple<T extends Record<string, unknown>>(
  aliases: string[]
): { data: Partial<T>; loading: boolean; errors: Record<string, Error | null> } {
  const [data, setData] = useState<Partial<T>>({})
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, Error | null>>({})

  useEffect(() => {
    const unsubscribes: (() => void)[] = []
    const newData: Partial<T> = {}
    const newErrors: Record<string, Error | null> = {}
    let isAnyLoading = false

    aliases.forEach(alias => {
      const normalizedAlias = alias.startsWith('$') ? alias.slice(1) : alias
      
      // Get initial state
      const state = pageDataService.getState(normalizedAlias)
      if (state) {
        newData[normalizedAlias as keyof T] = state.data as T[keyof T]
        newErrors[normalizedAlias] = state.error
        if (state.loading) isAnyLoading = true
      }

      // Subscribe to changes
      const unsub = pageDataService.subscribe(normalizedAlias, (d, err) => {
        setData(prev => ({ ...prev, [normalizedAlias]: d }))
        setErrors(prev => ({ ...prev, [normalizedAlias]: err || null }))
        
        // Check if any is still loading
        const anyLoading = aliases.some(a => {
          const na = a.startsWith('$') ? a.slice(1) : a
          return pageDataService.isLoading(na)
        })
        setLoading(anyLoading)
      })
      unsubscribes.push(unsub)
    })

    setData(newData)
    setErrors(newErrors)
    setLoading(isAnyLoading)

    return () => unsubscribes.forEach(unsub => unsub())
  }, [aliases.join(',')])

  return { data, loading, errors }
}

/**
 * Hook for checking if page data is ready
 * 
 * @example
 * const isReady = usePageDataReady(['$products', '$categories'])
 * if (!isReady) return <Loading />
 */
export function usePageDataReady(aliases: string[]): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const checkReady = () => {
      const allReady = aliases.every(alias => {
        const normalizedAlias = alias.startsWith('$') ? alias.slice(1) : alias
        const state = pageDataService.getState(normalizedAlias)
        return state && !state.loading && state.data !== null
      })
      setReady(allReady)
    }

    checkReady()

    const unsubscribes = aliases.map(alias => {
      const normalizedAlias = alias.startsWith('$') ? alias.slice(1) : alias
      return pageDataService.subscribe(normalizedAlias, checkReady)
    })

    return () => unsubscribes.forEach(unsub => unsub())
  }, [aliases.join(',')])

  return ready
}

export default usePageData
