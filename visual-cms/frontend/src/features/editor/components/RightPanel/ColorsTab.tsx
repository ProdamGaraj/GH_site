import React from 'react'
import { useAppDispatch } from '@/app/hooks'
import { updateNodeStyles } from '@/features/editor/editorSlice'
import { Input } from '@/shared/components/Input'
import type { BlockNode } from '@/shared/types'

interface ColorsTabProps {
  node: BlockNode
}

export const ColorsTab: React.FC<ColorsTabProps> = ({ node }) => {
  const dispatch = useAppDispatch()

  const handleStyleChange = (property: string, value: string) => {
    dispatch(updateNodeStyles({
      id: node.id,
      properties: { [property]: value },
    }))
  }

  return (
    <div className="space-y-4">
      {/* Background */}
      <div>
        <h4 className="text-xs font-medium text-gray-700 mb-2">Фон</h4>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              label="Цвет фона"
              value={node.styles.properties?.backgroundColor || ''}
              onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
              placeholder="#ffffff"

            />
            <input
              type="color"
              value={node.styles.properties?.backgroundColor || '#ffffff'}
              onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
              className="w-12 h-9 mt-5 border border-gray-300 rounded cursor-pointer"
            />
          </div>
          <Input
            label="Background Image"
            value={node.styles.properties?.backgroundImage || ''}
            onChange={(e) => handleStyleChange('backgroundImage', e.target.value)}
            placeholder="url()"

          />
        </div>
      </div>

      {/* Border */}
      <div>
        <h4 className="text-xs font-medium text-gray-700 mb-2">Границы</h4>
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Border Width"
            value={node.styles.properties?.borderWidth || node.styles.properties?.border?.split(' ')[0] || ''}
            onChange={(e) => handleStyleChange('borderWidth', e.target.value)}
            placeholder="1px"

          />
          <Input
            label="Border Style"
            value={node.styles.properties?.borderStyle || 'solid'}
            onChange={(e) => handleStyleChange('borderStyle', e.target.value)}
            placeholder="solid"

          />
        </div>
        <div className="flex gap-2 mt-2">
          <Input
            label="Border Color"
            value={node.styles.properties?.borderColor || ''}
            onChange={(e) => handleStyleChange('borderColor', e.target.value)}
            placeholder="#000000"

          />
          <input
            type="color"
            value={node.styles.properties?.borderColor || '#000000'}
            onChange={(e) => handleStyleChange('borderColor', e.target.value)}
            className="w-12 h-9 mt-5 border border-gray-300 rounded cursor-pointer"
          />
        </div>
        <Input
          label="Border Radius"
          value={node.styles.properties?.borderRadius || ''}
          onChange={(e) => handleStyleChange('borderRadius', e.target.value)}
          placeholder="0"

          className="mt-2"
        />
      </div>

      {/* Text Color */}
      <div>
        <h4 className="text-xs font-medium text-gray-700 mb-2">Текст</h4>
        <div className="flex gap-2">
          <Input
            label="Цвет текста"
            value={node.styles.properties?.color || ''}
            onChange={(e) => handleStyleChange('color', e.target.value)}
            placeholder="#000000"

          />
          <input
            type="color"
            value={node.styles.properties?.color || '#000000'}
            onChange={(e) => handleStyleChange('color', e.target.value)}
            className="w-12 h-9 mt-5 border border-gray-300 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Opacity */}
      <div>
        <label className="text-xs font-medium text-gray-700 mb-2 block">Прозрачность</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={node.styles.properties?.opacity || '1'}
          onChange={(e) => handleStyleChange('opacity', e.target.value)}
          className="w-full"
        />
        <div className="text-xs text-gray-500 text-center">{node.styles.properties?.opacity || '1'}</div>
      </div>
    </div>
  )
}
