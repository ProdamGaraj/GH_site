import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useAppSelector, useAppDispatch } from '@/app/hooks'
import { selectRootNode, selectDragState, selectViewport, selectBreakpoints, selectZoom, selectPanOffset, selectBlockAlignment, selectEditMode, setZoom, setPanOffset, selectCanvasColor, selectRunScriptsInCanvas, selectSiteGlobalCss, selectSiteGlobalJs, selectEffectiveBrowserOffset, setAutoChromeOffset } from '@/features/editor/editorSlice'
import { CanvasRenderer } from './CanvasRenderer'
import type { DropIndicator } from '../../utils/dndUtils'
import { DropIndicatorOverlay, DropTargetHighlight } from './DropIndicatorOverlay'
import { getEffectiveTree } from '../../utils/variationUtils'
import { collectTreeGlobalCss, collectTreeGlobalJs } from '../../utils/exportUtils'

interface CanvasProps {
  dropIndicator?: DropIndicator | null
  targetContainerRect?: DOMRect | null
  targetLayoutMode?: 'flex' | 'grid' | 'absolute' | 'table'
  editorType?: 'page' | 'block'
  libraryBlockId?: string // ID библиотечного блока при редактировании блока
}

export const Canvas: React.FC<CanvasProps> = ({ 
  dropIndicator, 
  targetContainerRect,
  targetLayoutMode = 'flex',
  editorType = 'block',
  libraryBlockId
}) => {
  const dispatch = useAppDispatch()
  const rootNode = useAppSelector(selectRootNode)
  const dragState = useAppSelector(selectDragState)
  const viewport = useAppSelector(selectViewport)
  const breakpoints = useAppSelector(selectBreakpoints)
  const zoom = useAppSelector(selectZoom)
  const storedPanOffset = useAppSelector(selectPanOffset)
  const blockAlignment = useAppSelector(selectBlockAlignment)
  const editMode = useAppSelector(selectEditMode)
  const canvasColor = useAppSelector(selectCanvasColor)
  const runScriptsInCanvas = useAppSelector(selectRunScriptsInCanvas)
  const siteGlobalCss = useAppSelector(selectSiteGlobalCss)
  const siteGlobalJs = useAppSelector(selectSiteGlobalJs)
  const browserOffset = useAppSelector(selectEffectiveBrowserOffset)
  const canvasRef = useRef<HTMLDivElement>(null)
  const panContainerRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  // Высота контента вьюпорта (нескейленная) — для разметки экранов пунктиром.
  const [viewportContentHeight, setViewportContentHeight] = useState(0)
  // Локальный pan offset для плавности (без Redux при drag)
  const localPanRef = useRef({ x: storedPanOffset.x, y: storedPanOffset.y })
  
  const currentBreakpoint = breakpoints.find(bp => bp.id === viewport)

  // Реальная видимая высота экрана = высота брейкпоинта минус «хром» браузера
  // (адресная строка и т.п.; в режиме «авто» — реальный замер текущего окна).
  // Это ТА ЖЕ база, от которой useComputedStyles считает 100vh — поэтому коробка
  // канваса совпадает и с блоками (vh), и с реальным экраном.
  const effectiveScreenHeight = currentBreakpoint?.height
    ? Math.max(1, currentBreakpoint.height - browserOffset)
    : undefined

  // Замер реального «хрома» текущего браузера: монитор − видимая область окна.
  // Обновляется на resize (развернул/свернул окно, докнул devtools и т.п.).
  useEffect(() => {
    const measure = () =>
      dispatch(setAutoChromeOffset(Math.max(0, (window.screen?.height || 0) - window.innerHeight)))
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [dispatch])

  // Автоподгонка зума при смене связки «экран+браузер»: канвас относится к полю
  // редактора так же, как viewport сайта — к экрану пользователя. Один экран
  // будущего пользователя (ширина × видимая высота) виден целиком. Ручной зум
  // после этого не трогаем — пересчёт только при смене breakpoint/браузера.
  useEffect(() => {
    if (editMode !== 'responsive' || !currentBreakpoint) return
    const workspace = canvasRef.current
    if (!workspace) return
    const availW = workspace.clientWidth - 48   // p-6 поля вокруг канваса
    const availH = workspace.clientHeight - 48
    if (availW <= 0 || availH <= 0) return
    const targetH = effectiveScreenHeight || currentBreakpoint.height || (currentBreakpoint.width * 9) / 16
    const fit = Math.min(availW / currentBreakpoint.width, availH / targetH) * 100
    dispatch(setZoom(Math.round(fit)))
    dispatch(setPanOffset({ x: 0, y: 0 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport, editMode, browserOffset, dispatch])

  // Мемоизируем эффективное дерево - пересчитывается только при изменении rootNode, viewport или editMode
  const effectiveTree = useMemo(() => {
    if (!rootNode) return null
    return getEffectiveTree(
      rootNode,
      viewport === 'base' ? null : viewport,
      editMode
    )
  }, [rootNode, viewport, editMode])

  // Общий CSS (страница + блоки) для живого превью. Применяется так же, как на деплое,
  // — поэтому правила @media/:hover/@keyframes из globalCss видны прямо в канвасе.
  // Site-ассеты (Site.settings.globalCss/globalJs) резолвятся по page.siteId в
  // Editor.tsx. Инжектим их ПЕРЕД page/block — тот же порядок, что на деплое
  // (reset → site → page → block). Для блоков/страниц без сайта — пусто.
  const globalCss = useMemo(
    () => [siteGlobalCss, collectTreeGlobalCss(rootNode)].filter(Boolean).join('\n\n'),
    [rootNode, siteGlobalCss],
  )
  const globalJs = useMemo(
    () => [siteGlobalJs, collectTreeGlobalJs(rootNode)].filter(Boolean).join('\n'),
    [rootNode, siteGlobalJs],
  )

  // vh/vw в globalCss браузер считает от ОКНА редактора, а не от выбранного экрана —
  // контент получал не те пропорции (и разметка экранов «уезжала»). Пересчитываем
  // viewport-единицы в px от той же базы, что useComputedStyles для стилей узлов:
  // ширина брейкпоинта и видимая высота (брейкпоинт − «хром» браузера).
  const displayGlobalCss = useMemo(() => {
    if (!globalCss || editMode !== 'responsive' || !currentBreakpoint) return globalCss
    let css = globalCss
    if (effectiveScreenHeight) {
      css = css.replace(/(\d*\.?\d+)(?:s|d|l)?vh\b/g, (_m, num) =>
        `${(parseFloat(num) / 100) * effectiveScreenHeight}px`)
    }
    css = css.replace(/(\d*\.?\d+)(?:s|d|l)?vw\b/g, (_m, num) =>
      `${(parseFloat(num) / 100) * currentBreakpoint.width}px`)
    return css
  }, [globalCss, editMode, currentBreakpoint, effectiveScreenHeight])

  // Опционально выполняем общий JS прямо в холсте (тумблер). Скрипт вставляется живым
  // <script>-элементом (React не исполняет script из JSX). Чужой JS может конфликтовать
  // с React-разметкой — поэтому строго по явному выбору пользователя.
  // Перезапуск при изменении дерева может «наслаивать» побочные эффекты (observers,
  // intervals) — приемлемо для опционального превью.
  useEffect(() => {
    if (!runScriptsInCanvas || !globalJs) return
    const container = viewportRef.current
    if (!container) return
    const script = document.createElement('script')
    script.setAttribute('data-canvas-user-js', 'true')
    script.textContent = globalJs
    container.appendChild(script)
    return () => {
      script.remove()
    }
  }, [runScriptsInCanvas, globalJs])

  // Замер высоты контента вьюпорта для разметки экранов. ResizeObserver даёт
  // нескейленную layout-высоту (transform не влияет на измеряемый box), поэтому
  // линии рисуем в тех же координатах, что и контент (до scale).
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const measure = () => setViewportContentHeight(el.scrollHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [rootNode, viewport, editMode])

  // Синхронизируем localPanRef с Redux при внешних изменениях
  useEffect(() => {
    localPanRef.current = { x: storedPanOffset.x, y: storedPanOffset.y }
  }, [storedPanOffset])

  // Высота одного «экрана» для разметки = реальная видимая высота (с учётом
  // «хрома» браузера), иначе дефолт 900. Линии только ВНУТРИ контента:
  // граница, совпадающая с самым низом страницы, не рисуется (−1px).
  const screenHeight = effectiveScreenHeight || 900
  const screenLineCount = screenHeight > 0
    ? Math.max(0, Math.floor((viewportContentHeight - 1) / screenHeight))
    : 0

  // Zoom with Ctrl + Mouse Wheel
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const delta = -e.deltaY
        const newZoom = Math.max(25, Math.min(500, zoom + delta * 0.1))
        dispatch(setZoom(Math.round(newZoom)))
      }
    }

    const canvas = canvasRef.current
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false })
      return () => canvas.removeEventListener('wheel', handleWheel)
    }
  }, [zoom, dispatch])

  // Pan with Space + Drag or Middle Mouse Button
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Ignore events from input elements or their labels
    const target = e.target as HTMLElement
    
    // Check if target is an input element
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || 
        target.isContentEditable) {
      return
    }
    
    // Check if target is inside a label (for checkboxes/radio buttons)
    if (target.closest('label') || target.closest('input') || target.closest('textarea') || target.closest('select')) {
      return
    }
    
    // Start panning on middle-click or left-click while Space is held
    if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
      e.preventDefault()
      setIsPanning(true)
      setPanStart({ x: e.clientX - localPanRef.current.x, y: e.clientY - localPanRef.current.y })
    }
  }, [isSpacePressed])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning && panContainerRef.current) {
      e.preventDefault() // Prevent text selection during panning
      // Обновляем через DOM напрямую - без React state/Redux
      const newX = e.clientX - panStart.x
      const newY = e.clientY - panStart.y
      localPanRef.current = { x: newX, y: newY }
      panContainerRef.current.style.transform = `translate(${newX}px, ${newY}px)`
    }
  }, [isPanning, panStart])

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      // Сохраняем в Redux только когда закончили pan
      dispatch(setPanOffset(localPanRef.current))
    }
    setIsPanning(false)
  }, [isPanning, dispatch])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        // Skip if user is typing in input/textarea
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return
        }
        
        setIsSpacePressed(true)
        if (!isPanning) {
          e.preventDefault()
          document.body.style.cursor = 'grab'
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false)
        document.body.style.cursor = 'default'
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      document.body.style.cursor = 'default'
    }
  }, [isPanning])

  if (!rootNode) {
    return (
      <div className="flex-1 bg-gray-100 p-8 overflow-auto flex items-center justify-center">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    )
  }

  return (
    <div 
      ref={canvasRef}
      className="flex-1 bg-gray-200 overflow-auto relative"
      data-canvas="true"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        cursor: isPanning ? 'grabbing' : 'default',
      }}
    >
      <div
        ref={panContainerRef}
        className="min-h-full min-w-max p-6 flex justify-center"
        style={{
          transform: `translate(${storedPanOffset.x}px, ${storedPanOffset.y}px)`,
          transition: isPanning ? 'none' : 'transform 0.1s ease-out',
        }}
      >
        {/* Drop indicator overlay - positioned relative to canvas container */}
        {dragState.isDragging && dropIndicator && (
          <DropIndicatorOverlay 
            indicator={dropIndicator} 
            containerRef={canvasRef as React.RefObject<HTMLElement>}
            targetContainerRect={targetContainerRect}
          />
        )}
        
        {/* Target container highlight */}
        {dragState.isDragging && targetContainerRect && (
          <DropTargetHighlight
            targetRect={targetContainerRect}
            containerRef={canvasRef as React.RefObject<HTMLElement>}
            layoutMode={targetLayoutMode}
          />
        )}
        
        <div
          ref={viewportRef}
          className="relative canvas-viewport"
          style={{
            // Фиксированная ширина viewport (как экран). flexShrink 0 обязателен:
            // это flex-item внутри justify-center, и без него ширина больше рабочей
            // области УЖИМАЕТСЯ (1920 выглядел как 1440 — flex-shrink по умолчанию 1).
            width: editMode === 'responsive' && currentBreakpoint
              ? `${currentBreakpoint.width}px`
              : editorType === 'page' ? '1280px' : '800px',
            flexShrink: 0,
            // Высота НЕ фиксируется — канвас растёт со страницей (не скролл-окно).
            // Минимум = реальная видимая высота экрана (брейкпоинт − «хром» браузера),
            // та же база, от которой useComputedStyles считает 100vh.
            ...(editMode === 'responsive' && effectiveScreenHeight ? {
              minHeight: `${effectiveScreenHeight}px`,
            } : {}),
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            // Тень для визуального выделения страницы
            boxShadow: '0 4px 40px rgba(0,0,0,0.15)',
            background: canvasColor,
            // Применяем базовый шрифт для страницы
            fontFamily: 'Muller, sans-serif',
          }}
        >
          {/* Breakpoint size indicator - только в responsive режиме */}
          {editMode === 'responsive' && currentBreakpoint && (
            <div className="absolute -top-8 left-0 right-0 flex items-center justify-center gap-2 text-xs text-gray-500">
              <div className="bg-purple-100 px-3 py-1.5 rounded shadow-sm border border-purple-300">
                <span className="font-medium text-purple-700">{currentBreakpoint.name} · viewport пользователя:</span>
                <span className="ml-1 text-purple-600">{currentBreakpoint.width}{effectiveScreenHeight ? ` × ${effectiveScreenHeight}` : ''}px</span>
                {browserOffset > 0 && currentBreakpoint.height && (
                  <span className="ml-1 text-purple-400">(монитор {currentBreakpoint.height} − браузер {browserOffset})</span>
                )}
              </div>
            </div>
          )}
          {/* Общие стили страницы/блоков — живое превью (@media, :hover, @keyframes) */}
          {displayGlobalCss && <style>{displayGlobalCss}</style>}
          <CanvasRenderer
            node={effectiveTree || rootNode}
            isRoot
            editorType={editorType}
            blockAlignment={blockAlignment}
            rootNode={rootNode || undefined}
            libraryBlockId={libraryBlockId}
          />

          {/* Разметка экранов: пунктирные линии на границах экранов + номер над линией.
              pointer-events:none, полупрозрачно — гайд, не мешающий редактированию. */}
          {screenLineCount > 0 && (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: viewportContentHeight,
                pointerEvents: 'none',
                zIndex: 45,
              }}
            >
              {Array.from({ length: screenLineCount }).map((_, i) => {
                const y = (i + 1) * screenHeight
                return (
                  <div key={i} style={{ position: 'absolute', top: y, left: 0, right: 0 }}>
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 3,
                        left: 8,
                        fontSize: 11,
                        lineHeight: 1,
                        color: 'rgba(30,30,45,0.5)',
                        background: 'rgba(255,255,255,0.72)',
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontFamily: 'system-ui, sans-serif',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Экран {i + 1}
                    </span>
                    <div style={{ borderTop: '1px dashed rgba(70,70,100,0.35)' }} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
