import { configureStore } from '@reduxjs/toolkit'
import editorReducer from '@/features/editor/editorSlice'
import pagesReducer from '@/features/pages/pagesSlice'
import blocksReducer from '@/features/blocks/blocksSlice'
import groupsReducer from '@/features/groups/groupsSlice'

export const store = configureStore({
  reducer: {
    editor: editorReducer,
    pages: pagesReducer,
    blocks: blocksReducer,
    groups: groupsReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
