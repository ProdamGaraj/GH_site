import React from 'react'
import { cn } from '@/shared/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}) => {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        {
          'bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-600': 
            variant === 'primary',
          'bg-gray-200 text-gray-900 hover:bg-gray-300 focus-visible:ring-gray-500': 
            variant === 'secondary',
          'hover:bg-gray-100 focus-visible:ring-gray-500': 
            variant === 'ghost',
          'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600': 
            variant === 'danger',
        },
        {
          'h-8 px-3 text-sm': size === 'sm',
          'h-10 px-4': size === 'md',
          'h-12 px-6 text-lg': size === 'lg',
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
