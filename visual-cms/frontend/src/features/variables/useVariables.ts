/**
 * useVariables Hook
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 6.2: Variables Management
 * 
 * Хуки для работы с переменными в компонентах.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  selectVariableValue,
  selectVariableByName,
  selectPageVariables,
  selectGlobalVariables,
  selectAllValues,
  setVariableValue,
  setVariableByName,
  resetVariableValue,
  subscribeBlock,
  unsubscribeBlock,
  unsubscribeAllForBlock,
  fetchPageVariables,
  createVariable,
  updateVariable,
  deleteVariable,
  type PageVariable,
  type VariableScope,
  type VariableType,
} from './variablesSlice'

// ==================== TYPES ====================

interface UseVariableResult<T = unknown> {
  value: T | undefined
  setValue: (value: T, source?: string) => void
  reset: () => void
  definition: PageVariable | undefined
  loading: boolean
}

interface UseVariablesManagerResult {
  variables: PageVariable[]
  globalVariables: PageVariable[]
  loading: boolean
  create: (data: CreateVariableParams) => Promise<PageVariable | null>
  update: (id: string, data: UpdateVariableParams) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
  fetchForPage: (pageId: string) => Promise<void>
}

interface CreateVariableParams {
  name: string
  pageId?: string
  scope?: VariableScope
  type?: VariableType
  defaultValue?: unknown
  description?: string
}

interface UpdateVariableParams {
  name?: string
  type?: VariableType
  defaultValue?: unknown
  description?: string
  isActive?: boolean
}

// ==================== HOOKS ====================

/**
 * Хук для работы с одной переменной по ID
 */
export function useVariable<T = unknown>(variableId: string): UseVariableResult<T> {
  const dispatch = useAppDispatch()
  
  const valueSelector = useMemo(
    () => selectVariableValue(variableId),
    [variableId]
  )
  const value = useAppSelector(valueSelector) as T | undefined
  
  const allDefinitions = useAppSelector(state => state.variables.definitions)
  const definition = allDefinitions[variableId]
  const loading = useAppSelector(state => state.variables.loading)

  const setValue = useCallback((newValue: T, source?: string) => {
    dispatch(setVariableValue({ variableId, value: newValue, source }))
  }, [dispatch, variableId])

  const reset = useCallback(() => {
    dispatch(resetVariableValue(variableId))
  }, [dispatch, variableId])

  return {
    value,
    setValue,
    reset,
    definition,
    loading,
  }
}

/**
 * Хук для работы с переменной по имени
 */
export function useVariableByName<T = unknown>(
  name: string,
  pageId?: string
): UseVariableResult<T> {
  const dispatch = useAppDispatch()
  
  const selector = useMemo(
    () => selectVariableByName(name, pageId),
    [name, pageId]
  )
  const result = useAppSelector(selector)
  const loading = useAppSelector(state => state.variables.loading)

  const value = result?.value as T | undefined
  const definition = result?.definition

  const setValue = useCallback((newValue: T, source?: string) => {
    dispatch(setVariableByName({ name, pageId, value: newValue, source }))
  }, [dispatch, name, pageId])

  const reset = useCallback(() => {
    if (definition) {
      dispatch(resetVariableValue(definition.id))
    }
  }, [dispatch, definition])

  return {
    value,
    setValue,
    reset,
    definition,
    loading,
  }
}

/**
 * Хук для подписки блока на переменную (реактивность)
 */
export function useVariableSubscription(
  variableId: string,
  blockId: string,
  onChange?: (value: unknown) => void
): void {
  const dispatch = useAppDispatch()
  const valueSelector = useMemo(
    () => selectVariableValue(variableId),
    [variableId]
  )
  const value = useAppSelector(valueSelector)
  const prevValueRef = useRef(value)

  // Subscribe on mount
  useEffect(() => {
    dispatch(subscribeBlock({ variableId, blockId }))
    
    return () => {
      dispatch(unsubscribeBlock({ variableId, blockId }))
    }
  }, [dispatch, variableId, blockId])

  // Call onChange when value changes
  useEffect(() => {
    if (prevValueRef.current !== value && onChange) {
      onChange(value)
    }
    prevValueRef.current = value
  }, [value, onChange])
}

