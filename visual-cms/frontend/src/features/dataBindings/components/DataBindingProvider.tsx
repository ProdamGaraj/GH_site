import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { variablesService } from '../services/VariablesService'
import { pageDataService } from '../services/PageDataService'
import type { VariableDefinition } from '../components/VariablesEditor'
import type { PageDataConfig } from '../components/PageDataSourcesEditor'

interface PageDataSettings {
  dataSources: PageDataConfig
  variables: { variables: VariableDefinition[] }
}

interface DataBindingContextValue {
  // Variables
  getVariable: <T>(path: string) => T | undefined
  setVariable: (path: string, value: unknown) => boolean
  // Page Data
  getData: <T>(alias: string) => T | null
  fetchData: (alias: string) => Promise<unknown>
  invalidateCache: (alias?: string) => void
  // State
  isReady: boolean
  isLoading: boolean
}

const DataBindingContext = createContext<DataBindingContextValue | null>(null)

interface DataBindingProviderProps {
  children: React.ReactNode
  pageId: string
  settings?: PageDataSettings
  apiBaseUrl?: string
}

/**
 * Provider for Data Binding system
 * 
 * Initializes variables and page data sources for a page.
 * Should wrap the page content.
 * 
 * @example
 * <DataBindingProvider pageId={pageId} settings={pageSettings}>
 *   <PageContent />
 * </DataBindingProvider>
 */
export const DataBindingProvider: React.FC<DataBindingProviderProps> = ({
  children,
  pageId,
  settings,
  apiBaseUrl = '/api'
}) => {
  const [isReady, setIsReady] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Initialize on mount or settings change
  useEffect(() => {
    setIsLoading(true)
    setIsReady(false)

    // Clear previous page variables
    variablesService.clearPageVariables()

    // Initialize variables
    if (settings?.variables?.variables) {
      variablesService.initializeVariables(settings.variables.variables)
    }

    // Initialize page data sources
    if (settings?.dataSources?.dataSources) {
      pageDataService.initialize(settings.dataSources.dataSources, { apiBaseUrl })
    }

    setIsLoading(false)
    setIsReady(true)

    // Cleanup on unmount
    return () => {
      variablesService.clearPageVariables()
      pageDataService.cleanup()
    }
  }, [pageId, settings, apiBaseUrl])

  // Context value
  const getVariable = useCallback(<T,>(path: string): T | undefined => {
    return variablesService.getByPath<T>(path)
  }, [])

  const setVariable = useCallback((path: string, value: unknown): boolean => {
    return variablesService.setByPath(path, value)
  }, [])

  const getData = useCallback(<T,>(alias: string): T | null => {
    return pageDataService.getData<T>(alias)
  }, [])

  const fetchData = useCallback(async (alias: string): Promise<unknown> => {
    return pageDataService.fetch(alias)
  }, [])

  const invalidateCache = useCallback((alias?: string): void => {
    if (alias) {
      pageDataService.invalidateCache(alias)
    } else {
      pageDataService.invalidateAllCaches()
    }
  }, [])

  const contextValue: DataBindingContextValue = {
    getVariable,
    setVariable,
    getData,
    fetchData,
    invalidateCache,
    isReady,
    isLoading
  }

  return (
    <DataBindingContext.Provider value={contextValue}>
      {children}
    </DataBindingContext.Provider>
  )
}

/**
 * Hook to access DataBinding context
 */
export function useDataBindingContext(): DataBindingContextValue {
  const context = useContext(DataBindingContext)
  if (!context) {
    throw new Error('useDataBindingContext must be used within DataBindingProvider')
  }
  return context
}

/**
 * Hook to check if data binding is ready
 */
export function useDataBindingReady(): boolean {
  const context = useContext(DataBindingContext)
  return context?.isReady ?? false
}

export default DataBindingProvider
