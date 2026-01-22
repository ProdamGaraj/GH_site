/**
 * Variable Reactivity Utilities
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 6.3: Advanced Reactivity
 * 
 * Утилиты для продвинутой реактивности переменных.
 */

import { useCallback, useRef, useEffect, useMemo } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { 
  setVariableValue, 
  setVariableByName,
  selectAllValues,
} from './variablesSlice'

// ==================== TYPES ====================

export interface DependencyTracker {
  dependencies: Set<string>
  addDependency: (variableId: string) => void
  clearDependencies: () => void
  hasDependency: (variableId: string) => boolean
}

export interface ThrottleOptions {
  leading?: boolean
  trailing?: boolean
}

export interface BatchUpdate {
  variableId?: string
  variableName?: string
  pageId?: string
  value: unknown
}

// ==================== DEPENDENCY TRACKING ====================

/**
 * Hook для отслеживания зависимостей переменных
 * Используется для оптимизации ре-рендеров
 */
export function useDependencyTracker(): DependencyTracker {
  const dependenciesRef = useRef<Set<string>>(new Set())

  const addDependency = useCallback((variableId: string) => {
    dependenciesRef.current.add(variableId)
  }, [])

  const clearDependencies = useCallback(() => {
    dependenciesRef.current.clear()
  }, [])

  const hasDependency = useCallback((variableId: string) => {
    return dependenciesRef.current.has(variableId)
  }, [])

  return {
    dependencies: dependenciesRef.current,
    addDependency,
    clearDependencies,
    hasDependency,
  }
}

// ==================== THROTTLING ====================

/**
 * Hook для throttling обновлений переменной
 */
export function useThrottledVariable(
  variableId: string,
  delay: number = 100,
  options: ThrottleOptions = {}
): [unknown, (value: unknown) => void] {
  const { leading = true, trailing = true } = options
  const dispatch = useAppDispatch()
  const allValues = useAppSelector(selectAllValues)
  const value = allValues[variableId]?.value
  
  const lastCallRef = useRef<number>(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingValueRef = useRef<unknown | null>(null)

  const throttledSetValue = useCallback((newValue: unknown) => {
    const now = Date.now()
    const timeSinceLastCall = now - lastCallRef.current

    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    if (timeSinceLastCall >= delay) {
      // Enough time has passed, execute immediately
      if (leading) {
        dispatch(setVariableValue({ variableId, value: newValue }))
        lastCallRef.current = now
        pendingValueRef.current = null
      } else {
        pendingValueRef.current = newValue
        timeoutRef.current = setTimeout(() => {
          if (pendingValueRef.current !== null) {
            dispatch(setVariableValue({ variableId, value: pendingValueRef.current }))
            lastCallRef.current = Date.now()
            pendingValueRef.current = null
          }
        }, delay)
      }
    } else {
      // Not enough time has passed, schedule for later
      pendingValueRef.current = newValue
      if (trailing) {
        const remainingTime = delay - timeSinceLastCall
        timeoutRef.current = setTimeout(() => {
          if (pendingValueRef.current !== null) {
            dispatch(setVariableValue({ variableId, value: pendingValueRef.current }))
            lastCallRef.current = Date.now()
            pendingValueRef.current = null
          }
        }, remainingTime)
      }
    }
  }, [dispatch, variableId, delay, leading, trailing])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return [value, throttledSetValue]
}

// ==================== BATCH UPDATES ====================

/**
 * Hook для batch обновления нескольких переменных
 */
export function useBatchUpdate() {
  const dispatch = useAppDispatch()
  const pendingUpdatesRef = useRef<BatchUpdate[]>([])
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const queueUpdate = useCallback((update: BatchUpdate) => {
    pendingUpdatesRef.current.push(update)

    // Debounce - execute all queued updates at once
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      const updates = [...pendingUpdatesRef.current]
      pendingUpdatesRef.current = []

      // Apply all updates
      updates.forEach((u) => {
        if (u.variableId) {
          dispatch(setVariableValue({ variableId: u.variableId, value: u.value }))
        } else if (u.variableName && u.pageId) {
          dispatch(setVariableByName({ pageId: u.pageId, name: u.variableName, value: u.value }))
        }
      })
    }, 0) // Execute in next tick
  }, [dispatch])

  const flushUpdates = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    const updates = [...pendingUpdatesRef.current]
    pendingUpdatesRef.current = []

    updates.forEach((u) => {
      if (u.variableId) {
        dispatch(setVariableValue({ variableId: u.variableId, value: u.value }))
      } else if (u.variableName && u.pageId) {
        dispatch(setVariableByName({ pageId: u.pageId, name: u.variableName, value: u.value }))
      }
    })
  }, [dispatch])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return { queueUpdate, flushUpdates }
}

// ==================== CONDITIONAL REACTIVITY ====================

