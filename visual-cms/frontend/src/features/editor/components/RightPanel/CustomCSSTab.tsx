import React, { useState, useEffect } from 'react'
import { useAppDispatch } from '@/app/hooks'
import { updateNodeStyles } from '@/features/editor/editorSlice'
import type { BlockNode } from '@/shared/types'

interface CustomCSSTabProps {
  node: BlockNode
}

export const CustomCSSTab: React.FC<CustomCSSTabProps> = ({ node }) => {
  const dispatch = useAppDispatch()
  const [cssText, setCssText] = useState('')

  // Convert styles object to CSS text
  useEffect(() => {
    const styles = node.styles.properties || {}
    const cssString = Object.entries(styles)
      .map(([key, value]) => {
        // Convert camelCase to kebab-case
        const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
        return `${cssKey}: ${value};`
      })
      .join('\n')
    setCssText(cssString)
  }, [node.styles.properties])

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
          
          // Convert kebab-case to camelCase
          const camelKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
          newStyles[camelKey] = value
        }
      })

      dispatch(updateNodeStyles({
        id: node.id,
        properties: newStyles,
      }))
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
          onChange={(e) => setCssText(e.target.value)}
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
