import React, { useState } from 'react'
import { Download, Send } from 'lucide-react'
import { useAppSelector } from '@/app/hooks'
import { selectSelectedNode } from '@/features/editor/editorSlice'
import { SmartDataBindingTab } from '@/features/dataBindings/components/SmartDataBindingTab'
import { OutputBindingSubTab } from '@/features/dataBindings/components/OutputBindingSubTab'

interface DataPanelProps {
  pageId?: string
}

export const DataPanel: React.FC<DataPanelProps> = ({ pageId }) => {
  const selectedNode = useAppSelector(selectSelectedNode)
  const [dataSubTab, setDataSubTab] = useState<'input' | 'output'>('input')

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
      <div className="p-4 pb-2 border-b border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-gray-900 mb-3">Привязка данных</h3>
        {/* Sub-tab switcher */}
        <div className="flex gap-1 bg-gray-200 rounded-lg p-0.5">
          <button
            onClick={() => setDataSubTab('input')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              dataSubTab === 'input'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Download size={13} />
            Получение
          </button>
          <button
            onClick={() => setDataSubTab('output')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              dataSubTab === 'output'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Send size={13} />
            Отправка
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pl-2 pr-2">
        {dataSubTab === 'input' ? (
          <SmartDataBindingTab 
            blockId={selectedNode.id} 
            linkedBlockId={linkedBlockId}
            pageId={pageId} 
          />
        ) : (
          <OutputBindingSubTab
            blockId={selectedNode.id}
            pageId={pageId}
          />
        )}
      </div>
    </div>
  )
}
