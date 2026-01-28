import React from 'react'
import { Info, Tag, Box, Hash, Lock, Globe, Monitor } from 'lucide-react'
import type { BlockNode } from '@/shared/types'
import { cn } from '@/shared/utils'

interface BlockBasicInfoProps {
  node: BlockNode
  isRootElement?: boolean
  nodeBreakpoint?: {
    id: string
    name: string
    width: number
    color?: string
    icon?: string
  } | null
  isBaseElement?: boolean
}

export const BlockBasicInfo: React.FC<BlockBasicInfoProps> = ({
  node,
  isRootElement = false,
  nodeBreakpoint,
  isBaseElement = false
}) => {
  const getElementTypeName = (type: string) => {
    const typeNames: Record<string, string> = {
      container: 'Контейнер',
      element: 'Элемент',
      text: 'Текст',
      media: 'Медиа',
      form: 'Форма'
    }
    return typeNames[type] || type
  }

  return (
    <div className="p-4 space-y-4 text-sm">
      <div className="flex items-center gap-2 text-base font-medium text-gray-900 mb-4">
        <Info size={18} className="text-primary-600" />
        <span>Информация о блоке</span>
      </div>

      {/* Element ID */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase">
          <Hash size={12} />
          <span>ID элемента</span>
        </div>
        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded font-mono text-xs text-gray-700 break-all">
          {node.id}
        </div>
      </div>

      {/* Element Type */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase">
          <Box size={12} />
          <span>Тип элемента</span>
        </div>
        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-gray-700">
          {getElementTypeName(node.elementType)}
        </div>
      </div>

      {/* HTML Tag */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase">
          <Tag size={12} />
          <span>HTML тег</span>
        </div>
        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded font-mono text-gray-700">
          &lt;{node.tagName}&gt;
        </div>
      </div>

      {/* Element Name */}
      {node.metadata?.name && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase">
            <Tag size={12} />
            <span>Название</span>
          </div>
          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-gray-700">
            {node.metadata.name}
          </div>
        </div>
      )}

      {/* Viewport Info */}
      {!isRootElement && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase">
            {isBaseElement ? <Globe size={12} /> : <Monitor size={12} />}
            <span>Viewport</span>
          </div>
          <div className={cn(
            "px-3 py-2 border rounded",
            isBaseElement 
              ? "bg-gray-100 border-gray-200 text-gray-700"
              : "bg-primary-50 border-primary-200 text-primary-700"
          )}>
            {isBaseElement ? (
              <span>Все viewport'ы</span>
            ) : nodeBreakpoint ? (
              <div className="flex items-center gap-2">
                <span className="font-medium">{nodeBreakpoint.name}</span>
                <span className="text-xs opacity-70">({nodeBreakpoint.width}px)</span>
              </div>
            ) : (
              <span>Неизвестный viewport</span>
            )}
          </div>
        </div>
      )}

      {/* Locked Status */}
      {node.metadata?.locked && (
        <div className="px-3 py-2 bg-orange-50 border border-orange-200 rounded">
          <div className="flex items-center gap-2 text-orange-700">
            <Lock size={14} />
            <span className="font-medium">Заблокирован</span>
          </div>
          <p className="text-xs text-orange-600 mt-1">
            Элемент защищён от изменений
          </p>
        </div>
      )}

      {/* Children Count */}
      {node.children && node.children.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase">
            <Box size={12} />
            <span>Дочерние элементы</span>
          </div>
          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-gray-700">
            {node.children.length} {node.children.length === 1 ? 'элемент' : 'элементов'}
          </div>
        </div>
      )}

      {/* Linked Block Info */}
      {node.metadata?.linkedBlockId && (
        <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded">
          <div className="flex items-center gap-2 text-blue-700">
            <Box size={14} />
            <span className="font-medium">Связан с библиотекой</span>
          </div>
          <p className="text-xs text-blue-600 mt-1 font-mono break-all">
            {node.metadata.linkedBlockId}
          </p>
        </div>
      )}
    </div>
  )
}
