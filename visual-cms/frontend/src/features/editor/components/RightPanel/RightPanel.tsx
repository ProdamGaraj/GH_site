import React, { useState } from 'react'
import { useAppSelector, useAppDispatch } from '@/app/hooks'
import { selectSelectedNode, selectInlineBlockEdit, selectRootNode, finishInlineBlockEdit, cancelInlineBlockEdit, updateNode } from '@/features/editor/editorSlice'
import { PropertiesPanel } from './PropertiesPanel'
import { Button } from '@/shared/components/Button'
import { Save, Copy, X, Loader2, Check } from 'lucide-react'
import { blockApi, pageApi, CreateBlockDto, UpdateBlockDto } from '@/shared/api'
import type { BlockNode, EditorPageSettings } from '@/shared/types'

interface RightPanelProps {
  pageSettings?: EditorPageSettings
  onPageSettingsChange?: (settings: EditorPageSettings) => void
  pageId?: string // ID страницы для сохранения
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

// Рекурсивно собрать все блоки с linkedBlockId (для обновления в библиотеке)
const collectLinkedBlocks = (node: BlockNode): { blockId: string, structure: BlockNode }[] => {
  const results: { blockId: string, structure: BlockNode }[] = []
  
  // Если у этого узла есть linkedBlockId, добавляем его
  if (node.metadata?.linkedBlockId) {
    results.push({
      blockId: node.metadata.linkedBlockId,
      structure: node
    })
  }
  
  // Рекурсивно проверяем детей
  for (const child of node.children || []) {
    results.push(...collectLinkedBlocks(child))
  }
  
  return results
}

export const RightPanel: React.FC<RightPanelProps> = ({ pageSettings, onPageSettingsChange, pageId }) => {
  const selectedNode = useAppSelector(selectSelectedNode)
  const rootNode = useAppSelector(selectRootNode)
  const inlineBlockEdit = useAppSelector(selectInlineBlockEdit)
  const dispatch = useAppDispatch()
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [saveMessage, setSaveMessage] = useState('')
  
  // Check if selected node is the root element
  const isPageRoot = selectedNode?.id === rootNode?.id
  
  // Режим редактирования блоков активен
  const isBlockEditMode = inlineBlockEdit.active
  
  // В режиме блоков используем текущий выбранный узел для редактирования
  const editingBlock = selectedNode

  // Функция для очистки _viewportId из структуры блока
  const cleanNode = (n: BlockNode): BlockNode => {
    const { _viewportId, ...rest } = n as any
    return {
      ...rest,
      children: n.children?.map(cleanNode) || []
    }
  }
  
  // Функция для обновления linkedBlockId в дереве
  const updateLinkedBlockIdInTree = (node: BlockNode, oldId: string, newId: string): BlockNode => {
    const updatedNode = { ...node }
    if (updatedNode.metadata?.linkedBlockId === oldId) {
      updatedNode.metadata = { ...updatedNode.metadata, linkedBlockId: newId }
    }
    updatedNode.children = node.children.map(child => updateLinkedBlockIdInTree(child, oldId, newId))
    return updatedNode
  }
  
  // Сохранить страницу в БД с обновлённой структурой
  const savePageWithUpdatedStructure = async (updatedRootNode: BlockNode) => {
    if (!pageId || !pageSettings) {
      console.warn('Нет pageId или pageSettings, страница не будет сохранена в БД')
      return
    }
    
    try {
      await pageApi.update(pageId, {
        structure: cleanNode(updatedRootNode),
        name: pageSettings.name,
        slug: pageSettings.slug,
      })
      console.log('Страница сохранена в БД')
    } catch (err) {
      console.error('Ошибка сохранения страницы:', err)
      throw err
    }
  }

  const showSaveStatus = (status: 'success' | 'error', message: string) => {
    setSaveStatus(status)
    setSaveMessage(message)
    setTimeout(() => {
      setSaveStatus('idle')
      setSaveMessage('')
    }, 3000)
  }

  // Сохранить в библиотеку - ОБНОВЛЯЕТ существующие блоки (рекурсивно)
  const handleSaveToLibrary = async () => {
    if (!editingBlock || !rootNode) {
      console.error('handleSaveToLibrary: editingBlock или rootNode отсутствует')
      return
    }
    
    const linkedBlockId = editingBlock.metadata?.linkedBlockId
    
    console.log('editingBlock:', editingBlock)
    console.log('editingBlock.metadata:', editingBlock.metadata)
    console.log('linkedBlockId:', linkedBlockId)
    
    if (!linkedBlockId) {
      showSaveStatus('error', 'Этот блок не связан с библиотекой. Используйте "Сохранить копию для страницы".')
      return
    }
    
    console.log('Начинаем обновление блока в библиотеке:', linkedBlockId)
    
    try {
      setIsSaving(true)
      setSaveStatus('saving')
      
      // Собираем все вложенные блоки с linkedBlockId для рекурсивного обновления
      const linkedBlocks = collectLinkedBlocks(editingBlock)
      console.log(`Найдено ${linkedBlocks.length} связанных блоков для обновления:`, linkedBlocks)
      
      // Обновляем все связанные блоки
      let updatedCount = 0
      let createdCount = 0
      let updatedRootNode = rootNode
      const linkUpdates: { oldId: string; newId: string; nodeId: string }[] = []
      
      for (const { blockId, structure } of linkedBlocks) {
        try {
          // Сначала проверяем существует ли блок
          try {
            await blockApi.getById(blockId)
          } catch (checkErr: any) {
            if (checkErr.message?.includes('404')) {
              // Блок был удалён - создаём новый
              console.log(`Блок ${blockId} не найден, создаём новый...`)
              const blockName = structure.metadata?.name || structure.tagName || 'Блок'
              const newBlock = await blockApi.create({
                name: blockName,
                type: 'section',
                structure: cleanNode(structure),
                isReusable: true,
                tags: ['restored']
              })
              
              // Запоминаем обновление для применения к дереву
              linkUpdates.push({ oldId: blockId, newId: newBlock.id, nodeId: structure.id })
              
              // Обновляем linkedBlockId на новый в Redux
              dispatch(updateNode({
                id: structure.id,
                updates: {
                  metadata: {
                    ...structure.metadata,
                    linkedBlockId: newBlock.id
                  }
                }
              }))
              
              // Обновляем локальную копию rootNode для сохранения в БД
              updatedRootNode = updateLinkedBlockIdInTree(updatedRootNode, blockId, newBlock.id)
              
              createdCount++
              console.log(`Создан новый блок ${newBlock.id} взамен удалённого ${blockId}`)
              continue
            }
            throw checkErr
          }
          
          // Блок существует - обновляем его
          const updateData: UpdateBlockDto = {
            structure: cleanNode(structure)
          }
          console.log(`Обновляем блок ${blockId}...`)
          await blockApi.update(blockId, updateData)
          updatedCount++
          console.log(`Обновлён блок ${blockId}`)
        } catch (err) {
          console.error(`Ошибка обновления блока ${blockId}:`, err)
        }
      }
      
      // ВСЕГДА сохраняем страницу с текущей структурой (включая изменения в блоках)
      if (pageId && rootNode) {
        console.log('Сохраняем страницу с обновлённой структурой...')
        await savePageWithUpdatedStructure(updatedRootNode)
      }
      
      let message = ''
      if (updatedCount > 0) message += `Обновлено ${updatedCount} блок(ов)`
      if (createdCount > 0) message += `, создано ${createdCount} новых`
      message += '. Страница сохранена.'
      if (updatedCount === 0 && createdCount === 0) message = 'Нет блоков для обновления, но страница сохранена.'
      
      showSaveStatus('success', message)
      
      setTimeout(() => {
        dispatch(finishInlineBlockEdit())
      }, 500)
      
    } catch (error) {
      console.error('Ошибка сохранения блока:', error)
      showSaveStatus('error', 'Не удалось обновить блок: ' + (error as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  // Сохранить только для этой страницы - СОЗДАЁТ новый блок с уникальным именем
  const handleSaveForPageOnly = async () => {
    if (!editingBlock || !rootNode) {
      console.error('handleSaveForPageOnly: editingBlock или rootNode отсутствует')
      return
    }
    
    console.log('Сохраняем изменения только для этой страницы')
    
    try {
      setIsSaving(true)
      setSaveStatus('saving')
      
      const blockName = editingBlock.metadata?.name || editingBlock.tagName || 'Блок'
      const pageName = pageSettings?.name || 'Страница'
      
      // Экранируем спецсимволы в имени для regex
      const escapedBlockName = blockName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const escapedPageName = pageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      
      // Получаем все блоки чтобы найти следующий номер
      const allBlocks = await blockApi.getAll()
      const pattern = new RegExp(`^${escapedBlockName}-${escapedPageName}-(\\d+)$`)
      
      let maxNumber = 0
      for (const block of allBlocks) {
        const match = block.name.match(pattern)
        if (match) {
          const num = parseInt(match[1], 10)
          if (num > maxNumber) maxNumber = num
        }
      }
      
      const newBlockName = `${blockName}-${pageName}-${maxNumber + 1}`
      
      const blockData: CreateBlockDto = {
        name: newBlockName,
        type: 'section',
        structure: cleanNode(editingBlock),
        isReusable: true,
        tags: ['page-specific', pageName]
      }
      
      console.log('Создаём новый блок:', newBlockName)
      
      const createdBlock = await blockApi.create(blockData)
      
      const oldLinkedBlockId = editingBlock.metadata?.linkedBlockId
      
      // Обновляем linkedBlockId в Redux
      dispatch(updateNode({
        id: editingBlock.id,
        updates: {
          metadata: {
            ...editingBlock.metadata,
            linkedBlockId: createdBlock.id
          }
        }
      }))
      
      // Сохраняем страницу в БД с новым linkedBlockId
      if (pageId) {
        let updatedRootNode = rootNode
        if (oldLinkedBlockId) {
          updatedRootNode = updateLinkedBlockIdInTree(rootNode, oldLinkedBlockId, createdBlock.id)
        } else {
          // Если не было старого linkedBlockId, обновляем напрямую узел
          const updateNodeInTree = (node: BlockNode): BlockNode => {
            if (node.id === editingBlock.id) {
              return {
                ...node,
                metadata: {
                  ...node.metadata,
                  linkedBlockId: createdBlock.id
                }
              }
            }
            return {
              ...node,
              children: node.children.map(updateNodeInTree)
            }
          }
          updatedRootNode = updateNodeInTree(rootNode)
        }
        
        console.log('Сохраняем страницу с новым linkedBlockId...')
        await savePageWithUpdatedStructure(updatedRootNode)
      }
      
      showSaveStatus('success', `Создан блок "${newBlockName}" и страница сохранена!`)
      
      setTimeout(() => {
        dispatch(finishInlineBlockEdit())
      }, 500)
      
    } catch (error) {
      console.error('Ошибка сохранения:', error)
      showSaveStatus('error', 'Не удалось сохранить изменения')
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
      {/* Статус сохранения */}
      {saveStatus !== 'idle' && (
        <div className={`p-3 text-sm flex items-center gap-2 ${
          saveStatus === 'saving' ? 'bg-blue-100 text-blue-800' :
          saveStatus === 'success' ? 'bg-green-100 text-green-800' :
          'bg-red-100 text-red-800'
        }`}>
          {saveStatus === 'saving' && <Loader2 size={14} className="animate-spin" />}
          {saveStatus === 'success' && <Check size={14} />}
          {saveStatus === 'error' && <X size={14} />}
          {saveMessage}
        </div>
      )}
      
      {/* Кнопки сохранения при inline-редактировании */}
      {isBlockEditMode && editingBlock && (
        <div className="p-4 border-b border-gray-200 bg-blue-50 space-y-3">
          <div className="text-sm font-medium text-blue-900">
            Режим редактирования блока
          </div>
          <div className="text-xs text-blue-700">
            Блок: {editingBlock.metadata?.name || editingBlock.tagName || 'Без имени'}
          </div>
          
          {editingBlock.metadata?.linkedBlockId && (
            <div className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
              🔗 Связан с библиотекой
            </div>
          )}
          
          {/* Кнопка обновления в библиотеке */}
          <div>
            <Button
              onClick={handleSaveToLibrary}
              disabled={isSaving || !editingBlock.metadata?.linkedBlockId}
              className="w-full bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              size="sm"
            >
              {isSaving ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Save size={14} className="mr-2" />}
              Обновить в библиотеке
            </Button>
            <p className="text-xs text-gray-500 mt-1">
              {editingBlock.metadata?.linkedBlockId 
                ? 'Обновит этот блок и все вложенные в библиотеке'
                : 'Блок не связан с библиотекой'}
            </p>
          </div>
          
          {/* Кнопка сохранения копии для страницы */}
          <div>
            <Button
              onClick={handleSaveForPageOnly}
              disabled={isSaving}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
              size="sm"
            >
              {isSaving ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Copy size={14} className="mr-2" />}
              Сохранить копию для страницы
            </Button>
            <p className="text-xs text-gray-500 mt-1">
              Создаст новый блок: {editingBlock.metadata?.name || 'Блок'}-{pageSettings?.name || 'Страница'}-N
            </p>
          </div>
          
          <Button
            onClick={handleCancel}
            disabled={isSaving}
            className="w-full bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
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
            disabled={isSaving}
            className="w-full bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
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
