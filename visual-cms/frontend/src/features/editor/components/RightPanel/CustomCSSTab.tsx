import React, { useState, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { updateNodeStyles, selectViewport } from '@/features/editor/editorSlice'
import type { BlockNode } from '@/shared/types'

interface CustomCSSTabProps {
  node: BlockNode
}

export const CustomCSSTab: React.FC<CustomCSSTabProps> = ({ node }) => {
  const dispatch = useAppDispatch()
  const viewport = useAppSelector(selectViewport)
  const [cssText, setCssText] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  // Синхронизация CustomCSS с полями - показываем текущие стили
  useEffect(() => {
    if (!isEditing) {
      const styles = node.styles.properties || {}
      const cssString = Object.entries(styles)
        .map(([key, value]) => {
          // Convert camelCase to kebab-case
          const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
          return `${cssKey}: ${value};`
        })
        .join('\n')
      setCssText(cssString)
    }
  }, [node.styles.properties, isEditing])

  const handleApplyCSS = () => {
    try {
      // Parse CSS text into object
      const lines = cssText.split('\n').filter(line => line.trim())
      const newStyles: Record<string, string> = {}

      lines.forEach(line => {
        const match = line.match(/([^:]+):([^;]+);?/)
        if (match) {
          const key = match[1].trim()
          const value = match[2].trim()
          
          // Skip empty values
          if (!value) {
            return
          }
          
          // Convert kebab-case to camelCase
          const camelKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
          newStyles[camelKey] = value
        }
      })

      // Получаем все текущие ключи, чтобы удалить те, которых нет в новом CSS
      const currentKeys = Object.keys(node.styles.properties || {})
      const newKeys = Object.keys(newStyles)
      
      // Создаем объект для удаления старых ключей
      const keysToDelete = currentKeys.filter(key => !newKeys.includes(key))
      const deleteStyles: Record<string, string> = {}
      keysToDelete.forEach(key => {
        deleteStyles[key] = '' // Пустое значение удалит свойство
      })

      // Сначала удаляем старые свойства, затем устанавливаем новые
      if (Object.keys(deleteStyles).length > 0) {
        dispatch(updateNodeStyles({
          nodeId: node.id,
          properties: deleteStyles as any,
          breakpoint: viewport,
        }))
      }

      dispatch(updateNodeStyles({
        nodeId: node.id,
        properties: newStyles as any,
        breakpoint: viewport,
      }))
      
      // Stop editing mode after successful apply
      setIsEditing(false)
    } catch (error) {
      console.error('Error parsing CSS:', error)
      alert('Ошибка в CSS синтаксисе')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-700">Custom CSS</label>
          <button
            onClick={handleApplyCSS}
            className="px-3 py-1 bg-primary-600 text-white text-xs rounded hover:bg-primary-700"
          >
            Применить
          </button>
        </div>
        <textarea
          value={cssText}
          onChange={(e) => {
            setCssText(e.target.value)
            setIsEditing(true)
          }}
          placeholder="width: 100%;\nheight: auto;\nbackground-color: #ffffff;"
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 font-mono min-h-[400px] bg-white"
          spellCheck={false}
        />
        <p className="text-xs text-gray-500 mt-2">
          Формат: <code className="bg-gray-100 px-1">property: value;</code>
        </p>
      </div>

      {/* Current Styles Preview */}
      <div>
        <h4 className="text-xs font-medium text-gray-700 mb-2">Текущие стили (JSON)</h4>
        <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs overflow-auto max-h-[200px]">
          {JSON.stringify(node.styles.properties, null, 2)}
        </pre>
      </div>
    </div>
  )
}
