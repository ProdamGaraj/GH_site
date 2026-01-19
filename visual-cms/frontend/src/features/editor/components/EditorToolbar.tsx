import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Input'
import { ColorPicker } from '@/shared/components/ColorPicker'
import { ExpandableButton } from '@/shared/components/ExpandableButton'
import { Save, Eye, Undo, Redo, X, Check, Loader2, Monitor, Tablet, Smartphone, Laptop, Watch, Settings, Settings2, ZoomIn, ZoomOut, AlignLeft, AlignCenter, AlignRight, Download, Upload, Rocket, ExternalLink, ChevronDown, Palette, Pencil, FileText, Library, FileDown } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { selectRootNode, selectIsDirty, selectBreakpoints, selectZoom, selectBlockAlignment, selectEditMode, markAsSaved, setZoom, setBlockAlignment, setEditMode, setActiveEditBreakpoint, loadRootNode, selectBrowsers, selectSelectedBrowser, setSelectedBrowser, selectCanUndo, selectCanRedo, undo, redo, selectCanvasColor, setCanvasColor, selectInlineBlockEdit, startInlineBlockEdit, cancelInlineBlockEdit, finishInlineBlockEdit, selectSelectedNodeId, updateNode } from '@/features/editor/editorSlice'
import { createBlock, updateBlock, selectBlocksSaving } from '@/features/blocks/blocksSlice'
import { createPage, updatePage, selectPagesSaving } from '@/features/pages/pagesSlice'
import { BreakpointManager } from './BreakpointManager'
import { ExportImportModal } from './ExportImportModal'
import { deployApi, blockApi, pageApi } from '@/shared/api'
import { generateNodeTreeCSS } from '../utils/styleGenerator'
import type { BlockNode } from '@/shared/types'

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
  // Render props для разделения на части
  children?: (parts: { centerContent: React.ReactNode; rightContent: React.ReactNode }) => React.ReactNode
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ 
  type: _type, 
  blockId: _blockId,
  blockName: initialBlockName,
  viewport = 'desktop',
  onViewportChange,
  pageSettings,
  children
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
  const editMode = useAppSelector(selectEditMode)
  const browsers = useAppSelector(selectBrowsers)
  const selectedBrowser = useAppSelector(selectSelectedBrowser)
  const canUndo = useAppSelector(selectCanUndo)
  const canRedo = useAppSelector(selectCanRedo)
  const canvasColor = useAppSelector(selectCanvasColor)
  const inlineBlockEdit = useAppSelector(selectInlineBlockEdit)
  const selectedNodeId = useAppSelector(selectSelectedNodeId)
  
  const isNewBlock = id === 'new' || !id
  const isPageEditor = _type === 'page'
  const isSaving = isPageEditor ? isSavingPages : isSavingBlocks
  const isBlockEditMode = inlineBlockEdit.active
  
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showBreakpointManager, setShowBreakpointManager] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [importTabActive, setImportTabActive] = useState(false)
  const [blockName, setBlockName] = useState(initialBlockName || '')
  const [isReusable, setIsReusable] = useState(true)
  const [zoomInput, setZoomInput] = useState(String(zoom))
  const [isDeploying, setIsDeploying] = useState(false)
  const [deployResult, setDeployResult] = useState<{ success: boolean; message: string; url?: string } | null>(null)
  const [showViewportDropdown, setShowViewportDropdown] = useState(false)
  const [isSavingToLibrary, setIsSavingToLibrary] = useState(false)
  const [blockSaveResult, setBlockSaveResult] = useState<{ success: boolean; message: string } | null>(null)

  // Sync zoomInput with redux zoom when it changes externally
  React.useEffect(() => {
    setZoomInput(String(zoom))
  }, [zoom])

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in input/textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (canUndo) dispatch(undo())
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        if (canRedo) dispatch(redo())
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dispatch, canUndo, canRedo])

  const handleViewportChange = (newViewport: string) => {
    // При выборе 'base' переключаемся в base режим, иначе в responsive
    if (newViewport === 'base') {
      dispatch(setEditMode('base'))
    } else {
      dispatch(setEditMode('responsive'))
      // Явно устанавливаем activeEditBreakpoint на новый viewport
      dispatch(setActiveEditBreakpoint(newViewport))
    }
    
    // Вызываем родительский обработчик
    if (onViewportChange) {
      onViewportChange(newViewport)
    }
  }

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

  const handleDeploy = async () => {
    if (!id || isNewBlock) {
      setDeployResult({ success: false, message: 'Сначала сохраните страницу' })
      setTimeout(() => setDeployResult(null), 3000)
      return
    }

    setIsDeploying(true)
    setDeployResult(null)

    try {
      const result = await deployApi.deployPage(id)
      setDeployResult({
        success: result.success,
        message: result.message,
        url: result.publicUrl
      })
      
      // Автоматически скрываем сообщение через 5 секунд
      setTimeout(() => setDeployResult(null), 5000)
    } catch (error: any) {
      setDeployResult({
        success: false,
        message: error.message || 'Ошибка при публикации'
      })
      setTimeout(() => setDeployResult(null), 5000)
    } finally {
      setIsDeploying(false)
    }
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

  // Вспомогательные функции для сохранения блоков
  const cleanNode = (n: BlockNode): BlockNode => {
    const { _viewportId, ...rest } = n as any
    return {
      ...rest,
      children: n.children?.map(cleanNode) || []
    }
  }

  const findNodeById = (node: BlockNode, id: string): BlockNode | null => {
    if (node.id === id) return node
    for (const child of node.children) {
      const found = findNodeById(child, id)
      if (found) return found
    }
    return null
  }

  const collectLinkedBlocks = (node: BlockNode): { blockId: string, structure: BlockNode }[] => {
    const results: { blockId: string, structure: BlockNode }[] = []
    if (node.metadata?.linkedBlockId) {
      results.push({ blockId: node.metadata.linkedBlockId, structure: node })
    }
    for (const child of node.children || []) {
      results.push(...collectLinkedBlocks(child))
    }
    return results
  }

  // Сохранить все изменённые блоки в библиотеку
  const handleSaveAllToLibrary = async () => {
    if (!rootNode) return
    
    setIsSavingToLibrary(true)
    setBlockSaveResult(null)
    
    try {
      const linkedBlocks = collectLinkedBlocks(rootNode)
      let updatedCount = 0
      let createdCount = 0
      
      for (const { blockId, structure } of linkedBlocks) {
        try {
          // Проверяем существует ли блок
          try {
            await blockApi.getById(blockId)
            // Блок существует - обновляем
            await blockApi.update(blockId, { structure: cleanNode(structure) })
            updatedCount++
          } catch (err: any) {
            if (err.message?.includes('404')) {
              // Блок удалён - создаём новый
              const blockName = structure.metadata?.name || structure.tagName || 'Блок'
              const newBlock = await blockApi.create({
                name: blockName,
                type: 'section',
                structure: cleanNode(structure),
                isReusable: true,
                tags: ['restored']
              })
              // Обновляем linkedBlockId
              dispatch(updateNode({
                id: structure.id,
                updates: { metadata: { ...structure.metadata, linkedBlockId: newBlock.id } }
              }))
              createdCount++
            }
          }
        } catch (err) {
          console.error(`Ошибка сохранения блока ${blockId}:`, err)
        }
      }
      
      // Сохраняем страницу
      if (id && pageSettings) {
        await pageApi.update(id, {
          structure: cleanNode(rootNode),
          name: pageSettings.name,
          slug: pageSettings.slug,
        })
        dispatch(markAsSaved())
      }
      
      let message = ''
      if (updatedCount > 0) message += `Обновлено ${updatedCount} блок(ов)`
      if (createdCount > 0) message += (message ? ', ' : '') + `создано ${createdCount}`
      message += '. Страница сохранена.'
      
      setBlockSaveResult({ success: true, message })
      setTimeout(() => setBlockSaveResult(null), 3000)
      
      // Выходим из режима редактирования блоков
      dispatch(finishInlineBlockEdit())
    } catch (error) {
      console.error('Ошибка сохранения:', error)
      setBlockSaveResult({ success: false, message: 'Ошибка сохранения: ' + (error as Error).message })
      setTimeout(() => setBlockSaveResult(null), 5000)
    } finally {
      setIsSavingToLibrary(false)
    }
  }

  // Сохранить изменения только для этой страницы (не трогать библиотеку)
  const handleSaveForPageOnly = async () => {
    if (!rootNode || !id || !pageSettings) return
    
    setIsSavingToLibrary(true)
    setBlockSaveResult(null)
    
    try {
      // Просто сохраняем страницу с текущей структурой
      await pageApi.update(id, {
        structure: cleanNode(rootNode),
        name: pageSettings.name,
        slug: pageSettings.slug,
      })
      dispatch(markAsSaved())
      
      setBlockSaveResult({ success: true, message: 'Страница сохранена (библиотека не изменена)' })
      setTimeout(() => setBlockSaveResult(null), 3000)
      
      // Выходим из режима редактирования блоков
      dispatch(finishInlineBlockEdit())
    } catch (error) {
      console.error('Ошибка сохранения страницы:', error)
      setBlockSaveResult({ success: false, message: 'Ошибка: ' + (error as Error).message })
      setTimeout(() => setBlockSaveResult(null), 5000)
    } finally {
      setIsSavingToLibrary(false)
    }
  }

  // Центральная часть - действия НА странице (масштаб, цвета, viewport и т.д.)
  const centerContent = (
    <>
      {/* Edit Mode Toggle - переключатель режимов */}
      {isPageEditor && (
        <>
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => {
                if (isBlockEditMode) {
                  dispatch(cancelInlineBlockEdit())
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                !isBlockEditMode
                  ? 'bg-white shadow-sm text-primary-700'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              title="Редактирование настроек страницы"
            >
              <FileText size={16} />
              <span className="hidden sm:inline">Страница</span>
            </button>
            <button
              onClick={() => {
                // Включаем режим редактирования блоков
                dispatch(startInlineBlockEdit())
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                isBlockEditMode
                  ? 'bg-white shadow-sm text-primary-700'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              title="Режим редактирования блоков"
            >
              <Pencil size={16} />
              <span className="hidden sm:inline">Блок</span>
            </button>
          </div>
          <div className="h-6 w-px bg-gray-300 mx-2" />
        </>
      )}
      
      {/* Canvas color */}
      <div className="flex items-center gap-1 mr-2" title="Цвет фона холста">
        <Palette size={14} className="text-gray-500" />
        <ColorPicker
          value={canvasColor}
          onChange={(value) => dispatch(setCanvasColor(value))}
        />
      </div>
      
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
        
        <div className="flex items-center">
          <input
            type="text"
            value={zoomInput}
            onChange={(e) => setZoomInput(e.target.value)}
            onBlur={() => {
              const val = parseInt(zoomInput, 10)
              if (isNaN(val) || val < 25) {
                dispatch(setZoom(25))
                setZoomInput('25')
              } else if (val > 500) {
                dispatch(setZoom(500))
                setZoomInput('500')
              } else {
                dispatch(setZoom(val))
                setZoomInput(String(val))
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur()
              }
            }}
            onDoubleClick={handleZoomReset}
            className="px-1 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 rounded-l transition-colors w-[32px] text-right bg-transparent border-none outline-none focus:bg-gray-200 cursor-text"
            title="Введите масштаб или дважды кликните для сброса"
          />
          <span className="text-xs font-medium text-gray-700">%</span>
        </div>
        
        <button
          onClick={handleZoomIn}
          disabled={zoom >= 500}
          className="p-1.5 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Увеличить"
        >
          <ZoomIn size={16} className="text-gray-600" />
        </button>
        
        <div className="h-6 w-px bg-gray-300 mx-2" />
        
        <Button 
          variant="ghost" 
          size="sm" 
          disabled={!canUndo} 
          onClick={() => dispatch(undo())}
          title="Отменить (Ctrl+Z)"
        >
          <Undo size={16} className="text-gray-600" />
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          disabled={!canRedo} 
          onClick={() => dispatch(redo())}
          title="Повторить (Ctrl+Y)"
        >
          <Redo size={16} className="text-gray-600" />
        </Button>
        
        {/* Block alignment (only for block editor in responsive mode) */}
        {!isPageEditor && editMode === 'responsive' && (
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
        
        {/* Viewport switcher with Base mode */}
        {onViewportChange && (
          <>
            <div className="flex items-center gap-1 bg-gray-100 rounded p-1">
              {/* Base/Общий mode */}
              <button
                onClick={() => handleViewportChange('base')}
                className={`p-1.5 rounded transition-colors ${
                  viewport === 'base' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                }`}
                title="Общий режим - изменения для всех экранов"
              >
                <Settings2 size={16} className={viewport === 'base' ? 'text-primary-600' : 'text-gray-600'} />
              </button>
              
              {/* Breakpoints dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowViewportDropdown(!showViewportDropdown)}
                  className={`flex items-center gap-1 p-1.5 rounded transition-colors ${
                    viewport !== 'base' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                  }`}
                  title="Выбрать размер экрана"
                >
                  {(() => {
                    const currentBp = breakpoints.find(bp => bp.id === viewport)
                    if (!currentBp) return <Monitor size={16} className="text-gray-600" />
                    const IconComponent = currentBp.icon === 'monitor' ? Monitor
                      : currentBp.icon === 'laptop' ? Laptop
                      : currentBp.icon === 'tablet' ? Tablet
                      : currentBp.icon === 'smartphone' ? Smartphone
                      : currentBp.icon === 'watch' ? Watch
                      : Monitor
                    return <IconComponent size={16} className={viewport !== 'base' ? 'text-primary-600' : 'text-gray-600'} />
                  })()}
                  <ChevronDown size={12} className="text-gray-500" />
                </button>
                
                {showViewportDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowViewportDropdown(false)}
                    />
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[240px]">
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
                            onClick={() => {
                              handleViewportChange(bp.id)
                              setShowViewportDropdown(false)
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                              viewport === bp.id 
                                ? 'bg-primary-50 text-primary-700' 
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <IconComponent size={16} />
                            <span>{bp.name}</span>
                            <span className="text-xs text-gray-400 ml-auto">{bp.width}px</span>
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
              
              <button
                onClick={() => setShowBreakpointManager(true)}
                className="p-1.5 rounded hover:bg-gray-200 transition-colors border-l border-gray-300 ml-1 pl-2"
                title="Управление breakpoints"
              >
                <Settings size={16} className="text-gray-600" />
              </button>
            </div>
            
            {/* Browser Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Браузер:</span>
              <select
                value={selectedBrowser || ''}
                onChange={(e) => dispatch(setSelectedBrowser(e.target.value || null))}
                className="px-2 py-1 text-sm text-gray-900 border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="" className='text-xs text-gray-600'>Не выбран</option>
                {browsers.map(browser => (
                  <option key={browser.id} value={browser.id} className='text-sm text-black-600'>
                    {browser.icon} {browser.name}
                  </option>
                ))}
              </select>
              {selectedBrowser && browsers.find(b => b.id === selectedBrowser) && (
                <span className="text-xs text-gray-800">
                  {browsers.find(b => b.id === selectedBrowser)?.viewportHeightOffset}px
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )

  // Правая часть - действия СО страницей (сохранить, экспорт, публикация)
  const rightContent = (
    <>
      <ExpandableButton
        icon={<Eye size={16} />}
        label="Предпросмотр"
        onClick={handlePreview}
        variant="secondary"
      />
      
      <ExpandableButton
        icon={<Download size={16} />}
        label="Экспорт"
        onClick={() => { setShowExportModal(true); setImportTabActive(false) }}
        variant="secondary"
      />
      
      <ExpandableButton
        icon={<Upload size={16} />}
        label="Импорт"
        onClick={() => { setShowExportModal(true); setImportTabActive(true) }}
        variant="secondary"
      />
      
      {/* Conditional save buttons based on edit mode */}
      {isBlockEditMode ? (
        <>
          <ExpandableButton
            icon={isSavingToLibrary ? <Loader2 size={16} className="animate-spin" /> : <Library size={16} />}
            label="В библиотеку"
            onClick={handleSaveAllToLibrary}
            disabled={isSavingToLibrary || !isDirty}
            variant="primary"
            title="Сохранить изменения блоков в библиотеку и на страницу"
          />
          <ExpandableButton
            icon={isSavingToLibrary ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
            label="Только страница"
            onClick={handleSaveForPageOnly}
            disabled={isSavingToLibrary || !isDirty}
            variant="secondary"
            title="Сохранить только для этой страницы (библиотека не изменится)"
          />
        </>
      ) : (
        <ExpandableButton
          icon={isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          label="Сохранить"
          onClick={handleSave}
          disabled={isSaving || !isDirty}
          variant="primary"
        />
      )}

      {/* Deploy button - only for page editor */}
      {isPageEditor && !isNewBlock && (
        <ExpandableButton
          icon={isDeploying ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
          label="Опубликовать"
          onClick={handleDeploy}
          disabled={isDeploying || isDirty}
          title={isDirty ? 'Сначала сохраните изменения' : 'Опубликовать страницу на сайт'}
          variant="success"
        />
      )}

      {/* Deploy result notification */}
      {deployResult && (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${
          deployResult.success 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {deployResult.success ? <Check size={16} /> : <X size={16} />}
          <span>{deployResult.message}</span>
          {deployResult.url && (
            <a 
              href={deployResult.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 underline hover:no-underline"
            >
              Открыть <ExternalLink size={14} />
            </a>
          )}
        </div>
      )}

      {/* Block save result notification */}
      {blockSaveResult && (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${
          blockSaveResult.success 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {blockSaveResult.success ? <Check size={16} /> : <X size={16} />}
          <span>{blockSaveResult.message}</span>
        </div>
      )}
    </>
  )

  // Модальные окна и диалоги
  const modalsContent = (
    <>
      {/* Export/Import Modal */}
      {showExportModal && rootNode && (
        <ExportImportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          node={rootNode}
          name={isPageEditor ? (pageSettings?.name || 'Page') : (blockName || 'Block')}
          type={isPageEditor ? 'page' : 'block'}
          defaultTab={importTabActive ? 'import' : 'export'}
          onImport={(importedNode) => {
            dispatch(loadRootNode(importedNode))
          }}
        />
      )}

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

      {showBreakpointManager && (
        <BreakpointManager onClose={() => setShowBreakpointManager(false)} />
      )}
    </>
  )

  // Если children передан - используем render props паттерн
  if (children) {
    return (
      <>
        {children({ centerContent, rightContent })}
        {modalsContent}
      </>
    )
  }

  // Иначе - обычный рендер (для обратной совместимости)
  return (
    <>
      {centerContent}
      {rightContent}
      {modalsContent}
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
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<string | null>(null)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [startSize, setStartSize] = useState({ width: 0, height: 0 })
  const [zoom, setZoomState] = useState(100)
  const [zoomInput, setZoomInput] = useState('100')
  const [ctrlPressed, setCtrlPressed] = useState(false)
  const previewRef = React.useRef<HTMLDivElement>(null)

  // Sync zoomInput with zoom state
  React.useEffect(() => {
    setZoomInput(String(zoom))
  }, [zoom])
  
  const currentBreakpoint = breakpoints.find(bp => bp.id === selectedBreakpoint)
  const displayWidth = isManualMode ? manualWidth : (currentBreakpoint?.width || 1440)
  const displayHeight = isManualMode ? manualHeight : (currentBreakpoint?.height || 900)

  const handleBreakpointSelect = (breakpointId: string) => {
    setSelectedBreakpoint(breakpointId)
    setIsManualMode(false)
    const bp = breakpoints.find(b => b.id === breakpointId)
    if (bp) {
      setManualWidth(bp.width)
      setManualHeight(bp.height || 900)
    }
  }

  const handleManualModeToggle = (enabled: boolean) => {
    setIsManualMode(enabled)
    if (enabled && currentBreakpoint) {
      setManualWidth(currentBreakpoint.width)
      setManualHeight(currentBreakpoint.height || 900)
    }
  }

  const handleResizeStart = (e: React.MouseEvent, direction: string) => {
    if (!isManualMode) return
    e.preventDefault()
    setIsResizing(true)
    setResizeDirection(direction)
    setStartPos({ x: e.clientX, y: e.clientY })
    setStartSize({ width: manualWidth, height: manualHeight })
  }

  React.useEffect(() => {
    if (!isResizing || !resizeDirection) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startPos.x
      const deltaY = e.clientY - startPos.y

      let newWidth = startSize.width
      let newHeight = startSize.height

      // Handle horizontal resizing
      if (resizeDirection.includes('right')) {
        newWidth = Math.max(320, Math.min(3840, startSize.width + deltaX))
      }

      // Handle vertical resizing
      if (resizeDirection.includes('bottom')) {
        newHeight = Math.max(400, Math.min(2160, startSize.height + deltaY))
      }

      setManualWidth(Math.round(newWidth))
      setManualHeight(Math.round(newHeight))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      setResizeDirection(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, resizeDirection, startPos, startSize])

  // Track Ctrl key to disable iframe pointer-events for wheel zoom
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        setCtrlPressed(true)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        setCtrlPressed(false)
      }
    }
    // Also reset on blur (in case user releases key outside window)
    const handleBlur = () => setCtrlPressed(false)

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  // Handle Ctrl + Wheel zoom - capture at document level when preview is open
  React.useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        e.stopPropagation()
        const delta = -e.deltaY
        const newZoom = Math.max(25, Math.min(500, zoom + delta * 0.1))
        setZoomState(Math.round(newZoom))
      }
    }

    // Add listener to document with capture phase to intercept before browser zoom
    document.addEventListener('wheel', handleWheel, { passive: false, capture: true })
    return () => document.removeEventListener('wheel', handleWheel, { capture: true })
  }, [zoom])

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
    
    // Add data-element-id for state styles and animations
    const dataAttr = `data-element-id="${node.id}"`

    const childrenHTML = node.children.map(child => generateHTML(child)).join('')
    const content = node.content || ''

    return `<${node.tagName} style="${styleString}" ${dataAttr} ${attrs}>${content}${childrenHTML}</${node.tagName}>`
  }

  const previewHTML = generateHTML(rootNode)
  
  // Generate CSS for states (hover, etc.) and animations
  const { css: stateAnimCSS, keyframes, scripts: animScripts } = generateNodeTreeCSS(rootNode)

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex flex-col z-[100]"
    >
      {/* Header */}
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-wrap">
          <h2 className="font-medium">Предпросмотр</h2>
          
          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setZoomState(Math.max(25, zoom - 10))}
              disabled={zoom <= 25}
              className="p-1.5 rounded hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Уменьшить масштаб"
            >
              <ZoomOut size={16} className="text-gray-300" />
            </button>
            
            <div className="flex items-center">
              <input
                type="text"
                value={zoomInput}
                onChange={(e) => setZoomInput(e.target.value)}
                onBlur={() => {
                  const val = parseInt(zoomInput, 10)
                  if (isNaN(val) || val < 25) {
                    setZoomState(25)
                    setZoomInput('25')
                  } else if (val > 500) {
                    setZoomState(500)
                    setZoomInput('500')
                  } else {
                    setZoomState(val)
                    setZoomInput(String(val))
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur()
                  }
                }}
                onDoubleClick={() => setZoomState(100)}
                className="px-1 py-1 text-xs font-medium text-gray-300 hover:bg-gray-700 rounded-l transition-colors w-[32px] text-right bg-transparent border-none outline-none focus:bg-gray-700 cursor-text"
                title="Введите масштаб или дважды кликните для сброса"
              />
              <span className="text-xs font-medium text-gray-300">%</span>
            </div>
            
            
            <button
              onClick={() => setZoomState(Math.min(500, zoom + 10))}
              disabled={zoom >= 500}
              className="p-1.5 rounded hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Увеличить масштаб"
            >
              <ZoomIn size={16} className="text-gray-300" />
            </button>
          </div>
          
          {/* Breakpoint buttons - always visible */}
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
            {breakpoints.map((bp) => (
              <button
                key={bp.id}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  selectedBreakpoint === bp.id && !isManualMode ? 'bg-gray-700' : 'hover:bg-gray-700/50'
                }`}
                onClick={() => handleBreakpointSelect(bp.id)}
                title={`${bp.name} (${bp.width}px)`}
              >
                {bp.name}
              </button>
            ))}
          </div>
          
          {/* Manual mode toggle */}
          <label className="flex items-center gap-2 cursor-pointer bg-gray-800 px-3 py-1.5 rounded-lg">
            <input
              type="checkbox"
              checked={isManualMode}
              onChange={(e) => handleManualModeToggle(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm">Ручной режим</span>
          </label>
          
          {/* Size display and controls */}
          <div className="flex items-center gap-3 bg-gray-800 px-3 py-1.5 rounded-lg">
            {isManualMode ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Ширина:</span>
                  <input
                    type="number"
                    value={manualWidth}
                    onChange={(e) => setManualWidth(Math.max(320, Math.min(3840, parseInt(e.target.value) || 320)))}
                    className="w-20 px-2 py-1 bg-gray-700 text-white text-sm rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                    min="320"
                    max="3840"
                    step="1"
                  />
                  <input
                    type="range"
                    value={manualWidth}
                    onChange={(e) => setManualWidth(parseInt(e.target.value))}
                    className="w-32"
                    min="320"
                    max="3840"
                    step="1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Высота:</span>
                  <input
                    type="number"
                    value={manualHeight}
                    onChange={(e) => setManualHeight(Math.max(400, Math.min(2160, parseInt(e.target.value) || 400)))}
                    className="w-20 px-2 py-1 bg-gray-700 text-white text-sm rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                    min="400"
                    max="2160"
                    step="1"
                  />
                  <input
                    type="range"
                    value={manualHeight}
                    onChange={(e) => setManualHeight(parseInt(e.target.value))}
                    className="w-32"
                    min="400"
                    max="2160"
                    step="1"
                  />
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-300">
                {displayWidth} × {displayHeight}px
              </div>
            )}
          </div>
        </div>
        
        <button 
          onClick={onClose}
          className="p-2 hover:bg-gray-800 rounded transition-colors"
        >
          <X size={20} />
        </button>
      </div>
      
      {/* Preview Content */}
      <div 
        ref={previewRef}
        className="flex-1 overflow-auto p-8 flex justify-center items-center bg-gray-800"
      >
        <div 
          className="relative" 
          style={{ 
            display: 'inline-block',
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'center center',
          }}
        >
          <div 
            className="bg-white shadow-2xl overflow-auto"
            style={{ 
              width: `${displayWidth}px`,
              height: `${displayHeight}px`,
              border: isManualMode ? '2px solid #3b82f6' : '2px solid #e5e7eb',
              userSelect: isResizing ? 'none' : 'auto',
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
                      ${keyframes}
                      ${stateAnimCSS}
                    </style>
                  </head>
                  <body>${previewHTML}${animScripts ? `<script>${animScripts}</script>` : ''}</body>
                </html>
              `}
              className="w-full h-full border-0"
              title="Preview"
              style={{ pointerEvents: (isResizing || ctrlPressed) ? 'none' : 'auto' }}
            />
          </div>
          
          {/* Resize handles - positioned outside the iframe container (DevTools style) */}
          {isManualMode && (
            <>
              {/* Bottom-right corner handle (main) */}
              <div
                onMouseDown={(e) => handleResizeStart(e, 'bottom-right')}
                className="absolute w-4 h-4 bg-blue-500 cursor-nwse-resize hover:bg-blue-600 z-10"
                style={{ 
                  bottom: '0',
                  right: '0',
                  transform: 'translate(50%, 50%)',
                  boxShadow: '0 0 0 1px white, 0 2px 4px rgba(0,0,0,0.3)',
                }}
              />
              
              {/* Bottom edge handle */}
              <div
                onMouseDown={(e) => handleResizeStart(e, 'bottom')}
                className="absolute cursor-ns-resize hover:bg-blue-500/20 z-10"
                style={{ 
                  bottom: '0',
                  left: '0',
                  right: '0',
                  height: '8px',
                  transform: 'translateY(50%)',
                  borderBottom: '2px solid #3b82f6',
                }}
              />
              
              {/* Right edge handle */}
              <div
                onMouseDown={(e) => handleResizeStart(e, 'right')}
                className="absolute cursor-ew-resize hover:bg-blue-500/20 z-10"
                style={{ 
                  right: '0',
                  top: '0',
                  bottom: '0',
                  width: '8px',
                  transform: 'translateX(50%)',
                  borderRight: '2px solid #3b82f6',
                }}
              />
              
              {/* Size indicator overlay */}
              <div
                className="absolute bg-blue-500 text-white text-xs font-mono px-2 py-1 pointer-events-none z-20"
                style={{
                  top: '-28px',
                  left: '0',
                  opacity: isResizing ? 1 : 0,
                  transition: 'opacity 0.15s',
                }}
              >
                {manualWidth} × {manualHeight}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

