/**
 * Save Status Indicator
 * 
 * Индикатор состояния сохранения в редакторе
 */

import React from 'react'
import { Cloud, CloudOff, Loader2, Check, AlertCircle } from 'lucide-react'
import { cn } from '@/shared/utils'

interface SaveStatusIndicatorProps {
  /** Идёт ли сохранение */
  isSaving: boolean
  /** Есть ли несохранённые изменения */
  hasUnsavedChanges: boolean
  /** Ошибка сохранения */
  error: string | null
  /** Текст последнего сохранения */
  lastSavedText: string
  /** Дополнительные классы */
  className?: string
}

export const SaveStatusIndicator: React.FC<SaveStatusIndicatorProps> = ({
  isSaving,
  hasUnsavedChanges,
  error,
  lastSavedText,
  className,
}) => {
  // Определяем состояние и цвет
  const getStatus = () => {
    if (error) {
      return {
        icon: <AlertCircle className="w-4 h-4" />,
        text: 'Ошибка сохранения',
        color: 'text-red-500',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
      }
    }
    
    if (isSaving) {
      return {
        icon: <Loader2 className="w-4 h-4 animate-spin" />,
        text: 'Сохранение...',
        color: 'text-blue-500',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
      }
    }
    
    if (hasUnsavedChanges) {
      return {
        icon: <CloudOff className="w-4 h-4" />,
        text: 'Несохранённые изменения',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
      }
    }
    
    return {
      icon: <Check className="w-4 h-4" />,
      text: lastSavedText || 'Сохранено',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
    }
  }
  
  const status = getStatus()
  
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded text-xs border transition-colors',
        status.bgColor,
        status.borderColor,
        status.color,
        className
      )}
      title={error || status.text}
    >
      {status.icon}
      <span className="whitespace-nowrap">{status.text}</span>
    </div>
  )
}

/**
 * Минимальный индикатор (только иконка)
 */
export const SaveStatusIcon: React.FC<{
  isSaving: boolean
  hasUnsavedChanges: boolean
  error: string | null
  className?: string
}> = ({ isSaving, hasUnsavedChanges, error, className }) => {
  if (error) {
    return (
      <span title="Ошибка сохранения">
        <AlertCircle className={cn('w-4 h-4 text-red-500', className)} />
      </span>
    )
  }
  
  if (isSaving) {
    return (
      <span title="Сохранение...">
        <Loader2 className={cn('w-4 h-4 text-blue-500 animate-spin', className)} />
      </span>
    )
  }
  
  if (hasUnsavedChanges) {
    return (
      <span title="Несохранённые изменения">
        <CloudOff className={cn('w-4 h-4 text-yellow-600', className)} />
      </span>
    )
  }
  
  return (
    <span title="Сохранено">
      <Cloud className={cn('w-4 h-4 text-green-600', className)} />
    </span>
  )
}
