import { useMemo } from 'react'
import { useAppSelector } from '@/app/hooks'
import { selectViewport, selectBreakpoints, selectEffectiveBrowserOffset } from '../editorSlice'
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

    // Преобразуем viewport units (vh, vw) в пиксели на основе breakpoint и browser offset
    if (currentBreakpoint) {
      // Реальная видимая высота = высота брейкпоинта − эффективный «хром» браузера
      // (константа выбранного браузера либо реальный замер в режиме «авто»).
      const effectiveViewportHeight = currentBreakpoint.height
        ? Math.max(1, currentBreakpoint.height - browserOffset)
        : currentBreakpoint.height
      
      const convertViewportUnits = (value: string): string => {
        if (typeof value !== 'string') return value
        
        // Преобразуем vh (viewport height) в пиксели с учетом browser offset
        if (value.includes('vh') && effectiveViewportHeight) {
          return value.replace(/(\d+\.?\d*)vh/g, (_match, num) => {
            const pixels = (parseFloat(num) / 100) * effectiveViewportHeight
            return `${pixels}px`
          })
        }
        
        // Преобразуем vw (viewport width) в пиксели
        if (value.includes('vw')) {
          return value.replace(/(\d+\.?\d*)vw/g, (_match, num) => {
            const pixels = (parseFloat(num) / 100) * currentBreakpoint.width
            return `${pixels}px`
          })
        }
        
        return value
      }
      
      // Применяем конвертацию ко всем свойствам
      Object.keys(baseStyles).forEach(key => {
        const value = baseStyles[key as keyof typeof baseStyles]
        if (typeof value === 'string') {
          (baseStyles as any)[key] = convertViewportUnits(value)
        }
      })
    }

    // Для контейнеров без явного display - устанавливаем block для правильного вертикального потока
    const containerTags = ['div', 'section', 'article', 'header', 'footer', 'main', 'aside', 'form']
    const isContainerTag = containerTags.includes(node.tagName?.toLowerCase() || '')
    
    if (!baseStyles.display && isContainerTag && node.elementType === 'container') {
      // По умолчанию контейнеры - блочные с вертикальным потоком
      baseStyles.display = 'block'
    }

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
  }, [node.styles, node.layoutMode, node.tagName, node.elementType, viewport, breakpoints, browserOffset])
}
