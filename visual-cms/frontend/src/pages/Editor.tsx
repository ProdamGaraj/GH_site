import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { 
  DndContext, 
  DragEndEvent, 
  DragStartEvent,
  DragOverEvent,
  DragMoveEvent,
  useSensor, 
  useSensors, 
  PointerSensor, 
  MouseSensor,
  pointerWithin,
  MeasuringStrategy,
} from '@dnd-kit/core'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { 
  createNewEditor, 
  selectRootNode, 
  addNode, 
  moveNode,
  reorderNode,
  updateNodePosition,
  startDrag,
  endDrag,
  selectDragState,
  setViewport,
  selectViewport,
  selectActiveLeftPanel,
  selectActiveRightPanel,
  setActiveLeftPanel,
  setActiveRightPanel,
  selectInlineBlockEdit,
  markAsDirty,
} from '@/features/editor/editorSlice'
import { Header } from '@/shared/components/Header'
import { EditorToolbar } from '@/features/editor/components/EditorToolbar'
import { Canvas } from '@/features/editor/components/Canvas/Canvas'
// import { LeftPanel } from '@/features/editor/components/LeftPanel/LeftPanel'
import { LibraryPanel } from '@/features/editor/components/LibraryPanel/LibraryPanel'
import { PageSettingsPanel } from '@/features/editor/components/PageSettings/PageSettingsPanel'
import { BasicSettingsPanel } from '@/features/editor/components/RightPanel/BasicSettingsPanel'
import { PositioningPanel } from '@/features/editor/components/RightPanel/PositioningPanel'
import { ColorsPanel } from '@/features/editor/components/RightPanel/ColorsPanel'
import { ContentPanel } from '@/features/editor/components/RightPanel/ContentPanel'
import { StatesPanel } from '@/features/editor/components/RightPanel/StatesPanel'
import { AnimationsPanel } from '@/features/editor/components/RightPanel/AnimationsPanel'
import { ScriptsPanel } from '@/features/editor/components/RightPanel/ScriptsPanel'
import { DataPanel } from '@/features/editor/components/RightPanel/DataPanel'
import { SlidesPanel } from '@/features/editor/components/RightPanel/SlidesPanel'
import { CSSPanel } from '@/features/editor/components/RightPanel/CSSPanel'
import { LeftSidebar } from '@/features/editor/components/Sidebar/LeftSidebar'
import { RightSidebar } from '@/features/editor/components/Sidebar/RightSidebar'
import { SavedBlocksLibrary } from '@/features/editor/components/SavedBlocksLibrary/SavedBlocksLibrary'
import { LayersPanel } from '@/features/editor/components/LeftPanel/LayersPanel'
import { DragOverlay } from '@/features/editor/components/Canvas/DragOverlay'
import { SaveStatusIndicator } from '@/features/editor/components/SaveStatusIndicator'
import { useAutoSave } from '@/features/editor/hooks/useAutoSave'
import { validateDrop } from '@/features/editor/utils/dropValidation'
import type { DragItem, BlockNode, EditorPageSettings } from '@/shared/types'
import { DataBindingProvider } from '@/features/dataBindings'
import { TranslationPanel } from '@/features/translations/TranslationPanel'
import { LanguageSettingsPanel } from '@/features/translations/LanguageSettingsPanel'
import { VersionHistoryPanel } from '@/features/editor/components/VersionHistoryPanel'
import { visibleRightPanelSections } from '@/features/editor/rightPanelSections'

import { 
  DropIndicator, 
  collectElementRects, 
  determineDropTarget,
  getLayoutMode,
} from '@/features/editor/utils/dndUtils'
import { DropValidationToast, useValidationToast } from '@/features/editor/components/DropValidationToast'

interface EditorProps {
  type: 'page' | 'block'
}

// Helper to find node by id
const findNodeById = (node: BlockNode, id: string): BlockNode | null => {
  if (node.id === id) return node
  for (const child of node.children) {
    const found = findNodeById(child, id)
    if (found) return found
  }
  return null
}

