import React from 'react'
import { useAppDispatch } from '@/app/hooks'
import { updateNode, updateNodeStyles } from '@/features/editor/editorSlice'
import { Input } from '@/shared/components/Input'
import type { BlockNode } from '@/shared/types'

interface ContentTabProps {
  node: BlockNode
}

export const ContentTab: React.FC<ContentTabProps> = ({ node }) => {
  const dispatch = useAppDispatch()

  const handleContentChange = (content: string) => {
    dispatch(updateNode({
      id: node.id,
      updates: { content },
    }))
  }

  const handleStyleChange = (property: string, value: string) => {
    dispatch(updateNodeStyles({
      id: node.id,
      properties: { [property]: value },
    }))
  }

  // Show content editor for text elements
  const isTextElement = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'button'].includes(node.tagName || '')
  
  return (
    <div className="space-y-4">
      {/* Content */}
      {isTextElement && (
        <div>
          <label className="text-xs font-medium text-gray-700 mb-2 block">Текст</label>
          <textarea
            value={node.content || ''}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Введите текст..."
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 min-h-[80px]"
          />
        </div>
      )}

      {/* Typography */}
      <div>
        <h4 className="text-xs font-medium text-gray-700 mb-2">Типографика</h4>
        <div className="space-y-2">
          <Input
            label="Font Family"
            value={node.styles.properties?.fontFamily || ''}
            onChange={(e) => handleStyleChange('fontFamily', e.target.value)}
            placeholder="inherit"

          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Font Size"
              value={node.styles.properties?.fontSize || ''}
              onChange={(e) => handleStyleChange('fontSize', e.target.value)}
              placeholder="16px"

            />
            <Input
              label="Font Weight"
              value={node.styles.properties?.fontWeight || ''}
              onChange={(e) => handleStyleChange('fontWeight', e.target.value)}
              placeholder="400"

            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Line Height"
              value={node.styles.properties?.lineHeight || ''}
              onChange={(e) => handleStyleChange('lineHeight', e.target.value)}
              placeholder="1.5"

            />
            <Input
              label="Letter Spacing"
              value={node.styles.properties?.letterSpacing || ''}
              onChange={(e) => handleStyleChange('letterSpacing', e.target.value)}
              placeholder="0"

            />
          </div>
        </div>
      </div>

      {/* Text Align */}
      <div>
        <label className="text-xs font-medium text-gray-700 mb-2 block">Выравнивание</label>
        <div className="flex gap-2">
          {['left', 'center', 'right', 'justify'].map((align) => (
            <button
              key={align}
              onClick={() => handleStyleChange('textAlign', align)}
              className={`flex-1 px-3 py-2 text-xs border rounded ${
                node.styles.properties?.textAlign === align
                  ? 'bg-primary-100 border-primary-300'
                  : 'bg-white border-gray-300 hover:bg-gray-50'
              }`}
            >
              {align}
            </button>
          ))}
        </div>
      </div>

      {/* Text Decoration */}
      <div>
        <label className="text-xs font-medium text-gray-700 mb-2 block">Декорация</label>
        <div className="flex gap-2">
          {['none', 'underline', 'line-through'].map((decoration) => (
            <button
              key={decoration}
              onClick={() => handleStyleChange('textDecoration', decoration)}
              className={`flex-1 px-3 py-2 text-xs border rounded ${
                node.styles.properties?.textDecoration === decoration
                  ? 'bg-primary-100 border-primary-300'
                  : 'bg-white border-gray-300 hover:bg-gray-50'
              }`}
            >
              {decoration}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
