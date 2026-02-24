import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '@/app/store'
import { languageApi, translationApi } from '@/shared/api/translationApi'
import type {
  Language,
  CreateLanguageRequest,
  UpdateLanguageRequest,
  Translation,
  TranslationEntry,
  TranslationMap,
  TranslationProgress,
} from '@/shared/types/translation'

interface TranslationsState {
  // Languages
  languages: Language[]
  languagesLoading: boolean
  languagesError: string | null
  
  // Active editing locale (selected in language switcher)
  activeLocale: string | null
  
  // Translations for current page + locale
  translations: Translation[]
  translationMap: TranslationMap
  translationsLoading: boolean
  translationsError: string | null
  translationsSaving: boolean
  
  // Source (default language) translatable content
  sourceContent: TranslationEntry[]
  sourceContentLoading: boolean
  
  // Progress stats
  progress: TranslationProgress[]
  progressLoading: boolean
  
  // Translation panel open state
  panelOpen: boolean
}

const initialState: TranslationsState = {
  languages: [],
  languagesLoading: false,
  languagesError: null,
  
  activeLocale: null,
  
  translations: [],
  translationMap: {},
  translationsLoading: false,
  translationsError: null,
  translationsSaving: false,
  
  sourceContent: [],
  sourceContentLoading: false,
  
  progress: [],
  progressLoading: false,
  
  panelOpen: false,
}

// === Language thunks ===

export const fetchLanguages = createAsyncThunk(
  'translations/fetchLanguages',
  async () => {
    return await languageApi.getAll()
  }
)

export const fetchActiveLanguages = createAsyncThunk(
  'translations/fetchActiveLanguages',
  async () => {
    return await languageApi.getActive()
  }
)

export const createLanguage = createAsyncThunk(
  'translations/createLanguage',
  async (data: CreateLanguageRequest) => {
    return await languageApi.create(data)
  }
)

export const updateLanguage = createAsyncThunk(
  'translations/updateLanguage',
  async ({ id, data }: { id: string; data: UpdateLanguageRequest }) => {
    return await languageApi.update(id, data)
  }
)

export const deleteLanguage = createAsyncThunk(
  'translations/deleteLanguage',
  async (id: string) => {
    await languageApi.delete(id)
    return id
  }
)

export const seedDefaultLanguages = createAsyncThunk(
  'translations/seedDefaults',
  async () => {
    return await languageApi.seedDefaults()
  }
)

export const reorderLanguages = createAsyncThunk(
  'translations/reorderLanguages',
  async (orderedIds: string[]) => {
    return await languageApi.reorder(orderedIds)
  }
)

// === Translation thunks ===

export const fetchSourceContent = createAsyncThunk(
  'translations/fetchSourceContent',
  async (pageId: string) => {
    return await translationApi.getTranslatableContent(pageId)
  }
)

export const fetchPageTranslations = createAsyncThunk(
  'translations/fetchPageTranslations',
  async ({ pageId, locale }: { pageId: string; locale: string }) => {
    const [translations, map] = await Promise.all([
      translationApi.getPageTranslations(pageId, locale),
      translationApi.getTranslationMap(pageId, locale),
    ])
    return { translations, map }
  }
)

export const fetchTranslationProgress = createAsyncThunk(
  'translations/fetchProgress',
  async (pageId: string) => {
    return await translationApi.getProgress(pageId)
  }
)

export const saveTranslation = createAsyncThunk(
  'translations/saveOne',
  async ({
    pageId,
    locale,
    nodeId,
    field,
    value,
    status,
  }: {
    pageId: string
    locale: string
    nodeId: string
    field: string
    value: string
    status?: string
  }) => {
    return await translationApi.upsertOne(pageId, locale, nodeId, field, value, status)
  }
)

export const bulkSaveTranslations = createAsyncThunk(
  'translations/bulkSave',
  async ({
    pageId,
    locale,
    translations,
  }: {
    pageId: string
    locale: string
    translations: TranslationEntry[]
  }) => {
    return await translationApi.bulkUpsert(pageId, locale, { translations })
  }
)

