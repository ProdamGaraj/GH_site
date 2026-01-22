/**
 * Drop Validation Toast
 * 
 * Компонент для отображения результатов валидации при drop
 */

import React, { useEffect, useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle, X, Info } from 'lucide-react'
import { cn } from '@/shared/utils'

export interface ValidationMessage {
  id: string
  type: 'error' | 'warning' | 'success' | 'info'
  message: string
  suggestion?: string
  duration?: number
}

interface DropValidationToastProps {
  messages: ValidationMessage[]
  onDismiss: (id: string) => void
}

const getIcon = (type: ValidationMessage['type']) => {
  switch (type) {
    case 'error': return AlertCircle
    case 'warning': return AlertTriangle
    case 'success': return CheckCircle
    case 'info': return Info
  }
}

const getStyles = (type: ValidationMessage['type']) => {
  switch (type) {
    case 'error':
      return {
        container: 'bg-red-50 border-red-200 text-red-800',
        icon: 'text-red-500',
      }
    case 'warning':
      return {
        container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
        icon: 'text-yellow-500',
      }
    case 'success':
      return {
        container: 'bg-green-50 border-green-200 text-green-800',
        icon: 'text-green-500',
      }
    case 'info':
      return {
        container: 'bg-blue-50 border-blue-200 text-blue-800',
        icon: 'text-blue-500',
      }
  }
}

const ToastItem: React.FC<{
  message: ValidationMessage
  onDismiss: () => void
}> = ({ message, onDismiss }) => {
  const Icon = getIcon(message.type)
  const styles = getStyles(message.type)
  
  useEffect(() => {
    if (message.duration !== 0) {
      const timer = setTimeout(() => {
        onDismiss()
      }, message.duration || 5000)
      return () => clearTimeout(timer)
    }
  }, [message.duration, onDismiss])
  
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border shadow-lg",
        "animate-in slide-in-from-right-full duration-300",
        styles.container
      )}
    >
      <Icon className={cn("w-5 h-5 flex-shrink-0 mt-0.5", styles.icon)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{message.message}</p>
        {message.suggestion && (
          <p className="text-xs mt-1 opacity-80">{message.suggestion}</p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="p-1 rounded hover:bg-black/5 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export const DropValidationToast: React.FC<DropValidationToastProps> = ({
  messages,
  onDismiss,
}) => {
  if (messages.length === 0) return null
  
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
      {messages.map((message) => (
        <ToastItem
          key={message.id}
          message={message}
          onDismiss={() => onDismiss(message.id)}
        />
      ))}
    </div>
  )
}

// Хук для управления toast-уведомлениями
export const useValidationToast = () => {
  const [messages, setMessages] = useState<ValidationMessage[]>([])
  
  const addMessage = (message: Omit<ValidationMessage, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    setMessages(prev => [...prev, { ...message, id }])
    return id
  }
  
  const dismissMessage = (id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id))
  }
  
  const showError = (message: string, suggestion?: string) => {
    return addMessage({ type: 'error', message, suggestion, duration: 6000 })
  }
  
  const showWarning = (message: string, suggestion?: string) => {
    return addMessage({ type: 'warning', message, suggestion, duration: 5000 })
  }
  
  const showSuccess = (message: string) => {
    return addMessage({ type: 'success', message, duration: 3000 })
  }
  
  const showInfo = (message: string, suggestion?: string) => {
    return addMessage({ type: 'info', message, suggestion, duration: 4000 })
  }
  
  const clearAll = () => {
    setMessages([])
  }
  
  return {
    messages,
    addMessage,
    dismissMessage,
    showError,
    showWarning,
    showSuccess,
    showInfo,
    clearAll,
  }
}

export default DropValidationToast
