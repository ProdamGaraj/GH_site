import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '@/app/store'
import { dataSourceApi } from '@/shared/api'
import type { 
  DataSource, 
  DataSourcesFilter, 
  CreateDataSourceRequest,
  UpdateDataSourceRequest,
  DataSourcesState,
} from '@/shared/types/dataSource'

/**
 * Data Sources Redux Slice
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 1.2 Frontend: Redux slice dataSourcesSlice
 * 
 * State: sources, loading, errors
 * Actions: fetch, create, update, delete
 * Async thunks для API calls
 */

const initialState: DataSourcesState = {
  items: [],
  groups: [],
  selectedId: null,
  loading: false,
  saving: false,
  testing: false,
  error: null,
  total: 0,
  page: 1,
  limit: 20,
  filters: {},
  testResult: null
}

// ============================================
// ASYNC THUNKS
// ============================================

/**
 * Получить список источников данных
 */
export const fetchDataSources = createAsyncThunk(
  'dataSources/fetchAll',
  async (filters: DataSourcesFilter | undefined, { rejectWithValue }) => {
    try {
      return await dataSourceApi.getAll(filters)
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch data sources')
    }
  }
)

/**
 * Получить один источник данных по ID
 */
export const fetchDataSourceById = createAsyncThunk(
  'dataSources/fetchById',
  async (id: string, { rejectWithValue }) => {
    try {
      return await dataSourceApi.getById(id)
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch data source')
    }
  }
)

/**
 * Создать новый источник данных
 */
export const createDataSource = createAsyncThunk(
  'dataSources/create',
  async (data: CreateDataSourceRequest, { rejectWithValue }) => {
    try {
      return await dataSourceApi.create(data)
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create data source')
    }
  }
)

/**
 * Обновить источник данных
 */
export const updateDataSource = createAsyncThunk(
  'dataSources/update',
  async ({ id, data }: { id: string; data: UpdateDataSourceRequest }, { rejectWithValue }) => {
    try {
      return await dataSourceApi.update(id, data)
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update data source')
    }
  }
)

/**
 * Удалить источник данных
 */
export const deleteDataSource = createAsyncThunk(
  'dataSources/delete',
  async (id: string, { rejectWithValue }) => {
    try {
      await dataSourceApi.delete(id)
      return id
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to delete data source')
    }
  }
)

/**
 * Тестировать подключение к существующему источнику
 */
export const testDataSourceConnection = createAsyncThunk(
  'dataSources/testConnection',
  async (id: string, { rejectWithValue }) => {
    try {
      return await dataSourceApi.testConnection(id)
    } catch (error: any) {
      return rejectWithValue(error.message || 'Connection test failed')
    }
  }
)

/**
 * Тестировать новую конфигурацию (без сохранения)
 */
export const testNewDataSourceConnection = createAsyncThunk(
  'dataSources/testNewConnection',
  async (data: { type: string; config: unknown; authConfig?: unknown }, { rejectWithValue }) => {
    try {
      return await dataSourceApi.testNewConnection(data)
    } catch (error: any) {
      return rejectWithValue(error.message || 'Connection test failed')
    }
  }
)

/**
 * Дублировать источник данных
 */
export const duplicateDataSource = createAsyncThunk(
  'dataSources/duplicate',
  async ({ id, newName }: { id: string; newName?: string }, { rejectWithValue }) => {
    try {
      return await dataSourceApi.duplicate(id, newName)
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to duplicate data source')
    }
  }
)

// ============================================
// SLICE
// ============================================

