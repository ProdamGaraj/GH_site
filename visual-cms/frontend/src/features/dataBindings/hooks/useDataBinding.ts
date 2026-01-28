import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { 
  fetchDataWithBinding, 
  selectFetchedData, 
  selectIsFetching, 
  selectFetchError,
  selectInputBindingForBlock 
} from '../dataBindingsSlice'
import type { DataBinding, InputBindingConfig } from '@/shared/types/dataBinding'

interface UseDataBindingOptions {
  /** Auto-fetch on mount */
  autoFetch?: boolean
  /** Fetch params */
  params?: Record<string, unknown>
  /** Polling interval in ms */
  pollingInterval?: number
  /** Transform function for data */
  transform?: (data: unknown) => unknown
  /** LinkedBlockId for library blocks (bindings may be stored by library block ID) */
  linkedBlockId?: string
}

interface UseDataBindingResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: (params?: Record<string, unknown>) => Promise<void>
  binding: DataBinding | null
}

/**
 * Hook for using INPUT data binding in a block
 * 
 * @example
 * const { data, loading, error, refetch } = useDataBinding<Product[]>(blockId)
 */
export function useDataBinding<T = unknown>(
  blockId: string,
  options?: UseDataBindingOptions
): UseDataBindingResult<T> {
  const dispatch = useAppDispatch()
  
  // Create memoized selectors for this specific block
  // Also search by linkedBlockId if provided (for library blocks)
  const inputBindingSelector = useMemo(
    () => selectInputBindingForBlock(blockId, options?.linkedBlockId), 
    [blockId, options?.linkedBlockId]
  )
  
  // Get binding for this block
  const binding = useAppSelector(inputBindingSelector)
  
  // Get data by binding id
  const bindingId = binding?.id || ''
  const fetchedDataSelector = useMemo(() => selectFetchedData(bindingId), [bindingId])
  const isFetchingSelector = useMemo(() => selectIsFetching(bindingId), [bindingId])
  const fetchErrorSelector = useMemo(() => selectFetchError(bindingId), [bindingId])
  
  const fetchedData = useAppSelector(fetchedDataSelector)
  const isFetching = useAppSelector(isFetchingSelector)
  const fetchError = useAppSelector(fetchErrorSelector)

  const [localData, setLocalData] = useState<T | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Apply transform if provided
  useEffect(() => {
    console.log('[useDataBinding] fetchedData changed:', { 
      blockId, 
      bindingId, 
      fetchedData,
      fetchedDataRaw: JSON.stringify(fetchedData, null, 2),
      data: fetchedData?.data,
      dataType: typeof fetchedData?.data,
      isArray: Array.isArray(fetchedData?.data)
    })
    
    if (fetchedData?.data !== null && fetchedData?.data !== undefined) {
      const transformed = options?.transform ? options.transform(fetchedData.data) : fetchedData.data
      console.log('[useDataBinding] Setting localData:', transformed, 'type:', typeof transformed, 'isArray:', Array.isArray(transformed))
      setLocalData(transformed as T)
    } else {
      console.log('[useDataBinding] No data, setting null')
      setLocalData(null)
    }
  }, [fetchedData, options?.transform, blockId, bindingId])

  // Fetch function
  const fetch = useCallback(async (params?: Record<string, unknown>) => {
    if (!bindingId) {
      console.warn(`No input binding found for block ${blockId}`)
      return
    }

    await dispatch(fetchDataWithBinding({
      key: bindingId,
      request: {
        bindingId,
        blockId,
        variables: params || options?.params || {}
      }
    }))
  }, [dispatch, bindingId, blockId, options?.params])

  // Auto-fetch on mount
  useEffect(() => {
    if (options?.autoFetch && bindingId) {
      fetch()
    }
  }, [options?.autoFetch, bindingId, fetch])

  // Setup polling
  useEffect(() => {
    if (!options?.pollingInterval || !bindingId) return

    pollingRef.current = setInterval(() => {
      fetch()
    }, options.pollingInterval)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [options?.pollingInterval, bindingId, fetch])

  return {
    data: localData,
    loading: isFetching,
    error: fetchError || null,
    refetch: fetch,
    binding: binding || null
  }
}

/**
 * Hook for repeater/list rendering with data binding
 * 
 * @example
 * const { items, loading, pagination } = useRepeaterBinding<Product>(blockId)
 * return items.map(item => <ProductCard key={item.id} {...item} />)
 */
export function useRepeaterBinding<T = unknown>(
  blockId: string,
  options?: UseDataBindingOptions
): {
  items: T[]
  loading: boolean
  error: string | null
  pagination: {
    page: number
    pageSize: number
    total: number
    hasMore: boolean
    nextPage: () => void
    prevPage: () => void
    goToPage: (page: number) => void
  }
  refetch: () => Promise<void>
} {
  const { data, loading, error, refetch, binding } = useDataBinding<T[] | { items: T[]; total: number }>(blockId, options)
  
  const [page, setPage] = useState(1)
  const inputConfig = binding?.config?.inputConfig as InputBindingConfig | undefined
  const pageSize = inputConfig?.pagination?.pageSize || 10

  // Extract items from data
  const items: T[] = Array.isArray(data) 
    ? data 
    : (data as { items?: T[] })?.items || []

  const total = Array.isArray(data) 
    ? items.length 
    : (data as { total?: number })?.total || items.length

  const hasMore = page * pageSize < total

  const nextPage = useCallback(() => {
    if (hasMore) {
      setPage(p => p + 1)
      refetch()
    }
  }, [hasMore, refetch])

  const prevPage = useCallback(() => {
    if (page > 1) {
      setPage(p => p - 1)
      refetch()
    }
  }, [page, refetch])

  const goToPage = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= Math.ceil(total / pageSize)) {
      setPage(newPage)
      refetch()
    }
  }, [total, pageSize, refetch])

  return {
    items,
    loading,
    error,
    pagination: {
      page,
      pageSize,
      total,
      hasMore,
      nextPage,
      prevPage,
      goToPage
    },
    refetch
  }
}