/**
 * Хук для получения всех значений переменных (для runtime)
 */
export function useAllVariableValues(): Record<string, unknown> {
  const values = useAppSelector(selectAllValues)
  
  return useMemo(() => {
    const result: Record<string, unknown> = {}
    for (const [, valueObj] of Object.entries(values)) {
      // Use variable name as key
      result[valueObj.name] = valueObj.value
    }
    return result
  }, [values])
}

/**
 * Хук для управления переменными страницы
 */
export function usePageVariablesManager(pageId: string): UseVariablesManagerResult {
  const dispatch = useAppDispatch()
  
  const variablesSelector = useMemo(
    () => selectPageVariables(pageId),
    [pageId]
  )
  const variables = useAppSelector(variablesSelector)
  const globalVariables = useAppSelector(selectGlobalVariables)
  const loading = useAppSelector(state => state.variables.loading)

  // Fetch on mount
  useEffect(() => {
    if (pageId) {
      dispatch(fetchPageVariables(pageId))
    }
  }, [dispatch, pageId])

  const create = useCallback(async (data: CreateVariableParams): Promise<PageVariable | null> => {
    try {
      const result = await dispatch(createVariable({
        ...data,
        pageId: data.pageId || pageId,
      })).unwrap()
      return result
    } catch {
      return null
    }
  }, [dispatch, pageId])

  const update = useCallback(async (id: string, data: UpdateVariableParams): Promise<boolean> => {
    try {
      await dispatch(updateVariable({ id, data })).unwrap()
      return true
    } catch {
      return false
    }
  }, [dispatch])

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      await dispatch(deleteVariable(id)).unwrap()
      return true
    } catch {
      return false
    }
  }, [dispatch])

  const fetchForPage = useCallback(async (targetPageId: string) => {
    await dispatch(fetchPageVariables(targetPageId))
  }, [dispatch])

  return {
    variables,
    globalVariables,
    loading,
    create,
    update,
    remove,
    fetchForPage,
  }
}

/**
 * Хук для очистки подписок блока при unmount
 */
export function useBlockCleanup(blockId: string): void {
  const dispatch = useAppDispatch()

  useEffect(() => {
    return () => {
      dispatch(unsubscribeAllForBlock(blockId))
    }
  }, [dispatch, blockId])
}

/**
 * Хук для debounced variable update
 */
export function useDebouncedVariable<T = unknown>(
  variableId: string,
  debounceMs: number = 300
): UseVariableResult<T> & { debouncedSetValue: (value: T) => void } {
  const result = useVariable<T>(variableId)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const debouncedSetValue = useCallback((newValue: T) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    timeoutRef.current = setTimeout(() => {
      result.setValue(newValue)
    }, debounceMs)
  }, [result.setValue, debounceMs])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    ...result,
    debouncedSetValue,
  }
}

/**
 * Хук для computed variable (зависит от других)
 */
export function useComputedVariable<T = unknown>(
  expression: string,
  dependencies: string[],
  _pageId?: string // Reserved for future scoping
): T | undefined {
  const allValues = useAllVariableValues()
  
  return useMemo(() => {
    try {
      // Создаем контекст с зависимостями
      const context: Record<string, unknown> = {}
      for (const dep of dependencies) {
        context[dep] = allValues[dep]
      }
      
      // Выполняем выражение
      const fn = new Function(...dependencies, `return ${expression}`)
      return fn(...dependencies.map(d => context[d])) as T
    } catch (error) {
      console.error('Computed variable error:', error)
      return undefined
    }
  }, [expression, dependencies, allValues])
}

export default {
  useVariable,
  useVariableByName,
  useVariableSubscription,
  useAllVariableValues,
  usePageVariablesManager,
  useBlockCleanup,
  useDebouncedVariable,
  useComputedVariable,
}
