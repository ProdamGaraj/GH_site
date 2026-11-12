import React from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  updateNode,
  updateLinkedBlockAsset,
  selectRootNode,
  selectSelectedNodeId,
  selectRunScriptsInCanvas,
  setRunScriptsInCanvas,
} from '@/features/editor/editorSlice'
import {
  countLinkedInstances,
  findOwningLinkedInstance,
  type BlockAssetField,
} from '@/features/editor/utils/linkedBlockAssets'
import { FileCode, Link2 } from 'lucide-react'

/** Чей CSS/JS редактирует корневой редактор: в редакторе страницы — страницы, в редакторе блока — блока. */
export type AssetScope = 'page' | 'block'

const CSS_PLACEHOLDER = '.my-class:hover { opacity: .8; }'
const JS_PLACEHOLDER = "document.querySelectorAll('...')"

/** Общее поле ввода CSS/JS (одинаковый вид у CSS страницы и CSS блока). */
const AssetTextarea: React.FC<{
  field: BlockAssetField
  value: string
  onChange: (next: string) => void
  ariaLabel: string
}> = ({ field, value, onChange, ariaLabel }) => (
  <textarea
    value={value}
    onChange={(e) => onChange(e.target.value)}
    spellCheck={false}
    rows={10}
    aria-label={ariaLabel}
    placeholder={field === 'globalCss' ? CSS_PLACEHOLDER : JS_PLACEHOLDER}
    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono bg-gray-50 text-gray-800"
  />
)

const kindOf = (field: BlockAssetField) => (field === 'globalCss' ? 'CSS' : 'JS')

/**
 * Редактор общих стилей/скриптов уровня корня дерева (страница или блок).
 * Пишет в `rootNode.metadata.globalCss` / `globalJs`. На деплое бэкенд
 * оборачивает их в <style>/<script> (для блока — с дедупом по контенту).
 *
 * Уровень определяется тем, что редактируется: при правке страницы корень —
 * это страница, при правке библиотечного блока — сам блок.
 */
export const GlobalAssetEditor: React.FC<{ field: BlockAssetField; scope?: AssetScope }> = ({ field, scope }) => {
  const dispatch = useAppDispatch()
  const rootNode = useAppSelector(selectRootNode)
  const runScriptsInCanvas = useAppSelector(selectRunScriptsInCanvas)

  if (!rootNode) {
    return <p className="text-gray-500 text-sm p-2">Нет корневого элемента</p>
  }

  const isCss = field === 'globalCss'
  const value = rootNode.metadata?.[field] || ''
  const owner = scope === 'page' ? ' страницы' : scope === 'block' ? ' блока' : ''
  const title = `Общий ${kindOf(field)}${owner}`

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
        {title}
      </h4>
      <p className="text-xs text-gray-500 mb-2">
        {isCss
          ? 'Применяется ко всему дереву (страница/блок). Поддерживает @media, :hover, @keyframes — то, что не выражается инлайн-стилями.'
          : 'Выполняется один раз для всего дерева (страница/блок). Для блока дублирующиеся скрипты на деплое склеиваются в один.'}
      </p>
      <AssetTextarea field={field} value={value} onChange={onChange} ariaLabel={title} />

      {!isCss && (
        <label className="mt-2 flex items-start gap-2 text-xs text-gray-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={runScriptsInCanvas}
            onChange={(e) => dispatch(setRunScriptsInCanvas(e.target.checked))}
            className="mt-0.5"
          />
          <span>
            Выполнять JS в редакторе
            <span className="block text-gray-400">
              Прогоняет общий JS прямо в холсте (нужно для scroll-reveal и т.п.). Чужой код
              исполняется в редакторе — включайте осознанно.
            </span>
          </span>
        </label>
      )}
    </div>
  )
}

/**
 * CSS/JS библиотечного блока, которому принадлежит выбранный элемент, — правка из
 * редактора СТРАНИЦЫ. Пишет во все вставки блока на странице; в библиотеку уходит
 * при сохранении страницы (окно решений → «В библиотеку»). Ничего не рендерит,
 * если выбранный элемент не внутри linked-блока.
 */
export const LinkedBlockAssetEditor: React.FC<{ field: BlockAssetField }> = ({ field }) => {
  const dispatch = useAppDispatch()
  const rootNode = useAppSelector(selectRootNode)
  const selectedNodeId = useAppSelector(selectSelectedNodeId)

  const instance = findOwningLinkedInstance(rootNode, selectedNodeId)
  const linkedBlockId = instance?.metadata?.linkedBlockId
  if (!instance || !linkedBlockId) return null

  const blockName = instance.metadata?.name || instance.tagName || 'Блок'
  const instances = countLinkedInstances(rootNode, linkedBlockId)
  const title = `${kindOf(field)} блока «${blockName}»`

  const onChange = (next: string) => {
    dispatch(updateLinkedBlockAsset({ linkedBlockId, field, value: next }))
  }

  return (
    <div className="border-t pt-4 mt-4" data-testid={`linked-block-${field}`}>
      <h4 className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
        <Link2 size={14} />
        {title}
      </h4>
      <p className="text-xs text-gray-500 mb-2">
        Общий {kindOf(field)} библиотечного блока. Попадёт в библиотеку при сохранении страницы
        (в окне изменений выберите «В библиотеку») и обновит блок на всех страницах.
        {instances > 1 && ` Блок вставлен на эту страницу ${instances} раз(а) — правка применяется ко всем вставкам.`}
      </p>
      <AssetTextarea field={field} value={instance.metadata?.[field] || ''} onChange={onChange} ariaLabel={title} />
    </div>
  )
}
