import React from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { updateNodeStyles, selectViewport } from '@/features/editor/editorSlice'
import { Input } from '@/shared/components/Input'
import type { BlockNode } from '@/shared/types'

interface PositioningTabProps {
  node: BlockNode
}

export const PositioningTab: React.FC<PositioningTabProps> = ({ node }) => {
  const dispatch = useAppDispatch()
  const viewport = useAppSelector(selectViewport)

  const handleStyleChange = (property: string, value: string) => {
    dispatch(updateNodeStyles({
      nodeId: node.id,
      properties: { [property]: value },
      breakpoint: viewport,
    }))
  }

  const currentDisplay = node.styles.properties?.display || 'flex'

  return (
    <div className="space-y-4">
      {/* Display / Layout Mode */}
      <div>
        <label className="text-xs font-medium text-gray-700 mb-2 block">Display</label>
        <select
          value={currentDisplay}
          onChange={(e) => handleStyleChange('display', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 bg-white rounded text-sm text-gray-900"
        >
          <option value="flex">Flex</option>
          <option value="grid">Grid</option>
          <option value="block">Block</option>
          <option value="inline-block">Inline Block</option>
          <option value="inline">Inline</option>
          <option value="none">None</option>
        </select>
      </div>

      {/* Flex-specific properties */}
      {currentDisplay === 'flex' && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-gray-700">Flex свойства</h4>
          
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Flex Direction</label>
            <select
              value={node.styles.properties?.flexDirection || 'row'}
              onChange={(e) => handleStyleChange('flexDirection', e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 bg-white rounded text-sm text-gray-900"
            >
              <option value="row">Row</option>
              <option value="row-reverse">Row Reverse</option>
              <option value="column">Column</option>
              <option value="column-reverse">Column Reverse</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-600 mb-1 block">Justify Content</label>
            <select
              value={node.styles.properties?.justifyContent || 'flex-start'}
              onChange={(e) => handleStyleChange('justifyContent', e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 bg-white rounded text-sm text-gray-900"
            >
              <option value="flex-start">Flex Start</option>
              <option value="flex-end">Flex End</option>
              <option value="center">Center</option>
              <option value="space-between">Space Between</option>
              <option value="space-around">Space Around</option>
              <option value="space-evenly">Space Evenly</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-600 mb-1 block">Align Items</label>
            <select
              value={node.styles.properties?.alignItems || 'stretch'}
              onChange={(e) => handleStyleChange('alignItems', e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 bg-white rounded text-sm text-gray-900"
            >
              <option value="stretch">Stretch</option>
              <option value="flex-start">Flex Start</option>
              <option value="flex-end">Flex End</option>
              <option value="center">Center</option>
              <option value="baseline">Baseline</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-600 mb-1 block">Align Content</label>
            <select
              value={node.styles.properties?.alignContent || 'normal'}
              onChange={(e) => handleStyleChange('alignContent', e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 bg-white rounded text-sm text-gray-900"
            >
              <option value="normal">Normal</option>
              <option value="flex-start">Flex Start</option>
              <option value="flex-end">Flex End</option>
              <option value="center">Center</option>
              <option value="space-between">Space Between</option>
              <option value="space-around">Space Around</option>
              <option value="stretch">Stretch</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-600 mb-1 block">Flex Wrap</label>
            <select
              value={node.styles.properties?.flexWrap || 'nowrap'}
              onChange={(e) => handleStyleChange('flexWrap', e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 bg-white rounded text-sm text-gray-900"
            >
              <option value="nowrap">No Wrap</option>
              <option value="wrap">Wrap</option>
              <option value="wrap-reverse">Wrap Reverse</option>
            </select>
          </div>

          <Input
            label="Gap"
            value={node.styles.properties?.gap || ''}
            onChange={(e) => handleStyleChange('gap', e.target.value)}
            placeholder="0"
          />
        </div>
      )}

      {/* Grid-specific properties */}
      {currentDisplay === 'grid' && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-gray-700">Grid свойства</h4>
          
          <Input
            label="Grid Template Columns"
            value={node.styles.properties?.gridTemplateColumns || ''}
            onChange={(e) => handleStyleChange('gridTemplateColumns', e.target.value)}
            placeholder="repeat(3, 1fr)"
          />

          <Input
            label="Grid Template Rows"
            value={node.styles.properties?.gridTemplateRows || ''}
            onChange={(e) => handleStyleChange('gridTemplateRows', e.target.value)}
            placeholder="auto"
          />

          <Input
            label="Gap"
            value={node.styles.properties?.gap || ''}
            onChange={(e) => handleStyleChange('gap', e.target.value)}
            placeholder="0"
          />

          <div>
            <label className="text-xs text-gray-600 mb-1 block">Justify Items</label>
            <select
              value={node.styles.properties?.justifyItems || 'stretch'}
              onChange={(e) => handleStyleChange('justifyItems', e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 bg-white rounded text-sm text-gray-900"
            >
              <option value="stretch">Stretch</option>
              <option value="start">Start</option>
              <option value="end">End</option>
              <option value="center">Center</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-600 mb-1 block">Align Items</label>
            <select
              value={node.styles.properties?.alignItems || 'stretch'}
              onChange={(e) => handleStyleChange('alignItems', e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 bg-white rounded text-sm text-gray-900"
            >
              <option value="stretch">Stretch</option>
              <option value="start">Start</option>
              <option value="end">End</option>
              <option value="center">Center</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-600 mb-1 block">Grid Auto Flow</label>
            <select
              value={node.styles.properties?.gridAutoFlow || 'row'}
              onChange={(e) => handleStyleChange('gridAutoFlow', e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 bg-white rounded text-sm text-gray-900"
            >
              <option value="row">Row</option>
              <option value="column">Column</option>
              <option value="dense">Dense</option>
              <option value="row dense">Row Dense</option>
              <option value="column dense">Column Dense</option>
            </select>
          </div>

          <Input
            label="Grid Auto Columns"
            value={node.styles.properties?.gridAutoColumns || ''}
            onChange={(e) => handleStyleChange('gridAutoColumns', e.target.value)}
            placeholder="auto"
          />

          <Input
            label="Grid Auto Rows"
            value={node.styles.properties?.gridAutoRows || ''}
            onChange={(e) => handleStyleChange('gridAutoRows', e.target.value)}
            placeholder="auto"
          />
        </div>
      )}

      {/* Block-specific properties */}
      {(currentDisplay === 'block' || currentDisplay === 'inline-block') && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-gray-700">Block свойства</h4>
          
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Text Align</label>
            <select
              value={node.styles.properties?.textAlign || 'left'}
              onChange={(e) => handleStyleChange('textAlign', e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 bg-white rounded text-sm text-gray-900"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
              <option value="justify">Justify</option>
            </select>
          </div>

          {currentDisplay === 'inline-block' && (
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Vertical Align</label>
              <select
                value={node.styles.properties?.verticalAlign || 'baseline'}
                onChange={(e) => handleStyleChange('verticalAlign', e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 bg-white rounded text-sm text-gray-900"
              >
                <option value="baseline">Baseline</option>
                <option value="top">Top</option>
                <option value="middle">Middle</option>
                <option value="bottom">Bottom</option>
                <option value="text-top">Text Top</option>
                <option value="text-bottom">Text Bottom</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* Inline-specific properties */}
      {currentDisplay === 'inline' && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-gray-700">Inline свойства</h4>
          
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Vertical Align</label>
            <select
              value={node.styles.properties?.verticalAlign || 'baseline'}
              onChange={(e) => handleStyleChange('verticalAlign', e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 bg-white rounded text-sm text-gray-900"
            >
              <option value="baseline">Baseline</option>
              <option value="top">Top</option>
              <option value="middle">Middle</option>
              <option value="bottom">Bottom</option>
              <option value="text-top">Text Top</option>
              <option value="text-bottom">Text Bottom</option>
              <option value="sub">Sub</option>
              <option value="super">Super</option>
            </select>
          </div>
        </div>
      )}

      {/* Position */}
      <div>
        <label className="text-xs font-medium text-gray-700 mb-2 block">Position</label>
        <select
          value={node.styles.properties?.position || 'relative'}
          onChange={(e) => handleStyleChange('position', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 bg-white rounded text-sm text-gray-900"
        >
          <option value="static">Static</option>
          <option value="relative">Relative</option>
          <option value="absolute">Absolute</option>
          <option value="fixed">Fixed</option>
          <option value="sticky">Sticky</option>
        </select>
      </div>

      {/* Position offset (for positioned elements) */}
      {node.styles.properties?.position && node.styles.properties.position !== 'static' && (
        <div>
          <h4 className="text-xs font-medium text-gray-700 mb-2">Позиционирование</h4>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Top"
              value={node.styles.properties?.top || ''}
              onChange={(e) => handleStyleChange('top', e.target.value)}
              placeholder="auto"
            />
            <Input
              label="Right"
              value={node.styles.properties?.right || ''}
              onChange={(e) => handleStyleChange('right', e.target.value)}
              placeholder="auto"
            />
            <Input
              label="Bottom"
              value={node.styles.properties?.bottom || ''}
              onChange={(e) => handleStyleChange('bottom', e.target.value)}
              placeholder="auto"
            />
            <Input
              label="Left"
              value={node.styles.properties?.left || ''}
              onChange={(e) => handleStyleChange('left', e.target.value)}
              placeholder="auto"
            />
          </div>
        </div>
      )}

      {/* Dimensions */}
      <div>
        <h4 className="text-xs font-medium text-gray-700 mb-2">Размеры</h4>
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Width"
            value={node.styles.properties?.width || ''}
            onChange={(e) => handleStyleChange('width', e.target.value)}
            placeholder="auto"
          />
          <Input
            label="Height"
            value={node.styles.properties?.height || ''}
            onChange={(e) => handleStyleChange('height', e.target.value)}
            placeholder="auto"
          />
          <Input
            label="Min Width"
            value={node.styles.properties?.minWidth || ''}
            onChange={(e) => handleStyleChange('minWidth', e.target.value)}
            placeholder="0"
          />
          <Input
            label="Max Width"
            value={node.styles.properties?.maxWidth || ''}
            onChange={(e) => handleStyleChange('maxWidth', e.target.value)}
            placeholder="none"
          />
          <Input
            label="Min Height"
            value={node.styles.properties?.minHeight || ''}
            onChange={(e) => handleStyleChange('minHeight', e.target.value)}
            placeholder="0"
          />
          <Input
            label="Max Height"
            value={node.styles.properties?.maxHeight || ''}
            onChange={(e) => handleStyleChange('maxHeight', e.target.value)}
            placeholder="none"
          />
        </div>
      </div>

      {/* Spacing */}
      <div>
        <h4 className="text-xs font-medium text-gray-700 mb-2">Отступы (Padding)</h4>
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Top"
            value={node.styles.properties?.paddingTop || node.styles.properties?.padding || ''}
            onChange={(e) => handleStyleChange('paddingTop', e.target.value)}
            placeholder="0"
          />
          <Input
            label="Right"
            value={node.styles.properties?.paddingRight || node.styles.properties?.padding || ''}
            onChange={(e) => handleStyleChange('paddingRight', e.target.value)}
            placeholder="0"
          />
          <Input
            label="Bottom"
            value={node.styles.properties?.paddingBottom || node.styles.properties?.padding || ''}
            onChange={(e) => handleStyleChange('paddingBottom', e.target.value)}
            placeholder="0"
          />
          <Input
            label="Left"
            value={node.styles.properties?.paddingLeft || node.styles.properties?.padding || ''}
            onChange={(e) => handleStyleChange('paddingLeft', e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      <div>
        <h4 className="text-xs font-medium text-gray-700 mb-2">Внешние отступы (Margin)</h4>
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Top"
            value={node.styles.properties?.marginTop || node.styles.properties?.margin || ''}
            onChange={(e) => handleStyleChange('marginTop', e.target.value)}
            placeholder="0"
          />
          <Input
            label="Right"
            value={node.styles.properties?.marginRight || node.styles.properties?.margin || ''}
            onChange={(e) => handleStyleChange('marginRight', e.target.value)}
            placeholder="0"
          />
          <Input
            label="Bottom"
            value={node.styles.properties?.marginBottom || node.styles.properties?.margin || ''}
            onChange={(e) => handleStyleChange('marginBottom', e.target.value)}
            placeholder="0"
          />
          <Input
            label="Left"
            value={node.styles.properties?.marginLeft || node.styles.properties?.margin || ''}
            onChange={(e) => handleStyleChange('marginLeft', e.target.value)}
            placeholder="0"
          />
        </div>
      </div>
    </div>
  )
}
