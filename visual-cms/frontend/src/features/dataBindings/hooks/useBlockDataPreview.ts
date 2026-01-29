import { useMemo } from 'react'
import { useAppSelector } from '@/app/hooks'
import { selectAllBindings } from '../dataBindingsSlice'
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
  inputConfig?: {
    mode?: 'single' | 'repeater'
    templateId?: string
    fieldMappings?: Array<{ sourceField: string; targetProperty: string }>
  }
  sourceConfig?: {
    alias?: string
    pageDataSourceId?: string
    fieldMappings?: Array<{ sourceField: string; targetProperty: string }>
  }
}

/**
 * Хук для получения превью данных привязанных к блоку
 * @param linkedBlockId - Опциональный ID библиотечного блока (привязка может быть по этому ID)
 */
export function useBlockDataPreview(blockId: string, _pageId?: string, linkedBlockId?: string): BlockDataPreviewResult {
  // Получаем все биндинги напрямую (не через createSelector в функции)
  const allBindings = useAppSelector(selectAllBindings)
  
  // Фильтруем биндинги в useMemo для стабильности
  const bindings = useMemo(() => {
    return allBindings.filter(b => 
      b.isActive !== false && 
      (b.blockId === blockId || (linkedBlockId && b.blockId === linkedBlockId))
    )
  }, [allBindings, blockId, linkedBlockId])

  // Debug log - для отслеживания загрузки биндингов
  if (blockId.includes('1769405707337') || blockId.includes('1769591959232') || blockId === 'Projects Grid') {
    console.log('[useBlockDataPreview] Checking block:', { 
      blockId, 
      linkedBlockId, 
      bindingsCount: bindings?.length, 
      bindings,
      allBindingsCount: allBindings.length,
      allBindingBlockIds: allBindings.map(b => b.blockId)
    })
  }

  const mainBinding = useMemo((): DataBinding | undefined => {
    if (!bindings || !Array.isArray(bindings)) return undefined
    return bindings.find((b: DataBinding) => {
      const config = b.config as BindingConfig | undefined
      const inputMode = config?.inputConfig?.mode
      return b.bindingType === 'input' || inputMode === 'repeater' || config?.mode === 'repeater'
    })
  }, [bindings])

  const bindingType = useMemo((): 'input' | 'output' | 'repeater' | null => {
    if (!mainBinding) return null
    const config = mainBinding.config as BindingConfig | undefined
    const inputMode = config?.inputConfig?.mode
    if (inputMode === 'repeater' || config?.mode === 'repeater') return 'repeater'
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
