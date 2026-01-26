import React, { useState } from 'react'
import { Sparkles, XCircle, AlertTriangle, CheckCircle } from 'lucide-react'

interface TemplateBlockControlsProps {
  blockId: string
  blockName: string
  isTemplate: boolean
  templateCategory?: string
  detectedFieldsCount: number
  onToggle?: () => void
}

/**
 * Компонент для управления Template режимом блока
 * Показывает статус и позволяет включить/отключить Template режим
 */
export const TemplateBlockControls: React.FC<TemplateBlockControlsProps> = ({
  blockId,
  blockName,
  isTemplate,
  templateCategory,
  detectedFieldsCount,
  onToggle,
}) => {
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleEnable = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/blocks/${blockId}/enable-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateCategory: 'custom',
          autoDetectFields: true,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to enable template mode')
      }

      onToggle?.()
    } catch (error) {
      console.error('Error enabling template:', error)
      alert('❌ Ошибка включения Template режима')
    } finally {
      setLoading(false)
    }
  }

  const handleDisable = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/blocks/${blockId}/disable-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        throw new Error('Failed to disable template mode')
      }

      setShowConfirm(false)
      onToggle?.()
    } catch (error) {
      console.error('Error disabling template:', error)
      alert('❌ Ошибка отключения Template режима')
    } finally {
      setLoading(false)
    }
  }

  if (!isTemplate) {
    // Блок не в Template режиме - показываем кнопку включения
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">Template режим отключен</p>
              <p className="text-xs text-gray-500">
                Включите для использования с Data Binding
              </p>
            </div>
          </div>
          <button
            onClick={handleEnable}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? 'Включение...' : 'Включить Template'}
          </button>
        </div>
      </div>
    )
  }

  // Блок в Template режиме - показываем статус и кнопку отключения
  return (
    <>
      <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
        <div className="flex flex-col center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sparkles size={18} className="text-purple-600 mt-0.5" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium text-purple-900">Template режим активен</p>
                <CheckCircle size={14} className="text-green-600" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-purple-700">
                  <span className="font-medium">Категория:</span> {templateCategory || 'custom'}
                </p>
                <p className="text-xs text-purple-700">
                  <span className="font-medium">Обнаружено полей:</span> {detectedFieldsCount}
                </p>
                <p className="text-xs text-purple-600">
                  Блок можно использовать с Data Binding для динамического контента
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            className="px-3 py-1.5 bg-white border border-purple-300 text-purple-700 text-sm font-medium rounded-lg hover:bg-purple-100 flex items-center gap-1.5"
          >
            <XCircle size={14} />
            Отключить
          </button>
        </div>
      </div>

      {/* Диалог подтверждения */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle size={24} className="text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Отключить Template режим?
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Блок <span className="font-medium">"{blockName}"</span> больше не будет доступен как шаблон для Data Binding.
                  </p>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="text-xs text-orange-800">
                      <strong>Последствия:</strong>
                    </p>
                    <ul className="text-xs text-orange-700 mt-1 space-y-1 list-disc list-inside">
                      <li>Все Data Binding привязки к этому блоку будут удалены</li>
                      <li>Обнаруженные поля ({detectedFieldsCount}) будут сброшены</li>
                      <li>Template метаданные будут удалены</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200"
                >
                  Отмена
                </button>
                <button
                  onClick={handleDisable}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Отключение...' : 'Отключить Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