const dataSourcesSlice = createSlice({
  name: 'dataSources',
  initialState,
  reducers: {
    /**
     * Выбрать источник данных
     */
    selectDataSource: (state, action: PayloadAction<string | null>) => {
      state.selectedId = action.payload
    },

    /**
     * Установить фильтры
     */
    setFilters: (state, action: PayloadAction<DataSourcesFilter>) => {
      state.filters = action.payload
    },

    /**
     * Сбросить фильтры
     */
    clearFilters: (state) => {
      state.filters = {}
      state.page = 1
    },

    /**
     * Установить страницу пагинации
     */
    setPage: (state, action: PayloadAction<number>) => {
      state.page = action.payload
    },

    /**
     * Установить лимит на страницу
     */
    setLimit: (state, action: PayloadAction<number>) => {
      state.limit = action.payload
      state.page = 1 // Сбрасываем на первую страницу при изменении лимита
    },

    /**
     * Очистить ошибку
     */
    clearError: (state) => {
      state.error = null
    },

    /**
     * Очистить результат теста
     */
    clearTestResult: (state) => {
      state.testResult = null
    },

    /**
     * Сбросить состояние
     */
    resetState: () => initialState
  },
  extraReducers: (builder) => {
    builder
      // ============================================
      // FETCH ALL
      // ============================================
      .addCase(fetchDataSources.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchDataSources.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload.items
        state.total = action.payload.total
        state.page = action.payload.page
        state.limit = action.payload.limit
      })
      .addCase(fetchDataSources.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })

      // ============================================
      // FETCH BY ID
      // ============================================
      .addCase(fetchDataSourceById.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchDataSourceById.fulfilled, (state, action) => {
        state.loading = false
        // Обновляем элемент в списке если есть
        const index = state.items.findIndex(item => item.id === action.payload.id)
        if (index !== -1) {
          state.items[index] = action.payload
        } else {
          state.items.push(action.payload)
        }
        state.selectedId = action.payload.id
      })
      .addCase(fetchDataSourceById.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })

      // ============================================
      // CREATE
      // ============================================
      .addCase(createDataSource.pending, (state) => {
        state.saving = true
        state.error = null
      })
      .addCase(createDataSource.fulfilled, (state, action) => {
        state.saving = false
        state.items.unshift(action.payload) // Добавляем в начало списка
        state.total += 1
        state.selectedId = action.payload.id
      })
      .addCase(createDataSource.rejected, (state, action) => {
        state.saving = false
        state.error = action.payload as string
      })

      // ============================================
      // UPDATE
      // ============================================
      .addCase(updateDataSource.pending, (state) => {
        state.saving = true
        state.error = null
      })
      .addCase(updateDataSource.fulfilled, (state, action) => {
        state.saving = false
        const index = state.items.findIndex(item => item.id === action.payload.id)
        if (index !== -1) {
          state.items[index] = action.payload
        }
      })
      .addCase(updateDataSource.rejected, (state, action) => {
        state.saving = false
        state.error = action.payload as string
      })

      // ============================================
      // DELETE
      // ============================================
      .addCase(deleteDataSource.pending, (state) => {
        state.saving = true
        state.error = null
      })
      .addCase(deleteDataSource.fulfilled, (state, action) => {
        state.saving = false
        state.items = state.items.filter(item => item.id !== action.payload)
        state.total -= 1
        if (state.selectedId === action.payload) {
          state.selectedId = null
        }
      })
      .addCase(deleteDataSource.rejected, (state, action) => {
        state.saving = false
        state.error = action.payload as string
      })

      // ============================================
      // TEST CONNECTION (existing)
      // ============================================
      .addCase(testDataSourceConnection.pending, (state) => {
        state.testing = true
        state.testResult = null
        state.error = null
      })
      .addCase(testDataSourceConnection.fulfilled, (state, action) => {
        state.testing = false
        state.testResult = action.payload
        // Обновляем lastFetchStatus в элементе списка
        if (state.selectedId) {
          const index = state.items.findIndex(item => item.id === state.selectedId)
          if (index !== -1) {
            state.items[index] = {
              ...state.items[index],
              lastFetchAt: new Date().toISOString(),
              lastFetchStatus: action.payload.success ? 'success' : 'error',
              lastFetchError: action.payload.success ? undefined : action.payload.error?.message
            }
          }
        }
      })
      .addCase(testDataSourceConnection.rejected, (state, action) => {
        state.testing = false
        state.testResult = {
          success: false,
          message: action.payload as string,
          error: {
            code: 'TEST_ERROR',
            message: action.payload as string
          }
        }
      })

      // ============================================
      // TEST NEW CONNECTION
      // ============================================
      .addCase(testNewDataSourceConnection.pending, (state) => {
        state.testing = true
        state.testResult = null
        state.error = null
      })
      .addCase(testNewDataSourceConnection.fulfilled, (state, action) => {
        state.testing = false
        state.testResult = action.payload
      })
      .addCase(testNewDataSourceConnection.rejected, (state, action) => {
        state.testing = false
        state.testResult = {
          success: false,
          message: action.payload as string,
          error: {
            code: 'TEST_ERROR',
            message: action.payload as string
          }
        }
      })

      // ============================================
      // DUPLICATE
      // ============================================
      .addCase(duplicateDataSource.pending, (state) => {
        state.saving = true
        state.error = null
      })
      .addCase(duplicateDataSource.fulfilled, (state, action) => {
        state.saving = false
        state.items.unshift(action.payload)
        state.total += 1
        state.selectedId = action.payload.id
      })
      .addCase(duplicateDataSource.rejected, (state, action) => {
        state.saving = false
        state.error = action.payload as string
      })
  }
})

// ============================================
// ACTIONS
// ============================================

export const {
  selectDataSource,
  setFilters,
  clearFilters,
  setPage,
  setLimit,
  clearError,
  clearTestResult,
  resetState
} = dataSourcesSlice.actions

// ============================================
// SELECTORS
// ============================================

export const selectDataSources = (state: RootState) => state.dataSources.items
export const selectDataSourcesLoading = (state: RootState) => state.dataSources.loading
export const selectDataSourcesSaving = (state: RootState) => state.dataSources.saving
export const selectDataSourcesTesting = (state: RootState) => state.dataSources.testing
export const selectDataSourcesError = (state: RootState) => state.dataSources.error
export const selectSelectedDataSourceId = (state: RootState) => state.dataSources.selectedId
export const selectDataSourcesTotal = (state: RootState) => state.dataSources.total
export const selectDataSourcesPage = (state: RootState) => state.dataSources.page
export const selectDataSourcesLimit = (state: RootState) => state.dataSources.limit
export const selectDataSourcesFilters = (state: RootState) => state.dataSources.filters
export const selectTestResult = (state: RootState) => state.dataSources.testResult

/**
 * Получить выбранный источник данных
 */
export const selectSelectedDataSource = (state: RootState): DataSource | null => {
  const { items, selectedId } = state.dataSources
  if (!selectedId) return null
  return items.find(item => item.id === selectedId) || null
}

/**
 * Получить источник данных по ID
 */
export const selectDataSourceById = (id: string) => (state: RootState): DataSource | undefined => {
  return state.dataSources.items.find(item => item.id === id)
}

/**
 * Получить количество страниц
 */
export const selectTotalPages = (state: RootState): number => {
  const { total, limit } = state.dataSources
  return Math.ceil(total / limit)
}

/**
 * Проверить, есть ли ещё страницы
 */
export const selectHasMorePages = (state: RootState): boolean => {
  const { page } = state.dataSources
  const totalPages = selectTotalPages(state)
  return page < totalPages
}

export default dataSourcesSlice.reducer
