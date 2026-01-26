/**
 * BlockTemplateSelector Component
 * 
 * Выбор Template-блоков (блоки с isTemplate=true) для Repeater bindings.
 * Заменяет старый TemplateSelector, который работал с таблицей templates.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { fetchBlocks, selectBlocks, selectBlocksLoading } from '@/features/blocks/blocksSlice'
import type { Block } from '@/shared/types'
import { Sparkles, Search, ChevronDown, Check } from 'lucide-react'

interface BlockTemplateSelectorProps {
  value?: string | null // Block ID
  onChange: (blockId: string | null, block?: Block) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export const BlockTemplateSelector: React.FC<BlockTemplateSelectorProps> = ({
  value,
  onChange,
  placeholder = 'Выберите Template блок...',
  className = '',
  disabled = false,
}) => {
  const dispatch = useAppDispatch()
  const allBlocks = useAppSelector(selectBlocks)
  const loading = useAppSelector(selectBlocksLoading)

  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Загружаем блоки при монтировании
  useEffect(() => {
    dispatch(fetchBlocks())
  }, [dispatch])

  // Закрываем dropdown при клике вне
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Фильтруем только Template блоки
  const templateBlocks = allBlocks.filter(block => block.isTemplate === true)

  // Фильтруем по поисковому запросу
  const filteredBlocks = templateBlocks.filter(block => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      block.name?.toLowerCase().includes(query) ||
      block.templateCategory?.toLowerCase().includes(query) ||
      block.tags?.some(tag => tag.toLowerCase().includes(query))
    )
  })

  // Получаем выбранный блок
  const selectedBlock = value ? templateBlocks.find(b => b.id === value) : null

  const handleSelect = useCallback((block: Block) => {
    onChange(block.id, block)
    setIsOpen(false)
    setSearchQuery('')
  }, [onChange])

  const handleClear = useCallback(() => {
    onChange(null)
    setIsOpen(false)
  }, [onChange])

  const getCategoryColor = (category?: string): string => {
    const colors: Record<string, string> = {
      card: 'bg-blue-100 text-blue-700',
      list: 'bg-green-100 text-green-700',
      gallery: 'bg-pink-100 text-pink-700',
      custom: 'bg-purple-100 text-purple-700',
    }
    return colors[category || 'custom'] || 'bg-gray-100 text-gray-700'
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between px-3 py-2.5 text-left
          border rounded-lg transition-colors
          ${disabled
            ? 'bg-gray-100 border-gray-200 cursor-not-allowed'
            : isOpen
              ? 'border-purple-500 ring-2 ring-purple-100'
              : 'border-gray-300 hover:border-purple-400'
          }
        `}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selectedBlock ? (
            <>
              <Sparkles size={16} className="text-purple-600 flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-gray-900 truncate">{selectedBlock.name}</div>
                <div className="text-xs text-gray-500">
                  {selectedBlock.detectedFields?.length || 0} полей
                </div>
              </div>
            </>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </div>
        <ChevronDown size={16} className={`text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск Template блоков..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-500"
                autoFocus
              />
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <p className="mt-2 text-sm text-gray-500">Загрузка блоков...</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && templateBlocks.length === 0 && (
            <div className="p-8 text-center">
              <Sparkles size={32} className="mx-auto text-gray-400 mb-2" />
              <p className="text-sm font-medium text-gray-700">Нет Template блоков</p>
              <p className="text-xs text-gray-500 mt-1">
                Включите Template режим для блока на вкладке "Данные"
              </p>
            </div>
          )}

          {/* No Results */}
          {!loading && templateBlocks.length > 0 && filteredBlocks.length === 0 && (
            <div className="p-8 text-center">
              <Search size={32} className="mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-700">Ничего не найдено</p>
              <p className="text-xs text-gray-500 mt-1">
                Попробуйте другой запрос
              </p>
            </div>
          )}

          {/* Results */}
          {!loading && filteredBlocks.length > 0 && (
            <div className="max-h-80 overflow-y-auto">
              {/* Clear Selection */}
              {value && (
                <button
                  onClick={handleClear}
                  className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 border-b border-gray-100"
                >
                  <span className="italic">Очистить выбор</span>
                </button>
              )}

              {/* Template Blocks List */}
              {filteredBlocks.map((block) => {
                const isSelected = value === block.id

                return (
                  <button
                    key={block.id}
                    onClick={() => handleSelect(block)}
                    className={`
                      w-full px-3 py-3 text-left transition-colors border-b border-gray-100
                      ${isSelected ? 'bg-purple-50' : 'hover:bg-gray-50'}
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <Sparkles size={16} className="text-purple-600 mt-0.5 flex-shrink-0" />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 truncate">
                            {block.name || 'Unnamed Block'}
                          </span>
                          {isSelected && <Check size={14} className="text-purple-600" />}
                        </div>
                        
                        <div className="flex items-center gap-2 mt-1">
                          {block.templateCategory && (
                            <span className={`px-2 py-0.5 text-xs rounded-full ${getCategoryColor(block.templateCategory)}`}>
                              {block.templateCategory}
                            </span>
                          )}
                          <span className="text-xs text-gray-500">
                            {block.detectedFields?.length || 0} полей
                          </span>
                        </div>

                        {/* Template Fields Preview */}
                        {block.detectedFields && block.detectedFields.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {block.detectedFields.slice(0, 3).map((field, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 bg-white border border-gray-200 text-xs text-gray-600 rounded"
                              >
                                {field.name}
                              </span>
                            ))}
                            {block.detectedFields.length > 3 && (
                              <span className="px-1.5 py-0.5 text-xs text-gray-400">
                                +{block.detectedFields.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Footer Info */}
          {!loading && templateBlocks.length > 0 && (
            <div className="p-2 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500 text-center">
                Найдено {filteredBlocks.length} из {templateBlocks.length} Template блоков
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