export const deleteTranslation = createAsyncThunk(
  'translations/deleteOne',
  async ({
    pageId,
    locale,
    nodeId,
    field,
  }: {
    pageId: string
    locale: string
    nodeId: string
    field: string
  }) => {
    await translationApi.deleteOne(pageId, locale, nodeId, field)
    return { nodeId, field }
  }
)

export const copyTranslations = createAsyncThunk(
  'translations/copy',
  async ({
    pageId,
    fromLocale,
    toLocale,
  }: {
    pageId: string
    fromLocale: string
    toLocale: string
  }) => {
    return await translationApi.copyTranslations(pageId, fromLocale, toLocale)
  }
)

// === Slice ===

const translationsSlice = createSlice({
  name: 'translations',
  initialState,
  reducers: {
    setActiveLocale: (state, action: PayloadAction<string | null>) => {
      state.activeLocale = action.payload
    },
    toggleTranslationPanel: (state) => {
      state.panelOpen = !state.panelOpen
    },
    setTranslationPanelOpen: (state, action: PayloadAction<boolean>) => {
      state.panelOpen = action.payload
    },
    clearTranslations: (state) => {
      state.translations = []
      state.translationMap = {}
      state.sourceContent = []
      state.progress = []
    },
    // Optimistic update for single translation
    updateTranslationLocally: (state, action: PayloadAction<{ nodeId: string; field: string; value: string }>) => {
      const { nodeId, field, value } = action.payload
      if (!state.translationMap[nodeId]) {
        state.translationMap[nodeId] = {}
      }
      state.translationMap[nodeId][field] = value
    },
  },
  extraReducers: (builder) => {
    builder
      // Languages
      .addCase(fetchLanguages.pending, (state) => {
        state.languagesLoading = true
        state.languagesError = null
      })
      .addCase(fetchLanguages.fulfilled, (state, action) => {
        state.languagesLoading = false
        state.languages = action.payload
      })
      .addCase(fetchLanguages.rejected, (state, action) => {
        state.languagesLoading = false
        state.languagesError = action.error.message || 'Failed to fetch languages'
      })
      .addCase(fetchActiveLanguages.fulfilled, (state, action) => {
        state.languages = action.payload
      })
      .addCase(createLanguage.fulfilled, (state, action) => {
        state.languages.push(action.payload)
        // If default changed, update others
        if (action.payload.isDefault) {
          state.languages = state.languages.map(l =>
            l.id === action.payload.id ? action.payload : { ...l, isDefault: false }
          )
        }
      })
      .addCase(updateLanguage.fulfilled, (state, action) => {
        const idx = state.languages.findIndex(l => l.id === action.payload.id)
        if (idx !== -1) {
          state.languages[idx] = action.payload
        }
        if (action.payload.isDefault) {
          state.languages = state.languages.map(l =>
            l.id === action.payload.id ? action.payload : { ...l, isDefault: false }
          )
        }
      })
      .addCase(deleteLanguage.fulfilled, (state, action) => {
        state.languages = state.languages.filter(l => l.id !== action.payload)
        if (state.activeLocale) {
          const langStillExists = state.languages.find(l => l.code === state.activeLocale)
          if (!langStillExists) {
            state.activeLocale = null
          }
        }
      })
      .addCase(seedDefaultLanguages.fulfilled, (state, action) => {
        state.languages = action.payload
      })
      .addCase(reorderLanguages.fulfilled, (state, action) => {
        state.languages = action.payload
      })
      
      // Source content
      .addCase(fetchSourceContent.pending, (state) => {
        state.sourceContentLoading = true
      })
      .addCase(fetchSourceContent.fulfilled, (state, action) => {
        state.sourceContentLoading = false
        state.sourceContent = action.payload
      })
      .addCase(fetchSourceContent.rejected, (state) => {
        state.sourceContentLoading = false
      })
      
      // Translations
      .addCase(fetchPageTranslations.pending, (state) => {
        state.translationsLoading = true
        state.translationsError = null
      })
      .addCase(fetchPageTranslations.fulfilled, (state, action) => {
        state.translationsLoading = false
        state.translations = action.payload.translations
        state.translationMap = action.payload.map
      })
      .addCase(fetchPageTranslations.rejected, (state, action) => {
        state.translationsLoading = false
        state.translationsError = action.error.message || 'Failed to fetch translations'
      })
      
      // Save
      .addCase(saveTranslation.pending, (state) => {
        state.translationsSaving = true
      })
      .addCase(saveTranslation.fulfilled, (state, action) => {
        state.translationsSaving = false
        const t = action.payload
        // Update map
        if (!state.translationMap[t.nodeId]) {
          state.translationMap[t.nodeId] = {}
        }
        state.translationMap[t.nodeId][t.field] = t.value
        // Update list
        const idx = state.translations.findIndex(
          tr => tr.nodeId === t.nodeId && tr.field === t.field
        )
        if (idx !== -1) {
          state.translations[idx] = t
        } else {
          state.translations.push(t)
        }
      })
      .addCase(saveTranslation.rejected, (state) => {
        state.translationsSaving = false
      })
      
      .addCase(bulkSaveTranslations.pending, (state) => {
        state.translationsSaving = true
      })
      .addCase(bulkSaveTranslations.fulfilled, (state, action) => {
        state.translationsSaving = false
        // Rebuild map from result
        for (const t of action.payload) {
          if (!state.translationMap[t.nodeId]) {
            state.translationMap[t.nodeId] = {}
          }
          state.translationMap[t.nodeId][t.field] = t.value
        }
      })
      .addCase(bulkSaveTranslations.rejected, (state) => {
        state.translationsSaving = false
      })
      
      // Delete
      .addCase(deleteTranslation.fulfilled, (state, action) => {
        const { nodeId, field } = action.payload
        if (state.translationMap[nodeId]) {
          delete state.translationMap[nodeId][field]
        }
        state.translations = state.translations.filter(
          t => !(t.nodeId === nodeId && t.field === field)
        )
      })
      
      // Progress
      .addCase(fetchTranslationProgress.pending, (state) => {
        state.progressLoading = true
      })
      .addCase(fetchTranslationProgress.fulfilled, (state, action) => {
        state.progressLoading = false
        state.progress = action.payload
      })
      .addCase(fetchTranslationProgress.rejected, (state) => {
        state.progressLoading = false
      })
  },
})

