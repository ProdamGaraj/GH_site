/**
 * useDataBindingWithTransforms
 * 
 * Расширенный хук для получения данных с поддержкой:
 * - Серверных фильтров
 * - Поиска
 * - Сортировки
 * - Пагинации
 * - Вычисляемых значений
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAppSelector, useAppDispatch } from '@/app/hooks'
import { selectAllBindings, selectBindingsVersion } from '../dataBindingsSlice'
import { setComputedValues } from '../computedValuesSlice'
import type { DataBinding } from '@/shared/types/dataBinding'
import type { 
  FilterCondition, 
  FetchWithTransformsRequest, 
  FetchWithTransformsResponse,
  DataTransform 
} from '@/shared/types/transforms'
import { dataBindingApi } from '@/shared/api'

// ============ Типы ============

export interface TransformOptions {
  /** Динамические фильтры */
  filters?: FilterCondition[]
  
  /** Поисковый запрос */
  search?: {
    query: string
    fields: string[]
  }
  
  /** Сортировка */
  sort?: {
    field: string
    order: 'asc' | 'desc'
  }
  
  /** Пагинация */
  pagination?: {
    page: number
    pageSize: number
  }
  
  /** Переопределение трансформаций */
  transformsOverride?: DataTransform[]
}

export interface UseDataBindingWithTransformsOptions extends TransformOptions {
  /** Авто-загрузка при монтировании */
  autoFetch?: boolean
  
  /** Интервал polling в ms */
  pollingInterval?: number
  
  /** ID связанного блока (для library blocks) */
  linkedBlockId?: string
  
  /** Дебаунс для поиска/фильтров в ms */
  debounceMs?: number
}

export interface TransformMeta {
  totalCount: number
  filteredCount: number
  returnedCount: number
  page?: number
  pageSize?: number
  totalPages?: number
  hasNextPage?: boolean
  hasPrevPage?: boolean
  computed?: {
    count?: number
    sum?: Record<string, number>
    avg?: Record<string, number>
    min?: Record<string, number>
    max?: Record<string, number>
  }
  responseTime?: number
}

export interface UseDataBindingWithTransformsResult<T> {
  /** Данные */
  data: T[]
  
  /** Загрузка */
  loading: boolean
  
  /** Ошибка */
  error: string | null
  
  /** Метаданные */
  meta: TransformMeta | null
  
  /** Принудительная перезагрузка */
  refetch: () => Promise<void>
  
  /** Применить новые фильтры */
  applyFilters: (filters: FilterCondition[]) => void
  
  /** Применить поиск */
  applySearch: (query: string) => void
  
  /** Применить сортировку */
  applySort: (field: string, order: 'asc' | 'desc') => void
  
  /** Перейти на страницу */
  goToPage: (page: number) => void
  
  /** Сбросить все фильтры */
  resetFilters: () => void
  
  /** Привязка */
  binding: DataBinding | null
}

/**
 * Хук для получения данных с серверными трансформациями
 * 
 * @example
 * const { data, meta, applyFilters, applySearch, goToPage } = useDataBindingWithTransforms<Project>(blockId, {
 *   autoFetch: true,
 *   pagination: { page: 1, pageSize: 12 }
 * })
 * 
 * // Применить фильтр
 * applyFilters([{ field: 'status', operator: 'eq', value: 'active' }])
 * 
 * // Поиск
 * applySearch('элитный')
 * 
 * // Пагинация
 * goToPage(2)
 */
