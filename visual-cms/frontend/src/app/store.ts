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
import collectionsReducer from '@/features/collections/collectionsSlice'
import authReducer, { sessionExpired } from '@/features/auth/authSlice'
import { setUnauthorizedHandler } from '@/shared/api/http'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    editor: editorReducer,
    pages: pagesReducer,
    sites: sitesReducer,
    collections: collectionsReducer,
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

// Любой 401 от API → помечаем сессию истёкшей; RequireAuth уведёт на /login.
setUnauthorizedHandler(() => {
  store.dispatch(sessionExpired())
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
