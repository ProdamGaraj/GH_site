import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Input'
import { Save, Eye, Undo, Redo, X, Check, Loader2, Monitor, Tablet, Smartphone, Laptop, Watch, Settings, ZoomIn, ZoomOut, AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { selectRootNode, selectIsDirty, selectBreakpoints, selectZoom, selectBlockAlignment, markAsSaved, setZoom, setBlockAlignment } from '@/features/editor/editorSlice'
import { createBlock, updateBlock, selectBlocksSaving } from '@/features/blocks/blocksSlice'
import { createPage, updatePage, selectPagesSaving } from '@/features/pages/pagesSlice'
import { BreakpointManager } from './BreakpointManager'

interface EditorToolbarProps {
  type: 'page' | 'block'
  blockId?: string
  blockName?: string
  viewport?: string
  onViewportChange?: (viewport: string) => void
  pageSettings?: {
    name: string
    slug: string
    status: 'draft' | 'published' | 'archived'
    metaTitle: string
    metaDescription: string
    keywords: string
    ogImage: string
  }
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ 
  type: _type, 
  blockId: _blockId,
  blockName: initialBlockName,
  viewport = 'desktop',
  onViewportChange,
  pageSettings
}) => {
  const { id } = useParams()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  
  const rootNode = useAppSelector(selectRootNode)
  const isDirty = useAppSelector(selectIsDirty)
  const isSavingBlocks = useAppSelector(selectBlocksSaving)
  const isSavingPages = useAppSelector(selectPagesSaving)
  const breakpoints = useAppSelector(selectBreakpoints)
  const zoom = useAppSelector(selectZoom)
  const blockAlignment = useAppSelector(selectBlockAlignment)
  
  const isNewBlock = id === 'new' || !id
  const isPageEditor = _type === 'page'
  const isSaving = isPageEditor ? isSavingPages : isSavingBlocks
  
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showBreakpointManager, setShowBreakpointManager] = useState(false)
  const [blockName, setBlockName] = useState(initialBlockName || '')
  const [isReusable, setIsReusable] = useState(true)

  const handleSave = async () => {
    if (!rootNode) return

    if (isPageEditor) {
      // Save page
      if (!pageSettings) return

      if (isNewBlock) {
        setShowSaveDialog(true)
      } else {
        try {
          await dispatch(updatePage({
            id: id!,
            data: {
              structure: rootNode,
              name: pageSettings.name,
              slug: pageSettings.slug,
              status: pageSettings.status,
              metadata: {
                title: pageSettings.metaTitle,
                description: pageSettings.metaDescription,
                keywords: pageSettings.keywords ? pageSettings.keywords.split(',').map(k => k.trim()) : [],
                ogImage: pageSettings.ogImage,
              }
            }
          })).unwrap()
          
          dispatch(markAsSaved())
        } catch (error) {
          console.error('Failed to save page:', error)
        }
      }
    } else {
      // Save block
      if (isNewBlock) {
        setShowSaveDialog(true)
      } else {
        try {
          await dispatch(updateBlock({
            id: id!,
            data: {
              structure: rootNode,
            }
          })).unwrap()
          
          dispatch(markAsSaved())
        } catch (error) {
          console.error('Failed to save block:', error)
        }
      }
    }
  }

  const handleSaveNew = async () => {
    if (!rootNode) return

    if (isPageEditor) {
      // Create new page
      if (!pageSettings || !pageSettings.name.trim() || !pageSettings.slug.trim()) return

      try {
        const result = await dispatch(createPage({
          name: pageSettings.name.trim(),
          slug: pageSettings.slug.trim(),
          structure: rootNode,
          metadata: {
            title: pageSettings.metaTitle || pageSettings.name,
            description: pageSettings.metaDescription,
            keywords: pageSettings.keywords ? pageSettings.keywords.split(',').map(k => k.trim()) : [],
            ogImage: pageSettings.ogImage,
          }
        })).unwrap()
        
        dispatch(markAsSaved())
        setShowSaveDialog(false)
        
        navigate(`/editor/page/${result.id}`, { replace: true })
      } catch (error) {
        console.error('Failed to create page:', error)
      }
    } else {
      // Create new block
      if (!blockName.trim()) return

      try {
        const result = await dispatch(createBlock({
          name: blockName.trim(),
          type: 'static',
          structure: rootNode,
          isReusable,
        })).unwrap()
        
        dispatch(markAsSaved())
        setShowSaveDialog(false)
        
        navigate(`/editor/block/${result.id}`, { replace: true })
      } catch (error) {
        console.error('Failed to create block:', error)
      }
    }
  }

  const handlePreview = () => {
    setShowPreview(true)
  }

  const handleClosePreview = () => {
    setShowPreview(false)
  }
  
  const handleZoomIn = () => {
    dispatch(setZoom(zoom + 10))
  }
  
  const handleZoomOut = () => {
    dispatch(setZoom(zoom - 10))
  }
  
  const handleZoomReset = () => {
    dispatch(setZoom(100))
  }

  const toolbarContent = (
    <>
      <div className="flex items-center gap-2">
        {/* Zoom controls */}
        <button
          onClick={handleZoomOut}
          disabled={zoom <= 25}
          className="p-1.5 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Уменьшить"
        >
          <ZoomOut size={16} className="text-gray-600" />
        </button>
        
        <button
          onClick={handleZoomReset}
          className="px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 rounded transition-colors min-w-[50px]"
          title="Сбросить масштаб"
        >
          {zoom}%
        </button>
        
        <button
          onClick={handleZoomIn}
          disabled={zoom >= 200}
          className="p-1.5 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Увеличить"
        >
          <ZoomIn size={16} className="text-gray-600" />
        </button>
        
        <div className="h-6 w-px bg-gray-300 mx-2" />
        
        <Button variant="ghost" size="sm" disabled>
          <Undo size={16} />
        </Button>
        <Button variant="ghost" size="sm" disabled>
          <Redo size={16} />
        </Button>
        
        {/* Block alignment (only for block editor) */}
        {!isPageEditor && (
          <>
            <div className="h-6 w-px bg-gray-300 mx-2" />
            
            <div className="flex items-center gap-1 bg-gray-100 rounded p-1">
              <button
                onClick={() => dispatch(setBlockAlignment('left'))}
                className={`p-1.5 rounded transition-colors ${
                  blockAlignment === 'left' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                }`}
                title="Выровнять по левому краю"
              >
                <AlignLeft size={16} className={blockAlignment === 'left' ? 'text-primary-600' : 'text-gray-600'} />
              </button>
              <button
                onClick={() => dispatch(setBlockAlignment('center'))}
                className={`p-1.5 rounded transition-colors ${
                  blockAlignment === 'center' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                }`}
                title="Выровнять по центру"
              >
                <AlignCenter size={16} className={blockAlignment === 'center' ? 'text-primary-600' : 'text-gray-600'} />
              </button>
              <button
                onClick={() => dispatch(setBlockAlignment('right'))}
                className={`p-1.5 rounded transition-colors ${
                  blockAlignment === 'right' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                }`}
                title="Выровнять по правому краю"
              >
                <AlignRight size={16} className={blockAlignment === 'right' ? 'text-primary-600' : 'text-gray-600'} />
              </button>
            </div>
          </>
        )}
        
        <div className="h-6 w-px bg-gray-300 mx-2" />
        
        {/* Viewport switcher for pages and blocks */}
        {onViewportChange && (
          <>
            <div className="flex items-center gap-1 bg-gray-100 rounded p-1">
              {breakpoints.map((bp) => {
                const IconComponent = bp.icon === 'monitor' ? Monitor
                  : bp.icon === 'laptop' ? Laptop
                  : bp.icon === 'tablet' ? Tablet
                  : bp.icon === 'smartphone' ? Smartphone
                  : bp.icon === 'watch' ? Watch
                  : Monitor
                
                return (
                  <button
                    key={bp.id}
                    onClick={() => onViewportChange(bp.id)}
                    className={`p-1.5 rounded transition-colors ${
                      viewport === bp.id ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                    }`}
                    title={`${bp.name} (${bp.width}px)`}
                  >
                    <IconComponent size={16} className={viewport === bp.id ? 'text-primary-600' : 'text-gray-600'} />
                  </button>
                )
              })}
              <button
                onClick={() => setShowBreakpointManager(true)}
                className="p-1.5 rounded hover:bg-gray-200 transition-colors border-l border-gray-300 ml-1 pl-2"
                title="Управление breakpoints"
              >
                <Settings size={16} className="text-gray-600" />
              </button>
            </div>
            
            <div className="h-6 w-px bg-gray-300 mx-2" />
          </>
        )}
        
        <Button variant="secondary" size="sm" onClick={handlePreview}>
          <Eye size={16} className="mr-2" />
          Предпросмотр
        </Button>
        <Button 
          size="sm" 
          onClick={handleSave}
          disabled={isSaving || !isDirty}
        >
          {isSaving ? (
            <Loader2 size={16} className="mr-2 animate-spin" />
          ) : (
            <Save size={16} className="mr-2" />
          )}
          Сохранить
        </Button>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">
              {isPageEditor ? 'Создать страницу' : 'Сохранить блок'}
            </h2>
            
            <div className="space-y-4">
              {isPageEditor ? (
                <>
                  <div className="text-sm text-gray-600 mb-4">
                    Все настройки страницы настраиваются в правой панели.
                    Убедитесь, что вы заполнили название и slug перед сохранением.
                  </div>
                  {(!pageSettings?.name.trim() || !pageSettings?.slug.trim()) && (
                    <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                      Заполните название и slug в правой панели
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Input
                    label="Название блока"
                    value={blockName}
                    onChange={(e) => setBlockName(e.target.value)}
                    placeholder="Введите название..."
                    autoFocus
                  />
                  
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isReusable}
                      onChange={(e) => setIsReusable(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">
                      Переиспользуемый блок (доступен в библиотеке)
                    </span>
                  </label>
                </>
              )}
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button 
                variant="secondary" 
                onClick={() => setShowSaveDialog(false)}
              >
                <X size={16} className="mr-2" />
                Отмена
              </Button>
              <Button 
                onClick={handleSaveNew}
                disabled={
                  isSaving || 
                  (isPageEditor 
                    ? (!pageSettings?.name.trim() || !pageSettings?.slug.trim())
                    : !blockName.trim()
                  )
                }
              >
                {isSaving ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <Check size={16} className="mr-2" />
                )}
                {isPageEditor ? 'Создать' : 'Сохранить'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && rootNode && (
        <PreviewModal 
          rootNode={rootNode}
          breakpoints={breakpoints}
          onClose={handleClosePreview} 
        />
      )}
    </>
  )

  return (
    <>
      {toolbarContent}
      {showBreakpointManager && (
        <BreakpointManager onClose={() => setShowBreakpointManager(false)} />
      )}
    </>
  )
}

// Preview Modal Component
interface PreviewModalProps {
  rootNode: import('@/shared/types').BlockNode
  breakpoints: import('@/shared/types').CustomBreakpoint[]
  onClose: () => void
}

const PreviewModal: React.FC<PreviewModalProps> = ({ rootNode, breakpoints, onClose }) => {
  const [selectedBreakpoint, setSelectedBreakpoint] = useState(breakpoints[0]?.id || 'desktop')
  const [isManualMode, setIsManualMode] = useState(false)
  const [manualWidth, setManualWidth] = useState(1440)
  const [manualHeight, setManualHeight] = useState(900)
  
  const currentBreakpoint = breakpoints.find(bp => bp.id === selectedBreakpoint)
  const displayWidth = isManualMode ? manualWidth : (currentBreakpoint?.width || 1440)
  const displayHeight = isManualMode ? manualHeight : (currentBreakpoint?.height || 900)

  // Generate HTML from BlockNode tree
  const generateHTML = (node: import('@/shared/types').BlockNode): string => {
    const styleString = Object.entries(node.styles.properties)
      .filter(([_, value]) => value)
      .map(([key, value]) => {
        // Convert camelCase to kebab-case
        const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
        return `${cssKey}: ${value}`
      })
      .join('; ')

    const attrs = Object.entries(node.attributes)
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ')

    const childrenHTML = node.children.map(child => generateHTML(child)).join('')
    const content = node.content || ''

    return `<${node.tagName} style="${styleString}" ${attrs}>${content}${childrenHTML}</${node.tagName}>`
  }

  const previewHTML = generateHTML(rootNode)

  return (
    <div className="fixed inset-0 bg-black/80 flex flex-col z-[100]">
      {/* Header */}
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="font-medium">Предпросмотр</h2>
          
          {/* Manual mode toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isManualMode}
              onChange={(e) => setIsManualMode(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm">Ручной режим</span>
          </label>
          
          {!isManualMode && (
            <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
              {breakpoints.map((bp) => (
                <button
                  key={bp.id}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    selectedBreakpoint === bp.id ? 'bg-gray-700' : 'hover:bg-gray-700/50'
                  }`}
                  onClick={() => setSelectedBreakpoint(bp.id)}
                >
                  {bp.name}
                </button>
              ))}
            </div>
          )}
          
          {/* Size display */}
          <div className="text-sm text-gray-400">
            {displayWidth} × {displayHeight}px
          </div>
        </div>
        
        <button 
          onClick={onClose}
          className="p-2 hover:bg-gray-800 rounded"
        >
          <X size={20} />
        </button>
      </div>
      
      {/* Preview Content */}
      <div className="flex-1 overflow-auto p-8 flex justify-center items-center">
        <div 
          className="bg-white shadow-2xl transition-all duration-300 overflow-auto relative"
          style={{ 
            width: `${displayWidth}px`,
            height: `${displayHeight}px`,
            maxWidth: '100%',
            maxHeight: '100%',
            resize: isManualMode ? 'both' : 'none',
            border: isManualMode ? '2px solid #3b82f6' : '2px solid #e5e7eb',
            minHeight: '400px',
          }}
          onMouseUp={(e) => {
            if (isManualMode) {
              const target = e.currentTarget
              setManualWidth(target.offsetWidth)
              setManualHeight(target.offsetHeight)
            }
          }}
        >
          <iframe
            srcDoc={`
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: system-ui, -apple-system, sans-serif; }
                  </style>
                </head>
                <body>${previewHTML}</body>
              </html>
            `}
            className="w-full h-full min-h-[600px] border-0"
            title="Preview"
          />
        </div>
      </div>
    </div>
  )
}

