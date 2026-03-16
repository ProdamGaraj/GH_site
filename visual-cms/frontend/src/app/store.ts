import { configureStore } from '@reduxjs/toolkit'
import editorReducer from '@/features/editor/editorSlice'
import pagesReducer from '@/features/pages/pagesSlice'
import blocksReducer from '@/features/blocks/blocksSlice'
import groupsReducer from '@/features/groups/groupsSlice'
import dataSourcesReducer from '@/features/data-sources/dataSourcesSlice'
import dataBindingsReducer from '@/features/dataBindings/dataBindingsSlice'
import computedValuesReducer from '@/features/dataBindings/computedValuesSlice'
import templatesReducer from '@/features/templates/templatesSlice'
import variablesReducer from '@/features/variables/variablesSlice'
import formsReducer from '@/features/forms/formsSlice'
import analyticsReducer from '@/features/analytics/analyticsSlice'
import translationsReducer from '@/features/translations/translationsSlice'
import sitesReducer from '@/features/sites/sitesSlice'

export const store = configureStore({
  reducer: {
    editor: editorReducer,
    pages: pagesReducer,
    sites: sitesReducer,
    blocks: blocksReducer,
    groups: groupsReducer,
    dataSources: dataSourcesReducer,
    dataBindings: dataBindingsReducer,
    computedValues: computedValuesReducer,
    templates: templatesReducer,
    variables: variablesReducer,
    analytics: analyticsReducer,
    forms: formsReducer,
    translations: translationsReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
