import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import type { Page } from '@/shared/types'
import type { RootState } from '@/app/store'
import { pageApi, CreatePageDto, UpdatePageDto } from '@/shared/api'

interface PagesState {
  items: Page[]
  loading: boolean
  saving: boolean
  error: string | null
}

const initialState: PagesState = {
  items: [],
  loading: false,
  saving: false,
  error: null,
}

export const fetchPages = createAsyncThunk(
  'pages/fetchAll',
  async (siteId?: string) => {
    const pages = await pageApi.getAll(siteId)
    return pages
  }
)

export const fetchPageById = createAsyncThunk(
  'pages/fetchById',
  async (id: string) => {
    const page = await pageApi.getById(id)
    return page
  }
)

export const createPage = createAsyncThunk(
  'pages/create',
  async (data: CreatePageDto) => {
    const page = await pageApi.create(data)
    return page
  }
)

export const updatePage = createAsyncThunk(
  'pages/update',
  async ({ id, data }: { id: string; data: UpdatePageDto }) => {
    const page = await pageApi.update(id, data)
    return page
  }
)

export const deletePage = createAsyncThunk(
  'pages/delete',
  async (id: string) => {
    await pageApi.delete(id)
    return id
  }
)

const pagesSlice = createSlice({
  name: 'pages',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPages.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchPages.fulfilled, (state, action: PayloadAction<Page[]>) => {
        state.loading = false
        state.items = action.payload
      })
      .addCase(fetchPages.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch pages'
      })
      // Create
      .addCase(createPage.pending, (state) => {
        state.saving = true
        state.error = null
      })
      .addCase(createPage.fulfilled, (state, action: PayloadAction<Page>) => {
        state.saving = false
        state.items.push(action.payload)
      })
      .addCase(createPage.rejected, (state, action) => {
        state.saving = false
        state.error = action.error.message || 'Failed to create page'
      })
      // Update
      .addCase(updatePage.pending, (state) => {
        state.saving = true
        state.error = null
      })
      .addCase(updatePage.fulfilled, (state, action: PayloadAction<Page>) => {
        state.saving = false
        const index = state.items.findIndex(p => p.id === action.payload.id)
        if (index !== -1) {
          state.items[index] = action.payload
        }
      })
      .addCase(updatePage.rejected, (state, action) => {
        state.saving = false
        state.error = action.error.message || 'Failed to update page'
      })
      // Delete
      .addCase(deletePage.fulfilled, (state, action: PayloadAction<string>) => {
        state.items = state.items.filter(p => p.id !== action.payload)
      })
  },
})

export const selectPages = (state: RootState) => state.pages.items
export const selectPagesLoading = (state: RootState) => state.pages.loading
export const selectPagesSaving = (state: RootState) => state.pages.saving
export const selectPagesError = (state: RootState) => state.pages.error

export default pagesSlice.reducer
