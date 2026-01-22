import { useMemo } from 'react'
import { useAppSelector } from '@/app/hooks'
import { selectBindingsByBlockId } from '../dataBindingsSlice'
import type { DataBinding } from '@/shared/types/dataBinding'

export interface BlockDataPreviewResult {
  hasBinding: boolean
  bindingType: 'input' | 'output' | 'repeater' | null
  dataSourceAlias: string | null
  isLoading: boolean
  error: string | null
  previewData: unknown
  fieldMappings: Record<string, string>
  isRepeater: boolean
  itemCount: number | null
}

interface BindingConfig {
  mode?: 'single' | 'repeater'
  sourceConfig?: {
    alias?: string
    pageDataSourceId?: string
    fieldMappings?: Array<{ sourceField: string; targetProperty: string }>
  }
}

/**
 * Хук для получения превью данных привязанных к блоку
 */
export function useBlockDataPreview(blockId: string, _pageId?: string): BlockDataPreviewResult {
  const bindings = useAppSelector(selectBindingsByBlockId(blockId))

  const mainBinding = useMemo((): DataBinding | undefined => {
    if (!bindings || !Array.isArray(bindings)) return undefined
    return bindings.find((b: DataBinding) => {
      const config = b.config as BindingConfig | undefined
      return b.bindingType === 'input' || config?.mode === 'repeater'
    })
  }, [bindings])

  const bindingType = useMemo((): 'input' | 'output' | 'repeater' | null => {
    if (!mainBinding) return null
    const config = mainBinding.config as BindingConfig | undefined
    if (config?.mode === 'repeater') return 'repeater'
    if (mainBinding.bindingType === 'input') return 'input'
    if (mainBinding.bindingType === 'output') return 'output'
    return null
  }, [mainBinding])

  const dataSourceAlias = useMemo((): string | null => {
    if (!mainBinding) return null
    const config = mainBinding.config as BindingConfig | undefined
    if (config?.sourceConfig?.alias) return config.sourceConfig.alias
    if (config?.sourceConfig?.pageDataSourceId) return `$${config.sourceConfig.pageDataSourceId}`
    return null
  }, [mainBinding])

  const fieldMappings = useMemo((): Record<string, string> => {
    if (!mainBinding) return {}
    const config = mainBinding.config as BindingConfig | undefined
    if (!config?.sourceConfig?.fieldMappings) return {}
    const mappings: Record<string, string> = {}
    config.sourceConfig.fieldMappings.forEach((fm) => {
      mappings[fm.targetProperty] = fm.sourceField
    })
    return mappings
  }, [mainBinding])

  return {
    hasBinding: !!mainBinding,
    bindingType,
    dataSourceAlias,
    isLoading: false,
    error: null,
    previewData: null,
    fieldMappings,
    isRepeater: bindingType === 'repeater',
    itemCount: null
  }
}

export function useResolvedContent(content: string, _blockId: string): string {
  return content || ''
}

export default useBlockDataPreview
