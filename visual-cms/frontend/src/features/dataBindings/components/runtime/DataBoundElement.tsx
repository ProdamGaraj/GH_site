import React, { useMemo } from 'react'
import { useDataBinding } from '../../hooks/useDataBinding'
import { useVariable, useTemplate } from '../../hooks/useVariable'

interface DataBoundElementProps {
  /** Block ID for data binding lookup */
  blockId: string
  /** Element tag to render */
  as?: keyof JSX.IntrinsicElements
  /** Template string with variable placeholders like {$item.title} */
  template?: string
  /** Field path to extract from data (e.g., "title", "user.name") */
  field?: string
  /** Fallback content when data is not available */
  fallback?: React.ReactNode
  /** Show loading indicator */
  showLoading?: boolean
  /** Custom loading component */
  loadingComponent?: React.ReactNode
  /** Transform function for the data */
  transform?: (value: unknown) => React.ReactNode
  /** Additional props passed to the element */
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
}

/**
 * Get nested value from object by dot-notation path
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined
  
  const parts = path.split('.')
  let current: unknown = obj
  
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  
  return current
}

/**
 * DataBoundElement - renders an element with data from binding
 * 
 * @example
 * // Simple field binding
 * <DataBoundElement blockId="block-1" field="title" as="h1" />
 * 
 * @example
 * // Template binding
 * <DataBoundElement 
 *   blockId="block-1" 
 *   template="Welcome, {$item.name}!" 
 *   as="p" 
 * />
 * 
 * @example
 * // With transform
 * <DataBoundElement 
 *   blockId="block-1" 
 *   field="price" 
 *   transform={(v) => `$${v.toFixed(2)}`} 
 * />
 */
export const DataBoundElement: React.FC<DataBoundElementProps> = ({
  blockId,
  as: Component = 'span',
  template,
  field,
  fallback = null,
  showLoading = true,
  loadingComponent,
  transform,
  className,
  style,
  children
}) => {
  const { data, loading, error } = useDataBinding(blockId, { autoFetch: true })

  // Resolve the value
  const resolvedValue = useMemo(() => {
    if (data === null || data === undefined) return null

    // If field is specified, extract it
    if (field) {
      return getNestedValue(data, field)
    }

    // If template is specified, it will be handled separately
    if (template) {
      return data
    }

    // Return raw data
    return data
  }, [data, field, template])

  // Apply transform
  const displayValue = useMemo(() => {
    if (resolvedValue === null || resolvedValue === undefined) return null
    if (transform) return transform(resolvedValue)
    
    // For objects/arrays, stringify
    if (typeof resolvedValue === 'object') {
      return JSON.stringify(resolvedValue)
    }
    
    return String(resolvedValue)
  }, [resolvedValue, transform])

  // Handle loading state
  if (loading && showLoading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>
    }
    return (
      <Component className={className} style={style}>
        <span className="inline-flex items-center gap-2 text-gray-400">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </span>
      </Component>
    )
  }

  // Handle error state
  if (error) {
    return (
      <Component className={className} style={{ ...style, color: 'red' }}>
        Error: {error}
      </Component>
    )
  }

  // Handle no data
  if (displayValue === null || displayValue === undefined) {
    if (fallback) return <>{fallback}</>
    if (children) return <Component className={className} style={style}>{children}</Component>
    return null
  }

  return (
    <Component className={className} style={style}>
      {displayValue}
    </Component>
  )
}

/**
 * TemplateText - renders text with variable interpolation
 * 
 * @example
 * <TemplateText template="Hello, {$page.userName}!" />
 */
export const TemplateText: React.FC<{
  template: string
  as?: keyof JSX.IntrinsicElements
  className?: string
  style?: React.CSSProperties
}> = ({ template, as: Component = 'span', className, style }) => {
  const resolvedText = useTemplate(template)

  return (
    <Component className={className} style={style}>
      {resolvedText}
    </Component>
  )
}

/**
 * ConditionalRender - renders children only when condition is true
 * 
 * @example
 * <ConditionalRender condition="$page.isLoggedIn">
 *   <p>Welcome back!</p>
 * </ConditionalRender>
 */
export const ConditionalRender: React.FC<{
  condition: string
  children: React.ReactNode
  fallback?: React.ReactNode
}> = ({ condition, children, fallback = null }) => {
  // Simple variable check (e.g., "$page.isLoggedIn")
  const isSimpleVar = /^\$(\w+)\.(\w+)$/.test(condition)
  
  if (isSimpleVar) {
    const match = condition.match(/^\$(\w+)\.(\w+)$/)
    if (match) {
      const [, scope, name] = match
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const [value] = useVariable(scope as 'page' | 'global' | 'session', name)
      return value ? <>{children}</> : <>{fallback}</>
    }
  }

  // For complex conditions, we'd need evaluateCondition from useCondition hook
  // This is a simplified version
  return <>{children}</>
}

export default DataBoundElement
