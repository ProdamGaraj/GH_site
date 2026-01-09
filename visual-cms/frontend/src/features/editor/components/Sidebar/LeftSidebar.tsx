import React from 'react'
import { Layers, Box, Package } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { setActiveLeftPanel, selectActiveLeftPanel } from '@/features/editor/editorSlice'

interface LeftSidebarProps {
  mode?: 'page' | 'block'
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ mode = 'block' }) => {
  const dispatch = useAppDispatch()
  const activePanel = useAppSelector(selectActiveLeftPanel)

  const handlePanelClick = (panelId: string) => {
    if (activePanel === panelId) {
      dispatch(setActiveLeftPanel(null))
    } else {
      dispatch(setActiveLeftPanel(panelId))
    }
  }

  return (
    <div className="w-12 bg-gray-100 border-r border-gray-200 flex flex-col items-center py-2 gap-1">
      {/* Layers/Structure */}
      <button
        onClick={() => handlePanelClick('layers')}
        className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
          activePanel === 'layers' 
            ? 'bg-white shadow-sm text-gray-900 border border-gray-300' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
        }`}
        title="Структура"
      >
        <Layers size={20} />
      </button>

      {/* Library */}
      <button
        onClick={() => handlePanelClick('library')}
        className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
          activePanel === 'library' 
            ? 'bg-white shadow-sm text-gray-900 border border-gray-300' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
        }`}
        title="Библиотека элементов"
      >
        <Package size={20} />
      </button>

      {/* Saved Blocks (only for pages) */}
      {mode === 'page' && (
        <button
          onClick={() => handlePanelClick('savedBlocks')}
          className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
            activePanel === 'savedBlocks' 
              ? 'bg-white shadow-sm text-gray-900 border border-gray-300' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
          title="Сохраненные блоки"
        >
          <Box size={20} />
        </button>
      )}
    </div>
  )
}
