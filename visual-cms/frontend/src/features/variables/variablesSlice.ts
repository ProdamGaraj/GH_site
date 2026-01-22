/**
 * Variables Slice
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 6: Reactive Variables
 * 
 * Redux slice для управления переменными страниц.
 */

import { createSlice, createAsyncThunk, createSelector, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '@/app/store'
import { api } from '@/shared/api'

// ==================== API RESPONSE TYPES ====================

interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

// ==================== TYPES ====================

export type VariableScope = 'page' | 'session' | 'global'
export type VariableType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'any'

export interface VariableConfig {
  scope: VariableScope
  type: VariableType
  defaultValue?: unknown
  description?: string
  persistence?: {
    enabled: boolean
    storage: 'localStorage' | 'sessionStorage' | 'cookie'
    key?: string
    expiry?: number
  }
  validation?: {
    required?: boolean
    min?: number
    max?: number
    minLength?: number
    maxLength?: number
    pattern?: string
    enum?: unknown[]
  }
  computed?: {
    expression: string
    dependencies: string[]
  }
  readOnly?: boolean
  debounceMs?: number
}

export interface PageVariable {
  id: string
  pageId: string | null
  name: string
  scope: VariableScope
  type: VariableType
  defaultValue: unknown
  description: string | null
  config: Partial<VariableConfig> | null
  isActive: boolean
  order: number
  createdAt: string
  updatedAt: string
}

export interface VariableValue {
  variableId: string
  name: string
  value: unknown
  lastUpdated: number
  source?: string  // Откуда пришло значение
}

interface VariablesState {
  // Definitions (from backend)
  definitions: Record<string, PageVariable>
  definitionsByPage: Record<string, string[]>  // pageId -> variableIds
  globalDefinitions: string[]  // variableIds for global scope
  
  // Runtime values
  values: Record<string, VariableValue>  // variableId -> value
  
  // UI state
  loading: boolean
  saving: boolean
  error: string | null
  
  // Subscribers (for reactivity)
  subscribers: Record<string, string[]>  // variableId -> blockIds that depend on it
  
  // Change tracking
  pendingChanges: Record<string, unknown>
  lastSync: number | null
}

const initialState: VariablesState = {
  definitions: {},
  definitionsByPage: {},
  globalDefinitions: [],
  values: {},
  loading: false,
  saving: false,
  error: null,
  subscribers: {},
  pendingChanges: {},
  lastSync: null,
}

// ==================== ASYNC THUNKS ====================

/**
 * Загрузить переменные страницы
 */
export const fetchPageVariables = createAsyncThunk(
  'variables/fetchPageVariables',
  async (pageId: string, { rejectWithValue }) => {
    try {
      const response = await api.get<ApiResponse<PageVariable[]>>(`/variables/page/${pageId}`)
      return {
        pageId,
        variables: response.data,
      }
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to fetch variables'
      )
    }
  }
)

/**
 * Загрузить глобальные переменные
 */
export const fetchGlobalVariables = createAsyncThunk(
  'variables/fetchGlobalVariables',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get<ApiResponse<PageVariable[]>>('/variables', { params: { scope: 'global' } })
      return response.data
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to fetch global variables'
      )
    }
  }
)

/**
 * Создать переменную
 */
export const createVariable = createAsyncThunk(
  'variables/createVariable',
  async (data: {
    pageId?: string
    name: string
    scope?: VariableScope
    type?: VariableType
    defaultValue?: unknown
    description?: string
    config?: Partial<VariableConfig>
  }, { rejectWithValue }) => {
    try {
      const response = await api.post<ApiResponse<PageVariable>>('/variables', data)
      return response.data
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to create variable'
      )
    }
  }
)

/**
 * Обновить переменную
 */
export const updateVariable = createAsyncThunk(
  'variables/updateVariable',
  async ({ id, data }: {
    id: string
    data: Partial<Pick<PageVariable, 'name' | 'type' | 'defaultValue' | 'description' | 'config' | 'isActive' | 'order'>>
  }, { rejectWithValue }) => {
    try {
      const response = await api.put<ApiResponse<PageVariable>>(`/variables/${id}`, data)
      return response.data
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to update variable'
      )
    }
  }
)

/**
 * Удалить переменную
 */
export const deleteVariable = createAsyncThunk(
  'variables/deleteVariable',
  async (id: string, { rejectWithValue }) => {
    try {
      await api.delete(`/variables/${id}`)
      return id
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to delete variable'
      )
    }
  }
)

// ==================== SLICE ====================

