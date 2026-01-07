import React, { useState } from 'react'
import { useAppDispatch } from '@/app/hooks'
import { updateNode, deleteNode } from '@/features/editor/editorSlice'
import { Input } from '@/shared/components/Input'
import { Button } from '@/shared/components/Button'
import { Trash2, Move, Palette, Type, Code } from 'lucide-react'
import type { BlockNode } from '@/shared/types'
import { PositioningTab } from './PositioningTab'
import { ColorsTab } from './ColorsTab'
import { ContentTab } from './ContentTab'
import { CustomCSSTab } from './CustomCSSTab'
import { cn } from '@/shared/utils'

interface PropertiesPanelProps {
  node: BlockNode
}

type TabType = 'positioning' | 'colors' | 'content' | 'css'

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ node }) => {
  const dispatch = useAppDispatch()
  const [activeTab, setActiveTab] = useState<TabType>('positioning')

  const handleNameChange = (name: string) => {
    dispatch(updateNode({
      id: node.id,
      updates: {
        metadata: { ...node.metadata, name },
      },
    }))
  }

  const handleDelete = () => {
    const hasChildren = node.children && node.children.length > 0
    
    if (hasChildren) {
      if (confirm(`Удалить элемент и ${node.children.length} дочерних?`)) {
        dispatch(deleteNode(node.id))
      }
    } else {
      dispatch(deleteNode(node.id))
    }
  }

  const isRootElement = !node.id.includes('-') || node.metadata.name === 'Root Container'

  const tabs = [
    { id: 'positioning' as TabType, label: 'Позиция', icon: Move },
    { id: 'colors' as TabType, label: 'Цвета', icon: Palette },
    { id: 'content' as TabType, label: 'Контент', icon: Type },
    { id: 'css' as TabType, label: 'CSS', icon: Code },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Свойства</h3>
          {!isRootElement && (
            <Button variant="ghost" size="sm" onClick={handleDelete}>
              <Trash2 size={16} className="text-red-600" />
            </Button>
          )}
        </div>

        {/* Basic Info */}
        <div className="space-y-2">
          <Input
            label="Имя элемента"
            value={node.metadata.name || ''}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder={node.tagName}
          />
          <div className="text-xs text-gray-500">
            <div className="flex justify-between py-1">
              <span>Тег:</span>
              <span className="font-mono">&lt;{node.tagName}&gt;</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors',
                activeTab === tab.id
                  ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              )}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'positioning' && <PositioningTab node={node} />}
        {activeTab === 'colors' && <ColorsTab node={node} />}
        {activeTab === 'content' && <ContentTab node={node} />}
        {activeTab === 'css' && <CustomCSSTab node={node} />}
      </div>
    </div>
  )
}