export interface ConditionalReactivityConfig {
  condition: (currentValue: unknown, previousValue: unknown) => boolean
  onChange: (value: unknown) => void
}

/**
 * Hook для условной реактивности - вызывает callback только при определённых условиях
 */
export function useConditionalReactivity(
  variableId: string,
  config: ConditionalReactivityConfig
) {
  const allValues = useAppSelector(selectAllValues)
  const value = allValues[variableId]?.value
  const previousValueRef = useRef<unknown>(value)

  useEffect(() => {
    const previousValue = previousValueRef.current
    
    if (config.condition(value, previousValue)) {
      config.onChange(value)
    }
    
    previousValueRef.current = value
  }, [value, config])
}

// ==================== DERIVED VARIABLES ====================

export type DeriveFunction<T = unknown> = (values: Record<string, unknown>) => T

/**
 * Hook для создания derived (вычисляемой) переменной из нескольких
 */
export function useDerivedVariable<T = unknown>(
  variableIds: string[],
  deriveFn: DeriveFunction<T>
): T {
  const allValues = useAppSelector(selectAllValues)
  
  const values = useMemo(() => {
    const result: Record<string, unknown> = {}
    variableIds.forEach((id) => {
      result[id] = allValues[id]?.value
    })
    return result
  }, [allValues, variableIds])

  return useMemo(() => deriveFn(values), [values, deriveFn])
}

// ==================== VARIABLE CHANGE HISTORY ====================

export interface VariableChangeRecord {
  timestamp: number
  previousValue: unknown
  newValue: unknown
}

/**
 * Hook для отслеживания истории изменений переменной
 */
export function useVariableHistory(
  variableId: string,
  maxHistory: number = 10
): {
  history: VariableChangeRecord[]
  canUndo: boolean
  undo: () => void
} {
  const dispatch = useAppDispatch()
  const allValues = useAppSelector(selectAllValues)
  const value = allValues[variableId]?.value
  const historyRef = useRef<VariableChangeRecord[]>([])
  const previousValueRef = useRef<unknown>(value)

  // Track changes
  useEffect(() => {
    const previousValue = previousValueRef.current
    
    if (JSON.stringify(value) !== JSON.stringify(previousValue)) {
      historyRef.current.push({
        timestamp: Date.now(),
        previousValue,
        newValue: value,
      })
      
      // Trim history if needed
      if (historyRef.current.length > maxHistory) {
        historyRef.current = historyRef.current.slice(-maxHistory)
      }
      
      previousValueRef.current = value
    }
  }, [value, maxHistory])

  const undo = useCallback(() => {
    const lastChange = historyRef.current.pop()
    if (lastChange) {
      dispatch(setVariableValue({ variableId, value: lastChange.previousValue }))
      previousValueRef.current = lastChange.previousValue
    }
  }, [dispatch, variableId])

  return {
    history: historyRef.current,
    canUndo: historyRef.current.length > 0,
    undo,
  }
}

// ==================== VARIABLE WATCHERS ====================

export type WatchCallback = (newValue: unknown, oldValue: unknown) => void

/**
 * Hook для наблюдения за изменениями переменной с callback
 */
export function useVariableWatch(
  variableId: string,
  callback: WatchCallback,
  deps: React.DependencyList = []
) {
  const allValues = useAppSelector(selectAllValues)
  const value = allValues[variableId]?.value
  const previousValueRef = useRef<unknown>(value)
  const callbackRef = useRef(callback)

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback
  }, [callback, ...deps])

  // Watch for changes
  useEffect(() => {
    const previousValue = previousValueRef.current
    
    if (JSON.stringify(value) !== JSON.stringify(previousValue)) {
      callbackRef.current(value, previousValue)
      previousValueRef.current = value
    }
  }, [value])
}

/**
 * Hook для наблюдения за несколькими переменными
 */
export function useMultiVariableWatch(
  variableIds: string[],
  callback: (changes: Record<string, { oldValue: unknown; newValue: unknown }>) => void
) {
  const allValues = useAppSelector(selectAllValues)
  
  const values = useMemo(() => {
    const result: Record<string, unknown> = {}
    variableIds.forEach((id) => {
      result[id] = allValues[id]?.value
    })
    return result
  }, [allValues, variableIds])
  
  const previousValuesRef = useRef<Record<string, unknown>>({ ...values })

  useEffect(() => {
    const changes: Record<string, { oldValue: unknown; newValue: unknown }> = {}
    let hasChanges = false

    variableIds.forEach((id) => {
      const oldValue = previousValuesRef.current[id]
      const newValue = values[id]
      
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes[id] = { oldValue, newValue }
        hasChanges = true
      }
    })

    if (hasChanges) {
      callback(changes)
      previousValuesRef.current = { ...values }
    }
  }, [values, variableIds, callback])
}
