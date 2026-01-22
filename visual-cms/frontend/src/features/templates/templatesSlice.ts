import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '@/app/store'
import { templateApi } from '@/shared/api/templateApi'
import type { 
  Template, 
  CreateTemplateRequest, 
  UpdateTemplateRequest, 
  TemplateFilters,
  TemplateCategory,
  DetectedField
} from '@/shared/types/template'

/**
 * Templates Slice
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 3.2 Frontend: Templates Library
 */

interface TemplatesState {
  // Все шаблоны
  items: Template[]
  // Текущий редактируемый шаблон
  currentTemplate: Template | null
  // Фильтры
  filters: TemplateFilters
  // Состояние загрузки
  loading: boolean
  saving: boolean
  detecting: boolean
  // Ошибки
  error: string | null
}

const initialState: TemplatesState = {
  items: [],
  currentTemplate: null,
  filters: {},
  loading: false,
  saving: false,
  detecting: false,
  error: null,
}

// ============ Async Thunks ============

/**
 * Получить все шаблоны
 */
export const fetchTemplates = createAsyncThunk(
  'templates/fetchAll',
  async (filters?: TemplateFilters) => {
    return await templateApi.getAll(filters)
  }
)

/**
 * Получить шаблон по ID
 */
export const fetchTemplateById = createAsyncThunk(
  'templates/fetchById',
  async (id: string) => {
    return await templateApi.getById(id)
  }
)

/**
 * Создать шаблон
 */
export const createTemplate = createAsyncThunk(
  'templates/create',
  async (data: CreateTemplateRequest) => {
    return await templateApi.create(data)
  }
)

/**
 * Обновить шаблон
 */
export const updateTemplate = createAsyncThunk(
  'templates/update',
  async ({ id, data }: { id: string; data: UpdateTemplateRequest }) => {
    return await templateApi.update(id, data)
  }
)

/**
 * Удалить шаблон
 */
export const deleteTemplate = createAsyncThunk(
  'templates/delete',
  async (id: string) => {
    await templateApi.delete(id)
    return id
  }
)

/**
 * Дублировать шаблон
 */
export const duplicateTemplate = createAsyncThunk(
  'templates/duplicate',
  async ({ id, newName }: { id: string; newName?: string }) => {
    return await templateApi.duplicate(id, newName)
  }
)

/**
 * Переопределить поля шаблона
 */
export const detectTemplateFields = createAsyncThunk(
  'templates/detectFields',
  async (id: string) => {
    return await templateApi.detectFields(id)
  }
)

/**
 * Определить поля из HTML (без сохранения)
 */
export const detectFieldsFromHtml = createAsyncThunk(
  'templates/detectFieldsFromHtml',
  async (html: string) => {
    return await templateApi.detectFieldsFromHtml(html)
  }
)

// ============ Slice ============

const templatesSlice = createSlice({
  name: 'templates',
  initialState,
  reducers: {
    // Установить текущий шаблон
    setCurrentTemplate: (state, action: PayloadAction<Template | null>) => {
      state.currentTemplate = action.payload
    },

    // Установить фильтры
    setFilters: (state, action: PayloadAction<TemplateFilters>) => {
      state.filters = action.payload
    },

    // Сбросить фильтры
    clearFilters: (state) => {
      state.filters = {}
    },

    // Очистить ошибку
    clearError: (state) => {
      state.error = null
    },

    // Обновить поля текущего шаблона локально
    updateCurrentTemplateFields: (state, action: PayloadAction<DetectedField[]>) => {
      if (state.currentTemplate) {
        state.currentTemplate.detectedFields = action.payload
      }
    },
  },
  extraReducers: (builder) => {
    // fetchTemplates
    builder
      .addCase(fetchTemplates.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchTemplates.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload
      })
      .addCase(fetchTemplates.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch templates'
      })

    // fetchTemplateById
    builder
      .addCase(fetchTemplateById.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchTemplateById.fulfilled, (state, action) => {
        state.loading = false
        state.currentTemplate = action.payload
      })
      .addCase(fetchTemplateById.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch template'
      })

    // createTemplate
    builder
      .addCase(createTemplate.pending, (state) => {
        state.saving = true
        state.error = null
      })
      .addCase(createTemplate.fulfilled, (state, action) => {
        state.saving = false
        state.items.unshift(action.payload)
        state.currentTemplate = action.payload
      })
      .addCase(createTemplate.rejected, (state, action) => {
        state.saving = false
        state.error = action.error.message || 'Failed to create template'
      })

    // updateTemplate
    builder
      .addCase(updateTemplate.pending, (state) => {
        state.saving = true
        state.error = null
      })
      .addCase(updateTemplate.fulfilled, (state, action) => {
        state.saving = false
        const index = state.items.findIndex(t => t.id === action.payload.id)
        if (index !== -1) {
          state.items[index] = action.payload
        }
        if (state.currentTemplate?.id === action.payload.id) {
          state.currentTemplate = action.payload
        }
      })
      .addCase(updateTemplate.rejected, (state, action) => {
        state.saving = false
        state.error = action.error.message || 'Failed to update template'
      })

    // deleteTemplate
    builder
      .addCase(deleteTemplate.pending, (state) => {
        state.saving = true
        state.error = null
      })
      .addCase(deleteTemplate.fulfilled, (state, action) => {
        state.saving = false
        state.items = state.items.filter(t => t.id !== action.payload)
        if (state.currentTemplate?.id === action.payload) {
          state.currentTemplate = null
        }
      })
      .addCase(deleteTemplate.rejected, (state, action) => {
        state.saving = false
        state.error = action.error.message || 'Failed to delete template'
      })

    // duplicateTemplate
    builder
      .addCase(duplicateTemplate.fulfilled, (state, action) => {
        state.items.unshift(action.payload)
      })

    // detectTemplateFields
    builder
      .addCase(detectTemplateFields.pending, (state) => {
        state.detecting = true
      })
      .addCase(detectTemplateFields.fulfilled, (state, action) => {
        state.detecting = false
        const index = state.items.findIndex(t => t.id === action.payload.templateId)
        if (index !== -1) {
          state.items[index].detectedFields = action.payload.detectedFields
        }
        if (state.currentTemplate?.id === action.payload.templateId) {
          state.currentTemplate.detectedFields = action.payload.detectedFields
        }
      })
      .addCase(detectTemplateFields.rejected, (state) => {
        state.detecting = false
      })
  },
})

// Actions
export const { 
  setCurrentTemplate, 
  setFilters, 
  clearFilters, 
  clearError,
  updateCurrentTemplateFields 
} = templatesSlice.actions

// Selectors
export const selectTemplates = (state: RootState) => state.templates.items
export const selectCurrentTemplate = (state: RootState) => state.templates.currentTemplate
export const selectTemplatesLoading = (state: RootState) => state.templates.loading
export const selectTemplatesSaving = (state: RootState) => state.templates.saving
export const selectTemplatesDetecting = (state: RootState) => state.templates.detecting
export const selectTemplatesError = (state: RootState) => state.templates.error
export const selectTemplatesFilters = (state: RootState) => state.templates.filters

// Selector by category
export const selectTemplatesByCategory = (category: TemplateCategory) => 
  (state: RootState) => state.templates.items.filter(t => t.category === category)

// Selector for active templates
export const selectActiveTemplates = (state: RootState) => 
  state.templates.items.filter(t => t.status === 'active')

export default templatesSlice.reducer