export const Editor: React.FC<EditorProps> = ({ type }) => {
  const { id } = useParams()
  const dispatch = useAppDispatch()
  const rootNode = useAppSelector(selectRootNode)
  const dragState = useAppSelector(selectDragState)
  const viewport = useAppSelector(selectViewport) as 'desktop' | 'tablet' | 'mobile'
  const activeLeftPanel = useAppSelector(selectActiveLeftPanel)
  const activeRightPanel = useAppSelector(selectActiveRightPanel)
  const inlineBlockEdit = useAppSelector(selectInlineBlockEdit)
  const validationToast = useValidationToast()
  const [leftPanelWidth, setLeftPanelWidth] = useState(280)
  const [isResizingLeft, setIsResizingLeft] = useState(false)
  const [rightPanelWidth, setRightPanelWidth] = useState(320)
  const [isResizingRight, setIsResizingRight] = useState(false)
  // Правая панель — одна непрерывная лента секций; сайдбар лишь скроллит к ним.
  const rightSections = visibleRightPanelSections(type)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [activeSection, setActiveSection] = useState<string>(rightSections[0]?.id || 'basicSettings')
  const rightScrollRef = useRef<HTMLDivElement | null>(null)
  // Контейнер ленты как state: он монтируется ПОЗЖЕ первого рендера (после
  // загрузки страницы), и scroll-spy должен переподписаться на реальный DOM-узел.
  const [rightScrollEl, setRightScrollEl] = useState<HTMLDivElement | null>(null)
  const attachRightScroll = useCallback((el: HTMLDivElement | null) => {
    rightScrollRef.current = el
    setRightScrollEl(el)
  }, [])
  // const [isLibraryOpen, setIsLibraryOpen] = useState(true)
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null)
  const [targetContainerRect, setTargetContainerRect] = useState<DOMRect | null>(null)
  const [targetLayoutMode, setTargetLayoutMode] = useState<'flex' | 'grid' | 'absolute' | 'table'>('flex')
  const [activeNode, setActiveNode] = useState<BlockNode | null>(null)
  const [loading, setLoading] = useState(false)
  // Данные загруженного блока (Template) — сохраняем при загрузке; сейчас не
  // читаются в панели (ленте), сеттер оставлен для будущего использования.
  const [, setCurrentBlockData] = useState<any>(null)
  const [pageVersion, setPageVersion] = useState(1)
  const [pageSettings, setPageSettings] = useState<EditorPageSettings>({
    name: '',
    slug: '',
    status: 'draft' as 'draft' | 'published' | 'archived',
    metaTitle: '',
    metaDescription: '',
    keywords: '',
    ogImage: '',
    scripts: [],
  })
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const dropIndicatorRef = useRef<DropIndicator | null>(null)
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  // Last (cursor, dnd-kit delta) tuple used to suppress sub-pixel re-runs.
  // Storing delta too is needed for autoscroll: when the canvas scrolls but the
  // cursor stays still in viewport coords, only delta changes, and skipping
  // would otherwise leave the indicator stale.
  const lastMousePosRef = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null)
  // Cursor's true viewport coords (clientX/Y), kept in sync via a global
  // pointermove listener. We can't derive these from dnd-kit's event.delta
  // because delta includes ancestor-scroll adjustments — during autoscroll
  // that makes mousePosition diverge from getBoundingClientRect's viewport
  // space, and isPointInRect stops matching any container.
  const cursorRef = useRef<{ x: number; y: number } | null>(null)
  
  // Auto-save hook - ОТКЛЮЧЕНО, сохранение только по кнопке
  const isNewDocument = !id || id === 'new'
  const autoSave = useAutoSave({
    documentId: isNewDocument ? null : id,
    documentType: type,
    pageSettings: type === 'page' ? pageSettings : undefined,
    enabled: false, // ОТКЛЮЧЕНО - сохранение только вручную
    debounceMs: 3000,
    onSaveSuccess: () => {
      console.log('Auto-saved successfully')
    },
    onSaveError: (error) => {
      console.error('Auto-save failed:', error)
    },
  })
  
  // Global pointer tracking — see cursorRef declaration for why dnd-kit's delta
  // is unusable. Listener stays mounted for the editor's lifetime; pointermove
  // is cheap and only updates a ref.
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      cursorRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    return () => window.removeEventListener('pointermove', onPointerMove)
  }, [])

  // Keep ref in sync with state
  useEffect(() => {
    dropIndicatorRef.current = dropIndicator
  }, [dropIndicator])

  // Handle left panel resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingLeft) return
      const newWidth = e.clientX
      if (newWidth >= 200 && newWidth <= 600) {
        setLeftPanelWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizingLeft(false)
    }

    if (isResizingLeft) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizingLeft])

  // Handle right panel resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRight) return
      const newWidth = window.innerWidth - e.clientX
      if (newWidth >= 280 && newWidth <= 600) {
        setRightPanelWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizingRight(false)
    }

    if (isResizingRight) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizingRight])

  // Скролл ленты к секции + раскрытие панели, если свёрнута. rAF — на случай,
  // когда контейнер только что вернулся из collapsed и ещё не в DOM.
  const scrollToSection = useCallback((sectionId: string) => {
    setRightPanelCollapsed(false)
    setActiveSection(sectionId)
    requestAnimationFrame(() => {
      const root = rightScrollRef.current
      const el = root?.querySelector<HTMLElement>(`[data-rp="${sectionId}"]`)
      if (root && el) {
        const delta = el.getBoundingClientRect().top - root.getBoundingClientRect().top
        root.scrollTo({ top: root.scrollTop + delta, behavior: 'smooth' })
      }
    })
  }, [])

  // Scroll-spy: активна последняя секция, чей верх поднялся к верху контейнера.
  // Обновляем activeSection только при смене — без churn на каждый пиксель.
  // Подписка через rightScrollEl (state), а не ref: контейнер появляется после
  // загрузки, и слушатель должен навеситься на актуальный узел.
  useEffect(() => {
    const root = rightScrollEl
    if (rightPanelCollapsed || activeRightPanel === 'languageSettings' || !root) return

    let raf = 0
    const spy = () => {
      raf = 0
      const rootTop = root.getBoundingClientRect().top
      const secs = Array.from(root.querySelectorAll<HTMLElement>('[data-rp]'))
      let current = secs[0]?.dataset.rp
      for (const s of secs) {
        if (s.getBoundingClientRect().top - rootTop <= 8) current = s.dataset.rp
        else break
      }
      if (current) setActiveSection((prev) => (prev === current ? prev : current))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(spy)
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    spy()
    return () => {
      root.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [rightScrollEl, rightPanelCollapsed, activeRightPanel, type])

  // Выбор элемента на канвасе → только раскрыть панель, если свёрнута.
  // Ленту НЕ скроллим: при переключении блоков панель остаётся на месте,
  // чтобы можно было править одну и ту же секцию у разных элементов.
  const selectedNodeId = useAppSelector((s) => s.editor.selectedNodeId)
  useEffect(() => {
    if (selectedNodeId) setRightPanelCollapsed(false)
  }, [selectedNodeId])

  useEffect(() => {
    const loadEditor = async () => {
      // Site-level ассеты резолвим ниже по page.siteId. По умолчанию (блок /
      // новая страница / страница без сайта) — сбрасываем, чтобы канвас не тянул
      // чужой site-CSS от прежде открытой страницы.
      const { setSiteGlobalAssets } = await import('@/features/editor/editorSlice')
      dispatch(setSiteGlobalAssets({}))

      // Проверяем есть ли импортированный контент
      const importedContentStr = sessionStorage.getItem('importedContent')
      if (importedContentStr && (!id || id === 'new')) {
        try {
          const importedContent = JSON.parse(importedContentStr)
          sessionStorage.removeItem('importedContent') // Очищаем после использования
          
          // Загружаем импортированную структуру
          const { loadEditor: loadEditorAction } = await import('@/features/editor/editorSlice')
          dispatch(loadEditorAction(importedContent.node))
          
          // Устанавливаем имя для страницы
          if (type === 'page' && importedContent.name) {
            setPageSettings(prev => ({
              ...prev,
              name: importedContent.name,
              slug: importedContent.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            }))
          }
          return
        } catch (e) {
          console.error('Failed to load imported content:', e)
          sessionStorage.removeItem('importedContent')
        }
      }
      
      if (!id || id === 'new') {
        dispatch(createNewEditor())
      } else if (type === 'block') {
        // Load existing block
        setLoading(true)
        try {
          const { fetchBlockById } = await import('@/features/blocks/blocksSlice')
          const result = await dispatch(fetchBlockById(id)).unwrap()
          
          // Сохраняем данные блока (включая isTemplate, detectedFields)
          setCurrentBlockData(result)
          
          // Load the block structure into editor
          const { loadEditor: loadEditorAction } = await import('@/features/editor/editorSlice')
          dispatch(loadEditorAction(result.structure))
          
          // Load ALL data bindings (needed for nested blocks like Projects Grid inside Projects Section)
          const { fetchAllBindings } = await import('@/features/dataBindings/dataBindingsSlice')
          dispatch(fetchAllBindings())
          
          // Load all blocks (needed for repeater templates)
          const { fetchBlocks } = await import('@/features/blocks/blocksSlice')
          dispatch(fetchBlocks())
        } catch (error) {
          console.error('Failed to load block:', error)
        } finally {
          setLoading(false)
        }
      } else if (type === 'page') {
        // Load existing page
        setLoading(true)
        try {
          const { fetchPageById } = await import('@/features/pages/pagesSlice')
          const result = await dispatch(fetchPageById(id)).unwrap()
          
          // Load the page structure into editor
          const { loadEditor: loadEditorAction } = await import('@/features/editor/editorSlice')
          dispatch(loadEditorAction(result.structure))
          setPageVersion(result.version || 1)

          // Site-level globalCss/globalJs страницы: резолвим по siteId и кладём в
          // стор — канвас инжектит их так же, как деплой (site → page → block).
          if (result.siteId) {
            try {
              const { siteApi } = await import('@/shared/api')
              const site = await siteApi.getById(result.siteId)
              dispatch(setSiteGlobalAssets({ css: site.settings?.globalCss, js: site.settings?.globalJs }))
            } catch {
              // Сайт недоступен — остаёмся без site-CSS, редактор не роняем.
            }
          }

          // Load page settings
          setPageSettings({
            name: result.name,
            slug: result.slug,
            status: result.status || 'draft',
            metaTitle: result.metadata?.title || '',
            metaDescription: result.metadata?.description || '',
            keywords: result.metadata?.keywords?.join(', ') || '',
            ogImage: result.metadata?.ogImage || '',
            scripts: result.scripts || [],
          })

          // Load data bindings for all blocks on this page
          const { fetchBindingsForPage } = await import('@/features/dataBindings/dataBindingsSlice')
          dispatch(fetchBindingsForPage(id))

          // Load all blocks (needed for repeater templates)
          const { fetchBlocks } = await import('@/features/blocks/blocksSlice')
          dispatch(fetchBlocks())
        } finally {
          setLoading(false)
        }
      }
    }
    
    loadEditor()
  }, [id, type, dispatch])
  
  // Set default right panel for page editor
  useEffect(() => {
    if (type === 'page') {
      dispatch(setActiveRightPanel('pageSettings'))
    }
  }, [type, dispatch])

  // Root container width is managed by Canvas viewport wrapper (CSS-only).
  // Do NOT dispatch updateNodeStyles here — it mutates base styles on every
  // viewport switch, writes the viewport-specific width into the saved structure,
  // and marks the page dirty.

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active, activatorEvent } = event
    const dragData = active.data.current as DragItem

    // Reset per-drag refs. Without this, leftovers from the previous drag
    // (stale indicator, stale subpixel-skip baseline) leak into the new one.
    dropIndicatorRef.current = null
    lastMousePosRef.current = null

    // Seed cursorRef from the mousedown event in case pointermove hasn't fired
    // yet (drag activates as soon as the activation distance is exceeded).
    const startEvent = activatorEvent as MouseEvent
    if (startEvent && typeof startEvent.clientX === 'number') {
      cursorRef.current = { x: startEvent.clientX, y: startEvent.clientY }
    }

    if (dragData?.type === 'canvas-element' && dragData.node) {
      dispatch(startDrag({ nodeId: dragData.node.id }))
      setActiveNode(dragData.node)
      
      // Calculate offset from cursor to element's top-left corner
      const mouseEvent = activatorEvent as MouseEvent
      if (mouseEvent) {
        const element = document.querySelector(`[data-element-id="${dragData.node.id}"]`)
        if (element) {
          const rect = element.getBoundingClientRect()
          dragOffsetRef.current = {
            x: mouseEvent.clientX - rect.left,
            y: mouseEvent.clientY - rect.top,
          }
        }
      }
    } else if (dragData?.type === 'library-item') {
      // For library items, we don't have a node yet - use default offset
      dragOffsetRef.current = { x: 20, y: 20 }
      setActiveNode(null)
    }
  }, [dispatch])

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    if (!rootNode) return

    const { active, activatorEvent } = event
    const dragData = active.data.current as DragItem

    // Prefer the global pointer-tracking ref over activatorEvent.clientX + delta.
    // dnd-kit's delta includes ancestor-scroll adjustments, so during canvas
    // autoscroll the derived coords drift out of viewport space and stop
    // matching getBoundingClientRect-based element rects.
    const tracked = cursorRef.current
    const mouseEvent = activatorEvent as MouseEvent | null
    const mousePosition = tracked
      ? tracked
      : mouseEvent
        ? {
            x: mouseEvent.clientX + (event.delta?.x || 0),
            y: mouseEvent.clientY + (event.delta?.y || 0),
          }
        : null
    if (!mousePosition) return

    // Skip sub-pixel updates — but compare BOTH viewport coords and dnd-kit's
    // delta. During canvas autoscroll the cursor stays put in viewport space
    // while delta keeps changing (it tracks scroll-adjusted translation), so a
    // pure-coord check would freeze the indicator until the user moves again.
    const delta = event.delta || { x: 0, y: 0 }
    const last = lastMousePosRef.current
    if (
      last &&
      Math.abs(last.x - mousePosition.x) < 1 &&
      Math.abs(last.y - mousePosition.y) < 1 &&
      Math.abs(last.dx - delta.x) < 1 &&
      Math.abs(last.dy - delta.y) < 1
    ) {
      return
    }
    lastMousePosRef.current = { x: mousePosition.x, y: mousePosition.y, dx: delta.x, dy: delta.y }

    // Collect all element rects
    const canvasElement = document.querySelector('[data-canvas="true"]')
    if (!canvasElement) return

    const elementRects = collectElementRects(canvasElement as HTMLElement)
    
    // Check if dragged element has position: absolute
    const draggedNode = dragData?.type === 'canvas-element' ? dragData.node : null
    const isAbsoluteElement = draggedNode?.styles?.properties?.position === 'absolute'
    
    // Determine drop target (pass drag offset for absolute positioning)
    const draggedId = draggedNode?.id
    let indicator = determineDropTarget(
      rootNode, 
      mousePosition, 
      draggedId || '', 
      elementRects,
      dragOffsetRef.current
    )
    
    // If element has position: absolute, check if it's within parent bounds
    if (isAbsoluteElement && indicator && draggedNode) {
      // Get the element's current parent
      const sourceParentId = dragState.sourceParentId
      const sourceParentRect = sourceParentId ? elementRects.get(sourceParentId) : null
      const draggedRect = elementRects.get(draggedNode.id)
      
      if (sourceParentRect && draggedRect) {
        const offset = dragOffsetRef.current
        const elementWidth = draggedRect.width
        const elementHeight = draggedRect.height
        
        // Calculate potential position relative to source parent
        const potentialX = mousePosition.x - sourceParentRect.left - offset.x
        const potentialY = mousePosition.y - sourceParentRect.top - offset.y
        
        // Check if element would stay within parent bounds
        const isWithinParent = 
          potentialX >= -elementWidth / 2 &&
          potentialY >= -elementHeight / 2 &&
          potentialX <= sourceParentRect.width - elementWidth / 2 &&
          potentialY <= sourceParentRect.height - elementHeight / 2
        
        if (isWithinParent) {
          // Clamp coordinates to parent bounds (integer values)
          const clampedX = Math.round(Math.max(0, Math.min(potentialX, sourceParentRect.width - elementWidth)))
          const clampedY = Math.round(Math.max(0, Math.min(potentialY, sourceParentRect.height - elementHeight)))
          
          indicator = {
            ...indicator,
            type: 'absolute-position',
            targetParentId: sourceParentId || '',
            absoluteCoords: {
              x: clampedX,
              y: clampedY,
            }
          }
        }
        // If outside parent bounds, keep the indicator as-is (will trigger parent change mode)
      }
    }
    
    if (indicator) {
      // Sync ref synchronously — useEffect-based sync runs after render and
      // races with handleDragEnd (which reads dropIndicatorRef.current). A fast
      // release right after the last move would otherwise drop with a stale ref.
      dropIndicatorRef.current = indicator
      setDropIndicator(indicator)

      // Get target container rect for highlight
      const targetParentRect = elementRects.get(indicator.targetParentId)
      setTargetContainerRect(targetParentRect || null)


      // Get layout mode
      const targetParent = findNodeById(rootNode, indicator.targetParentId)
      if (targetParent) {
        setTargetLayoutMode(getLayoutMode(targetParent))
      }
    }
  }, [rootNode, dragState.sourceParentId])

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // This is handled by DragMove for more precise control
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    const dragData = active.data.current as any

    // Use ref to get the latest indicator value
    const currentIndicator = dropIndicatorRef.current

    // Clear drag state — both React state and the ref. setDropIndicator(null)
    // alone leaves dropIndicatorRef holding the just-used value until the
    // useEffect re-syncs after render, which races a quick re-drag.
    dispatch(endDrag())
    setActiveNode(null)
    setDropIndicator(null)
    dropIndicatorRef.current = null
    setTargetContainerRect(null)

    // === Handle layer-item drag (from structure panel) ===
    if (dragData?.type === 'layer-item' && over) {
      const dropData = over.data.current as any
      
      // Обработка drop в edge зоны (верх/низ списка)
      if (dropData && dropData.type === 'layers-list-edge') {
        const sourceNodeId = dragData.nodeId
        const sourceParentId = dragData.parentId
        const sourceIndex = dragData.index
        
        const targetParentId = dropData.parentId
        const targetIndex = dropData.targetIndex
        const position = dropData.position
        
        console.log('[Edge Drop]', {
          sourceNodeId,
          sourceParentId,
          sourceIndex,
          targetParentId,
          targetIndex,
          position
        })
        
        // Check if it's a reorder within the same parent
        if (sourceParentId === targetParentId) {
          // НЕ корректируем индекс здесь - reducer сам это сделает
          // Просто проверяем что позиция изменится
          if (sourceIndex === targetIndex) {
            console.log('[Edge Drop] Already at target position')
            return
          }
          
          console.log('[Edge Drop] Same parent reorder:', {
            sourceIndex,
            targetIndex,
            willMove: true
          })
          
          dispatch(reorderNode({
            nodeId: sourceNodeId,
            parentId: targetParentId,
            newIndex: targetIndex, // Передаём как есть, reducer скорректирует
          }))
        } else {
          console.log('[Edge Drop] Move to different parent')
          // Move to different parent
          dispatch(moveNode({
            nodeId: sourceNodeId,
            targetParentId: targetParentId,
            position: targetIndex,
          }))
        }
        return
      }
      
      if (dropData && dropData.type === 'layer-droppable') {
        const sourceNodeId = dragData.nodeId
        const sourceParentId = dragData.parentId
        const sourceIndex = dragData.index
        
        const targetNodeId = dropData.nodeId
        const targetParentId = dropData.parentId
        const targetIndex = dropData.index
        const isTargetContainer = dropData.isContainer
        const isTargetRoot = dropData.isRoot
        
        // Don't do anything if dropping on itself
        if (sourceNodeId === targetNodeId) {
          return
        }
        
        // Determine drop position based on over element's rect and mouse position
        // This is a simplified version - the LayerItem component handles visual feedback
        // We need to determine: before, after, or inside
        const overRect = over.rect
        const activeRect = active.rect.current.translated
        
        if (!overRect || !activeRect) return
        
        // Calculate which zone we're in based on the active element position
        const overCenterY = overRect.top + overRect.height / 2
        const activeCenterY = activeRect.top + activeRect.height / 2
        
        let finalTargetParentId = targetParentId
        let finalTargetIndex = targetIndex
        
        // Determine position: before, after, or inside
        if (isTargetRoot) {
          // Can only drop inside root
          finalTargetParentId = targetNodeId
          finalTargetIndex = 0
        } else if (isTargetContainer && activeCenterY > overRect.top + overRect.height * 0.3 && activeCenterY < overRect.top + overRect.height * 0.7) {
          // Drop inside container (middle 40%)
          finalTargetParentId = targetNodeId
          finalTargetIndex = 0
        } else if (activeCenterY < overCenterY) {
          // Drop before (top half)
          finalTargetParentId = targetParentId || ''
          finalTargetIndex = targetIndex
        } else {
          // Drop after (bottom half)
          finalTargetParentId = targetParentId || ''
          finalTargetIndex = targetIndex + 1
        }
        
        // Check if it's a reorder within the same parent
        if (sourceParentId === finalTargetParentId) {
          // При перестановке в том же родителе:
          // Если тащим вниз (sourceIndex < finalTargetIndex), то после удаления
          // элемента все индексы ниже сдвигаются на -1, поэтому compensate
          let adjustedIndex = finalTargetIndex
          if (sourceIndex < finalTargetIndex) {
            adjustedIndex = finalTargetIndex - 1
          }
          
          // Don't do anything if position hasn't changed
          if (sourceIndex === adjustedIndex) {
            return
          }
          
          dispatch(reorderNode({
            nodeId: sourceNodeId,
            parentId: finalTargetParentId,
            newIndex: adjustedIndex,
          }))
        } else {
          // Move to different parent
          dispatch(moveNode({
            nodeId: sourceNodeId,
            targetParentId: finalTargetParentId,
            position: finalTargetIndex,
          }))
        }
      }
      return
    }

    if (!currentIndicator) {
      // Fallback to simple drop logic if no indicator
      if (!over) return
      
      const dropTargetId = (over.id as string).replace('drop-', '')
      const targetNode = rootNode ? findNodeById(rootNode, dropTargetId) : null
      
      if (dragData?.type === 'library-item' && targetNode && rootNode && dragData.tagName) {
        // Validate drop
        const validation = validateDrop({
          draggedNode: null,
          libraryItem: {
            tagName: dragData.tagName,
            elementType: dragData.elementType || 'element',
            label: dragData.label || dragData.tagName,
          },
          targetNode,
          rootNode,
        })
        
        if (!validation.isValid) {
          validationToast.showError(validation.reason || 'Недопустимая операция', validation.suggestion)
          return
        }
        
        if (validation.warning) {
          validationToast.showWarning(validation.warning, validation.suggestion)
        }
        
        dispatch(addNode({
          parentId: dropTargetId,
          node: {
            elementType: dragData.elementType,
            tagName: dragData.tagName,
            metadata: { name: dragData.label },
          },
        }))
      }
      return
    }

    const { targetParentId, position, absoluteCoords, type: indicatorType } = currentIndicator
    
    // Find target node for validation
    const targetNode = rootNode ? findNodeById(rootNode, targetParentId) : null

    if (dragData?.type === 'library-item') {
      // Validate drop for library items
      if (targetNode && rootNode && (dragData.node || dragData.tagName)) {
        const libraryItemData = dragData.node ? undefined : (dragData.tagName ? {
          tagName: dragData.tagName,
          elementType: String(dragData.elementType || 'element'),
          label: dragData.label || dragData.tagName,
        } : undefined)
        
        const validation = validateDrop({
          draggedNode: dragData.node || null,
          libraryItem: libraryItemData,
          targetNode,
          rootNode,
        })
        
        if (!validation.isValid) {
          validationToast.showError(validation.reason || 'Недопустимая операция', validation.suggestion)
          return
        }
        
        if (validation.warning) {
          validationToast.showWarning(validation.warning, validation.suggestion)
        }
      }
      
      // Adding new element from library
      let newNodeProps: Partial<BlockNode>
      
      // If dragging a saved block (with structure), clone it
      if (dragData.node) {
        // Clone the entire block structure with new IDs
        // Lock only children, not the root container
        // dragData.id contains the library block ID
        const libraryBlockId = dragData.id
        
        // Linked-вставка из библиотеки. Корень получает linkedBlockId и имя блока
        // из библиотеки (dragData.label) БЕЗ суффикса "(копия)" — это живая ссылка,
        // а не копия (иначе суффикс накапливается: "Footer (копия) (копия)").
        // Дети НЕ блокируются (locked): содержимое linked-блока редактируется прямо
        // на канвасе, а расхождения с библиотекой разрешаются модалкой при сохранении
        // (🟢 в библиотеку / 🟡 статический / 🔴 откатить).
        const cloneNodeWithNewIds = (node: BlockNode, isRoot = true): BlockNode => {
          return {
            ...node,
            id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            metadata: {
              ...node.metadata,
              name: isRoot ? (dragData.label || node.metadata?.name || 'Блок') : node.metadata?.name,
              linkedBlockId: isRoot ? libraryBlockId : node.metadata?.linkedBlockId,
            },
            children: node.children.map(child => cloneNodeWithNewIds(child, false)),
          }
        }
        
        newNodeProps = cloneNodeWithNewIds(dragData.node, true)
      } else {
        // Regular library item
        newNodeProps = {
          elementType: dragData.elementType,
          tagName: dragData.tagName,
          metadata: { name: dragData.label },
        }
      }

      // If dropping into absolute container, set position
      if (indicatorType === 'absolute-position' && absoluteCoords) {
        newNodeProps.styles = {
          properties: {
            position: 'absolute',
            left: `${absoluteCoords.x}px`,
            top: `${absoluteCoords.y}px`,
          },
        }
      }

      dispatch(addNode({
        parentId: targetParentId,
        node: newNodeProps,
        position: position,
      }))
    } else if (dragData?.type === 'canvas-element' && dragData.node) {
      // Moving existing element
      const nodeId = dragData.node.id
      const draggedNode = dragData.node
      const sourceParentId = dragState.sourceParentId
      
      // Validate move for canvas elements (only when moving to different parent)
      if (targetNode && rootNode && sourceParentId !== targetParentId) {
        const validation = validateDrop({
          draggedNode,
          targetNode,
          rootNode,
        })
        
        if (!validation.isValid) {
          validationToast.showError(validation.reason || 'Недопустимое перемещение', validation.suggestion)
          return
        }
        
        if (validation.warning) {
          validationToast.showWarning(validation.warning, validation.suggestion)
        }
      }
      
      // Check if the dragged element itself has position: absolute
      const isAbsoluteElement = draggedNode.styles?.properties?.position === 'absolute'
      
      // If element has position: absolute, just update its coordinates
      if (isAbsoluteElement && absoluteCoords) {
        dispatch(updateNodePosition({
          nodeId,
          position: absoluteCoords,
        }))
        return
      }
      
      // Check if it's a reorder within the same parent
      if (sourceParentId === targetParentId) {
        if (position !== undefined) {
          // Reorder within same flex/grid container
          dispatch(reorderNode({
            nodeId,
            parentId: targetParentId,
            newIndex: position,
          }))
        }
      } else {
        // Move to different parent
        dispatch(moveNode({
          nodeId,
          targetParentId,
          position: indicatorType === 'absolute-position' ? undefined : position,
          absolutePosition: absoluteCoords,
        }))
      }
    }
  }, [dispatch, dragState.sourceParentId, rootNode, validationToast])

  const handleDragCancel = useCallback(() => {
    dispatch(endDrag())
    setActiveNode(null)
    setDropIndicator(null)
    dropIndicatorRef.current = null
    setTargetContainerRect(null)
  }, [dispatch])

  if (!rootNode || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          {loading ? (
            <>
              <div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-2"></div>
              <p className="text-gray-500">Загрузка блока...</p>
            </>
          ) : (
            <>
              <p className="text-gray-500">Инициализация редактора...</p>
              <p className="text-xs text-gray-400 mt-2">id: {id || 'new'}</p>
            </>
          )}
        </div>
      </div>
    )
  }

  // Контент одной секции ленты по её id. Секции, которых нет для текущего
  // режима (pageOnly в редакторе блока), в rightSections не попадают.
  const renderRightSection = (sectionId: string): React.ReactNode => {
    switch (sectionId) {
      case 'pageSettings':
        return inlineBlockEdit.active ? (
          <div className="p-4 text-sm text-gray-500">Настройки страницы недоступны в режиме редактирования блока.</div>
        ) : (
          <PageSettingsPanel
            pageId={id}
            settings={pageSettings}
            onChange={(newSettings) => {
              setPageSettings(newSettings)
              dispatch(markAsDirty())
            }}
          />
        )
      case 'basicSettings':
        return <BasicSettingsPanel pageId={type === 'page' ? id : undefined} />
      case 'positioning':
        return <PositioningPanel />
      case 'colors':
        return <ColorsPanel />
      case 'content':
        return <ContentPanel />
      case 'states':
        return <StatesPanel />
      case 'animations':
        return <AnimationsPanel />
      case 'scripts':
        return <ScriptsPanel />
      case 'data':
        return <DataPanel pageId={type === 'page' ? id : undefined} libraryBlockId={type === 'block' ? id : undefined} />
      case 'slides':
        return <SlidesPanel pageId={type === 'page' ? id : undefined} />
      case 'translations':
        return id ? <TranslationPanel pageId={id} /> : null
      case 'versionHistory':
        return id ? (
          <VersionHistoryPanel
            pageId={id}
            currentVersion={pageVersion}
            onRestore={async (restoredPage) => {
              const { loadEditor: loadEditorAction } = await import('@/features/editor/editorSlice')
              dispatch(loadEditorAction(restoredPage.structure))
              setPageVersion(restoredPage.version || pageVersion + 1)
              if (restoredPage.metadata) {
                setPageSettings(prev => ({
                  ...prev,
                  metaTitle: restoredPage.metadata?.title || prev.metaTitle,
                  metaDescription: restoredPage.metadata?.description || prev.metaDescription,
                  keywords: restoredPage.metadata?.keywords?.join(', ') || prev.keywords,
                }))
              }
            }}
            onClose={() => scrollToSection('basicSettings')}
          />
        ) : null
      case 'css':
        return <CSSPanel />
      default:
        return null
    }
  }

  return (
    <DataBindingProvider pageId={id || 'new'}>
      <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      autoScroll={{
        // dnd-kit default acceleration is 10; scroll speed scales linearly
        // with it. 11.5 ≈ +15% faster autoscroll when dragging off-screen.
        acceleration: 11.5,
      }}
      measuring={{
        droppable: {
          strategy: MeasuringStrategy.Always,
        },
      }}
    >
      <div className="h-screen flex flex-col bg-gray-100" ref={canvasContainerRef}>
        <div className="relative">
          <EditorToolbar 
            type={type} 
            viewport={viewport}
            onViewportChange={(newViewport) => dispatch(setViewport(newViewport))}
            pageSettings={type === 'page' ? pageSettings : undefined}
          >
            {({ centerContent, rightContent }) => (
              <Header 
                centerActions={centerContent}
                rightActions={
                  <div className="flex items-center gap-2">
                    {!isNewDocument && (
                      <SaveStatusIndicator
                        isSaving={autoSave.isSaving}
                        hasUnsavedChanges={autoSave.hasUnsavedChanges}
                        error={autoSave.error}
                        lastSavedText={autoSave.getLastSavedText()}
                      />
                    )}
                    {rightContent}
                  </div>
                }
              />
            )}
          </EditorToolbar>
        </div>
        
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar with Icons */}
          <LeftSidebar mode={type} />
          
          {/* Left Panel Content */}
          {activeLeftPanel && (
            <div 
              className="bg-white border-r border-gray-200 flex flex-col relative"
              style={{ width: `${leftPanelWidth}px` }}
            >
              <button
                onClick={() => dispatch(setActiveLeftPanel(null))}
                className="absolute -right-3 top-4 z-10 w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
                title="Скрыть панель"
              >
                <ChevronLeft size={14} className="text-gray-600" />
              </button>
              
              {/* Resize handle */}
              <div
                onMouseDown={() => setIsResizingLeft(true)}
                className="absolute right-0 top-0 bottom-0 w-1 hover:w-2 bg-transparent hover:bg-blue-400 cursor-col-resize transition-all z-20"
                title="Изменить ширину"
              />
              
              {activeLeftPanel === 'layers' && (
                <>
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-semibold text-gray-900 text-sm">
                      {type === 'page' ? 'Структура страницы' : 'Структура блока'}
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto overflow-x-auto">
                    <LayersPanel />
                  </div>
                </>
              )}
              
              {activeLeftPanel === 'library' && (
                <>
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-semibold text-gray-900 text-sm">Библиотека элементов</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Перетащите элементы на холст</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3">
                    <LibraryPanel isOpen={true} onToggle={() => {}} />
                  </div>
                </>
              )}
              
              {activeLeftPanel === 'savedBlocks' && (
                <>
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-semibold text-gray-900 text-sm">Сохраненные блоки</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {type === 'page' ? 'Блоки, которые можно добавить на страницу' : 'Блоки, которые можно добавить в этот блок'}
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3">
                    <SavedBlocksLibrary />
                  </div>
                </>
              )}
            </div>
          )}
          
          <Canvas 
            dropIndicator={dropIndicator}
            targetContainerRect={targetContainerRect}
            targetLayoutMode={targetLayoutMode}
            editorType={type}
            libraryBlockId={type === 'block' ? id : undefined}
          />
          
          {/* Right Panel — одна непрерывная лента секций (scroll-spy + шорткаты) */}
          {!rightPanelCollapsed && (
            <div
              className="bg-white border-l border-gray-200 flex flex-col relative"
              style={{ width: `${rightPanelWidth}px` }}
            >
              {/* Resize handle on left edge */}
              <div
                onMouseDown={() => setIsResizingRight(true)}
                className="absolute left-0 top-0 bottom-0 w-1 hover:w-2 bg-transparent hover:bg-blue-400 cursor-col-resize transition-all z-20"
                title="Изменить ширину"
              />

              <button
                onClick={() => setRightPanelCollapsed(true)}
                className="absolute -left-3 top-4 z-10 w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
                title="Скрыть панель"
              >
                <ChevronRight size={14} className="text-gray-600" />
              </button>

              {/* Настройки языков — единственный подэкран-оверлей поверх ленты
                  (открывается из «Переводов»); всё остальное — непрерывная лента. */}
              {type === 'page' && activeRightPanel === 'languageSettings' ? (
                <div className="flex-1 overflow-y-auto overflow-x-auto">
                  <LanguageSettingsPanel onClose={() => dispatch(setActiveRightPanel('translations'))} />
                </div>
              ) : (
                <div ref={attachRightScroll} className="flex-1 overflow-y-auto overflow-x-auto">
                  {rightSections.map((s) => (
                    <section key={s.id} data-rp={s.id} className="border-b border-gray-200 last:border-b-0">
                      {renderRightSection(s.id)}
                    </section>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Right Sidebar — кнопки-шорткаты к секциям ленты */}
          <RightSidebar mode={type} activeSection={activeSection} onNavigate={scrollToSection} />
        </div>
      </div>
      
      {/* Drag overlay */}
      <DragOverlay activeNode={activeNode} />
      
      {/* Drop validation toast */}
      <DropValidationToast 
        messages={validationToast.messages} 
        onDismiss={validationToast.dismissMessage} 
      />
     </DndContext>
    </DataBindingProvider>
  )
}
