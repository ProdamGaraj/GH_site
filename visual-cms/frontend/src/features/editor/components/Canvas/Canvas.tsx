import React from 'react'
import { useAppSelector } from '@/app/hooks'
import { selectRootNode } from '@/features/editor/editorSlice'
import { CanvasRenderer } from './CanvasRenderer'

export const Canvas: React.FC = () => {
  const rootNode = useAppSelector(selectRootNode)

  if (!rootNode) {
    return <div>Loading...</div>
  }

  return (
    <div className="flex-1 bg-gray-100 p-8 overflow-auto">
      <div className="mx-auto" style={{ maxWidth: '1200px' }}>
        <CanvasRenderer node={rootNode} />
      </div>
    </div>
  )
}
