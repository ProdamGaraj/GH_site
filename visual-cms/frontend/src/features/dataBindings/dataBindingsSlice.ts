import { createSlice, createAsyncThunk, PayloadAction, createSelector } from '@reduxjs/toolkit'
import type { RootState } from '@/app/store'
import { dataBindingApi } from '@/shared/api'
import type {
  DataBinding,
  CreateDataBindingRequest,
  UpdateDataBindingRequest,
  FetchDataResult,
  DirectFetchRequest,
  FetchWithBindingRequest
} from '@/shared/types/dataBinding'

interface DataBindingsState {
  // Все привязки
  items: DataBinding[]
  // Привязки текущего блока
  currentBlockBindings: DataBinding[]
  // Текущая редактируемая привязка
  currentBinding: DataBinding | null
  // Данные, полученные через привязку
  fetchedData: Record<string, FetchDataResult>
  // Состояние загрузки
  loading: boolean
  saving: boolean
  fetching: Record<string, boolean>
  // Ошибки
  error: string | null
  fetchErrors: Record<string, string>
  // Версия привязок (инкрементируется при обновлении для триггера перезагрузки данных)
  bindingsVersion: number
}

const initialState: DataBindingsState = {
  items: [],
  currentBlockBindings: [],
  currentBinding: null,
  fetchedData: {},
  loading: false,
  saving: false,
  fetching: {},
  error: null,
  fetchErrors: {},
  bindingsVersion: 0,
}

// ============ Async Thunks ============

/**
 * Получить все привязки
 */
export const fetchAllBindings = createAsyncThunk(
  'dataBindings/fetchAll',
  async () => {
    return await dataBindingApi.getAll()
  }
)

/**
 * Получить привязку по ID
 */
export const fetchBindingById = createAsyncThunk(
  'dataBindings/fetchById',
  async (id: string) => {
    return await dataBindingApi.getById(id)
  }
)

/**
 * Получить привязки для блока
 * Поддерживает поиск по основному blockId и linkedBlockId (для связанных блоков)
 */
export const fetchBindingsForBlock = createAsyncThunk(
  'dataBindings/fetchForBlock',
  async ({ blockId, linkedBlockId, pageId }: { blockId: string; linkedBlockId?: string; pageId?: string }) => {
    // Если есть linkedBlockId и он отличается от blockId - запрашиваем оба
    const effectiveBlockId = linkedBlockId && linkedBlockId !== blockId 
      ? `${blockId},${linkedBlockId}` 
      : blockId
    return await dataBindingApi.getByBlockId(effectiveBlockId, pageId)
  }
)

/**
 * Получить все привязки для страницы (включая привязки к библиотечным блокам без pageId)
 */
export const fetchBindingsForPage = createAsyncThunk(
  'dataBindings/fetchForPage',
  async (pageId: string) => {
    const all = await dataBindingApi.getAll()
    // Возвращаем привязки для этой страницы ИЛИ привязки без pageId (привязаны к блокам из библиотеки)
    const filtered = all.filter(b => b.pageId === pageId || !b.pageId)
    console.log('[fetchBindingsForPage] pageId:', pageId, 'all:', all.length, 'filtered:', filtered.length)
    return filtered
  }
)

/**
 * Создать привязку
 */
export const createBinding = createAsyncThunk(
  'dataBindings/create',
  async (data: CreateDataBindingRequest) => {
    return await dataBindingApi.create(data)
  }
)

/**
 * Обновить привязку
 */
export const updateBinding = createAsyncThunk(
  'dataBindings/update',
  async ({ id, data }: { id: string; data: UpdateDataBindingRequest }) => {
    return await dataBindingApi.update(id, data)
  }
)

/**
 * Удалить привязку
 */
export const deleteBinding = createAsyncThunk(
  'dataBindings/delete',
  async (id: string) => {
    await dataBindingApi.delete(id)
    return id
  }
)

/**
 * Получить данные напрямую
 */
export const fetchDataDirect = createAsyncThunk(
  'dataBindings/fetchDirect',
  async ({ key, request }: { key: string; request: DirectFetchRequest }) => {
    const result = await dataBindingApi.fetchDirect(request)
    return { key, result }
  }
)

/**
 * Получить данные через привязку
 */
export const fetchDataWithBinding = createAsyncThunk(
  'dataBindings/fetchWithBinding',
  async ({ key, request }: { key: string; request: FetchWithBindingRequest }) => {
    const result = await dataBindingApi.fetchWithBinding(request)
    return { key, result }
  }
)

// ============ Slice ============

