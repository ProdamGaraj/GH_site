/**
 * Computed Values Slice
 * 
 * Redux slice для хранения вычисленных значений от data bindings.
 * Позволяет зависимым блокам (счётчики, агрегаты) подписываться на
 * результаты других блоков.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '@/app/store'

// ============ Типы ============

export interface ComputedValues {
  count: number
  sum: Record<string, number>
  avg: Record<string, number>
  min: Record<string, number>
  max: Record<string, number>
}

export interface BlockComputedState {
  blockId: string
  bindingId: string
  values: ComputedValues
  totalCount: number
  filteredCount: number
  returnedCount: number
  lastUpdated: number
}

interface ComputedValuesState {
  /** Computed values по blockId */
  byBlockId: Record<string, BlockComputedState>
  
  /** Computed values по bindingId */
  byBindingId: Record<string, BlockComputedState>
  
  /** Подписки: какие блоки зависят от каких */
  subscriptions: Record<string, string[]> // sourceBlockId -> dependentBlockIds[]
}

const initialState: ComputedValuesState = {
  byBlockId: {},
  byBindingId: {},
  subscriptions: {}
}

// ============ Slice ============

const computedValuesSlice = createSlice({
  name: 'computedValues',
  initialState,
  reducers: {
    /** Обновить computed values для блока */
    setComputedValues: (state, action: PayloadAction<{
      blockId: string
      bindingId: string
      values: ComputedValues
      totalCount: number
      filteredCount: number
      returnedCount: number
    }>) => {
      const { blockId, bindingId, values, totalCount, filteredCount, returnedCount } = action.payload
      
      const computedState: BlockComputedState = {
        blockId,
        bindingId,
        values,
        totalCount,
        filteredCount,
        returnedCount,
        lastUpdated: Date.now()
      }
      
      state.byBlockId[blockId] = computedState
      state.byBindingId[bindingId] = computedState
    },
    
    /** Добавить подписку */
    subscribe: (state, action: PayloadAction<{
      sourceBlockId: string
      dependentBlockId: string
    }>) => {
      const { sourceBlockId, dependentBlockId } = action.payload
      
      if (!state.subscriptions[sourceBlockId]) {
        state.subscriptions[sourceBlockId] = []
      }
      
      if (!state.subscriptions[sourceBlockId].includes(dependentBlockId)) {
        state.subscriptions[sourceBlockId].push(dependentBlockId)
      }
    },
    
    /** Удалить подписку */
    unsubscribe: (state, action: PayloadAction<{
      sourceBlockId: string
      dependentBlockId: string
    }>) => {
      const { sourceBlockId, dependentBlockId } = action.payload
      
      if (state.subscriptions[sourceBlockId]) {
        state.subscriptions[sourceBlockId] = state.subscriptions[sourceBlockId]
          .filter(id => id !== dependentBlockId)
      }
    },
    
    /** Очистить computed values для блока */
    clearBlockComputed: (state, action: PayloadAction<string>) => {
      const blockId = action.payload
      const computed = state.byBlockId[blockId]
      
      if (computed) {
        delete state.byBindingId[computed.bindingId]
        delete state.byBlockId[blockId]
      }
    },
    
    /** Очистить все */
    clearAll: (state) => {
      state.byBlockId = {}
      state.byBindingId = {}
      state.subscriptions = {}
    }
  }
})

export const {
  setComputedValues,
  subscribe,
  unsubscribe,
  clearBlockComputed,
  clearAll
} = computedValuesSlice.actions

// ============ Selectors ============

export const selectComputedByBlockId = (blockId: string) => 
  (state: RootState) => state.computedValues?.byBlockId[blockId] || null

export const selectComputedByBindingId = (bindingId: string) => 
  (state: RootState) => state.computedValues?.byBindingId[bindingId] || null

export const selectSubscribers = (sourceBlockId: string) =>
  (state: RootState) => state.computedValues?.subscriptions[sourceBlockId] || []

export const selectCount = (blockId: string) =>
  (state: RootState) => state.computedValues?.byBlockId[blockId]?.values.count ?? null

export const selectFilteredCount = (blockId: string) =>
  (state: RootState) => state.computedValues?.byBlockId[blockId]?.filteredCount ?? null

export const selectSum = (blockId: string, field: string) =>
  (state: RootState) => state.computedValues?.byBlockId[blockId]?.values.sum[field] ?? null

export const selectAvg = (blockId: string, field: string) =>
  (state: RootState) => state.computedValues?.byBlockId[blockId]?.values.avg[field] ?? null

export default computedValuesSlice.reducer
