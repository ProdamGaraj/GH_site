import React from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { updateNode, selectSelectedNode } from '@/features/editor/editorSlice'
import { Input } from '@/shared/components/Input'
import { BlockInfoSection } from './BlockInfoSection'

interface BasicSettingsPanelProps {
  pageId?: string
}

export const BasicSettingsPanel: React.FC<BasicSettingsPanelProps> = ({ pageId }) => {
  const dispatch = useAppDispatch()
  const selectedNode = useAppSelector(selectSelectedNode)

  if (!selectedNode) {
    return (
      <div className="p-4">
        <p className="text-gray-500 text-sm">Выберите элемент для настройки</p>
      </div>
    )
  }

  const handleNameChange = (name: string) => {
    dispatch(updateNode({
      id: selectedNode.id,
      updates: {
        metadata: { ...selectedNode.metadata, name },
      },
    }))
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-gray-900">Основные настройки</h3>
      </div>

      {/* Block Info Section - показываем если блок связан с библиотекой */}
      <BlockInfoSection node={selectedNode} pageId={pageId} />

      {/* Element Name */}
      <div className="p-4 border-b border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Имя элемента
        </label>
        <Input
          value={selectedNode.metadata?.name || ''}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Введите имя элемента"
        />
        <p className="text-xs text-gray-500 mt-1">
          Используется для идентификации элемента в структуре
        </p>
      </div>

      {/* Element Info */}
      <div className="p-4 space-y-3">
        <div>
          <span className="text-xs font-medium text-gray-500">ID элемента:</span>
          <p className="text-sm text-gray-900 font-mono mt-0.5">{selectedNode.id}</p>
        </div>
        
        <div>
          <span className="text-xs font-medium text-gray-500">Тег:</span>
          <p className="text-sm text-gray-900 mt-0.5">{selectedNode.tag || 'div'}</p>
        </div>
        
        {selectedNode.children && selectedNode.children.length > 0 && (
          <div>
            <span className="text-xs font-medium text-gray-500">Дочерних элементов:</span>
            <p className="text-sm text-gray-900 mt-0.5">{selectedNode.children.length}</p>
          </div>
        )}
      </div>
    </div>
  )
}