export const {
  setActiveLocale,
  toggleTranslationPanel,
  setTranslationPanelOpen,
  clearTranslations,
  updateTranslationLocally,
} = translationsSlice.actions

// === Selectors ===
export const selectLanguages = (state: RootState) => state.translations.languages
export const selectLanguagesLoading = (state: RootState) => state.translations.languagesLoading
export const selectActiveLocale = (state: RootState) => state.translations.activeLocale
export const selectDefaultLanguage = (state: RootState) => 
  state.translations.languages.find(l => l.isDefault)
export const selectNonDefaultLanguages = (state: RootState) =>
  state.translations.languages.filter(l => !l.isDefault && l.isActive)
export const selectTranslationMap = (state: RootState) => state.translations.translationMap
export const selectTranslations = (state: RootState) => state.translations.translations
export const selectTranslationsLoading = (state: RootState) => state.translations.translationsLoading
export const selectTranslationsSaving = (state: RootState) => state.translations.translationsSaving
export const selectSourceContent = (state: RootState) => state.translations.sourceContent
export const selectSourceContentLoading = (state: RootState) => state.translations.sourceContentLoading
export const selectTranslationProgress = (state: RootState) => state.translations.progress
export const selectTranslationPanelOpen = (state: RootState) => state.translations.panelOpen

// Get translation for a specific node+field
export const selectNodeTranslation = (nodeId: string, field: string) => (state: RootState) =>
  state.translations.translationMap[nodeId]?.[field]

export default translationsSlice.reducer
