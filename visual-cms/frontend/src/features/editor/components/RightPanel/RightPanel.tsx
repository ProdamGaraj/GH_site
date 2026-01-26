import React from 'react'
import { useAppSelector, useAppDispatch } from '@/app/hooks'
import { selectSelectedNode, selectInlineBlockEdit, selectRootNode, cancelInlineBlockEdit } from '@/features/editor/editorSlice'
import { PropertiesPanel } from './PropertiesPanel'
import { Button } from '@/shared/components/Button'
import { X } from 'lucide-react'
import type { EditorPageSettings } from '@/shared/types'

interface RightPanelProps {
  pageSettings?: EditorPageSettings
  onPageSettingsChange?: (settings: EditorPageSettings) => void
  pageId?: string
  currentBlockData?: any // Данные блока для показа Template информации
}

export const RightPanel: React.FC<RightPanelProps> = ({ pageSettings, onPageSettingsChange, pageId, currentBlockData }) => {
  const selectedNode = useAppSelector(selectSelectedNode)
  const rootNode = useAppSelector(selectRootNode)
  const inlineBlockEdit = useAppSelector(selectInlineBlockEdit)
  const dispatch = useAppDispatch()
  
  // Check if selected node is the root element
  const isPageRoot = selectedNode?.id === rootNode?.id
  
  // Режим редактирования блоков активен
  const isBlockEditMode = inlineBlockEdit.active
  
  // В режиме блоков используем текущий выбранный узел для редактирования
  const editingBlock = selectedNode

  const handleCancel = () => {
    dispatch(cancelInlineBlockEdit())
  }

  return (
    <>
      {/* Информация при режиме редактирования блока */}
      {isBlockEditMode && editingBlock && (
        <div className="p-4 border-b border-gray-200 bg-blue-50 space-y-3">
          <div className="text-sm font-medium text-blue-900">
            Режим редактирования блока
          </div>
          <div className="text-xs text-blue-700">
            Блок: {editingBlock.metadata?.name || editingBlock.tagName || 'Без имени'}
          </div>
          
          {editingBlock.metadata?.linkedBlockId ? (
            <div className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
              🔗 Связан с библиотекой
            </div>
          ) : (
            <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              Не связан с библиотекой
            </div>
          )}
          
          <div className="text-xs text-gray-500 mt-2">
            Используйте кнопки в header для сохранения:
            <br />• <strong>В библиотеку</strong> - обновит блоки в библиотеке
            <br />• <strong>Только страница</strong> - сохранит только страницу
          </div>
          
          <Button
            onClick={handleCancel}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
            size="sm"
          >
            <X size={14} className="mr-2" />
            Отменить изменения
          </Button>
        </div>
      )}
      
      {/* Режим редактирования блоков активен, но блок не выбран */}
      {isBlockEditMode && !editingBlock && (
        <div className="p-4 border-b border-gray-200 bg-blue-50 space-y-3">
          <div className="text-sm font-medium text-blue-900">
            Режим редактирования блока
          </div>
          <div className="text-xs text-blue-700">
            Кликните на блок на холсте для редактирования
          </div>
          
          <Button
            onClick={handleCancel}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
            size="sm"
          >
            <X size={14} className="mr-2" />
            Выйти из режима
          </Button>
        </div>
      )}
    
      {selectedNode ? (
        <PropertiesPanel 
          node={selectedNode} 
          isPageRoot={isPageRoot}
          pageSettings={pageSettings}
          onPageSettingsChange={onPageSettingsChange}
          pageId={pageId}
          currentBlockData={currentBlockData}
        />
      ) : (
        <div className="p-8 text-center">
          <p className="text-sm text-gray-500">
            Выберите элемент для редактирования его свойств
          </p>
        </div>
      )}
    </>
  )
}
