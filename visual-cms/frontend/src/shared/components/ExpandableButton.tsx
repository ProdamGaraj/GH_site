import React, { useState, useRef, useCallback } from 'react'
import { cn } from '@/shared/utils'

interface ExpandableButtonProps {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'success'
  className?: string
  title?: string
}

export const ExpandableButton: React.FC<ExpandableButtonProps> = ({
  icon,
  label,
  onClick,
  disabled = false,
  variant = 'secondary',
  className,
  title
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const clearAllTimeouts = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current)
      leaveTimeoutRef.current = null
    }
  }, [])

  const handleMouseEnter = useCallback(() => {
    // Отменяем закрытие если оно было запланировано
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current)
      leaveTimeoutRef.current = null
    }
    
    // Если уже открыто - ничего не делаем
    if (isExpanded) return
    
    // Запускаем таймер на открытие
    if (!hoverTimeoutRef.current) {
      hoverTimeoutRef.current = setTimeout(() => {
        setIsExpanded(true)
        hoverTimeoutRef.current = null
      }, 150) // 0.15s задержка
    }
  }, [isExpanded])

  const handleMouseLeave = useCallback(() => {
    // Отменяем открытие если оно было запланировано
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    
    // Добавляем небольшую задержку на закрытие чтобы избежать дёргания
    leaveTimeoutRef.current = setTimeout(() => {
      setIsExpanded(false)
      leaveTimeoutRef.current = null
    }, 50)
  }, [])

  const baseClasses = 'flex items-center justify-center rounded-md transition-all duration-300 ease-out overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed'
  
  const variantClasses = {
    primary: 'bg-primary-500 text-white hover:bg-primary-600',
    secondary: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400',
    success: 'bg-green-600 text-white hover:bg-green-700'
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title || label}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        baseClasses,
        variantClasses[variant],
        'h-9',
        isExpanded ? 'px-3' : 'w-9',
        className
      )}
    >
      <span className="flex-shrink-0">
        {icon}
      </span>
      <span 
        className={cn(
          'overflow-hidden whitespace-nowrap transition-all duration-300 ease-out text-sm font-medium',
          isExpanded ? 'max-w-[150px] ml-2' : 'max-w-0 ml-0'
        )}
      >
        {label}
      </span>
    </button>
  )
}
