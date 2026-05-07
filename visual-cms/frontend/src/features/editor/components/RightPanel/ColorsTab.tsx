import React from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { updateNodeStyles, selectViewport } from '@/features/editor/editorSlice'
import { Input } from '@/shared/components/Input'
import { ColorPicker } from '@/shared/components/ColorPicker'
import { ImageUpload } from './ImageUpload'
import type { BlockNode } from '@/shared/types'

/** Strip CSS `url("...")` wrapper, return bare URL. */
function unwrapCssUrl(raw: string): string {
  if (!raw) return ''
  const m = raw.match(/^\s*url\((['"]?)(.+?)\1\)\s*$/i)
  return m ? m[2] : raw
}

/** Wrap bare URL into CSS `url("...")` form. Empty → ''. */
function wrapCssUrl(url: string): string {
  if (!url) return ''
  if (/^\s*url\(/i.test(url)) return url
  return `url("${url}")`
}

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
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Цвет фона</label>
            <ColorPicker
              value={node.styles.properties?.backgroundColor || ''}
              onChange={(value: string) => handleStyleChange('backgroundColor', value)}
              previewElementId={node.id}
              previewProperty="backgroundColor"
            />
          </div>
          <ImageUpload
            label="Фоновое изображение"
            value={unwrapCssUrl(node.styles.properties?.backgroundImage || '')}
            onChange={(url) => handleStyleChange('backgroundImage', wrapCssUrl(url))}
            placeholder="https://example.com/image.jpg"
            kind="image"
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
        <div className="mt-2">
          <label className="text-xs text-gray-600 mb-1 block">Border Color</label>
          <ColorPicker
            value={node.styles.properties?.borderColor || ''}
            onChange={(value: string) => handleStyleChange('borderColor', value)}
            previewElementId={node.id}
            previewProperty="borderColor"
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
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Цвет текста</label>
          <ColorPicker
            value={node.styles.properties?.color || ''}
            onChange={(value: string) => handleStyleChange('color', value)}
            previewElementId={node.id}
            previewProperty="color"
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
