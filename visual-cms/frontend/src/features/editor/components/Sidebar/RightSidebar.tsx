import React from 'react'
import { Settings, FileText } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { setActiveRightPanel, selectActiveRightPanel } from '@/features/editor/editorSlice'

interface RightSidebarProps {
  mode?: 'page' | 'block'
}

export const RightSidebar: React.FC<RightSidebarProps> = ({ mode = 'block' }) => {
  const dispatch = useAppDispatch()
  const activePanel = useAppSelector(selectActiveRightPanel)

  const handlePanelClick = (panelId: string) => {
    if (activePanel === panelId) {
      dispatch(setActiveRightPanel(null))
    } else {
      dispatch(setActiveRightPanel(panelId))
    }
  }

  return (
    <div className="w-12 bg-gray-100 border-l border-gray-200 flex flex-col items-center py-2 gap-1">
      {mode === 'page' && (
        <button
          onClick={() => handlePanelClick('pageSettings')}
          className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
            activePanel === 'pageSettings' 
              ? 'bg-white shadow-sm text-gray-900 border border-gray-300' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
          title="Настройки страницы"
        >
          <FileText size={20} />
        </button>
      )}
      
      {mode === 'block' && (
        <button
          onClick={() => handlePanelClick('properties')}
          className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
            activePanel === 'properties' 
              ? 'bg-white shadow-sm text-gray-900 border border-gray-300' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
          title="Свойства элемента"
        >
          <Settings size={20} />
        </button>
      )}
    </div>
  )
}