const dataBindingsSlice = createSlice({
  name: 'dataBindings',
  initialState,
  reducers: {
    // Установить текущую привязку для редактирования
    setCurrentBinding: (state, action: PayloadAction<DataBinding | null>) => {
      state.currentBinding = action.payload
    },

    // Очистить привязки текущего блока
    clearCurrentBlockBindings: (state) => {
      state.currentBlockBindings = []
    },

    // Очистить полученные данные
    clearFetchedData: (state, action: PayloadAction<string | undefined>) => {
      if (action.payload) {
        delete state.fetchedData[action.payload]
        delete state.fetchErrors[action.payload]
      } else {
        state.fetchedData = {}
        state.fetchErrors = {}
      }
    },

    // Очистить ошибки
    clearError: (state) => {
      state.error = null
    },

    // Обновить конфигурацию текущей привязки (локально)
    updateCurrentBindingConfig: (state, action: PayloadAction<Partial<DataBinding['config']>>) => {
      if (state.currentBinding) {
        state.currentBinding.config = {
          ...state.currentBinding.config,
          ...action.payload,
        }
      }
    },
  },

  extraReducers: (builder) => {
    // ============ fetchAllBindings ============
    builder
      .addCase(fetchAllBindings.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchAllBindings.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload
        console.log('[dataBindingsSlice] fetchAllBindings fulfilled:', action.payload.length, 'bindings')
      })
      .addCase(fetchAllBindings.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch bindings'
      })

    // ============ fetchBindingById ============
    builder
      .addCase(fetchBindingById.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchBindingById.fulfilled, (state, action) => {
        state.loading = false
        state.currentBinding = action.payload
        // Обновляем в общем списке если есть
        const idx = state.items.findIndex(b => b.id === action.payload.id)
        if (idx !== -1) {
          state.items[idx] = action.payload
        }
      })
      .addCase(fetchBindingById.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch binding'
      })

    // ============ fetchBindingsForBlock ============
    builder
      .addCase(fetchBindingsForBlock.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchBindingsForBlock.fulfilled, (state, action) => {
        state.loading = false
        state.currentBlockBindings = action.payload
        
        // MERGE bindings instead of replacing - add new bindings, update existing ones
        const newBindings = action.payload
        const existingIds = new Set(state.items.map(b => b.id))
        
        // Update existing and add new
        for (const binding of newBindings) {
          const idx = state.items.findIndex(b => b.id === binding.id)
          if (idx !== -1) {
            state.items[idx] = binding
          } else {
            state.items.push(binding)
          }
        }
        
        console.log('[dataBindingsSlice] fetchBindingsForBlock fulfilled:', action.payload.length, 'bindings, total items:', state.items.length)
      })
      .addCase(fetchBindingsForBlock.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch block bindings'
      })

    // ============ fetchBindingsForPage ============
    builder
      .addCase(fetchBindingsForPage.pending, (state) => {
        state.loading = true
        state.error = null
        console.log('[dataBindingsSlice] fetchBindingsForPage pending...')
      })
      .addCase(fetchBindingsForPage.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload
        console.log('[dataBindingsSlice] fetchBindingsForPage fulfilled:', action.payload.length, 'bindings', action.payload)
      })
      .addCase(fetchBindingsForPage.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch page bindings'
      })

    // ============ createBinding ============
    builder
      .addCase(createBinding.pending, (state) => {
        state.saving = true
        state.error = null
      })
      .addCase(createBinding.fulfilled, (state, action) => {
        state.saving = false
        state.items.push(action.payload)
        state.currentBlockBindings.push(action.payload)
        state.currentBinding = action.payload
        // Инкрементируем версию для триггера перезагрузки данных
        state.bindingsVersion += 1
      })
      .addCase(createBinding.rejected, (state, action) => {
        state.saving = false
        state.error = action.error.message || 'Failed to create binding'
      })

    // ============ updateBinding ============
    builder
      .addCase(updateBinding.pending, (state) => {
        state.saving = true
        state.error = null
      })
      .addCase(updateBinding.fulfilled, (state, action) => {
        state.saving = false
        // Обновляем в списках
        const updateInList = (list: DataBinding[]) => {
          const idx = list.findIndex(b => b.id === action.payload.id)
          if (idx !== -1) {
            list[idx] = action.payload
          }
        }
        updateInList(state.items)
        updateInList(state.currentBlockBindings)
        state.currentBinding = action.payload
        // Инкрементируем версию для триггера перезагрузки данных
        state.bindingsVersion += 1
      })
      .addCase(updateBinding.rejected, (state, action) => {
        state.saving = false
        state.error = action.error.message || 'Failed to update binding'
      })

    // ============ deleteBinding ============
    builder
      .addCase(deleteBinding.pending, (state) => {
        state.saving = true
        state.error = null
      })
      .addCase(deleteBinding.fulfilled, (state, action) => {
        state.saving = false
        const id = action.payload
        state.items = state.items.filter(b => b.id !== id)
        state.currentBlockBindings = state.currentBlockBindings.filter(b => b.id !== id)
        if (state.currentBinding?.id === id) {
          state.currentBinding = null
        }
      })
      .addCase(deleteBinding.rejected, (state, action) => {
        state.saving = false
        state.error = action.error.message || 'Failed to delete binding'
      })

    // ============ fetchDataDirect ============
    builder
      .addCase(fetchDataDirect.pending, (state, action) => {
        const key = action.meta.arg.key
        state.fetching[key] = true
        delete state.fetchErrors[key]
      })
      .addCase(fetchDataDirect.fulfilled, (state, action) => {
        const { key, result } = action.payload
        state.fetching[key] = false
        // Извлекаем data из обёрнутого ответа {success, data, metadata}
        state.fetchedData[key] = { success: result.success, data: result.data, metadata: result.metadata }
      })
      .addCase(fetchDataDirect.rejected, (state, action) => {
        const key = action.meta.arg.key
        state.fetching[key] = false
        state.fetchErrors[key] = action.error.message || 'Failed to fetch data'
      })

    // ============ fetchDataWithBinding ============
    builder
      .addCase(fetchDataWithBinding.pending, (state, action) => {
        const key = action.meta.arg.key
        state.fetching[key] = true
        delete state.fetchErrors[key]
      })
      .addCase(fetchDataWithBinding.fulfilled, (state, action) => {
        const { key, result } = action.payload
        console.log('[dataBindingsSlice] fetchDataWithBinding.fulfilled:', {
          key,
          result,
          resultData: result.data,
          resultDataType: typeof result.data,
          resultDataIsArray: Array.isArray(result.data),
          resultDataStringified: JSON.stringify(result, null, 2)
        })
        state.fetching[key] = false
        // Извлекаем data из обёрнутого ответа {success, data, metadata}
        state.fetchedData[key] = { success: result.success, data: result.data, metadata: result.metadata }
        console.log('[dataBindingsSlice] Saved to fetchedData[' + key + ']:', state.fetchedData[key])
      })
      .addCase(fetchDataWithBinding.rejected, (state, action) => {
        const key = action.meta.arg.key
        state.fetching[key] = false
        state.fetchErrors[key] = action.error.message || 'Failed to fetch data'
      })
  },
})

