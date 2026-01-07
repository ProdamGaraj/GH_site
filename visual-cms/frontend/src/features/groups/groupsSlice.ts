import { createSlice } from '@reduxjs/toolkit'
import type { Group } from '@/shared/types'
import type { RootState } from '@/app/store'

interface GroupsState {
  items: Group[]
  loading: boolean
  error: string | null
}

const initialState: GroupsState = {
  items: [],
  loading: false,
  error: null,
}

const groupsSlice = createSlice({
  name: 'groups',
  initialState,
  reducers: {},
})

export const selectGroups = (state: RootState) => state.groups.items

export default groupsSlice.reducer
