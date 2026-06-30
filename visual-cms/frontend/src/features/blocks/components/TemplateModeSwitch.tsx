import React, { useState } from 'react'
import { Wand2, X, Sparkles, RefreshCw } from 'lucide-react'
import type { Block } from '@/shared/types'
import type { TemplateCategory } from '@/shared/types/template'
import { apiFetch } from '@/shared/api/http'

interface TemplateModeSwitchProps {
  block: Block
  onUpdate: (block: Block) => void
}

export const TemplateModeSwitch: React.FC<TemplateModeSwitchProps> = ({ block, onUpdate }) => {
  const [showDialog, setShowDialog] = useState(false)
  const [loading, setLoading] = useState(false)
  const [category, setCategory] = useState<TemplateCategory>('card')

  const handleEnableTemplate = async () => {
    setLoading(true)
    try {
      const response = await apiFetch(`/api/blocks/${block.id}/enable-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateCategory: category,
          autoDetectFields: true
        })
      })

      if (!response.ok) throw new Error('Failed to enable template mode')

      const data = await response.json()
      onUpdate(data.block)
      setShowDialog(false)
      
      // Show success notification
      console.log(data.message)
    } catch (error) {
      console.error('Error enabling template:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDisableTemplate = async () => {
    if (!confirm('Отключить Template режим? Все привязки данных сохранятся.')) return

    setLoading(true)
    try {
      const response = await apiFetch(`/api/blocks/${block.id}/disable-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) throw new Error('Failed to disable template mode')

      const data = await response.json()
      onUpdate(data.block)
    } catch (error) {
      console.error('Error disabling template:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshFields = async () => {
    setLoading(true)
    try {
      const response = await apiFetch(`/api/blocks/${block.id}/refresh-fields`, {
        method: 'POST'
      })

      if (!response.ok) throw new Error('Failed to refresh fields')

      const data = await response.json()
      onUpdate(data.block)
      
      // Show diff
      if (data.diff.added.length > 0 || data.diff.removed.length > 0) {
        console.log('Field changes:', data.diff)
        alert(
          `Обновлено полей:\n` +
          `+ Добавлено: ${data.diff.added.join(', ') || 'нет'}\n` +
          `- Удалено: ${data.diff.removed.join(', ') || 'нет'}`
        )
      } else {
        alert('Изменений в полях не обнаружено')
      }
    } catch (error) {
      console.error('Error refreshing fields:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!block.isTemplate) {
    return (
      <>
        <button
          onClick={() => setShowDialog(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors"
          title="Включить Template режим для data binding"
        >
          <Wand2 className="w-4 h-4" />
          Enable Template
        </button>

        {showDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    Включить Template режим
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Блок станет data-driven шаблоном с автоматическим определением полей
                  </p>
                </div>
                <button
                  onClick={() => setShowDialog(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Категория шаблона
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="card">Card (Карточка)</option>
                    <option value="list-item">List Item</option>
                    <option value="gallery">Gallery Item</option>
                    <option value="pricing">Pricing</option>
                    <option value="testimonial">Testimonial</option>
                    <option value="team-member">Team Member</option>
                    <option value="feature">Feature</option>
                    <option value="faq">FAQ</option>
                    <option value="blog-post">Blog Post</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Автоматически определятся:</strong>
                  </p>
                  <ul className="text-sm text-blue-700 mt-2 space-y-1">
                    <li>• Текстовые поля (для названий, описаний)</li>
                    <li>• Изображения (для картинок)</li>
                    <li>• Ссылки (для кнопок и ссылок)</li>
                  </ul>
                </div>

                <div className="flex gap-2 justify-end mt-6">
                  <button
                    onClick={() => setShowDialog(false)}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                    disabled={loading}
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleEnableTemplate}
                    disabled={loading}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        Включение...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        Включить Template
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 text-sm rounded border border-purple-300">
        <Sparkles className="w-4 h-4" />
        <span className="font-medium">Template Mode</span>
        {block.detectedFields && (
          <span className="text-xs bg-purple-200 px-2 py-0.5 rounded">
            {block.detectedFields.length} fields
          </span>
        )}
      </div>

      <button
        onClick={handleRefreshFields}
        disabled={loading}
        className="p-1.5 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
        title="Обновить detected fields"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
      </button>

      <button
        onClick={handleDisableTemplate}
        disabled={loading}
        className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
        title="Отключить Template режим"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
