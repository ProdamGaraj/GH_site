import React from 'react'
import { FileText, Move, Palette, Type, MousePointer, Zap, Code2, Database, Info, Languages, History, GalleryHorizontal } from 'lucide-react'
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
      
      {/* Basic Settings - always first */}
      <button
        onClick={() => handlePanelClick('basicSettings')}
        className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
          activePanel === 'basicSettings' 
            ? 'bg-white shadow-sm text-gray-900 border border-gray-300' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
        }`}
        title="Основные настройки"
      >
        <Info size={20} />
      </button>
      
      <div className="h-px w-8 bg-gray-300 my-1" />
      
      {/* Panel buttons */}
      <button
        onClick={() => handlePanelClick('positioning')}
        className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
          activePanel === 'positioning'
            ? 'bg-white shadow-sm text-gray-900 border border-gray-300' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
        }`}
        title="Позиция и размеры"
      >
        <Move size={20} />
      </button>
      
      <button
        onClick={() => handlePanelClick('colors')}
        className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
          activePanel === 'colors'
            ? 'bg-white shadow-sm text-gray-900 border border-gray-300' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
        }`}
        title="Цвета"
      >
        <Palette size={20} />
      </button>
      
      <button
        onClick={() => handlePanelClick('content')}
        className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
          activePanel === 'content'
            ? 'bg-white shadow-sm text-gray-900 border border-gray-300' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
        }`}
        title="Контент и текст"
      >
        <Type size={20} />
      </button>
      
      <button
        onClick={() => handlePanelClick('states')}
        className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
          activePanel === 'states'
            ? 'bg-white shadow-sm text-gray-900 border border-gray-300' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
        }`}
        title="Hover и состояния"
      >
        <MousePointer size={20} />
      </button>
      
      <button
        onClick={() => handlePanelClick('animations')}
        className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
          activePanel === 'animations'
            ? 'bg-white shadow-sm text-gray-900 border border-gray-300' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
        }`}
        title="Анимации"
      >
        <Zap size={20} />
      </button>
      
      <button
        onClick={() => handlePanelClick('scripts')}
        className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
          activePanel === 'scripts'
            ? 'bg-white shadow-sm text-gray-900 border border-gray-300' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
        }`}
        title="Скрипты"
      >
        <Code2 size={20} />
      </button>
      
      <button
        onClick={() => handlePanelClick('data')}
        className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
          activePanel === 'data'
            ? 'bg-white shadow-sm text-gray-900 border border-gray-300' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
        }`}
        title="Привязка данных"
      >
        <Database size={20} />
      </button>
      
      <button
        onClick={() => handlePanelClick('slides')}
        className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
          activePanel === 'slides'
            ? 'bg-white shadow-sm text-gray-900 border border-gray-300' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
        }`}
        title="Слайды карусели"
      >
        <GalleryHorizontal size={20} />
      </button>
      
      {mode === 'page' && (
        <button
          onClick={() => handlePanelClick('translations')}
          className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
            activePanel === 'translations'
              ? 'bg-white shadow-sm text-blue-600 border border-blue-300' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
          title="Переводы"
        >
          <Languages size={20} />
        </button>
      )}
      
      {mode === 'page' && (
        <button
          onClick={() => handlePanelClick('versionHistory')}
          className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
            activePanel === 'versionHistory'
              ? 'bg-white shadow-sm text-amber-600 border border-amber-300' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
          title="История версий"
        >
          <History size={20} />
        </button>
      )}
      
      <button
        onClick={() => handlePanelClick('css')}
        className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
          activePanel === 'css'
            ? 'bg-white shadow-sm text-gray-900 border border-gray-300' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
        }`}
        title="CSS код"
      >
        <Code2 size={20} />
      </button>
    </div>
  )
}
