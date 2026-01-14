import React, { useState, useEffect } from 'react'
import { 
  Download, 
  Upload, 
  FileCode, 
  FileJson, 
  FolderArchive,
  Code2,
  FileText,
  X,
  Check,
  Copy
} from 'lucide-react'
import { Button } from '@/shared/components/Button'
import { cn } from '@/shared/utils'
import type { BlockNode } from '@/shared/types'
import {
  exportToJSON,
  importContent,
  detectImportFormat,
  generateFullExport,
  downloadFile,
  downloadAsZip,
  ExportFile,
  ImportFormat
} from '../utils/exportUtils'

interface ExportImportModalProps {
  isOpen: boolean
  onClose: () => void
  node: BlockNode
  name: string
  type: 'page' | 'block'
  onImport?: (node: BlockNode) => void
  defaultTab?: 'export' | 'import'
}

type ExportFormat = 'html' | 'react-ts' | 'react-js' | 'vue' | 'json'
type TabType = 'export' | 'import' | 'preview'

export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  isOpen,
  onClose,
  node,
  name,
  type,
  onImport,
  defaultTab = 'export'
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('html')
  const [previewContent, setPreviewContent] = useState<string>('')
  const [previewFiles, setPreviewFiles] = useState<ExportFile[]>([])
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [importText, setImportText] = useState('')
  const [importFormat, setImportFormat] = useState<ImportFormat>('html')
  const [importError, setImportError] = useState<string>('')
  const [copied, setCopied] = useState(false)

  // Обновляем вкладку при изменении defaultTab
  useEffect(() => {
    setActiveTab(defaultTab)
  }, [defaultTab])

  if (!isOpen) return null

  const formats: { id: ExportFormat; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'html', label: 'HTML + CSS + JS', icon: <FileCode size={20} />, desc: 'Чистый HTML с отдельными CSS и JS файлами' },
    { id: 'react-ts', label: 'React + TypeScript', icon: <Code2 size={20} />, desc: 'TSX компонент с CSS модулями' },
    { id: 'react-js', label: 'React + JavaScript', icon: <Code2 size={20} />, desc: 'JSX компонент с CSS модулями' },
    { id: 'vue', label: 'Vue 3 SFC', icon: <FileText size={20} />, desc: 'Single File Component (.vue)' },
    { id: 'json', label: 'JSON (Visual CMS)', icon: <FileJson size={20} />, desc: 'Для импорта в другой проект' },
  ]

  const handlePreview = () => {
    let content = ''
    let files: ExportFile[] = []
    
    if (exportFormat === 'html') {
      const result = generateFullExport(node, { name, type, format: 'html' })
      files = result.files
      content = files.find(f => f.path.endsWith('.html'))?.content || ''
    } else if (exportFormat === 'react-ts' || exportFormat === 'react-js') {
      const result = generateFullExport(node, { name, type, format: 'react' })
      files = result.files
      content = files.find(f => f.path.endsWith('.tsx') || f.path.endsWith('.jsx'))?.content || ''
    } else if (exportFormat === 'vue') {
      const result = generateFullExport(node, { name, type, format: 'vue' })
      files = result.files
      content = files.find(f => f.path.endsWith('.vue'))?.content || ''
    } else if (exportFormat === 'json') {
      content = exportToJSON(node)
      files = [{ path: `${name}.json`, content }]
    }
    
    setPreviewContent(content)
    setPreviewFiles(files)
    setSelectedFile(files[0]?.path || '')
    setActiveTab('preview')
  }

  const handleExport = async () => {
    const safeName = name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
    
    if (exportFormat === 'json') {
      const content = exportToJSON(node)
      downloadFile(content, `${safeName}.json`, 'application/json')
      return
    }
    
    const format = exportFormat === 'html' ? 'html' : 
                   exportFormat.startsWith('react') ? 'react' : 'vue'
    
    const result = generateFullExport(node, { name, type, format })
    
    if (result.files.length === 1) {
      const file = result.files[0]
      downloadFile(file.content, file.path.split('/').pop() || 'export.txt')
    } else {
      await downloadAsZip(result.files, safeName)
    }
  }

  const handleImport = () => {
    try {
      setImportError('')
      const imported = importContent(importText, importFormat)
      onImport?.(imported)
      onClose()
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Ошибка парсинга. Проверьте формат данных.')
    }
  }

  const handleCopy = () => {
    const content = previewFiles.find(f => f.path === selectedFile)?.content || previewContent
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setImportText(content)
      // Автоопределение формата по расширению файла
      if (file.name.endsWith('.json')) {
        setImportFormat('json')
      } else if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
        setImportFormat('html')
      } else {
        // Автоопределение по содержимому
        setImportFormat(detectImportFormat(content))
      }
    }
    reader.readAsText(file)
  }

  // Автоопределение формата при изменении текста
  const handleImportTextChange = (value: string) => {
    setImportText(value)
    setImportError('')
    if (value.trim()) {
      setImportFormat(detectImportFormat(value))
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[900px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <FolderArchive className="text-primary-600" size={24} />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Экспорт / Импорт
              </h2>
              <p className="text-sm text-gray-500">
                {type === 'page' ? 'Страница' : 'Блок'}: {name}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6">
          <button
            onClick={() => setActiveTab('export')}
            className={cn(
              'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'export' 
                ? 'border-primary-600 text-primary-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <Download size={16} className="inline mr-2" />
            Экспорт
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={cn(
              'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'import' 
                ? 'border-primary-600 text-primary-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <Upload size={16} className="inline mr-2" />
            Импорт
          </button>
          {previewFiles.length > 0 && (
            <button
              onClick={() => setActiveTab('preview')}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === 'preview' 
                  ? 'border-primary-600 text-primary-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <FileCode size={16} className="inline mr-2" />
              Предпросмотр
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'export' && (
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Выберите формат экспорта:
              </p>
              
              <div className="grid grid-cols-1 gap-3">
                {formats.map(format => (
                  <label
                    key={format.id}
                    className={cn(
                      'flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-all',
                      exportFormat === format.id
                        ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <input
                      type="radio"
                      name="format"
                      value={format.id}
                      checked={exportFormat === format.id}
                      onChange={() => setExportFormat(format.id)}
                      className="sr-only"
                    />
                    <div className={cn(
                      'p-2 rounded-lg',
                      exportFormat === format.id ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-500'
                    )}>
                      {format.icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{format.label}</p>
                      <p className="text-sm text-gray-500">{format.desc}</p>
                    </div>
                    {exportFormat === format.id && (
                      <Check size={20} className="text-primary-600" />
                    )}
                  </label>
                ))}
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={handlePreview} variant="secondary" className="flex-1">
                  <FileCode size={16} className="mr-2" />
                  Предпросмотр кода
                </Button>
                <Button onClick={handleExport} className="flex-1">
                  <Download size={16} className="mr-2" />
                  Скачать {previewFiles.length > 1 ? 'архив' : 'файл'}
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Импортируйте HTML код или JSON структуру блока:
              </p>
              
              {/* Выбор формата импорта */}
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
              
              <div className="flex gap-3">
                <label className="flex-1">
                  <input
                    type="file"
                    accept={importFormat === 'json' ? '.json' : '.html,.htm'}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors">
                    <Upload size={20} className="text-gray-400" />
                    <span className="text-sm text-gray-600">
                      Загрузить {importFormat === 'json' ? 'JSON' : 'HTML'} файл
                    </span>
                  </div>
                </label>
              </div>

              <textarea
                value={importText}
                onChange={(e) => handleImportTextChange(e.target.value)}
                placeholder={importFormat === 'json' 
                  ? '{"id": "...", "elementType": "container", ...}'
                  : '<div class="container">\n  <h1>Заголовок</h1>\n  <p>Контент...</p>\n</div>'
                }
                className="w-full h-64 p-4 font-mono text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />

              {importError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {importError}
                </div>
              )}

              {importText.trim() && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
                  Формат определён как: <strong>{importFormat === 'json' ? 'JSON' : 'HTML'}</strong>
                </div>
              )}

              <Button 
                onClick={handleImport} 
                disabled={!importText.trim()}
                className="w-full"
              >
                <Upload size={16} className="mr-2" />
                Импортировать {importFormat === 'json' ? 'JSON' : 'HTML'}
              </Button>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="flex h-[500px]">
              {/* File tree */}
              <div className="w-56 border-r bg-gray-50 overflow-y-auto">
                <div className="p-3 text-xs font-semibold text-gray-500 uppercase">
                  Файлы ({previewFiles.length})
                </div>
                {previewFiles.map(file => (
                  <button
                    key={file.path}
                    onClick={() => setSelectedFile(file.path)}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm truncate hover:bg-gray-100',
                      selectedFile === file.path && 'bg-primary-100 text-primary-700'
                    )}
                    title={file.path}
                  >
                    <FileCode size={14} className="inline mr-2" />
                    {file.path.split('/').pop()}
                  </button>
                ))}
              </div>
              
              {/* Code preview */}
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b">
                  <span className="text-sm font-mono text-gray-600">{selectedFile}</span>
                  <button 
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Скопировано!' : 'Копировать'}
                  </button>
                </div>
                <pre className="flex-1 p-4 overflow-auto text-sm bg-gray-900 text-gray-100">
                  <code>
                    {previewFiles.find(f => f.path === selectedFile)?.content || ''}
                  </code>
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
