import React from 'react'
import { useAppSelector } from '@/app/hooks'
import { selectSelectedNode } from '@/features/editor/editorSlice'
import { PropertiesPanel } from './PropertiesPanel'

export const RightPanel: React.FC = () => {
  const selectedNode = useAppSelector(selectSelectedNode)

  return (
    <>
      {selectedNode ? (
        <PropertiesPanel node={selectedNode} />
      ) : (
        <div className="p-8 text-center">
          <p className="text-sm text-gray-500">
            Выберите элемент для редактирования его свойств
          </p>
        </div>
      )}
    </>
  )
}
