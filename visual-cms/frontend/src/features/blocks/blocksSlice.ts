import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import type { Block } from '@/shared/types'
import type { RootState } from '@/app/store'
import { blockApi, CreateBlockDto, UpdateBlockDto } from '@/shared/api'

interface BlocksState {
  items: Block[]
  currentBlock: Block | null
  loading: boolean
  saving: boolean
  error: string | null
}

const initialState: BlocksState = {
  items: [],
  currentBlock: null,
  loading: false,
  saving: false,
  error: null,
}

// Async thunks
export const fetchBlocks = createAsyncThunk(
  'blocks/fetchAll',
  async () => {
    return await blockApi.getAll()
  }
)

export const fetchBlockById = createAsyncThunk(
  'blocks/fetchById',
  async (id: string) => {
    return await blockApi.getById(id)
  }
)

export const createBlock = createAsyncThunk(
  'blocks/create',
  async (data: CreateBlockDto) => {
    return await blockApi.create(data)
  }
)

export const updateBlock = createAsyncThunk(
  'blocks/update',
  async ({ id, data }: { id: string; data: UpdateBlockDto }) => {
    return await blockApi.update(id, data)
  }
)

export const deleteBlock = createAsyncThunk(
  'blocks/delete',
  async (id: string) => {
    await blockApi.delete(id)
    return id
  }
)

const blocksSlice = createSlice({
  name: 'blocks',
  initialState,
  reducers: {
    setCurrentBlock: (state, action: PayloadAction<Block | null>) => {
      state.currentBlock = action.payload
    },
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all
      .addCase(fetchBlocks.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchBlocks.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload
      })
      .addCase(fetchBlocks.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch blocks'
      })
      // Fetch by ID
      .addCase(fetchBlockById.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchBlockById.fulfilled, (state, action) => {
        state.loading = false
        state.currentBlock = action.payload
      })
      .addCase(fetchBlockById.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch block'
      })
      // Create
      .addCase(createBlock.pending, (state) => {
        state.saving = true
        state.error = null
      })
      .addCase(createBlock.fulfilled, (state, action) => {
        state.saving = false
        state.items.push(action.payload)
        state.currentBlock = action.payload
      })
      .addCase(createBlock.rejected, (state, action) => {
        state.saving = false
        state.error = action.error.message || 'Failed to create block'
      })
      // Update
      .addCase(updateBlock.pending, (state) => {
        state.saving = true
        state.error = null
      })
      .addCase(updateBlock.fulfilled, (state, action) => {
        state.saving = false
        const index = state.items.findIndex(b => b.id === action.payload.id)
        if (index !== -1) {
          state.items[index] = action.payload
        }
        state.currentBlock = action.payload
      })
      .addCase(updateBlock.rejected, (state, action) => {
        state.saving = false
        state.error = action.error.message || 'Failed to update block'
      })
      // Delete
      .addCase(deleteBlock.fulfilled, (state, action) => {
        state.items = state.items.filter(b => b.id !== action.payload)
        if (state.currentBlock?.id === action.payload) {
          state.currentBlock = null
        }
      })
  },
})

export const { setCurrentBlock, clearError } = blocksSlice.actions

export const selectBlocks = (state: RootState) => state.blocks.items
export const selectCurrentBlock = (state: RootState) => state.blocks.currentBlock
export const selectReusableBlocks = (state: RootState) => 
  state.blocks.items.filter(block => block.isReusable)
export const selectBlocksLoading = (state: RootState) => state.blocks.loading
export const selectBlocksSaving = (state: RootState) => state.blocks.saving
export const selectBlocksError = (state: RootState) => state.blocks.error

export default blocksSlice.reducer
