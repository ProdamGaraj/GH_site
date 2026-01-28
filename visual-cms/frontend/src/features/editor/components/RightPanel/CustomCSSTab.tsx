import React, { useState, useEffect, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { updateNodeStyles, selectViewport } from '@/features/editor/editorSlice'
import { Copy, Wand2, Trash2 } from 'lucide-react'
import type { BlockNode } from '@/shared/types'

interface CustomCSSTabProps {
  node: BlockNode
}

export const CustomCSSTab: React.FC<CustomCSSTabProps> = ({ node }) => {
  const dispatch = useAppDispatch()
  const viewport = useAppSelector(selectViewport)
  const [cssText, setCssText] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Синхронизация CustomCSS с полями - показываем текущие стили
  useEffect(() => {
    if (!isEditing) {
      const styles = node.styles.properties || {}
      const cssString = Object.entries(styles)
        .map(([key, value]) => {
          // Convert camelCase to kebab-case
          const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
          return `  ${cssKey}: ${value};`
        })
        .join('\n')
      setCssText(cssString)
    }
  }, [node.styles.properties, isEditing])

  // Копировать CSS
  const copyCSS = useCallback(() => {
    navigator.clipboard.writeText(cssText)
  }, [cssText])

  // Сбросить CSS
  const resetCSS = useCallback(() => {
    setCssText('')
    setIsEditing(true)
    setError(null)
  }, [])

  // Форматировать CSS
  const formatCSS = useCallback(() => {
    try {
      const lines = cssText.split('\n').filter(line => line.trim())
      const formatted = lines.map(line => {
        const match = line.match(/([^:]+):([^;]+);?/)
        if (match) {
          const key = match[1].trim()
          const value = match[2].trim()
          return `  ${key}: ${value};`
        }
        return line
      }).join('\n')
      setCssText(formatted)
    } catch {
      // Игнорируем ошибки форматирования
    }
  }, [cssText])

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
      setError(null)
    } catch (err) {
      console.error('Error parsing CSS:', err)
      setError('Ошибка в CSS синтаксисе')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-700">Custom CSS</label>
          <div className="flex items-center gap-1">
            <button
              onClick={formatCSS}
              className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
              title="Форматировать"
            >
              <Wand2 className="w-4 h-4" />
            </button>
            <button
              onClick={copyCSS}
              className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
              title="Копировать"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={resetCSS}
              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
              title="Сбросить"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleApplyCSS}
              className="px-3 py-1 bg-primary-600 text-white text-xs rounded hover:bg-primary-700 ml-2"
            >
              Применить
            </button>
          </div>
        </div>
        
        {/* Monaco Editor */}
        <div className="border border-gray-300 rounded overflow-hidden">
          <Editor
            height="350px"
            defaultLanguage="css"
            value={cssText}
            onChange={(value) => {
              setCssText(value || '')
              setIsEditing(true)
            }}
            theme="vs-light"
            options={{
              minimap: { enabled: false },
              lineNumbers: 'on',
              glyphMargin: false,
              folding: false,
              lineDecorationsWidth: 4,
              lineNumbersMinChars: 3,
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              fontSize: 12,
              tabSize: 2,
              automaticLayout: true,
              padding: { top: 8, bottom: 8 },
              renderLineHighlight: 'line',
              fixedOverflowWidgets: true,
              scrollbar: {
                vertical: 'auto',
                horizontal: 'auto',
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
              },
            }}
          />
        </div>
        
        {/* Error message */}
        {error && (
          <p className="mt-2 text-xs text-red-500">{error}</p>
        )}
        
        <p className="text-xs text-gray-500 mt-2">
          Формат: <code className="bg-gray-100 px-1 rounded">property: value;</code> — нажмите "Применить" для сохранения
        </p>
      </div>

      {/* Current Styles Preview */}
      <div>
        <h4 className="text-xs font-medium text-gray-700 mb-2">Текущие стили (JSON)</h4>
        <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs overflow-auto max-h-[200px] text-gray-900">
          {JSON.stringify(node.styles.properties, null, 2)}
        </pre>
      </div>
    </div>
  )
}
