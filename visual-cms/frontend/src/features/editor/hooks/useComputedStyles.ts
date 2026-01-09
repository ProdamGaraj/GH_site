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
    // Sort breakpoints by width descending to apply correct cascade
    const sortedBreakpoints = [...breakpoints].sort((a, b) => b.width - a.width)
    const currentBreakpoint = breakpoints.find(bp => bp.id === viewport)
    
    if (currentBreakpoint && viewport !== 'desktop' && node.styles.responsive) {
      // Apply styles for current breakpoint if exists
      if (node.styles.responsive[viewport]) {
        Object.assign(baseStyles, node.styles.responsive[viewport])
      }
    }

    console.log('🎨 Computing styles for', node.id, 'viewport:', viewport, ':', baseStyles)

    // If display is not explicitly set, fallback to layoutMode for backward compatibility
    if (!baseStyles.display && node.layoutMode) {
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

    // TODO: Parse and apply customCSS with higher priority
    if (node.styles.customCSS) {
      // For now, we'll just use properties
      // In the future, parse CSS string and merge
    }

    console.log('✅ Final computed styles:', baseStyles)

    return baseStyles as React.CSSProperties
  }, [node.styles, node.layoutMode, viewport, breakpoints])
}
