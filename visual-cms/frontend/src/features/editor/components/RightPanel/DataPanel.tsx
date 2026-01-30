import React from 'react'
import { useAppSelector } from '@/app/hooks'
import { selectSelectedNode } from '@/features/editor/editorSlice'
import { SmartDataBindingTab } from '@/features/dataBindings/components/SmartDataBindingTab'

interface DataPanelProps {
  pageId?: string
}

export const DataPanel: React.FC<DataPanelProps> = ({ pageId }) => {
  const selectedNode = useAppSelector(selectSelectedNode)

  if (!selectedNode) {
    return (
      <div className="p-4">
        <p className="text-gray-500 text-sm">Выберите элемент</p>
      </div>
    )
  }

  // Передаём оба ID: nodeId для привязок к этой ноде
  // и linkedBlockId для привязок к библиотечному блоку
  const linkedBlockId = selectedNode.metadata?.linkedBlockId

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-gray-900">Привязка данных</h3>
      </div>
      <div className="flex-1 overflow-y-auto pl-2 pr-2">
        <SmartDataBindingTab 
          blockId={selectedNode.id} 
          linkedBlockId={linkedBlockId}
          pageId={pageId} 
        />
      </div>
    </div>
  )
}
