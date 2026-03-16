import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import type { Site, SiteSettings } from '@/shared/types'
import type { RootState } from '@/app/store'
import { siteApi, CreateSiteDto, UpdateSiteDto } from '@/shared/api'

interface SitesState {
  items: Site[]
  currentSite: Site | null
  loading: boolean
  saving: boolean
  error: string | null
}

const initialState: SitesState = {
  items: [],
  currentSite: null,
  loading: false,
  saving: false,
  error: null,
}

export const fetchSites = createAsyncThunk(
  'sites/fetchAll',
  async () => {
    return await siteApi.getAll()
  }
)

export const fetchSiteById = createAsyncThunk(
  'sites/fetchById',
  async (id: string) => {
    return await siteApi.getById(id)
  }
)

export const createSite = createAsyncThunk(
  'sites/create',
  async (data: CreateSiteDto) => {
    return await siteApi.create(data)
  }
)

export const updateSite = createAsyncThunk(
  'sites/update',
  async ({ id, data }: { id: string; data: UpdateSiteDto }) => {
    return await siteApi.update(id, data)
  }
)

export const deleteSite = createAsyncThunk(
  'sites/delete',
  async (id: string) => {
    await siteApi.delete(id)
    return id
  }
)

export const updateSiteSettings = createAsyncThunk(
  'sites/updateSettings',
  async ({ id, settings }: { id: string; settings: Partial<SiteSettings> }) => {
    return await siteApi.updateSettings(id, settings)
  }
)

export const duplicateSite = createAsyncThunk(
  'sites/duplicate',
  async (id: string) => {
    return await siteApi.duplicate(id)
  }
)

export const deploySite = createAsyncThunk(
  'sites/deploy',
  async (id: string) => {
    return await siteApi.deploy(id)
  }
)

const sitesSlice = createSlice({
  name: 'sites',
  initialState,
  reducers: {
    setCurrentSite(state, action: PayloadAction<Site | null>) {
      state.currentSite = action.payload
    },
    clearError(state) {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchAll
      .addCase(fetchSites.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchSites.fulfilled, (state, action: PayloadAction<Site[]>) => {
        state.loading = false
        state.items = action.payload
      })
      .addCase(fetchSites.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Не удалось загрузить сайты'
      })
      // fetchById
      .addCase(fetchSiteById.fulfilled, (state, action: PayloadAction<Site>) => {
        state.currentSite = action.payload
        const index = state.items.findIndex(s => s.id === action.payload.id)
        if (index !== -1) {
          state.items[index] = action.payload
        }
      })
      // create
      .addCase(createSite.pending, (state) => {
        state.saving = true
        state.error = null
      })
      .addCase(createSite.fulfilled, (state, action: PayloadAction<Site>) => {
        state.saving = false
        state.items.push(action.payload)
      })
      .addCase(createSite.rejected, (state, action) => {
        state.saving = false
        state.error = action.error.message || 'Не удалось создать сайт'
      })
      // update
      .addCase(updateSite.pending, (state) => {
        state.saving = true
        state.error = null
      })
      .addCase(updateSite.fulfilled, (state, action: PayloadAction<Site>) => {
        state.saving = false
        const index = state.items.findIndex(s => s.id === action.payload.id)
        if (index !== -1) {
          state.items[index] = action.payload
        }
        if (state.currentSite?.id === action.payload.id) {
          state.currentSite = action.payload
        }
      })
      .addCase(updateSite.rejected, (state, action) => {
        state.saving = false
        state.error = action.error.message || 'Не удалось обновить сайт'
      })
      // delete
      .addCase(deleteSite.fulfilled, (state, action: PayloadAction<string>) => {
        state.items = state.items.filter(s => s.id !== action.payload)
        if (state.currentSite?.id === action.payload) {
          state.currentSite = null
        }
      })
      // updateSettings
      .addCase(updateSiteSettings.fulfilled, (state, action: PayloadAction<Site>) => {
        const index = state.items.findIndex(s => s.id === action.payload.id)
        if (index !== -1) {
          state.items[index] = action.payload
        }
        if (state.currentSite?.id === action.payload.id) {
          state.currentSite = action.payload
        }
      })
      // duplicate
      .addCase(duplicateSite.fulfilled, (state, action: PayloadAction<Site>) => {
        state.items.push(action.payload)
      })
  },
})

export const { setCurrentSite, clearError } = sitesSlice.actions

export const selectSites = (state: RootState) => state.sites.items
export const selectCurrentSite = (state: RootState) => state.sites.currentSite
export const selectSitesLoading = (state: RootState) => state.sites.loading
export const selectSitesSaving = (state: RootState) => state.sites.saving
export const selectSitesError = (state: RootState) => state.sites.error

export default sitesSlice.reducer
