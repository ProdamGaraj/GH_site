// Data Bindings feature exports

// Redux slice and actions
export {
  default as dataBindingsReducer,
  fetchAllBindings,
  fetchBindingById,
  fetchBindingsForBlock,
  fetchBindingsForPage,
  createBinding,
  updateBinding,
  deleteBinding,
  fetchDataDirect,
  fetchDataWithBinding,
  setCurrentBinding,
  clearCurrentBlockBindings,
  clearFetchedData,
  clearError,
  updateCurrentBindingConfig,
  // Selectors
  selectAllBindings,
  selectCurrentBlockBindings,
  selectCurrentBinding,
  selectBindingsLoading,
  selectBindingsSaving,
  selectBindingsError,
  selectFetchedData,
  selectIsFetching,
  selectFetchError,
  selectBindingsByBlockId,
  selectInputBindingForBlock,
} from './dataBindingsSlice'

// Computed Values Slice
export {
  default as computedValuesReducer,
  setComputedValues,
  subscribe as subscribeToComputed,
  unsubscribe as unsubscribeFromComputed,
  clearBlockComputed,
  selectComputedByBlockId,
  selectComputedByBindingId,
  selectCount,
  selectFilteredCount,
  selectSum,
  selectAvg
} from './computedValuesSlice'

// Components
export { DataBindingTab } from './components/DataBindingTab'
export { SmartDataBindingTab } from './components/SmartDataBindingTab'
export { InputBindingEditor } from './components/InputBindingEditor'
export { FieldMappingEditor } from './components/FieldMappingEditor'
export { FilterBuilder } from './components/FilterBuilder'
export { SortBuilder } from './components/SortBuilder'
export { TransformsEditor } from './components/TransformsEditor'
export { DataPreview } from './components/DataPreview'
export { OutputBindingEditor } from './components/OutputBindingEditor'
export { RepeaterStatesEditor } from './components/RepeaterStatesEditor'
export { PaginationControlsEditor } from './components/PaginationControlsEditor'
export { PageDataSourcesEditor } from './components/PageDataSourcesEditor'
export { VariablesEditor } from './components/VariablesEditor'
export { DataBindingProvider, useDataBindingContext, useDataBindingReady } from './components/DataBindingProvider'
export { DataBindingIndicator, DataBindingInfoPanel } from './components/DataBindingIndicator'

// Services
export { variablesService, pageDataService } from './services'

// Hooks
export {
  useVariable,
  useVariables,
  useToggle,
  useCounter,
  useArrayVariable,
  useTemplate,
  useCondition,
  usePageData,
  usePageDataFetcher,
  usePageDataMultiple,
  usePageDataReady,
  useDataBinding,
  useRepeaterBinding,
  useFormSubmit,
  useBlockBindings,
  useBlockDataPreview,
  useResolvedContent,
  // Новые хуки с поддержкой transforms
  useDataBindingWithTransforms,
  useComputedValue,
  type TransformOptions,
  type UseDataBindingWithTransformsOptions,
  type TransformMeta,
  type UseDataBindingWithTransformsResult,
  // Хуки для блоков-фильтров
  useFilterBlocks,
  useFilterBlockValue,
  useSearchBlock,
  type FilterBlockState,
  type UseFilterBlocksOptions,
  type UseFilterBlocksResult
} from './hooks'

// Runtime Components (for published pages)
export {
  DataBoundElement,
  TemplateText,
  ConditionalRender,
  Repeater,
  LoadMoreRepeater,
  ComputedBlock
} from './components/runtime'

// Types re-exports
export type { PageDataSource, PageDataConfig } from './components/PageDataSourcesEditor'
export type { VariableScope, VariableType, VariableDefinition, VariablesConfig } from './components/VariablesEditor'
