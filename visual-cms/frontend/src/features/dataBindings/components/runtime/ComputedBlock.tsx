/**
 * ComputedBlock
 * 
 * Runtime компонент для отображения вычисляемых значений.
 * Показывает count, sum, avg и т.д. из данных другого блока.
 * 
 * @example
 * // Показать количество найденных элементов
 * <ComputedBlock 
 *   sourceBlockId="projects-grid" 
 *   template="Найдено {filteredCount} проектов" 
 * />
 * 
 * // Показать сумму по полю
 * <ComputedBlock 
 *   sourceBlockId="projects-grid" 
 *   computeType="sum"
 *   field="area"
 *   template="Общая площадь: {value} м²" 
 * />
 */

import React, { useMemo } from 'react'
import { useComputedValue } from '../../hooks/useDataBindingWithTransforms'

export type ComputeType = 'count' | 'totalCount' | 'filteredCount' | 'sum' | 'avg' | 'min' | 'max'

interface ComputedBlockProps {
  /** ID блока-источника данных */
  sourceBlockId: string
  
  /** Тип вычисления */
  computeType?: ComputeType
  
  /** Поле для агрегатных функций (sum, avg, min, max) */
  field?: string
  
  /** Шаблон для форматирования. Используйте {value}, {count}, {filteredCount}, {sum}, {avg} */
  template?: string
  
  /** CSS классы */
  className?: string
  
  /** Inline стили */
  style?: React.CSSProperties
  
  /** Значение по умолчанию если нет данных */
  defaultValue?: string | number
  
  /** Форматтер для числа */
  format?: 'number' | 'currency' | 'percent' | 'compact'
  
  /** Локаль для форматирования */
  locale?: string
  
  /** Показать скелетон при загрузке */
  showSkeleton?: boolean
}

/**
 * Форматирование числа
 */
function formatNumber(
  value: number,
  format?: ComputedBlockProps['format'],
  locale = 'ru-RU'
): string {
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'RUB',
        maximumFractionDigits: 0
      }).format(value)
    
    case 'percent':
      return new Intl.NumberFormat(locale, {
        style: 'percent',
        maximumFractionDigits: 1
      }).format(value / 100)
    
    case 'compact':
      return new Intl.NumberFormat(locale, {
        notation: 'compact',
        maximumFractionDigits: 1
      }).format(value)
    
    case 'number':
    default:
      return new Intl.NumberFormat(locale).format(value)
  }
}

/**
 * Заменить плейсхолдеры в шаблоне
 */
function applyTemplate(
  template: string,
  values: {
    value?: string | number
    count?: number | null
    totalCount?: number | null
    filteredCount?: number | null
    sum?: Record<string, number>
    avg?: Record<string, number>
    min?: Record<string, number>
    max?: Record<string, number>
  }
): string {
  let result = template
  
  // Заменяем простые плейсхолдеры
  if (values.value !== undefined) {
    result = result.replace(/\{value\}/g, String(values.value))
  }
  if (values.count !== null && values.count !== undefined) {
    result = result.replace(/\{count\}/g, String(values.count))
  }
  if (values.totalCount !== null && values.totalCount !== undefined) {
    result = result.replace(/\{totalCount\}/g, String(values.totalCount))
  }
  if (values.filteredCount !== null && values.filteredCount !== undefined) {
    result = result.replace(/\{filteredCount\}/g, String(values.filteredCount))
  }
  
  // Заменяем агрегатные плейсхолдеры: {sum.field}, {avg.field}, etc
  if (values.sum) {
    Object.entries(values.sum).forEach(([field, val]) => {
      result = result.replace(new RegExp(`\\{sum\\.${field}\\}`, 'g'), String(val))
    })
  }
  if (values.avg) {
    Object.entries(values.avg).forEach(([field, val]) => {
      result = result.replace(new RegExp(`\\{avg\\.${field}\\}`, 'g'), String(val))
    })
  }
  if (values.min) {
    Object.entries(values.min).forEach(([field, val]) => {
      result = result.replace(new RegExp(`\\{min\\.${field}\\}`, 'g'), String(val))
    })
  }
  if (values.max) {
    Object.entries(values.max).forEach(([field, val]) => {
      result = result.replace(new RegExp(`\\{max\\.${field}\\}`, 'g'), String(val))
    })
  }
  
  return result
}

export const ComputedBlock: React.FC<ComputedBlockProps> = ({
  sourceBlockId,
  computeType = 'filteredCount',
  field,
  template,
  className,
  style,
  defaultValue = '—',
  format = 'number',
  locale = 'ru-RU',
  showSkeleton = true
}) => {
  const computed = useComputedValue(sourceBlockId)
  
  // Получаем нужное значение
  const rawValue = useMemo(() => {
    switch (computeType) {
      case 'count':
        return computed.count
      case 'totalCount':
        return computed.totalCount
      case 'filteredCount':
        return computed.filteredCount
      case 'sum':
        return field ? computed.sum[field] : null
      case 'avg':
        return field ? computed.avg[field] : null
      case 'min':
        return field ? computed.min[field] : null
      case 'max':
        return field ? computed.max[field] : null
      default:
        return null
    }
  }, [computeType, field, computed])
  
  // Форматируем значение
  const formattedValue = useMemo(() => {
    if (rawValue === null || rawValue === undefined) {
      return String(defaultValue)
    }
    return formatNumber(rawValue, format, locale)
  }, [rawValue, defaultValue, format, locale])
  
  // Применяем шаблон если есть
  const displayValue = useMemo(() => {
    if (template) {
      return applyTemplate(template, {
        value: formattedValue,
        count: computed.count,
        totalCount: computed.totalCount,
        filteredCount: computed.filteredCount,
        sum: computed.sum,
        avg: computed.avg,
        min: computed.min,
        max: computed.max
      })
    }
    return formattedValue
  }, [template, formattedValue, computed])
  
  // Скелетон при отсутствии данных
  if (computed.lastUpdated === null && showSkeleton) {
    return (
      <span 
        className={`inline-block bg-gray-200 animate-pulse rounded ${className || ''}`}
        style={{ width: '4em', height: '1em', ...style }}
      />
    )
  }
  
  return (
    <span className={className} style={style}>
      {displayValue}
    </span>
  )
}

export default ComputedBlock
