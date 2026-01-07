import { useMemo } from 'react'
import type { BlockNode } from '@/shared/types'

export const useComputedStyles = (node: BlockNode): React.CSSProperties => {
  return useMemo(() => {
    const baseStyles = { ...node.styles.properties }

    console.log('🎨 Computing styles for', node.id, ':', baseStyles)

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
  }, [node.styles, node.layoutMode])
}
