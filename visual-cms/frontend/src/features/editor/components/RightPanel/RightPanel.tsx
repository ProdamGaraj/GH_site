import React, { useState } from 'react'
import { useAppSelector, useAppDispatch } from '@/app/hooks'
import { selectSelectedNode, selectInlineBlockEdit, finishInlineBlockEdit, cancelInlineBlockEdit, updateNode } from '@/features/editor/editorSlice'
import { PropertiesPanel } from './PropertiesPanel'
import { Button } from '@/shared/components/Button'
import { Save, Copy, X } from 'lucide-react'
import { blockApi, CreateBlockDto, UpdateBlockDto } from '@/shared/api'
import type { BlockNode } from '@/shared/types'

export const RightPanel: React.FC = () => {
  const selectedNode = useAppSelector(selectSelectedNode)
  const inlineBlockEdit = useAppSelector(selectInlineBlockEdit)
  const dispatch = useAppDispatch()
  const [isSaving, setIsSaving] = useState(false)

  // Функция для очистки _viewportId из структуры блока
  const cleanNode = (n: BlockNode): BlockNode => {
    const { _viewportId, ...rest } = n as any
    return {
      ...rest,
      children: n.children?.map(cleanNode) || []
    }
  }

  const handleSaveToLibrary = async () => {
    if (!selectedNode || !inlineBlockEdit.nodeId) return
    
    try {
      setIsSaving(true)
      
      const blockName = selectedNode.metadata?.name || selectedNode.tagName || 'Блок'
      
      const blockData: CreateBlockDto = {
        name: `${blockName} (обновлён)`,
        type: 'section',
        structure: cleanNode(selectedNode),
        isReusable: true,
        tags: ['edited-inline']
      }
      
      // Создаём новый блок в библиотеке
      const createdBlock = await blockApi.create(blockData)
      
      // Обновляем metadata блока, чтобы отметить связь с библиотекой
      dispatch(updateNode({
        id: selectedNode.id,
        updates: {
          metadata: {
            ...selectedNode.metadata,
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
    if (!selectedNode || !inlineBlockEdit.nodeId) return
    
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
      {inlineBlockEdit.nodeId && selectedNode && (
        <div className="p-4 border-b border-gray-200 bg-blue-50 space-y-2">
          <div className="text-sm font-medium text-blue-900 mb-3">
            Режим редактирования блока
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
            Сохранить только для страницы
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
        <PropertiesPanel node={selectedNode} />
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