const variablesSlice = createSlice({
  name: 'variables',
  initialState,
  reducers: {
    /**
     * Установить значение переменной
     */
    setVariableValue: (state, action: PayloadAction<{
      variableId: string
      value: unknown
      source?: string
    }>) => {
      const { variableId, value, source } = action.payload
      const definition = state.definitions[variableId]
      
      if (!definition) {
        console.warn(`Variable ${variableId} not found`)
        return
      }

      state.values[variableId] = {
        variableId,
        name: definition.name,
        value,
        lastUpdated: Date.now(),
        source,
      }

      // Handle persistence
      const persistence = definition.config?.persistence
      if (persistence?.enabled) {
        const key = persistence.key || `var_${definition.name}`
        const serialized = JSON.stringify(value)
        
        switch (persistence.storage) {
          case 'localStorage':
            localStorage.setItem(key, serialized)
            break
          case 'sessionStorage':
            sessionStorage.setItem(key, serialized)
            break
          case 'cookie':
            const expiry = persistence.expiry 
              ? new Date(Date.now() + persistence.expiry * 1000).toUTCString()
              : ''
            document.cookie = `${key}=${encodeURIComponent(serialized)}${expiry ? `; expires=${expiry}` : ''}`
            break
        }
      }
    },

    /**
     * Установить значение по имени переменной
     */
    setVariableByName: (state, action: PayloadAction<{
      name: string
      pageId?: string
      value: unknown
      source?: string
    }>) => {
      const { name, pageId, value, source } = action.payload
      
      // Найти переменную по имени
      let variable: PageVariable | undefined
      
      if (pageId) {
        const pageVarIds = state.definitionsByPage[pageId] || []
        variable = pageVarIds
          .map(id => state.definitions[id])
          .find(v => v?.name === name)
      }
      
      // Fallback to global
      if (!variable) {
        variable = state.globalDefinitions
          .map(id => state.definitions[id])
          .find(v => v?.name === name)
      }

      if (variable) {
        state.values[variable.id] = {
          variableId: variable.id,
          name: variable.name,
          value,
          lastUpdated: Date.now(),
          source,
        }
      }
    },

    /**
     * Сбросить значение к default
     */
    resetVariableValue: (state, action: PayloadAction<string>) => {
      const variableId = action.payload
      const definition = state.definitions[variableId]
      
      if (definition) {
        state.values[variableId] = {
          variableId,
          name: definition.name,
          value: definition.defaultValue,
          lastUpdated: Date.now(),
          source: 'reset',
        }
      }
    },

    /**
     * Сбросить все значения страницы
     */
    resetPageVariables: (state, action: PayloadAction<string>) => {
      const pageId = action.payload
      const pageVarIds = state.definitionsByPage[pageId] || []
      
      for (const varId of pageVarIds) {
        const definition = state.definitions[varId]
        if (definition) {
          state.values[varId] = {
            variableId: varId,
            name: definition.name,
            value: definition.defaultValue,
            lastUpdated: Date.now(),
            source: 'reset',
          }
        }
      }
    },

    /**
     * Подписать блок на переменную
     */
    subscribeBlock: (state, action: PayloadAction<{
      variableId: string
      blockId: string
    }>) => {
      const { variableId, blockId } = action.payload
      if (!state.subscribers[variableId]) {
        state.subscribers[variableId] = []
      }
      if (!state.subscribers[variableId].includes(blockId)) {
        state.subscribers[variableId].push(blockId)
      }
    },

    /**
     * Отписать блок от переменной
     */
    unsubscribeBlock: (state, action: PayloadAction<{
      variableId: string
      blockId: string
    }>) => {
      const { variableId, blockId } = action.payload
      if (state.subscribers[variableId]) {
        state.subscribers[variableId] = state.subscribers[variableId]
          .filter(id => id !== blockId)
      }
    },

    /**
     * Очистить всех подписчиков блока
     */
    unsubscribeAllForBlock: (state, action: PayloadAction<string>) => {
      const blockId = action.payload
      for (const varId of Object.keys(state.subscribers)) {
        state.subscribers[varId] = state.subscribers[varId]
          .filter(id => id !== blockId)
      }
    },

    /**
     * Инициализировать значения из persistence
     */
    initializeFromPersistence: (state) => {
      for (const [varId, definition] of Object.entries(state.definitions)) {
        const persistence = definition.config?.persistence
        if (!persistence?.enabled) continue

        const key = persistence.key || `var_${definition.name}`
        let storedValue: string | null = null

        switch (persistence.storage) {
          case 'localStorage':
            storedValue = localStorage.getItem(key)
            break
          case 'sessionStorage':
            storedValue = sessionStorage.getItem(key)
            break
          case 'cookie':
            const match = document.cookie.match(new RegExp(`${key}=([^;]+)`))
            storedValue = match ? decodeURIComponent(match[1]) : null
            break
        }

        if (storedValue !== null) {
          try {
            const value = JSON.parse(storedValue)
            state.values[varId] = {
              variableId: varId,
              name: definition.name,
              value,
              lastUpdated: Date.now(),
              source: 'persistence',
            }
          } catch {
            // Invalid JSON, skip
          }
        }
      }
    },

    /**
     * Очистить ошибку
     */
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchPageVariables
      .addCase(fetchPageVariables.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchPageVariables.fulfilled, (state, action) => {
        state.loading = false
        const { pageId, variables } = action.payload
        
        const pageVarIds: string[] = []
        
        for (const variable of variables) {
          state.definitions[variable.id] = variable
          
          if (variable.scope === 'global') {
            if (!state.globalDefinitions.includes(variable.id)) {
              state.globalDefinitions.push(variable.id)
            }
          } else {
            pageVarIds.push(variable.id)
          }
          
          // Initialize value if not set
          if (!state.values[variable.id]) {
            state.values[variable.id] = {
              variableId: variable.id,
              name: variable.name,
              value: variable.defaultValue,
              lastUpdated: Date.now(),
              source: 'init',
            }
          }
        }
        
        state.definitionsByPage[pageId] = pageVarIds
        state.lastSync = Date.now()
      })
      .addCase(fetchPageVariables.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      
      // fetchGlobalVariables
      .addCase(fetchGlobalVariables.fulfilled, (state, action) => {
        const variables = action.payload
        
        for (const variable of variables) {
          state.definitions[variable.id] = variable
          
          if (!state.globalDefinitions.includes(variable.id)) {
            state.globalDefinitions.push(variable.id)
          }
          
          if (!state.values[variable.id]) {
            state.values[variable.id] = {
              variableId: variable.id,
              name: variable.name,
              value: variable.defaultValue,
              lastUpdated: Date.now(),
              source: 'init',
            }
          }
        }
      })
      
      // createVariable
      .addCase(createVariable.pending, (state) => {
        state.saving = true
      })
      .addCase(createVariable.fulfilled, (state, action) => {
        state.saving = false
        const variable = action.payload
        
        state.definitions[variable.id] = variable
        
        if (variable.scope === 'global') {
          state.globalDefinitions.push(variable.id)
        } else if (variable.pageId) {
          if (!state.definitionsByPage[variable.pageId]) {
            state.definitionsByPage[variable.pageId] = []
          }
          state.definitionsByPage[variable.pageId].push(variable.id)
        }
        
        state.values[variable.id] = {
          variableId: variable.id,
          name: variable.name,
          value: variable.defaultValue,
          lastUpdated: Date.now(),
          source: 'create',
        }
      })
      .addCase(createVariable.rejected, (state, action) => {
        state.saving = false
        state.error = action.payload as string
      })
      
      // updateVariable
      .addCase(updateVariable.fulfilled, (state, action) => {
        const variable = action.payload
        state.definitions[variable.id] = variable
      })
      
      // deleteVariable
      .addCase(deleteVariable.fulfilled, (state, action) => {
        const id = action.payload
        const variable = state.definitions[id]
        
        if (variable) {
          delete state.definitions[id]
          delete state.values[id]
          delete state.subscribers[id]
          
          if (variable.scope === 'global') {
            state.globalDefinitions = state.globalDefinitions.filter(vId => vId !== id)
          } else if (variable.pageId) {
            state.definitionsByPage[variable.pageId] = 
              (state.definitionsByPage[variable.pageId] || []).filter(vId => vId !== id)
          }
        }
      })
  },
})

// ==================== ACTIONS ====================

export const {
  setVariableValue,
  setVariableByName,
  resetVariableValue,
  resetPageVariables,
  subscribeBlock,
  unsubscribeBlock,
  unsubscribeAllForBlock,
  initializeFromPersistence,
  clearError,
} = variablesSlice.actions

// ==================== SELECTORS ====================

const selectVariablesState = (state: RootState) => state.variables

export const selectVariablesLoading = createSelector(
  selectVariablesState,
  (state) => state.loading
)

export const selectVariablesSaving = createSelector(
  selectVariablesState,
  (state) => state.saving
)

export const selectVariablesError = createSelector(
  selectVariablesState,
  (state) => state.error
)

export const selectAllDefinitions = createSelector(
  selectVariablesState,
  (state) => state.definitions
)

export const selectPageVariables = (pageId: string) => createSelector(
  selectVariablesState,
  (state) => {
    const ids = state.definitionsByPage[pageId] || []
    return ids.map(id => state.definitions[id]).filter(Boolean)
  }
)

export const selectGlobalVariables = createSelector(
  selectVariablesState,
  (state) => state.globalDefinitions.map(id => state.definitions[id]).filter(Boolean)
)

export const selectVariableValue = (variableId: string) => createSelector(
  selectVariablesState,
  (state) => state.values[variableId]?.value
)

export const selectVariableByName = (name: string, pageId?: string) => createSelector(
  selectVariablesState,
  (state) => {
    // Check page variables first
    if (pageId) {
      const pageVarIds = state.definitionsByPage[pageId] || []
      const pageVar = pageVarIds
        .map(id => state.definitions[id])
        .find(v => v?.name === name)
      if (pageVar) {
        return {
          definition: pageVar,
          value: state.values[pageVar.id]?.value,
        }
      }
    }
    
    // Fallback to global
    const globalVar = state.globalDefinitions
      .map(id => state.definitions[id])
      .find(v => v?.name === name)
    
    if (globalVar) {
      return {
        definition: globalVar,
        value: state.values[globalVar.id]?.value,
      }
    }
    
    return null
  }
)

export const selectVariableSubscribers = (variableId: string) => createSelector(
  selectVariablesState,
  (state) => state.subscribers[variableId] || []
)

export const selectAllValues = createSelector(
  selectVariablesState,
  (state) => state.values
)

export default variablesSlice.reducer
