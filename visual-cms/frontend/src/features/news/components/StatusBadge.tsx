import React from 'react'
import { cn } from '@/shared/utils'
import type { NewsStatus } from '../types'
import { STATUS_LABELS } from '../newsForm'

const STYLES: Record<NewsStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  published: 'bg-green-100 text-green-800',
  archived: 'bg-amber-100 text-amber-800',
}

export const StatusBadge: React.FC<{ status: NewsStatus }> = ({ status }) => (
  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', STYLES[status])}>{STATUS_LABELS[status]}</span>
)
