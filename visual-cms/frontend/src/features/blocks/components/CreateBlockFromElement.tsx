import React, { useState } from 'react'
import { Package, Sparkles } from 'lucide-react'
import type { BlockNode } from '@/shared/types'
import { apiFetch } from '@/shared/api/http'

interface CreateBlockFromElementProps {
  element: BlockNode
  onSuccess?: (blockId: string) => void
}

/**
 * Компонент для создания блока из выделенного элемента
 */
export const CreateBlockFromElement: React.FC<CreateBlockFromElementProps> = ({
  element,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [blockName, setBlockName] = useState(element.metadata?.name || 'New Block')
  const [enableTemplate, setEnableTemplate] = useState(true)

  const handleCreate = async () => {
    setLoading(true)
    try {
      const response = await apiFetch('/api/blocks/create-from-element', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: blockName,
          structure: element,
          enableTemplate,
          templateCategory: 'card',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create block')
      }

      const newBlock = await response.json()
      
      setShowDialog(false)
      alert(`✅ Блок "${blockName}" успешно создан!`)
      
      onSuccess?.(newBlock.id)
    } catch (error) {
      console.error('Error creating block:', error)
      alert('❌ Ошибка создания блока')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="w-full px-3 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
      >
        <Package size={16} />
        Создать блок из элемента
      </button>

      {showDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Создать блок из элемента
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Название блока
                </label>
                <input
                  type="text"
                  value={blockName}
                  onChange={(e) => setBlockName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Project Card"
                />
              </div>

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-purple-600" />
                    <span className="text-sm font-medium text-gray-700">
                      Включить Template режим
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableTemplate}
                      onChange={(e) => setEnableTemplate(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
                <p className="text-xs text-gray-500">
                  {enableTemplate
                    ? 'Блок сможет использоваться как Template для Repeater'
                    : 'Блок будет обычным переиспользуемым блоком'}
                </p>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Элемент:</h4>
                <div className="text-xs text-blue-700 space-y-1">
                  <div className="flex justify-between">
                    <span>Тег:</span>
                    <span className="font-mono">&lt;{element.tagName}&gt;</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Имя:</span>
                    <span className="font-medium">{element.metadata?.name || 'Без имени'}</span>
                  </div>
                  {element.children && (
                    <div className="flex justify-between">
                      <span>Дочерних элементов:</span>
                      <span className="font-medium">{element.children.length}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowDialog(false)}
                disabled={loading}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                onClick={handleCreate}
                disabled={loading || !blockName}
                className="flex-1 px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Создание...' : 'Создать блок'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
