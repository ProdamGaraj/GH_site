import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { Page } from '@/shared/types'
import type { RootState } from '@/app/store'

interface PagesState {
  items: Page[]
  loading: boolean
  error: string | null
}

const initialState: PagesState = {
  items: [],
  loading: false,
  error: null,
}

export const fetchPages = createAsyncThunk(
  'pages/fetchAll',
  async () => {
    // TODO: Implement API call
    return [] as Page[]
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
      })
      .addCase(fetchPages.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload
      })
      .addCase(fetchPages.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch pages'
      })
  },
})

export const selectPages = (state: RootState) => state.pages.items
export const selectPagesLoading = (state: RootState) => state.pages.loading

export default pagesSlice.reducer
