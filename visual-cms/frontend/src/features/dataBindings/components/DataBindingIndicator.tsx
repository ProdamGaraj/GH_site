import React from 'react'
import { Database, RefreshCw, List, ArrowRight } from 'lucide-react'
import { useBlockDataPreview } from '../hooks'

interface DataBindingIndicatorProps {
  blockId: string
  pageId?: string
  className?: string
  showDetails?: boolean
}

/**
 * Индикатор привязки данных для элемента в Canvas
 * Показывает иконку и тултип с информацией о привязке
 */
export const DataBindingIndicator: React.FC<DataBindingIndicatorProps> = ({
  blockId,
  pageId,
  className = '',
  showDetails = false
}) => {
  const {
    hasBinding,
    bindingType,
    dataSourceAlias,
    isLoading,
    isRepeater,
    itemCount
  } = useBlockDataPreview(blockId, pageId)

  if (!hasBinding) return null

  const getIcon = () => {
    if (isLoading) return <RefreshCw size={12} className="animate-spin" />
    if (isRepeater) return <List size={12} />
    return <Database size={12} />
  }

  const getColor = () => {
    switch (bindingType) {
      case 'repeater':
        return 'bg-purple-500 text-white'
      case 'input':
        return 'bg-blue-500 text-white'
      case 'output':
        return 'bg-green-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const getTitle = () => {
    const parts: string[] = []
    
    if (bindingType === 'repeater') {
      parts.push('Repeater')
      if (itemCount !== null) {
        parts.push(`(${itemCount} items)`)
      }
    } else if (bindingType === 'input') {
      parts.push('Data Binding')
    } else if (bindingType === 'output') {
      parts.push('Output Binding')
    }
    
    if (dataSourceAlias) {
      parts.push(`← ${dataSourceAlias}`)
    }
    
    return parts.join(' ')
  }

  return (
    <div 
      className={`
        absolute -top-1 -right-1 z-20
        flex items-center gap-1 px-1.5 py-0.5 rounded-full
        text-[10px] font-medium shadow-sm
        ${getColor()}
        ${className}
      `}
      title={getTitle()}
    >
      {getIcon()}
      
      {showDetails && (
        <>
          {dataSourceAlias && (
            <span className="max-w-[80px] truncate">
              {dataSourceAlias}
            </span>
          )}
          
          {isRepeater && itemCount !== null && (
            <span className="opacity-75">×{itemCount}</span>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Развёрнутая панель информации о привязке данных
 */
export const DataBindingInfoPanel: React.FC<DataBindingIndicatorProps> = ({
  blockId,
  pageId
}) => {
  const {
    hasBinding,
    dataSourceAlias,
    isLoading,
    error,
    previewData,
    fieldMappings,
    isRepeater,
    itemCount
  } = useBlockDataPreview(blockId, pageId)

  if (!hasBinding) return null

  // Явная типизация для TypeScript
  const mappingsEntries: [string, string][] = Object.entries(fieldMappings)
  const mappingsCount = Object.keys(fieldMappings).length

  return (
    <div className="absolute left-full top-0 ml-2 z-30 w-64 bg-white rounded-lg shadow-lg border border-gray-200 text-xs">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-2">
          {isRepeater ? (
            <List size={14} className="text-purple-500" />
          ) : (
            <Database size={14} className="text-blue-500" />
          )}
          <span className="font-medium text-gray-900">
            {isRepeater ? 'Repeater Binding' : 'Data Binding'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        {/* Source */}
        {dataSourceAlias && (
          <div className="flex items-center gap-2 text-gray-600">
            <span className="text-gray-400">Source:</span>
            <code className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">
              {dataSourceAlias}
            </code>
          </div>
        )}

        {/* Repeater info */}
        {isRepeater && itemCount !== null && (
          <div className="flex items-center gap-2 text-gray-600">
            <span className="text-gray-400">Items:</span>
            <span className="font-medium">{itemCount}</span>
          </div>
        )}

        {/* Field mappings */}
        {mappingsCount > 0 ? (
          <div className="space-y-1">
            <span className="text-gray-400">Mappings:</span>
            <div className="pl-2 space-y-1">
              {mappingsEntries.slice(0, 3).map(([target, source]) => (
                <div key={target} className="flex items-center gap-1 text-gray-600">
                  <code className="text-green-600">{source}</code>
                  <ArrowRight size={10} className="text-gray-400" />
                  <code className="text-purple-600">{target}</code>
                </div>
              ))}
              {mappingsCount > 3 ? (
                <div className="text-gray-400">
                  +{mappingsCount - 3} more...
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Loading/Error state */}
        {isLoading && (
          <div className="flex items-center gap-2 text-blue-600">
            <RefreshCw size={12} className="animate-spin" />
            <span>Loading data...</span>
          </div>
        )}

        {error && (
          <div className="text-red-600 bg-red-50 px-2 py-1 rounded">
            {error}
          </div>
        )}

        {/* Preview data */}
        {previewData !== null && previewData !== undefined && !isLoading ? (
          <div className="space-y-1">
            <span className="text-gray-400">Preview:</span>
            <pre className="p-2 bg-gray-50 rounded text-[10px] max-h-20 overflow-auto">
              {JSON.stringify(previewData, null, 2).slice(0, 200)}
              {JSON.stringify(previewData).length > 200 ? '...' : ''}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default DataBindingIndicator
