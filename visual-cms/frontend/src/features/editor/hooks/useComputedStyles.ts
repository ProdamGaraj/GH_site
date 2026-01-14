import { useMemo } from 'react'
import { useAppSelector } from '@/app/hooks'
import { selectViewport, selectBreakpoints } from '../editorSlice'
import type { BlockNode } from '@/shared/types'

export const useComputedStyles = (node: BlockNode): React.CSSProperties => {
  const viewport = useAppSelector(selectViewport)
  const breakpoints = useAppSelector(selectBreakpoints)
  
  return useMemo(() => {
    const baseStyles = { ...node.styles.properties }

    // Apply responsive styles based on viewport
    const currentBreakpoint = breakpoints.find(bp => bp.id === viewport)
    
    if (currentBreakpoint && viewport !== 'desktop' && node.styles.responsive) {
      if (node.styles.responsive[viewport]) {
        Object.assign(baseStyles, node.styles.responsive[viewport])
      }
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
  }, [node.styles, node.layoutMode, node.tagName, node.elementType, viewport, breakpoints])
}
