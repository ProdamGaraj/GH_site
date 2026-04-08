import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '@/app/store'
import {
  collectionApi,
  Collection,
  CreateCollectionDto,
  UpdateCollectionDto,
  CreateOverrideDto,
  UpdateOverrideDto,
  CollectionItemsResult,
} from '@/shared/api/collectionApi'

interface CollectionsState {
  items: Collection[]
  currentCollection: Collection | null
  collectionItems: CollectionItemsResult | null
  loading: boolean
  saving: boolean
  deploying: boolean
  error: string | null
}

const initialState: CollectionsState = {
  items: [],
  currentCollection: null,
  collectionItems: null,
  loading: false,
  saving: false,
  deploying: false,
  error: null,
}

export const fetchCollections = createAsyncThunk(
  'collections/fetchAll',
  async (siteId?: string) => {
    return await collectionApi.getAll(siteId)
  }
)

export const fetchCollectionById = createAsyncThunk(
  'collections/fetchById',
  async (id: string) => {
    return await collectionApi.getById(id)
  }
)

export const createCollection = createAsyncThunk(
  'collections/create',
  async (data: CreateCollectionDto) => {
    return await collectionApi.create(data)
  }
)

export const updateCollection = createAsyncThunk(
  'collections/update',
  async ({ id, data }: { id: string; data: UpdateCollectionDto }) => {
    return await collectionApi.update(id, data)
  }
)

export const deleteCollection = createAsyncThunk(
  'collections/delete',
  async (id: string) => {
    await collectionApi.delete(id)
    return id
  }
)

export const fetchCollectionItems = createAsyncThunk(
  'collections/fetchItems',
  async (id: string) => {
    return await collectionApi.getItems(id)
  }
)

export const deployCollection = createAsyncThunk(
  'collections/deploy',
  async (id: string) => {
    return await collectionApi.deploy(id)
  }
)

export const createOverride = createAsyncThunk(
  'collections/createOverride',
  async ({ collectionId, data }: { collectionId: string; data: CreateOverrideDto }) => {
    return await collectionApi.createOverride(collectionId, data)
  }
)

export const updateOverride = createAsyncThunk(
  'collections/updateOverride',
  async ({ collectionId, overrideId, data }: { collectionId: string; overrideId: string; data: UpdateOverrideDto }) => {
    return await collectionApi.updateOverride(collectionId, overrideId, data)
  }
)

export const deleteOverride = createAsyncThunk(
  'collections/deleteOverride',
  async ({ collectionId, overrideId }: { collectionId: string; overrideId: string }) => {
    await collectionApi.deleteOverride(collectionId, overrideId)
    return overrideId
  }
)

const collectionsSlice = createSlice({
  name: 'collections',
  initialState,
  reducers: {
    setCurrentCollection(state, action: PayloadAction<Collection | null>) {
      state.currentCollection = action.payload
    },
    clearError(state) {
      state.error = null
    },
    clearCollectionItems(state) {
      state.collectionItems = null
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchAll
      .addCase(fetchCollections.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchCollections.fulfilled, (state, action: PayloadAction<Collection[]>) => {
        state.loading = false
        state.items = action.payload
      })
      .addCase(fetchCollections.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Не удалось загрузить коллекции'
      })
      // fetchById
      .addCase(fetchCollectionById.fulfilled, (state, action: PayloadAction<Collection>) => {
        state.currentCollection = action.payload
        const index = state.items.findIndex(c => c.id === action.payload.id)
        if (index !== -1) {
          state.items[index] = action.payload
        }
      })
      // create
      .addCase(createCollection.pending, (state) => {
        state.saving = true
        state.error = null
      })
      .addCase(createCollection.fulfilled, (state, action: PayloadAction<Collection>) => {
        state.saving = false
        state.items.push(action.payload)
      })
      .addCase(createCollection.rejected, (state, action) => {
        state.saving = false
        state.error = action.error.message || 'Не удалось создать коллекцию'
      })
      // update
      .addCase(updateCollection.pending, (state) => {
        state.saving = true
        state.error = null
      })
      .addCase(updateCollection.fulfilled, (state, action: PayloadAction<Collection>) => {
        state.saving = false
        const index = state.items.findIndex(c => c.id === action.payload.id)
        if (index !== -1) {
          state.items[index] = action.payload
        }
        if (state.currentCollection?.id === action.payload.id) {
          state.currentCollection = action.payload
        }
      })
      .addCase(updateCollection.rejected, (state, action) => {
        state.saving = false
        state.error = action.error.message || 'Не удалось обновить коллекцию'
      })
      // delete
      .addCase(deleteCollection.fulfilled, (state, action: PayloadAction<string>) => {
        state.items = state.items.filter(c => c.id !== action.payload)
        if (state.currentCollection?.id === action.payload) {
          state.currentCollection = null
        }
      })
      // fetchItems
      .addCase(fetchCollectionItems.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchCollectionItems.fulfilled, (state, action: PayloadAction<CollectionItemsResult>) => {
        state.loading = false
        state.collectionItems = action.payload
      })
      .addCase(fetchCollectionItems.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Не удалось загрузить элементы'
      })
      // deploy
      .addCase(deployCollection.pending, (state) => {
        state.deploying = true
      })
      .addCase(deployCollection.fulfilled, (state) => {
        state.deploying = false
      })
      .addCase(deployCollection.rejected, (state, action) => {
        state.deploying = false
        state.error = action.error.message || 'Ошибка деплоя'
      })
      // createOverride
      .addCase(createOverride.fulfilled, (state, action) => {
        if (state.currentCollection) {
          state.currentCollection.overrides = [
            ...(state.currentCollection.overrides || []),
            action.payload,
          ]
        }
      })
      // deleteOverride
      .addCase(deleteOverride.fulfilled, (state, action: PayloadAction<string>) => {
        if (state.currentCollection) {
          state.currentCollection.overrides = (state.currentCollection.overrides || [])
            .filter(o => o.id !== action.payload)
        }
      })
  },
})

export const { setCurrentCollection, clearError, clearCollectionItems } = collectionsSlice.actions

export const selectCollections = (state: RootState) => state.collections.items
export const selectCurrentCollection = (state: RootState) => state.collections.currentCollection
export const selectCollectionItems = (state: RootState) => state.collections.collectionItems
export const selectCollectionsLoading = (state: RootState) => state.collections.loading
export const selectCollectionsSaving = (state: RootState) => state.collections.saving
export const selectCollectionsDeploying = (state: RootState) => state.collections.deploying
export const selectCollectionsError = (state: RootState) => state.collections.error

export default collectionsSlice.reducer