export function useDataBindingWithTransforms<T = unknown>(
  blockId: string,
  options?: UseDataBindingWithTransformsOptions
): UseDataBindingWithTransformsResult<T> {
  const dispatch = useAppDispatch()
  
  // ============ Состояние ============
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<TransformMeta | null>(null)
  
  // Локальные трансформы (могут меняться через методы)
  const [filters, setFilters] = useState<FilterCondition[]>(options?.filters || [])
  const [search, setSearch] = useState(options?.search)
  const [sort, setSort] = useState(options?.sort)
  const [pagination, setPagination] = useState(options?.pagination || { page: 1, pageSize: 20 })
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  
  // ============ Получение binding и версии ============
  const allBindings = useAppSelector(selectAllBindings)
  const bindingsVersion = useAppSelector(selectBindingsVersion)
  
  const binding = useMemo(() => {
    const linkedBlockId = options?.linkedBlockId
    console.log('[useDataBindingWithTransforms] Finding binding:', { blockId, linkedBlockId, allBindingsCount: allBindings.length })
    
    // Сначала ищем по blockId (приоритет)
    let found = allBindings.find(
      b => b.isActive !== false &&
           (b.bindingType === 'input' || b.bindingType === 'bidirectional') && 
           b.blockId === blockId
    ) || null
    
    // Если не нашли по blockId, ищем по linkedBlockId
    if (!found && linkedBlockId) {
      found = allBindings.find(
        b => b.isActive !== false &&
             (b.bindingType === 'input' || b.bindingType === 'bidirectional') && 
             b.blockId === linkedBlockId
      ) || null
    }
    
    console.log('[useDataBindingWithTransforms] Found binding:', found?.id, 'for blockId:', found?.blockId, 'transforms:', (found?.config?.inputConfig as any)?.transforms)
    return found
  }, [allBindings, blockId, options?.linkedBlockId])
  
  const bindingId = binding?.id || ''
  
  // ============ Основной fetch ============
  const fetchData = useCallback(async () => {
    if (!bindingId) {
      console.warn(`[useDataBindingWithTransforms] No binding for block ${blockId}`, { allBindingsCount: allBindings.length })
      return
    }
    
    // Отменяем предыдущий запрос
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()
    
    setLoading(true)
    setError(null)
    
    try {
      const request: FetchWithTransformsRequest = {
        bindingId,
        filters: filters.length > 0 ? filters : undefined,
        search,
        sort,
        pagination
      }
      
      if (options?.transformsOverride) {
        request.transformsOverride = options.transformsOverride
      }
      
      console.log('[useDataBindingWithTransforms] Fetching:', request)
      
      const result = await dataBindingApi.fetchWithTransforms(request) as FetchWithTransformsResponse<T>
      
      if (result.success) {
        setData(result.data)
        setMeta(result.meta)
        
        // Сохраняем computed values в Redux для зависимых блоков
        dispatch(setComputedValues({
          blockId,
          bindingId,
          values: {
            count: result.meta.computed?.count ?? result.data.length,
            sum: result.meta.computed?.sum ?? {},
            avg: result.meta.computed?.avg ?? {},
            min: result.meta.computed?.min ?? {},
            max: result.meta.computed?.max ?? {}
          },
          totalCount: result.meta.totalCount,
          filteredCount: result.meta.filteredCount,
          returnedCount: result.meta.returnedCount
        }))
        
        console.log('[useDataBindingWithTransforms] Success:', { 
          count: result.data.length, 
          meta: result.meta 
        })
      } else {
        setError(result.error || 'Unknown error')
        console.error('[useDataBindingWithTransforms] Error:', result.error)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('[useDataBindingWithTransforms] Request aborted')
        return
      }
      const message = err instanceof Error ? err.message : 'Fetch error'
      setError(message)
      console.error('[useDataBindingWithTransforms] Fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }, [dispatch, bindingId, blockId, filters, search, sort, pagination, options?.transformsOverride])
  
  // ============ Дебаунс для поиска/фильтров ============
  const debouncedFetch = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    const delay = options?.debounceMs ?? 300
    debounceRef.current = setTimeout(() => {
      fetchData()
    }, delay)
  }, [fetchData, options?.debounceMs])
  
  // ============ Публичные методы ============
  
  const applyFilters = useCallback((newFilters: FilterCondition[]) => {
    setFilters(newFilters)
    // Сбрасываем на первую страницу при изменении фильтров
    setPagination(prev => ({ ...prev, page: 1 }))
  }, [])
  
  const applySearch = useCallback((query: string) => {
    // Используем searchFields из binding config или дефолтные
    const searchFields = options?.search?.fields || ['title', 'name', 'description']
    setSearch(query ? { query, fields: searchFields } : undefined)
    // Сбрасываем на первую страницу при поиске
    setPagination(prev => ({ ...prev, page: 1 }))
  }, [options?.search?.fields])
  
  const applySort = useCallback((field: string, order: 'asc' | 'desc') => {
    setSort({ field, order })
  }, [])
  
  const goToPage = useCallback((page: number) => {
    setPagination(prev => ({ ...prev, page }))
  }, [])
  
  const resetFilters = useCallback(() => {
    setFilters([])
    setSearch(undefined)
    setSort(options?.sort)
    setPagination({ page: 1, pageSize: options?.pagination?.pageSize || 20 })
  }, [options?.sort, options?.pagination?.pageSize])
  
  const refetch = useCallback(async () => {
    await fetchData()
  }, [fetchData])
  
  // ============ Эффекты ============
  
  // Авто-загрузка при монтировании или при изменении версии привязок
  useEffect(() => {
    console.log('[useDataBindingWithTransforms] autoFetch effect triggered:', { 
      autoFetch: options?.autoFetch, 
      bindingId, 
      blockId, 
      bindingsVersion,
      bindingTransforms: (binding?.config?.inputConfig as any)?.transforms
    })
    if (options?.autoFetch && bindingId) {
      console.log('[useDataBindingWithTransforms] Calling fetchData for version:', bindingsVersion)
      fetchData()
    }
  }, [options?.autoFetch, bindingId, bindingsVersion, fetchData])
  
  // Реагируем на изменение фильтров/поиска (с дебаунсом)
  useEffect(() => {
    if (bindingId) {
      debouncedFetch()
    }
    
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [filters, search]) // eslint-disable-line react-hooks/exhaustive-deps
  
  // Реагируем на изменение сортировки/пагинации (без дебаунса)
  useEffect(() => {
    if (bindingId && (sort || pagination)) {
      fetchData()
    }
  }, [sort, pagination]) // eslint-disable-line react-hooks/exhaustive-deps
  
  // Polling
  useEffect(() => {
    if (!options?.pollingInterval || !bindingId) return
    
    pollingRef.current = setInterval(() => {
      fetchData()
    }, options.pollingInterval)
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [options?.pollingInterval, bindingId, fetchData])
  
  // Cleanup
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])
  
  return {
    data,
    loading,
    error,
    meta,
    refetch,
    applyFilters,
    applySearch,
    applySort,
    goToPage,
    resetFilters,
    binding
  }
}

/**
 * Хук для получения вычисляемых значений из другого блока
 * Используется для зависимых блоков (счётчики, агрегаты)
 * 
 * @example
 * const { count, filteredCount, sum, loading } = useComputedValue(sourceBlockId)
 * 
 * // В JSX:
 * <div>Найдено {filteredCount} проектов</div>
 * <div>Общая площадь: {sum.area} м²</div>
 */
export function useComputedValue(
  sourceBlockId: string
): {
  count: number | null
  totalCount: number | null
  filteredCount: number | null
  sum: Record<string, number>
  avg: Record<string, number>
  min: Record<string, number>
  max: Record<string, number>
  loading: boolean
  lastUpdated: number | null
} {
  const computed = useAppSelector(state => 
    state.computedValues?.byBlockId[sourceBlockId] || null
  )
  
  if (!computed) {
    return {
      count: null,
      totalCount: null,
      filteredCount: null,
      sum: {},
      avg: {},
      min: {},
      max: {},
      loading: false,
      lastUpdated: null
    }
  }
  
  return {
    count: computed.values.count,
    totalCount: computed.totalCount,
    filteredCount: computed.filteredCount,
    sum: computed.values.sum,
    avg: computed.values.avg,
    min: computed.values.min,
    max: computed.values.max,
    loading: false,
    lastUpdated: computed.lastUpdated
  }
}

export default useDataBindingWithTransforms
