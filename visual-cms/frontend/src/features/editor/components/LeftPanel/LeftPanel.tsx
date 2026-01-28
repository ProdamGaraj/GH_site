import React, { useState } from 'react'
import { LayersPanel } from './LayersPanel'
import { SavedBlocksLibrary } from '../SavedBlocksLibrary/SavedBlocksLibrary'
import { Layers, Box, ChevronLeft } from 'lucide-react'
import { useAppDispatch } from '@/app/hooks'
import { setActiveLeftPanel } from '@/features/editor/editorSlice'

interface LeftPanelProps {
  mode?: 'blocks' | 'pages'
}

export const LeftPanel: React.FC<LeftPanelProps> = ({ mode = 'blocks' }) => {
  const dispatch = useAppDispatch()
  const [activeTab, setActiveTab] = useState<'layers' | 'savedBlocks'>(
    mode === 'pages' ? 'savedBlocks' : 'layers'
  )

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col relative">
      {/* Collapse button */}
      <button
        onClick={() => dispatch(setActiveLeftPanel(null))}
        className="absolute -right-3 top-4 z-10 w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
        title="Скрыть панель"
      >
        <ChevronLeft size={14} className="text-gray-600" />
      </button>
      
      {/* Header with tabs for pages mode */}
      {mode === 'pages' ? (
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'savedBlocks'
                  ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab('savedBlocks')}
            >
              <Box size={16} />
              Блоки
            </button>
            <button
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'layers'
                  ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab('layers')}
            >
              <Layers size={16} />
              Структура
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900 text-sm">Структура блока</h3>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto pl-2 pr-2">
        {mode === 'pages' ? (
          activeTab === 'savedBlocks' ? (
            <div className="p-3">
              <SavedBlocksLibrary />
            </div>
          ) : (
            <LayersPanel />
          )
        ) : (
          <LayersPanel />
        )}
      </div>
    </div>
  )
}
