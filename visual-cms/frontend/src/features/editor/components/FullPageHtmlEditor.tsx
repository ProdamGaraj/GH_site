import React, { useState, useEffect, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import { X, Check, Copy, RotateCcw, AlertTriangle } from 'lucide-react'
import { Button } from '@/shared/components/Button'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { selectRootNode, loadRootNode } from '@/features/editor/editorSlice'
import { generateFullPageHTML, mergeHtmlIntoTree } from '../utils/exportUtils'

interface FullPageHtmlEditorProps {
  isOpen: boolean
  onClose: () => void
  pageTitle?: string
}

export const FullPageHtmlEditor: React.FC<FullPageHtmlEditorProps> = ({
  isOpen,
  onClose,
  pageTitle = 'Страница',
}) => {
  const dispatch = useAppDispatch()
  const rootNode = useAppSelector(selectRootNode)

  const [htmlCode, setHtmlCode] = useState('')
  const [originalHtml, setOriginalHtml] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Generate HTML from current tree when modal opens
  useEffect(() => {
    if (isOpen && rootNode) {
      const html = generateFullPageHTML(rootNode, pageTitle)
      setHtmlCode(html)
      setOriginalHtml(html)
      setIsDirty(false)
      setError(null)
      setShowConfirm(false)
    }
  }, [isOpen, rootNode, pageTitle])

  const handleCodeChange = useCallback((value: string | undefined) => {
    const code = value || ''
    setHtmlCode(code)
    setIsDirty(code !== originalHtml)
    setError(null)
  }, [originalHtml])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(htmlCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [htmlCode])

  const handleReset = useCallback(() => {
    setHtmlCode(originalHtml)
    setIsDirty(false)
    setError(null)
  }, [originalHtml])

  const handleApply = useCallback(() => {
    if (!isDirty) return
    setShowConfirm(true)
  }, [isDirty])

  const handleConfirmApply = useCallback(() => {
    try {
      if (!rootNode) {
        setError('Нет текущей структуры страницы.')
        setShowConfirm(false)
        return
      }

      // Merge HTML changes back into the existing tree,
      // preserving metadata, scripts, animations, data bindings, etc.
      const mergedTree = mergeHtmlIntoTree(htmlCode, rootNode)

      if (!mergedTree) {
        setError('Не удалось разобрать HTML. Проверьте синтаксис.')
        setShowConfirm(false)
        return
      }

      // Load merged tree into editor
      dispatch(loadRootNode(mergedTree))

      setOriginalHtml(htmlCode)
      setIsDirty(false)
      setError(null)
      setShowConfirm(false)
      onClose()
    } catch (err: any) {
      setError(`Ошибка при разборе HTML: ${err.message || 'Неизвестная ошибка'}`)
      setShowConfirm(false)
    }
  }, [htmlCode, rootNode, dispatch, onClose])

  const handleClose = useCallback(() => {
    if (isDirty) {
      if (window.confirm('У вас есть несохранённые изменения. Закрыть без сохранения?')) {
        onClose()
      }
    } else {
      onClose()
    }
  }, [isDirty, onClose])

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <span className="text-white font-medium text-sm">
            {'</>'} Исходный код страницы
          </span>
          {isDirty && (
            <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
              Изменено
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopy}
            className="!bg-gray-700 !text-gray-300 hover:!bg-gray-600 !border-gray-600"
          >
            <Copy size={14} className="mr-1" />
            {copied ? 'Скопировано!' : 'Копировать'}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleReset}
            disabled={!isDirty}
            className="!bg-gray-700 !text-gray-300 hover:!bg-gray-600 !border-gray-600 disabled:opacity-40"
          >
            <RotateCcw size={14} className="mr-1" />
            Сбросить
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleApply}
            disabled={!isDirty}
            className="!bg-violet-600 hover:!bg-violet-700 disabled:opacity-40"
          >
            <Check size={14} className="mr-1" />
            Применить
          </Button>

          <div className="w-px h-6 bg-gray-700 mx-1" />

          <button
            onClick={handleClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-red-900/50 border-b border-red-700 text-red-300 text-sm flex items-center gap-2">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {/* Confirmation banner */}
      {showConfirm && (
        <div className="px-4 py-3 bg-amber-900/50 border-b border-amber-700 text-amber-200 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} />
            <span>
              HTML-структура будет обновлена. Привязки данных, скрипты, анимации
              и прочие настройки элементов будут сохранены.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowConfirm(false)}
              className="!bg-gray-700 !text-gray-300 hover:!bg-gray-600 !border-gray-600"
            >
              Отмена
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmApply}
              className="!bg-red-600 hover:!bg-red-700"
            >
              Да, применить
            </Button>
          </div>
        </div>
      )}

      {/* Monaco Editor - takes full remaining space */}
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language="html"
          theme="vs-dark"
          value={htmlCode}
          onChange={handleCodeChange}
          options={{
            minimap: { enabled: true },
            lineNumbers: 'on',
            fontSize: 14,
            wordWrap: 'on',
            automaticLayout: true,
            scrollBeyondLastLine: true,
            tabSize: 2,
            formatOnPaste: true,
            formatOnType: true,
            renderWhitespace: 'selection',
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true, indentation: true },
            folding: true,
            foldingStrategy: 'indentation',
            suggest: {
              insertMode: 'replace',
              showWords: true,
            },
          }}
        />
      </div>

      {/* Footer status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-gray-800 border-t border-gray-700 text-xs text-gray-500">
        <span>HTML · UTF-8</span>
        <span>
          {htmlCode.split('\n').length} строк · {htmlCode.length} символов
        </span>
      </div>
    </div>
  )
}
