import React from 'react'
import { useAppSelector } from '@/app/hooks'
import { selectSelectedNode } from '@/features/editor/editorSlice'
import { ScriptsTab } from './ScriptsTab'
import { GlobalAssetEditor, LinkedBlockAssetEditor, type AssetScope } from './GlobalAssetEditor'

/** @param editorType — см. CSSPanel: «JS блока» только в редакторе страницы. */
export const ScriptsPanel: React.FC<{ editorType?: AssetScope }> = ({ editorType }) => {
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
        <h3 className="font-semibold text-gray-900">Скрипты</h3>
      </div>
      <div className="flex-1 overflow-y-auto pl-2 pr-2">
        <ScriptsTab node={selectedNode} />
        {editorType === 'page' && <LinkedBlockAssetEditor field="globalJs" />}
        <GlobalAssetEditor field="globalJs" scope={editorType} />
      </div>
    </div>
  )
}
