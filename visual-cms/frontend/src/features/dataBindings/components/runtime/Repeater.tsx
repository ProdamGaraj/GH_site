import React, { useMemo, useCallback } from 'react'
import { useRepeaterBinding } from '../../hooks/useDataBinding'

interface RepeaterProps<T> {
  /** Block ID for data binding lookup */
  blockId: string
  /** Render function for each item */
  children: (item: T, index: number, meta: RepeaterItemMeta) => React.ReactNode
  /** Wrapper element tag */
  as?: keyof JSX.IntrinsicElements
  /** Key extractor for items */
  keyExtractor?: (item: T, index: number) => string | number
  /** Gap between items (CSS value) */
  gap?: string
  /** Layout direction */
  direction?: 'row' | 'column' | 'grid'
  /** Grid columns (for grid layout) */
  gridColumns?: number
  /** Empty state content */
  emptyContent?: React.ReactNode
  /** Loading state content */
  loadingContent?: React.ReactNode
  /** Error state content */
  errorContent?: React.ReactNode | ((error: string) => React.ReactNode)
  /** Show pagination controls */
  showPagination?: boolean
  /** Custom pagination renderer */
  paginationRenderer?: (props: PaginationProps) => React.ReactNode
  /** Additional wrapper props */
  className?: string
  style?: React.CSSProperties
}

interface RepeaterItemMeta {
  isFirst: boolean
  isLast: boolean
  isEven: boolean
  isOdd: boolean
  total: number
}

interface PaginationProps {
  page: number
  totalPages: number
  hasMore: boolean
  hasPrev: boolean
  loading: boolean
  onNextPage: () => void
  onPrevPage: () => void
  onGoToPage: (page: number) => void
}

/**
 * Default loading component
 */
const DefaultLoading: React.FC = () => (
  <div className="flex items-center justify-center py-8">
    <div className="flex items-center gap-3 text-gray-500">
      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span>Загрузка данных...</span>
    </div>
  </div>
)

/**
 * Default empty component
 */
const DefaultEmpty: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-8 text-gray-500">
    <span className="text-4xl mb-2">📭</span>
    <span>Данные не найдены</span>
  </div>
)

/**
 * Default error component
 */
const DefaultError: React.FC<{ error: string; onRetry?: () => void }> = ({ error, onRetry }) => (
  <div className="flex flex-col items-center justify-center py-8 text-red-500">
    <span className="text-4xl mb-2">⚠️</span>
    <span className="mb-2">{error}</span>
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
      >
        Повторить
      </button>
    )}
  </div>
)

/**
 * Default pagination component
 */
const DefaultPagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  hasMore,
  hasPrev,
  loading,
  onNextPage,
  onPrevPage,
  onGoToPage
}) => (
  <div className="flex items-center justify-center gap-2 py-4">
    <button
      onClick={onPrevPage}
      disabled={!hasPrev || loading}
      className="px-3 py-1.5 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
    >
      ← Назад
    </button>
    
    <div className="flex items-center gap-1">
      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
        const pageNum = i + 1
        return (
          <button
            key={pageNum}
            onClick={() => onGoToPage(pageNum)}
            disabled={loading}
            className={`w-8 h-8 rounded-lg ${
              page === pageNum
                ? 'bg-primary-600 text-white'
                : 'border hover:bg-gray-50'
            }`}
          >
            {pageNum}
          </button>
        )
      })}
      {totalPages > 5 && (
        <>
          <span>...</span>
          <button
            onClick={() => onGoToPage(totalPages)}
            disabled={loading}
            className="w-8 h-8 rounded-lg border hover:bg-gray-50"
          >
            {totalPages}
          </button>
        </>
      )}
    </div>

    <button
      onClick={onNextPage}
      disabled={!hasMore || loading}
      className="px-3 py-1.5 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
    >
      Далее →
    </button>
  </div>
)

/**
 * Repeater - renders a list of items from data binding
 * 
 * @example
 * <Repeater blockId="products-block" keyExtractor={(p) => p.id}>
 *   {(product, index) => (
 *     <ProductCard product={product} />
 *   )}
 * </Repeater>
 * 
 * @example
 * // With grid layout
 * <Repeater 
 *   blockId="gallery-block" 
 *   direction="grid" 
 *   gridColumns={3}
 *   gap="1rem"
 * >
 *   {(image) => <img src={image.url} alt={image.title} />}
 * </Repeater>
 */
