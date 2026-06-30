import React, { useState } from 'react'
import { Sparkles, XCircle } from 'lucide-react'
import type { Block } from '@/shared/types'
import { apiFetch } from '@/shared/api/http'

interface TemplateQuickToggleProps {
  block: Block
  onUpdate: () => void
}

/**
 * Компактная кнопка для быстрого управления Template режимом на странице листинга
 */
export const TemplateQuickToggle: React.FC<TemplateQuickToggleProps> = ({ block, onUpdate }) => {
  const [loading, setLoading] = useState(false)

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation() // Не переходить в редактор при клике
    e.preventDefault()

    if (block.isTemplate) {
      // Отключаем Template режим
      if (!confirm(
        `Отключить Template режим для "${block.name}"?\n\n` +
        'Последствия:\n' +
        '• Все Data Binding привязки будут удалены\n' +
        `• Обнаруженные поля (${block.detectedFields?.length || 0}) будут сброшены\n` +
        '• Template метаданные будут удалены'
      )) {
        return
      }

      setLoading(true)
      try {
        const response = await apiFetch(`/api/blocks/${block.id}/disable-template`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })

        if (!response.ok) {
          throw new Error('Failed to disable template mode')
        }

        onUpdate()
      } catch (error) {
        console.error('Error disabling template:', error)
        alert('❌ Ошибка отключения Template режима')
      } finally {
        setLoading(false)
      }
    } else {
      // Включаем Template режим
      setLoading(true)
      try {
        const response = await apiFetch(`/api/blocks/${block.id}/enable-template`, {
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

        onUpdate()
      } catch (error) {
        console.error('Error enabling template:', error)
        alert('❌ Ошибка включения Template режима')
      } finally {
        setLoading(false)
      }
    }
  }

  if (block.isTemplate) {
    // Показываем кнопку отключения для Template блоков
    return (
      <button
        onClick={handleToggle}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-purple-50 border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition-colors"
        title="Отключить Template режим"
      >
        <XCircle size={14} />
        <span>{loading ? 'Отключение...' : 'Отключить Template'}</span>
      </button>
    )
  }

  // Показываем кнопку включения для обычных блоков
  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-50 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
      title="Включить Template режим"
    >
      <Sparkles size={14} />
      <span>{loading ? 'Включение...' : 'Включить Template'}</span>
    </button>
  )
}
