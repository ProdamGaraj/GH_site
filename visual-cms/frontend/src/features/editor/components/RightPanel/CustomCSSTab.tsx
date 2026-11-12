import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Editor from '@monaco-editor/react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { setNodeCss, selectRootNode, selectBreakpoints } from '@/features/editor/editorSlice'
import { formatNodeCss, parseNodeCss, readNodeCss } from '@/features/editor/utils/nodeCss'
import { Copy, Wand2, Trash2 } from 'lucide-react'
import type { BlockNode } from '@/shared/types'

interface CustomCSSTabProps {
  node: BlockNode
}

/**
 * CSS элемента: стили основной версии и блок `@media` на каждый экран — всегда
 * все экраны, независимо от того, какой открыт на канвасе. «Применить» пишет
 * каждую часть на своё место (см. utils/nodeCss.ts).
 */
export const CustomCSSTab: React.FC<CustomCSSTabProps> = ({ node }) => {
  const dispatch = useAppDispatch()
  const rootNode = useAppSelector(selectRootNode)
  const breakpoints = useAppSelector(selectBreakpoints)
  const [cssText, setCssText] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Читаем из дерева, а не из `node`: тот уже слит с правками текущего экрана,
  // а здесь основная версия и экраны показываются раздельно.
  const model = useMemo(
    () => (rootNode ? readNodeCss(rootNode, node.id, breakpoints) : { base: {}, screens: [] }),
    [rootNode, node.id, breakpoints],
  )
  const storeText = useMemo(() => formatNodeCss(model), [model])

  // Выбрали другой элемент — несохранённый текст прежнего к нему не относится.
  useEffect(() => {
    setIsEditing(false)
    setError(null)
  }, [node.id])

  // Синхронизация с деревом, пока пользователь не правит текст.
  useEffect(() => {
    if (!isEditing) setCssText(storeText)
  }, [storeText, isEditing])

  // Копировать CSS
  const copyCSS = useCallback(() => {
    navigator.clipboard.writeText(cssText)
  }, [cssText])

  // Сбросить CSS
  const resetCSS = useCallback(() => {
    setCssText('')
    setIsEditing(true)
    setError(null)
  }, [])

  // Форматировать CSS: разбор и вывод в каноническом виде (при ошибках — не трогаем).
  const formatCSS = useCallback(() => {
    const parsed = parseNodeCss(cssText, model.screens)
    if (parsed.errors.length > 0) {
      setError(parsed.errors.join('\n'))
      return
    }
    setCssText(formatNodeCss({
      base: parsed.base,
      screens: model.screens.map(screen => ({ ...screen, styles: parsed.screens[screen.id] || {} })),
    }))
    setIsEditing(true)
    setError(null)
  }, [cssText, model.screens])

  const handleApplyCSS = () => {
    const parsed = parseNodeCss(cssText, model.screens)
    if (parsed.errors.length > 0) {
      // Ничего не применяем: частичная запись потеряла бы неразобранные строки.
      setError(parsed.errors.join('\n'))
      return
    }
    dispatch(setNodeCss({ nodeId: node.id, base: parsed.base, screens: parsed.screens }))
    setIsEditing(false)
    setError(null)
  }

  return (
    <div className="space-y-4">
      <div>
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-700">Custom CSS</label>
          <div className="flex items-center gap-1">
            <button
              onClick={formatCSS}
              className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
              title="Форматировать"
            >
              <Wand2 className="w-4 h-4" />
            </button>
            <button
              onClick={copyCSS}
              className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
              title="Копировать"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={resetCSS}
              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
              title="Сбросить"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleApplyCSS}
              className="px-3 py-1 bg-primary-600 text-white text-xs rounded hover:bg-primary-700 ml-2"
            >
              Применить
            </button>
          </div>
        </div>
        
        {/* Monaco Editor */}
        <div className="border border-gray-300 rounded overflow-hidden">
          <Editor
            height="350px"
            defaultLanguage="css"
            value={cssText}
            onChange={(value) => {
              setCssText(value || '')
              setIsEditing(true)
            }}
            theme="vs-light"
            options={{
              minimap: { enabled: false },
              lineNumbers: 'on',
              glyphMargin: false,
              folding: false,
              lineDecorationsWidth: 4,
              lineNumbersMinChars: 3,
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              fontSize: 12,
              tabSize: 2,
              automaticLayout: true,
              padding: { top: 8, bottom: 8 },
              renderLineHighlight: 'line',
              fixedOverflowWidgets: true,
              scrollbar: {
                vertical: 'auto',
                horizontal: 'auto',
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
              },
            }}
          />
        </div>
        
        {/* Error message */}
        {error && (
          <p className="mt-2 text-xs text-red-500 whitespace-pre-line">{error}</p>
        )}
        
        <p className="text-xs text-gray-500 mt-2">
          Сверху — основная версия, ниже — блок <code className="bg-gray-100 px-1 rounded">@media</code> для каждого экрана.
          Формат: <code className="bg-gray-100 px-1 rounded">property: value;</code> — нажмите "Применить" для сохранения.
          Чтобы убрать свойство на экране, впишите в его блок <code className="bg-gray-100 px-1 rounded">property: revert;</code>
        </p>
      </div>

      {/* Current Styles Preview */}
      <div>
        <h4 className="text-xs font-medium text-gray-700 mb-2">Итоговые стили на текущем экране (JSON)</h4>
        <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs overflow-auto max-h-[200px] text-gray-900">
          {JSON.stringify(node.styles.properties, null, 2)}
        </pre>
      </div>
    </div>
  )
}
