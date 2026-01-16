import React, { useState } from 'react'
import { useAppSelector, useAppDispatch } from '@/app/hooks'
import { selectSelectedNode, selectInlineBlockEdit, selectRootNode, finishInlineBlockEdit, cancelInlineBlockEdit, updateNode } from '@/features/editor/editorSlice'
import { PropertiesPanel } from './PropertiesPanel'
import { Button } from '@/shared/components/Button'
import { Save, Copy, X } from 'lucide-react'
import { blockApi, CreateBlockDto } from '@/shared/api'
import type { BlockNode, EditorPageSettings } from '@/shared/types'

interface RightPanelProps {
  pageSettings?: EditorPageSettings
  onPageSettingsChange?: (settings: EditorPageSettings) => void
}

// Рекурсивный поиск узла по id
const findNodeById = (node: BlockNode, id: string): BlockNode | null => {
  if (node.id === id) return node
  for (const child of node.children) {
    const found = findNodeById(child, id)
    if (found) return found
  }
  return null
}

export const RightPanel: React.FC<RightPanelProps> = ({ pageSettings, onPageSettingsChange }) => {
  const selectedNode = useAppSelector(selectSelectedNode)
  const rootNode = useAppSelector(selectRootNode)
  const inlineBlockEdit = useAppSelector(selectInlineBlockEdit)
  const dispatch = useAppDispatch()
  const [isSaving, setIsSaving] = useState(false)
  
  // Check if selected node is the root element
  const isPageRoot = selectedNode?.id === rootNode?.id
  
  // Находим редактируемый блок (не выбранный элемент, а сам блок)
  const editingBlock = inlineBlockEdit.nodeId && rootNode 
    ? findNodeById(rootNode, inlineBlockEdit.nodeId) 
    : null

  // Функция для очистки _viewportId из структуры блока
  const cleanNode = (n: BlockNode): BlockNode => {
    const { _viewportId, ...rest } = n as any
    return {
      ...rest,
      children: n.children?.map(cleanNode) || []
    }
  }

  const handleSaveToLibrary = async () => {
    // Сохраняем весь редактируемый блок, а не выбранный элемент
    if (!editingBlock || !inlineBlockEdit.nodeId) return
    
    try {
      setIsSaving(true)
      
      const blockName = editingBlock.metadata?.name || editingBlock.tagName || 'Блок'
      
      const blockData: CreateBlockDto = {
        name: `${blockName} (обновлён)`,
        type: 'section',
        structure: cleanNode(editingBlock),
        isReusable: true,
        tags: ['edited-inline']
      }
      
      // Создаём новый блок в библиотеке
      const createdBlock = await blockApi.create(blockData)
      
      // Обновляем metadata блока, чтобы отметить связь с библиотекой
      dispatch(updateNode({
        id: editingBlock.id,
        updates: {
          metadata: {
            ...editingBlock.metadata,
            linkedBlockId: createdBlock.id
          }
        }
      }))
      
      dispatch(finishInlineBlockEdit())
      alert('Блок сохранён в библиотеку!')
    } catch (error) {
      console.error('Ошибка сохранения блока:', error)
      alert('Не удалось сохранить блок: ' + (error as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveForPageOnly = async () => {
    if (!inlineBlockEdit.nodeId) return
    
    try {
      setIsSaving(true)
      
      // Просто завершаем редактирование - изменения уже применены к странице
      dispatch(finishInlineBlockEdit())
      alert('Изменения сохранены для этой страницы!')
    } catch (error) {
      console.error('Ошибка сохранения:', error)
      alert('Не удалось сохранить изменения')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (confirm('Отменить все изменения?')) {
      dispatch(cancelInlineBlockEdit())
    }
  }

  return (
    <>
      {/* Кнопки сохранения при inline-редактировании */}
      {inlineBlockEdit.nodeId && editingBlock && (
        <div className="p-4 border-b border-gray-200 bg-blue-50 space-y-2">
          <div className="text-sm font-medium text-blue-900 mb-1">
            Режим редактирования блока
          </div>
          <div className="text-xs text-blue-700 mb-3">
            Блок: {editingBlock.metadata?.name || editingBlock.tagName || 'Без имени'}
          </div>
          
          <Button
            onClick={handleSaveToLibrary}
            disabled={isSaving}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            size="sm"
          >
            <Save size={14} className="mr-2" />
            Сохранить в библиотеку
          </Button>
          
          <Button
            onClick={handleSaveForPageOnly}
            disabled={isSaving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            <Copy size={14} className="mr-2" />
            Сохранить для этой страницы
          </Button>
          
          <Button
            onClick={handleCancel}
            disabled={isSaving}
            // variant="outline"
            className="w-full bg-red-600 hover:bg-red-700 text-white"
            size="sm"
          >
            <X size={14} className="mr-2" />
            Отменить изменения
          </Button>
        </div>
      )}
    
      {selectedNode ? (
        <PropertiesPanel 
          node={selectedNode} 
          isPageRoot={isPageRoot}
          pageSettings={pageSettings}
          onPageSettingsChange={onPageSettingsChange}
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