/**
 * Hook for form submission with OUTPUT binding
 * 
 * @example
 * const { submit, loading, error, success } = useFormSubmit(blockId)
 * const handleSubmit = (data) => submit(data)
 */
export function useFormSubmit(blockId: string): {
  submit: (formData: Record<string, unknown>) => Promise<unknown>
  loading: boolean
  error: string | null
  success: boolean
  reset: () => void
} {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const submit = useCallback(async (formData: Record<string, unknown>) => {
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch('/api/data-fetch/submit-with-binding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockId,
          formData
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Submission failed')
      }

      setSuccess(true)
      return result.data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [blockId])

  const reset = useCallback(() => {
    setLoading(false)
    setError(null)
    setSuccess(false)
  }, [])

  return { submit, loading, error, success, reset }
}

/**
 * Combined hook for blocks that need both input and output bindings
 * 
 * @example
 * const { data, submit, inputLoading, outputLoading } = useBlockBindings(blockId)
 */
export function useBlockBindings<TInput = unknown, TOutput = unknown>(
  blockId: string,
  options?: UseDataBindingOptions
): {
  // Input binding
  data: TInput | null
  inputLoading: boolean
  inputError: string | null
  refetch: () => Promise<void>
  // Output binding
  submit: (data: Record<string, unknown>) => Promise<TOutput>
  outputLoading: boolean
  outputError: string | null
  submitSuccess: boolean
} {
  const input = useDataBinding<TInput>(blockId, options)
  const output = useFormSubmit(blockId)

  return {
    // Input
    data: input.data,
    inputLoading: input.loading,
    inputError: input.error,
    refetch: input.refetch,
    // Output
    submit: output.submit as (data: Record<string, unknown>) => Promise<TOutput>,
    outputLoading: output.loading,
    outputError: output.error,
    submitSuccess: output.success
  }
}

export default useDataBinding
