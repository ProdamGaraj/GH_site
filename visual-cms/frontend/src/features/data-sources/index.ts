/**
 * Data Sources Feature Module
 * 
 * Модуль для работы с источниками данных (Data Sources)
 * Согласно ТЗ: docs/data-binding-system-spec.md
 */

// Redux slice
export {
  default as dataSourcesReducer,
  // Actions
  selectDataSource,
  setFilters,
  clearFilters,
  setPage,
  setLimit,
  clearError,
  clearTestResult,
  resetState,
  // Async thunks
  fetchDataSources,
  fetchDataSourceById,
  createDataSource,
  updateDataSource,
  deleteDataSource,
  testDataSourceConnection,
  testNewDataSourceConnection,
  duplicateDataSource,
  // Selectors
  selectDataSources,
  selectSelectedDataSource,
  selectDataSourceById,
  selectDataSourcesLoading,
  selectDataSourcesSaving,
  selectDataSourcesTesting,
  selectDataSourcesError,
  selectDataSourcesTotal,
  selectDataSourcesPage,
  selectDataSourcesLimit,
  selectDataSourcesFilters,
  selectTotalPages,
  selectTestResult
} from './dataSourcesSlice'

// Components
export { DataSourceWizard } from './components'