// ============ Actions ============
export const {
  setCurrentBinding,
  clearCurrentBlockBindings,
  clearFetchedData,
  clearError,
  updateCurrentBindingConfig,
} = dataBindingsSlice.actions

// ============ Selectors ============
export const selectAllBindings = (state: RootState) => state.dataBindings.items
export const selectCurrentBlockBindings = (state: RootState) => state.dataBindings.currentBlockBindings
export const selectCurrentBinding = (state: RootState) => state.dataBindings.currentBinding
export const selectBindingsLoading = (state: RootState) => state.dataBindings.loading
export const selectBindingsSaving = (state: RootState) => state.dataBindings.saving
export const selectBindingsError = (state: RootState) => state.dataBindings.error
export const selectFetchedData = (key: string) => (state: RootState) => state.dataBindings.fetchedData[key]
export const selectIsFetching = (key: string) => (state: RootState) => state.dataBindings.fetching[key] || false
export const selectFetchError = (key: string) => (state: RootState) => state.dataBindings.fetchErrors[key]
export const selectBindingsVersion = (state: RootState) => state.dataBindings.bindingsVersion

// Мемоизированный селектор для получения привязки по blockId или linkedBlockId
export const selectBindingsByBlockId = (blockId: string, linkedBlockId?: string) =>
  createSelector(
    [selectAllBindings],
    (items) => items.filter(b => 
      b.isActive !== false && // Только активные привязки
      (b.blockId === blockId || (linkedBlockId && b.blockId === linkedBlockId))
    )
  )

// Мемоизированный селектор для Input binding блока
// Ищет привязку по blockId ИЛИ linkedBlockId (для библиотечных блоков)
export const selectInputBindingForBlock = (blockId: string, linkedBlockId?: string) =>
  createSelector(
    [selectAllBindings],
    (items) => items.find(
      b => b.isActive !== false && // Только активные привязки
           (b.bindingType === 'input' || b.bindingType === 'bidirectional') && 
           (b.blockId === blockId || (linkedBlockId && b.blockId === linkedBlockId))
    )
  )

// ============ Reducer ============
export default dataBindingsSlice.reducer
