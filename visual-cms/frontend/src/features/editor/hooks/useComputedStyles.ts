import { useMemo } from 'react'
import { useAppSelector } from '@/app/hooks'
import { selectViewport, selectBreakpoints, selectEffectiveBrowserOffset } from '../editorSlice'
import { convertViewportUnits } from '../utils/viewportUnits'
import type { BlockNode } from '@/shared/types'

export const useComputedStyles = (node: BlockNode): React.CSSProperties => {
  const viewport = useAppSelector(selectViewport)
  const breakpoints = useAppSelector(selectBreakpoints)
  const browserOffset = useAppSelector(selectEffectiveBrowserOffset)
  
  return useMemo(() => {
    // Defensive: ensure node.styles and node.styles.properties exist
    const baseStyles = { ...(node?.styles?.properties || {}) }

    // Apply responsive styles based on viewport
    const currentBreakpoint = breakpoints.find(bp => bp.id === viewport)
    
    if (currentBreakpoint && viewport !== 'desktop' && node.styles.responsive) {
      if (node.styles.responsive[viewport]) {
        Object.assign(baseStyles, node.styles.responsive[viewport])
      }
    }

    // Viewport-единицы (vh/vw/svh/dvh/vmin…) → px от экрана канваса: иначе браузер
    // считает их от окна редактора (см. utils/viewportUnits.ts).
    if (currentBreakpoint) {
      // Реальная видимая высота = высота брейкпоинта − эффективный «хром» браузера
      // (константа выбранного браузера либо реальный замер в режиме «авто»).
      const canvasViewport = {
        width: currentBreakpoint.width,
        height: currentBreakpoint.height ? Math.max(1, currentBreakpoint.height - browserOffset) : undefined,
      }
      Object.keys(baseStyles).forEach(key => {
        const value = baseStyles[key as keyof typeof baseStyles]
        if (typeof value === 'string') {
          (baseStyles as any)[key] = convertViewportUnits(value, canvasViewport)
        }
      })
    }

    // Контейнеру без своего display инлайн-display НЕ ставим: div/section/form
    // и так блочные, а display из CSS страницы/блока (.lead-form { display:
    // grid }) инлайн перебил бы — на сайте инлайна нет, и канвас расходился с
    // деплоем (форма заявки в канвасе была блоком, кнопка — по ширине текста).

    // If layoutMode is set, apply appropriate display
    if (node.layoutMode && !baseStyles.display) {
      switch (node.layoutMode) {
        case 'flex':
          baseStyles.display = 'flex'
          break
        case 'grid':
          baseStyles.display = 'grid'
          break
        case 'table':
          baseStyles.display = 'table'
          break
        case 'absolute':
          baseStyles.position = 'relative'
          break
      }
    }

    return baseStyles as React.CSSProperties
  }, [node.styles, node.layoutMode, viewport, breakpoints, browserOffset])
}
