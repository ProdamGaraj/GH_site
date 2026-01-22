// Pages feature exports

// Redux slice
export {
  default as pagesReducer,
  fetchPages,
  fetchPageById,
  createPage,
  updatePage,
  deletePage,
  selectPages,
  selectPagesLoading,
  selectPagesSaving,
  selectPagesError,
} from './pagesSlice'

// Components
export { PageSettingsDataTab } from './components'
export type { PageDataSettings } from './components'
