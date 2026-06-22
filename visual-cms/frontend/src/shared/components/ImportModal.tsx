import React, { useState, useMemo } from 'react'
import { Upload, FileCode, FileJson, X, AlertCircle } from 'lucide-react'
import { Button } from './Button'
import { cn } from '@/shared/utils'
import {
  importContent,
  importFromFiles,
  detectImportFormat,
  extractDocumentAssets,
  ImportFormat
} from '@/features/editor/utils/exportUtils'
import type { BlockNode } from '@/shared/types'

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (node: BlockNode, name: string) => void
  type: 'page' | 'block'
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  type
}) => {
  const [importText, setImportText] = useState('')
  const [importFormat, setImportFormat] = useState<ImportFormat>('html')
  const [importError, setImportError] = useState('')
  const [name, setName] = useState('')
  // Отдельные CSS/JS файлы (для импорта страницы из трёх файлов html+css+js)
  const [cssText, setCssText] = useState('')
  const [jsText, setJsText] = useState('')
  const [cssName, setCssName] = useState('')
  const [jsName, setJsName] = useState('')

  // Предпросмотр кода, который реально выполнится/применится после импорта.
  // Учитываем и встроенные в HTML стили/скрипты, и отдельные CSS/JS файлы.
  const capturedAssets = useMemo(() => {
    if (importFormat !== 'html') return null
    let css = cssText || ''
    let js = jsText || ''
    if (importText.trim()) {
      try {
        const doc = new DOMParser().parseFromString(importText, 'text/html')
        const a = extractDocumentAssets(doc)
        css = [css, a.css].filter(Boolean).join('\n')
        js = [js, a.js].filter(Boolean).join('\n')
      } catch {
        /* ignore */
      }
    }
    if (!css && !js) return null
    return { css, js }
  }, [importText, importFormat, cssText, jsText])

  if (!isOpen) return null

  const readFileText = (file: File, onText: (text: string) => void) => {
    const reader = new FileReader()
    reader.onload = (event) => onText((event.target?.result as string) || '')
    reader.readAsText(file)
  }

  const handleCssUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCssName(file.name)
    readFileText(file, setCssText)
  }

  const handleJsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setJsName(file.name)
    readFileText(file, setJsText)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Извлекаем имя из файла
    const fileName = file.name.replace(/\.(html|htm|json)$/i, '')
    if (!name) {
      setName(fileName)
    }
    
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setImportText(content)
      if (file.name.endsWith('.json')) {
        setImportFormat('json')
      } else if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
        setImportFormat('html')
      } else {
        setImportFormat(detectImportFormat(content))
      }
    }
    reader.readAsText(file)
  }

  const handleImportTextChange = (value: string) => {
    setImportText(value)
    setImportError('')
    if (value.trim()) {
      setImportFormat(detectImportFormat(value))
    }
  }

  const handleImport = () => {
    if (!name.trim()) {
      setImportError('Введите название')
      return
    }
    
    try {
      setImportError('')
      const useFiles = importFormat === 'html' && (cssText.trim() !== '' || jsText.trim() !== '')
      const imported = useFiles
        ? importFromFiles({ html: importText, css: cssText, js: jsText })
        : importContent(importText, importFormat)
      onImport(imported, name.trim())
      onClose()
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Ошибка парсинга. Проверьте формат данных.')
    }
  }

  const typeLabel = type === 'page' ? 'страницы' : 'блока'
  const typeTitle = type === 'page' ? 'страницу' : 'блок'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[700px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <Upload className="text-primary-600" size={24} />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Импорт {typeLabel}
              </h2>
              <p className="text-sm text-gray-500">
                Создайте {typeTitle} из HTML или JSON
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Название */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Название {typeLabel} *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === 'page' ? 'Главная страница' : 'Hero секция'}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Выбор формата */}
          <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => setImportFormat('html')}
              className={cn(
                'flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors',
                importFormat === 'html'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <FileCode size={16} className="inline mr-2" />
              HTML
            </button>
            <button
              onClick={() => setImportFormat('json')}
              className={cn(
                'flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors',
                importFormat === 'json'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <FileJson size={16} className="inline mr-2" />
              JSON
            </button>
          </div>
          
          {/* Загрузка файла */}
          <label className="block">
            <input
              type="file"
              accept=".html,.htm,.json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="flex items-center justify-center gap-2 px-4 py-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors">
              <Upload size={20} className="text-gray-400" />
              <span className="text-sm text-gray-600">
                Загрузить {importFormat === 'json' ? 'JSON' : 'HTML'} файл
              </span>
            </div>
          </label>

          {/* Отдельные CSS и JS файлы (импорт из трёх файлов html + css + js) */}
          {importFormat === 'html' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <input type="file" accept=".css" onChange={handleCssUpload} className="hidden" />
                <div className="flex items-center justify-center gap-2 px-3 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors">
                  <FileCode size={16} className="text-gray-400" />
                  <span className="text-xs text-gray-600 truncate">
                    {cssName || 'CSS файл (необязательно)'}
                  </span>
                </div>
              </label>
              <label className="block">
                <input type="file" accept=".js,.mjs" onChange={handleJsUpload} className="hidden" />
                <div className="flex items-center justify-center gap-2 px-3 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors">
                  <FileCode size={16} className="text-gray-400" />
                  <span className="text-xs text-gray-600 truncate">
                    {jsName || 'JS файл (необязательно)'}
                  </span>
                </div>
              </label>
            </div>
          )}

          {/* Текстовое поле */}
          <textarea
            value={importText}
            onChange={(e) => handleImportTextChange(e.target.value)}
            placeholder={importFormat === 'json' 
              ? '{"id": "...", "elementType": "container", ...}'
              : '<div class="container">\n  <h1>Заголовок</h1>\n  <p>Контент...</p>\n</div>'
            }
            className="w-full h-56 p-4 font-mono text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />

          {/* Ошибка */}
          {importError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              <AlertCircle size={16} />
              {importError}
            </div>
          )}

          {/* Инфо о формате */}
          {importText.trim() && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
              Формат определён как: <strong>{importFormat === 'json' ? 'JSON' : 'HTML'}</strong>
            </div>
          )}

          {/* Предпросмотр захваченных стилей/скриптов */}
          {capturedAssets?.css && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
              Будут перенесены общие стили (<strong>{capturedAssets.css.length}</strong> символов CSS).
            </div>
          )}
          {capturedAssets?.js && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-sm space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle size={16} />
                Импортируемый HTML содержит JavaScript — он будет выполняться на странице.
              </div>
              <pre className="max-h-40 overflow-auto bg-white/70 border border-amber-200 rounded p-2 text-xs font-mono whitespace-pre-wrap">
                {capturedAssets.js.length > 4000
                  ? capturedAssets.js.slice(0, 4000) + '\n… (обрезано)'
                  : capturedAssets.js}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!importText.trim() || !name.trim()}
          >
            <Upload size={16} className="mr-2" />
            Импортировать
          </Button>
        </div>
      </div>
    </div>
  )
}