export function Repeater<T = unknown>({
  blockId,
  children,
  as: Component = 'div',
  keyExtractor,
  gap = '0.5rem',
  direction = 'column',
  gridColumns = 3,
  emptyContent,
  loadingContent,
  errorContent,
  showPagination = false,
  paginationRenderer,
  className,
  style
}: RepeaterProps<T>): React.ReactElement | null {
  const {
    items,
    loading,
    error,
    pagination,
    refetch
  } = useRepeaterBinding<T>(blockId, { autoFetch: true })

  // Calculate total pages
  const totalPages = pagination.pageSize > 0 
    ? Math.ceil(pagination.total / pagination.pageSize) 
    : 1

  // Default key extractor
  const getKey = useCallback((item: T, index: number) => {
    if (keyExtractor) return keyExtractor(item, index)
    
    // Try common id fields
    const itemObj = item as Record<string, unknown>
    if (itemObj?.id !== undefined) return String(itemObj.id)
    if (itemObj?._id !== undefined) return String(itemObj._id)
    if (itemObj?.key !== undefined) return String(itemObj.key)
    
    return index
  }, [keyExtractor])

  // Container styles
  const containerStyle = useMemo((): React.CSSProperties => {
    const baseStyle: React.CSSProperties = { ...style }

    switch (direction) {
      case 'row':
        return {
          ...baseStyle,
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap
        }
      case 'grid':
        return {
          ...baseStyle,
          display: 'grid',
          gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
          gap
        }
      case 'column':
      default:
        return {
          ...baseStyle,
          display: 'flex',
          flexDirection: 'column',
          gap
        }
    }
  }, [direction, gap, gridColumns, style])

  // Handle loading state
  if (loading && items.length === 0) {
    return (
      <Component className={className} style={style}>
        {loadingContent || <DefaultLoading />}
      </Component>
    )
  }

  // Handle error state
  if (error && items.length === 0) {
    return (
      <Component className={className} style={style}>
        {typeof errorContent === 'function' 
          ? errorContent(error) 
          : errorContent || <DefaultError error={error} onRetry={refetch} />
        }
      </Component>
    )
  }

  // Handle empty state
  if (items.length === 0) {
    return (
      <Component className={className} style={style}>
        {emptyContent || <DefaultEmpty />}
      </Component>
    )
  }

  // Render items
  const total = items.length
  const renderedItems = items.map((item, index) => {
    const meta: RepeaterItemMeta = {
      isFirst: index === 0,
      isLast: index === total - 1,
      isEven: index % 2 === 0,
      isOdd: index % 2 !== 0,
      total
    }

    return (
      <React.Fragment key={getKey(item, index)}>
        {children(item, index, meta)}
      </React.Fragment>
    )
  })

  // Pagination props
  const paginationProps: PaginationProps = {
    page: pagination.page,
    totalPages,
    hasMore: pagination.hasMore,
    hasPrev: pagination.page > 1,
    loading,
    onNextPage: pagination.nextPage,
    onPrevPage: pagination.prevPage,
    onGoToPage: pagination.goToPage
  }

  return (
    <>
      <Component className={className} style={containerStyle}>
        {renderedItems}
      </Component>
      
      {showPagination && totalPages > 1 && (
        paginationRenderer 
          ? paginationRenderer(paginationProps)
          : <DefaultPagination {...paginationProps} />
      )}
    </>
  )
}

/**
 * LoadMoreRepeater - Repeater with "Load More" button instead of pagination
 */
export function LoadMoreRepeater<T = unknown>({
  blockId,
  children,
  loadMoreText = 'Загрузить ещё',
  ...props
}: Omit<RepeaterProps<T>, 'showPagination' | 'paginationRenderer'> & {
  loadMoreText?: string
}): React.ReactElement | null {
  return (
    <Repeater
      blockId={blockId}
      {...props}
      showPagination
      paginationRenderer={({ hasMore, loading, onNextPage }) => (
        hasMore ? (
          <div className="flex justify-center py-4">
            <button
              onClick={onNextPage}
              disabled={loading}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Загрузка...' : loadMoreText}
            </button>
          </div>
        ) : null
      )}
    >
      {children}
    </Repeater>
  )
}

export default Repeater
