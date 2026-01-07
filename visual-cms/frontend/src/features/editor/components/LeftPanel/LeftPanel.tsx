import React from 'react'
import { LayersPanel } from './LayersPanel'

export const LeftPanel: React.FC = () => {
  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-gray-900 text-sm">Структура страницы</h3>
      </div>

      {/* Layers */}
      <div className="flex-1 overflow-y-auto">
        <LayersPanel />
      </div>
    </div>
  )
}
