import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { 
  DndContext, 
  DragEndEvent, 
  DragStartEvent,
  DragOverEvent,
  useSensor, 
  useSensors, 
  PointerSensor, 
  MouseSensor,
  pointerWithin,
} from '@dnd-kit/core'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { createNewEditor, selectRootNode, addNode } from '@/features/editor/editorSlice'
import { Header } from '@/shared/components/Header'
import { EditorToolbar } from '@/features/editor/components/EditorToolbar'
import { Canvas } from '@/features/editor/components/Canvas/Canvas'
import { LeftPanel } from '@/features/editor/components/LeftPanel/LeftPanel'
import { RightPanel } from '@/features/editor/components/RightPanel/RightPanel'
import { LibraryPanel } from '@/features/editor/components/LibraryPanel/LibraryPanel'
import type { DragItem } from '@/shared/types'

interface EditorProps {
  type: 'page' | 'block'
}

export const Editor: React.FC<EditorProps> = ({ type }) => {
  const { id } = useParams()
  const dispatch = useAppDispatch()
  const rootNode = useAppSelector(selectRootNode)
  const [isLibraryOpen, setIsLibraryOpen] = useState(true)

  useEffect(() => {
    console.log('Editor mounted, id:', id, 'type:', type)
    // Если id === 'new' или id === undefined, создаем новый редактор
    if (!id || id === 'new') {
      console.log('Creating new editor')
      dispatch(createNewEditor())
    } else {
      // TODO: Загрузить существующую страницу/блок по ID
      console.log('Loading existing editor with id:', id)
      // dispatch(loadEditor(id))
    }
  }, [id, dispatch])

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    console.log('🎯 Drag START:', event.active.id, event.active.data.current)
  }

  const handleDragOver = (event: DragOverEvent) => {
    console.log('🔄 Drag OVER:', event.over?.id)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    console.log('✅ Drag END:', event)
    const { active, over } = event

    if (!over) {
      console.log('❌ No drop target')
      return
    }

    const draggedData = active.data.current as DragItem
    const dropTargetId = over.id as string

    console.log('📦 Dragged data:', draggedData)
    console.log('🎯 Drop target:', dropTargetId)

    if (draggedData?.type === 'library-item') {
      console.log('➕ Adding node to parent:', dropTargetId)
      dispatch(addNode({
        parentId: dropTargetId,
        node: {
          elementType: draggedData.elementType,
          tagName: draggedData.tagName,
          metadata: {
            name: draggedData.label,
          },
        },
      }))
    }
  }

  console.log('Editor render, rootNode:', rootNode)

  if (!rootNode) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-500">Загрузка редактора...</p>
          <p className="text-xs text-gray-400 mt-2">id: {id || 'new'}</p>
        </div>
      </div>
    )
  }

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="h-screen flex flex-col bg-gray-100">
        <Header showActions={<EditorToolbar type={type} />} />
        
        <div className="flex-1 flex overflow-hidden">
          <LeftPanel />
          <LibraryPanel 
            isOpen={isLibraryOpen} 
            onToggle={() => setIsLibraryOpen(!isLibraryOpen)} 
          />
          <Canvas />
          <RightPanel />
        </div>
      </div>
    </DndContext>
  )
}
