import React from 'react'
import { Link as LinkIcon } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { updateNode, wrapNodeInLink, unwrapNodeFromLink, selectSelectedNode, selectRootNode } from '@/features/editor/editorSlice'
import { Input } from '@/shared/components/Input'
import { BlockInfoSection } from './BlockInfoSection'
import { LinkSettings } from './LinkSettings'
import { findParentNode } from '@/features/editor/utils/treeUtils'
import {
  isBlockLink,
  canBeLink,
  isVoidTag,
  isLinkWrapper,
  makeNodeLink,
  unmakeNodeLink,
  hasLinkDescendant,
  hasLinkAncestor,
} from '@/features/editor/utils/linkUtils'

interface BasicSettingsPanelProps {
  pageId?: string
}

export const BasicSettingsPanel: React.FC<BasicSettingsPanelProps> = ({ pageId }) => {
  const dispatch = useAppDispatch()
  const selectedNode = useAppSelector(selectSelectedNode)
  const rootNode = useAppSelector(selectRootNode)

  if (!selectedNode) {
    return (
      <div className="p-4">
        <p className="text-gray-500 text-sm">Выберите элемент для настройки</p>
      </div>
    )
  }

  const handleNameChange = (name: string) => {
    dispatch(updateNode({
      id: selectedNode.id,
      updates: {
        metadata: { ...selectedNode.metadata, name },
      },
    }))
  }

  // Инлайн-ссылка настраивается во вкладке «Контент» — секцию не показываем
  const showLinkSection = canBeLink(selectedNode)
  // Void-элементы (img, input…) делаются ссылкой через обёртку <a>, остальные — сменой тега
  const isVoid = isVoidTag(selectedNode)
  const wrapper = isVoid && rootNode ? findParentNode(rootNode, selectedNode.id) : null
  const isLink = isVoid ? isLinkWrapper(wrapper) : isBlockLink(selectedNode)
  // Узел, на котором живут href/target: для void-элемента это обёртка
  const linkNode = isVoid ? wrapper : selectedNode
  const nestedLinkWarning = isLink
    ? null
    : hasLinkDescendant(selectedNode)
      ? 'Внутри блока уже есть ссылка — вложенные ссылки дадут невалидный HTML.'
      : hasLinkAncestor(rootNode, selectedNode.id)
        ? 'Блок находится внутри ссылки — вложенные ссылки дадут невалидный HTML.'
        : null

  const handleLinkToggle = (enabled: boolean) => {
    if (isVoid) {
      dispatch(enabled ? wrapNodeInLink(selectedNode.id) : unwrapNodeFromLink(selectedNode.id))
      return
    }
    const updates = enabled ? makeNodeLink(selectedNode) : unmakeNodeLink(selectedNode)
    if (Object.keys(updates).length > 0) {
      dispatch(updateNode({ id: selectedNode.id, updates }))
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-gray-900">Основные настройки</h3>
      </div>

      {/* Block Info Section - показываем если блок связан с библиотекой */}
      <BlockInfoSection node={selectedNode} pageId={pageId} />

      {/* Element Name */}
      <div className="p-4 border-b border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Имя элемента
        </label>
        <Input
          value={selectedNode.metadata?.name || ''}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Введите имя элемента"
        />
        <p className="text-xs text-gray-500 mt-1">
          Используется для идентификации элемента в структуре
        </p>
      </div>

      {/* Block as link */}
      {showLinkSection && (
        <div className="p-4 border-b border-gray-200 space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isLink}
              onChange={(e) => handleLinkToggle(e.target.checked)}
              className="rounded border-gray-300"
            />
            <LinkIcon size={14} /> Блок является ссылкой
          </label>

          {nestedLinkWarning && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              {nestedLinkWarning}
            </p>
          )}
          {isLink && linkNode && <LinkSettings node={linkNode} pageId={pageId} />}
        </div>
      )}

      {/* Element Info */}
      <div className="p-4 space-y-3">
        <div>
          <span className="text-xs font-medium text-gray-500">ID элемента:</span>
          <p className="text-sm text-gray-900 font-mono mt-0.5">{selectedNode.id}</p>
        </div>
        
        <div>
          <span className="text-xs font-medium text-gray-500">Тег:</span>
          <p className="text-sm text-gray-900 mt-0.5">{selectedNode.tagName || selectedNode.tag || 'div'}</p>
        </div>
        
        {selectedNode.children && selectedNode.children.length > 0 && (
          <div>
            <span className="text-xs font-medium text-gray-500">Дочерних элементов:</span>
            <p className="text-sm text-gray-900 mt-0.5">{selectedNode.children.length}</p>
          </div>
        )}
      </div>
    </div>
  )
}
