import React from 'react'
import { useAppSelector } from '@/app/hooks'
import { selectSelectedNode } from '@/features/editor/editorSlice'
import { AnimationsTab } from './AnimationsTab'

export const AnimationsPanel: React.FC = () => {
  const selectedNode = useAppSelector(selectSelectedNode)

  if (!selectedNode) {
    return (
      <div className="p-4">
        <p className="text-gray-500 text-sm">Выберите элемент</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-gray-900">Анимации</h3>
      </div>
      <div className="flex-1 overflow-y-auto pl-2 pr-2">
        <AnimationsTab node={selectedNode} />
      </div>
    </div>
  )
}
