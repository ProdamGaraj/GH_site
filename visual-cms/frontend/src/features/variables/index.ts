/**
 * Variables Feature
 * 
 * Экспорт модуля переменных
 */

// Redux slice
export {
  default as variablesReducer,
  // Actions
  setVariableValue,
  setVariableByName,
  resetVariableValue,
  resetPageVariables,
  subscribeBlock,
  unsubscribeBlock,
  unsubscribeAllForBlock,
  initializeFromPersistence,
  clearError,
  // Thunks
  fetchPageVariables,
  fetchGlobalVariables,
  createVariable,
  updateVariable,
  deleteVariable,
  // Selectors
  selectVariablesLoading,
  selectVariablesSaving,
  selectVariablesError,
  selectAllDefinitions,
  selectPageVariables,
  selectGlobalVariables,
  selectVariableValue,
  selectVariableByName,
  selectVariableSubscribers,
  selectAllValues,
  // Types
  type PageVariable,
  type VariableValue,
  type VariableScope,
  type VariableType,
  type VariableConfig,
} from './variablesSlice'

// Hooks
export {
  useVariable,
  useVariableByName,
  useVariableSubscription,
  useAllVariableValues,
  usePageVariablesManager,
  useBlockCleanup,
  useDebouncedVariable,
  useComputedVariable,
} from './useVariables'

// Components
export { 
  VariablesPanel, 
  VariableBindingSelector,
  VariableValueDisplay,
  VariableWatcher,
} from './components'

// Advanced Reactivity
export {
  useDependencyTracker,
  useThrottledVariable,
  useBatchUpdate,
  useConditionalReactivity,
  useDerivedVariable,
  useVariableHistory,
  useVariableWatch,
  useMultiVariableWatch,
  type DependencyTracker,
  type ThrottleOptions,
  type BatchUpdate,
  type ConditionalReactivityConfig,
  type DeriveFunction,
  type VariableChangeRecord,
  type WatchCallback,
} from './reactivity'
