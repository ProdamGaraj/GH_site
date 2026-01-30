/**
 * useFilterBlocks
 * 
 * Хук для связи блоков-фильтров с данными.
 * Позволяет:
 * - Получать значения из input/select/checkbox блоков
 * - Автоматически обновлять фильтры при изменении значений
 * - Управлять состоянием поиска
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAppSelector } from '@/app/hooks'
import { selectBlocks } from '@/features/blocks/blocksSlice'
import type { FilterCondition, DynamicFilter } from '@/shared/types/transforms'
import type { Block } from '@/shared/types'

// ============ Типы ============

export interface FilterBlockState {
  blockId: string
  value: string | number | boolean | string[] | null
  isEmpty: boolean
  lastUpdated: number
}

export interface UseFilterBlocksOptions {
  /** Блоки для отслеживания (если не указано - все блоки с inputs) */
  blockIds?: string[]
  /** Debounce для изменений в ms */
  debounceMs?: number
}

export interface UseFilterBlocksResult {
  /** Текущие значения блоков */
  blockValues: Record<string, FilterBlockState>
  
  /** Получить значение конкретного блока */
  getBlockValue: (blockId: string) => FilterBlockState | null
  
  /** Преобразовать DynamicFilters в FilterConditions с текущими значениями */
  buildFilters: (dynamicFilters: DynamicFilter[]) => FilterCondition[]
  
  /** Установить значение блока (для контролируемых компонентов) */
  setBlockValue: (blockId: string, value: FilterBlockState['value']) => void
  
  /** Сбросить все значения */
  resetAll: () => void
}

// ============ Утилиты ============

/**
 * Получить значение из блока
 */
function extractValueFromBlock(block: Block): FilterBlockState['value'] {
  // Проверяем structure блока
  const structure = block.structure
  
  if (!structure) return null
  
  // Для input элементов
  if (structure.tagName === 'INPUT') {
    const inputType = structure.attributes?.type || 'text'
    
    if (inputType === 'checkbox') {
      return structure.attributes?.checked ?? false
    }
    
    return structure.attributes?.value ?? ''
  }
  
  // Для select элементов
  if (structure.tagName === 'SELECT') {
    // Пытаемся получить значение из attributes
    return structure.attributes?.value ?? ''
  }
  
  // Для textarea
  if (structure.tagName === 'TEXTAREA') {
    return structure.content ?? ''
  }
  
  // Fallback - проверяем data-value атрибут
  if (structure.attributes?.['data-value'] !== undefined) {
    return structure.attributes['data-value']
  }
  
  return null
}

/**
 * Проверить, является ли блок фильтром (input/select/checkbox)
 */
function isFilterBlock(block: Block): boolean {
  if (!block.structure) return false
  
  const tagName = block.structure.tagName?.toUpperCase()
  
  // Стандартные form элементы
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tagName || '')) {
    return true
  }
  
  // Блоки с data-filter атрибутом
  if (block.structure.attributes?.['data-filter'] === 'true') {
    return true
  }
  
  return false
}

// ============ Хук ============

export function useFilterBlocks(options?: UseFilterBlocksOptions): UseFilterBlocksResult {
  const blocks = useAppSelector(selectBlocks)
  const [blockValues, setBlockValues] = useState<Record<string, FilterBlockState>>({})
  
  // Фильтруем блоки-фильтры
  const filterBlocks = useMemo(() => {
    const filteredBlocks = blocks.filter(b => {
      // Если указаны конкретные blockIds - используем только их
      if (options?.blockIds && options.blockIds.length > 0) {
        return options.blockIds.includes(b.id)
      }
      // Иначе - все блоки с inputs
      return isFilterBlock(b)
    })
    
    return filteredBlocks
  }, [blocks, options?.blockIds])
  
  // Инициализация значений из блоков
  useEffect(() => {
    const initialValues: Record<string, FilterBlockState> = {}
    
    for (const block of filterBlocks) {
      const value = extractValueFromBlock(block)
      initialValues[block.id] = {
        blockId: block.id,
        value,
        isEmpty: value === null || value === '' || (Array.isArray(value) && value.length === 0),
        lastUpdated: Date.now()
      }
    }
    
    setBlockValues(initialValues)
  }, [filterBlocks])
  
  // Получить значение блока
  const getBlockValue = useCallback((blockId: string): FilterBlockState | null => {
    return blockValues[blockId] || null
  }, [blockValues])
  
  // Установить значение блока
  const setBlockValue = useCallback((blockId: string, value: FilterBlockState['value']) => {
    setBlockValues(prev => ({
      ...prev,
      [blockId]: {
        blockId,
        value,
        isEmpty: value === null || value === '' || (Array.isArray(value) && value.length === 0),
        lastUpdated: Date.now()
      }
    }))
  }, [])
  
  // Преобразовать DynamicFilters в FilterConditions
  const buildFilters = useCallback((dynamicFilters: DynamicFilter[]): FilterCondition[] => {
    const conditions: FilterCondition[] = []
    
    for (const df of dynamicFilters) {
      const state = blockValues[df.sourceBlockId]
      
      // Пропускаем если блок не найден
      if (!state) continue
      
      // Пропускаем пустые значения (если настроено)
      if (df.skipIfEmpty && state.isEmpty) continue
      
      conditions.push({
        field: df.field,
        operator: df.operator,
        value: state.value,
        valueSource: 'block',
        blockId: df.sourceBlockId
      })
    }
    
    return conditions
  }, [blockValues])
  
  // Сбросить все значения
  const resetAll = useCallback(() => {
    const resetValues: Record<string, FilterBlockState> = {}
    
    for (const blockId of Object.keys(blockValues)) {
      resetValues[blockId] = {
        blockId,
        value: null,
        isEmpty: true,
        lastUpdated: Date.now()
      }
    }
    
    setBlockValues(resetValues)
  }, [blockValues])
  
  return {
    blockValues,
    getBlockValue,
    buildFilters,
    setBlockValue,
    resetAll
  }
}

/**
 * Хук для одного блока-фильтра
 */
export function useFilterBlockValue(blockId: string): {
  value: FilterBlockState['value']
  setValue: (value: FilterBlockState['value']) => void
  isEmpty: boolean
} {
  const { blockValues, setBlockValue } = useFilterBlocks({ blockIds: [blockId] })
  
  const state = blockValues[blockId]
  
  return {
    value: state?.value ?? null,
    setValue: (value) => setBlockValue(blockId, value),
    isEmpty: state?.isEmpty ?? true
  }
}

/**
 * Хук для поискового блока
 */
export function useSearchBlock(
  blockId: string,
  searchFields: string[] = ['title', 'name', 'description']
): {
  query: string
  setQuery: (query: string) => void
  isEmpty: boolean
  searchConfig: { query: string; fields: string[] } | undefined
} {
  const { value, setValue, isEmpty } = useFilterBlockValue(blockId)
  const query = typeof value === 'string' ? value : ''
  
  return {
    query,
    setQuery: setValue,
    isEmpty,
    searchConfig: isEmpty ? undefined : { query, fields: searchFields }
  }
}

export default useFilterBlocks
