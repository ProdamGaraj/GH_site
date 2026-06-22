import React from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { updateNode, selectRootNode } from '@/features/editor/editorSlice'
import { FileCode } from 'lucide-react'

/**
 * Редактор общих стилей/скриптов уровня корня дерева (страница или блок).
 * Пишет в `rootNode.metadata.globalCss` / `globalJs`. На деплое бэкенд
 * оборачивает их в <style>/<script> (для блока — с дедупом по контенту).
 *
 * Уровень определяется тем, что редактируется: при правке страницы корень —
 * это страница, при правке библиотечного блока — сам блок.
 */
export const GlobalAssetEditor: React.FC<{ field: 'globalCss' | 'globalJs' }> = ({ field }) => {
  const dispatch = useAppDispatch()
  const rootNode = useAppSelector(selectRootNode)

  if (!rootNode) {
    return <p className="text-gray-500 text-sm p-2">Нет корневого элемента</p>
  }

  const isCss = field === 'globalCss'
  const value = rootNode.metadata?.[field] || ''

  const onChange = (next: string) => {
    dispatch(
      updateNode({
        id: rootNode.id,
        updates: {
          metadata: { ...rootNode.metadata, [field]: next || undefined },
        },
      }),
    )
  }

  return (
    <div className="border-t pt-4 mt-4">
      <h4 className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
        <FileCode size={14} />
        {isCss ? 'Общий CSS' : 'Общий JS'}
      </h4>
      <p className="text-xs text-gray-500 mb-2">
        {isCss
          ? 'Применяется ко всему дереву (страница/блок). Поддерживает @media, :hover, @keyframes — то, что не выражается инлайн-стилями.'
          : 'Выполняется один раз для всего дерева (страница/блок). Для блока дублирующиеся скрипты на деплое склеиваются в один.'}
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        rows={10}
        placeholder={isCss ? '.my-class:hover { opacity: .8; }' : "document.querySelectorAll('...')"}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono bg-gray-50 text-gray-800"
      />
    </div>
  )
}
