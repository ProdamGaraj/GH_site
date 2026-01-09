import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { selectBreakpoints, addBreakpoint, removeBreakpoint, updateBreakpoint } from '../editorSlice'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Input'
import { Plus, Trash2, Monitor, Tablet, Smartphone, Laptop, Watch, X } from 'lucide-react'
import { generateId } from '@/shared/utils'
import type { CustomBreakpoint } from '@/shared/types'

interface BreakpointManagerProps {
  onClose: () => void
}

const iconOptions = [
  { value: 'monitor', Icon: Monitor, label: 'Monitor' },
  { value: 'laptop', Icon: Laptop, label: 'Laptop' },
  { value: 'tablet', Icon: Tablet, label: 'Tablet' },
  { value: 'smartphone', Icon: Smartphone, label: 'Smartphone' },
  { value: 'watch', Icon: Watch, label: 'Watch' },
] as const

export const BreakpointManager: React.FC<BreakpointManagerProps> = ({ onClose }) => {
  const dispatch = useAppDispatch()
  const breakpoints = useAppSelector(selectBreakpoints)
  const [newBreakpoint, setNewBreakpoint] = useState({
    name: '',
    width: '',
    height: '',
    icon: 'monitor' as 'monitor' | 'tablet' | 'smartphone' | 'laptop' | 'watch',
  })

  const handleAddBreakpoint = () => {
    if (!newBreakpoint.name || !newBreakpoint.width) {
      alert('Заполните название и ширину')
      return
    }

    const breakpoint: CustomBreakpoint = {
      id: generateId(),
      name: newBreakpoint.name,
      width: parseInt(newBreakpoint.width),
      height: newBreakpoint.height ? parseInt(newBreakpoint.height) : undefined,
      icon: newBreakpoint.icon,
    }

    dispatch(addBreakpoint(breakpoint))
    setNewBreakpoint({ name: '', width: '', height: '', icon: 'monitor' })
  }

  const handleRemoveBreakpoint = (id: string) => {
    const bp = breakpoints.find(b => b.id === id)
    if (bp && ['desktop', 'tablet', 'mobile'].includes(bp.id)) {
      alert('Нельзя удалить стандартный breakpoint')
      return
    }
    if (confirm('Удалить этот breakpoint?')) {
      dispatch(removeBreakpoint(id))
    }
  }

  const sortedBreakpoints = [...breakpoints].sort((a, b) => b.width - a.width)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Управление Breakpoints</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded text-red-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Existing Breakpoints */}
          <div className="space-y-2 mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Текущие breakpoints</h3>
            {sortedBreakpoints.map((bp) => {
              const iconOption = iconOptions.find(opt => opt.value === bp.icon) || iconOptions[0]
              const Icon = iconOption.Icon
              const isDefault = ['desktop', 'tablet', 'mobile'].includes(bp.id)
              
              return (
                <div key={bp.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded border">
                  <Icon size={20} className="text-gray-600" />
                  <div className="flex-1">
                    <div className="font-medium text-gray-500">{bp.name}</div>
                    <div className="text-sm text-gray-500">
                      {bp.width}px{bp.height ? ` × ${bp.height}px` : ''}
                    </div>
                  </div>
                  {!isDefault && (
                    <button
                      onClick={() => handleRemoveBreakpoint(bp.id)}
                      className="p-1 hover:bg-red-50 rounded text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  {isDefault && (
                    <span className="text-xs text-gray-400 px-2 py-1 bg-gray-200 rounded">
                      По умолчанию
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Add New Breakpoint */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Добавить новый breakpoint</h3>
            <div className="space-y-3">
              <Input
                label="Название"
                value={newBreakpoint.name}
                onChange={(e) => setNewBreakpoint({ ...newBreakpoint, name: e.target.value })}
                placeholder="Например: Large Desktop"
              />
              <Input
                label="Ширина (px)"
                type="number"
                value={newBreakpoint.width}
                onChange={(e) => setNewBreakpoint({ ...newBreakpoint, width: e.target.value })}
                placeholder="1920"
              />
              <Input
                label="Высота (px) - необязательно"
                type="number"
                value={newBreakpoint.height}
                onChange={(e) => setNewBreakpoint({ ...newBreakpoint, height: e.target.value })}
                placeholder="1080"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Иконка</label>
                <div className="flex gap-2">
                  {iconOptions.map(({ value, Icon, label }) => (
                    <button
                      key={value}
                      onClick={() => setNewBreakpoint({ ...newBreakpoint, icon: value })}
                      className={`p-3 border rounded hover:border-primary-500 transition-colors ${
                        newBreakpoint.icon === value ? 'border-primary-500 bg-primary-50' : 'border-gray-300'
                      }`}
                      title={label}
                    >
                      <Icon size={20} className={newBreakpoint.icon === value ? 'text-primary-600' : 'text-gray-600'} />
                    </button>
                  ))}
                </div>
              </div>
              <Button
                onClick={handleAddBreakpoint}
                className="w-full"
              >
                <Plus size={16} className="mr-2" />
                Добавить Breakpoint
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
