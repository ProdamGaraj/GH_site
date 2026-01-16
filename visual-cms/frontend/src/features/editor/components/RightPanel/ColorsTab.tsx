import React from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { updateNodeStyles, selectViewport } from '@/features/editor/editorSlice'
import { Input } from '@/shared/components/Input'
import type { BlockNode } from '@/shared/types'

interface ColorsTabProps {
  node: BlockNode
}

export const ColorsTab: React.FC<ColorsTabProps> = ({ node }) => {
  const dispatch = useAppDispatch()
  const viewport = useAppSelector(selectViewport)

  const handleStyleChange = (property: string, value: string) => {
    dispatch(updateNodeStyles({
      nodeId: node.id,
      properties: { [property]: value },
      breakpoint: viewport,
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
              placeholder="rgba(255, 255, 255, 1) или #ffffff"
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
            value={node.styles.properties?.borderStyle || ''}
            onChange={(e) => handleStyleChange('borderStyle', e.target.value)}
            placeholder="solid"
          />
        </div>
        <div className="flex gap-2 mt-2">
          <Input
            label="Border Color"
            value={node.styles.properties?.borderColor || ''}
            onChange={(e) => handleStyleChange('borderColor', e.target.value)}
            placeholder="rgba(0, 0, 0, 1) или #000000"
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
            placeholder="rgba(0, 0, 0, 1) или #000000"
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
          value={node.styles.properties?.opacity || ''}
          onChange={(e) => handleStyleChange('opacity', e.target.value)}
          className="w-full"
        />
        <div className="text-xs text-gray-500 text-center">{node.styles.properties?.opacity || ''}</div>
      </div>
    </div>
  )
}
