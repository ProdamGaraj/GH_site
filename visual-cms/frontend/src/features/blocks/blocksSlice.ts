import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { Block } from '@/shared/types'
import type { RootState } from '@/app/store'

interface BlocksState {
  items: Block[]
  loading: boolean
  error: string | null
}

const initialState: BlocksState = {
  items: [],
  loading: false,
  error: null,
}

export const fetchBlocks = createAsyncThunk(
  'blocks/fetchAll',
  async () => {
    // TODO: Implement API call
    return [] as Block[]
  }
)

const blocksSlice = createSlice({
  name: 'blocks',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchBlocks.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchBlocks.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload
      })
      .addCase(fetchBlocks.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch blocks'
      })
  },
})

export const selectBlocks = (state: RootState) => state.blocks.items
export const selectReusableBlocks = (state: RootState) => 
  state.blocks.items.filter(block => block.isReusable)
export const selectBlocksLoading = (state: RootState) => state.blocks.loading

export default blocksSlice.reducer
