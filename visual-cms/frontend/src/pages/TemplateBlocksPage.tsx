/**
 * TemplateBlocksPage
 * 
 * Страница для управления Template блоками (блоки с isTemplate=true).
 * Заменяет старую страницу Templates которая показывала записи из таблицы templates.
 */

import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { fetchBlocks, selectBlocks, selectBlocksLoading } from '@/features/blocks/blocksSlice'
import { Header } from '@/shared/components/Header'
import { Button } from '@/shared/components/Button'
import { Sparkles, Plus, Search, Filter, Grid, List, Pencil } from 'lucide-react'

export const TemplateBlocksPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const allBlocks = useAppSelector(selectBlocks)
  const loading = useAppSelector(selectBlocksLoading)

  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    dispatch(fetchBlocks())
  }, [dispatch])

  // Фильтруем только Template блоки
  const templateBlocks = allBlocks.filter(block => block.isTemplate === true)

  // Применяем фильтры
  const filteredBlocks = templateBlocks.filter(block => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (
        !block.name?.toLowerCase().includes(query) &&
        !block.templateCategory?.toLowerCase().includes(query) &&
        !block.tags?.some(tag => tag.toLowerCase().includes(query))
      ) {
        return false
      }
    }

    if (categoryFilter && block.templateCategory !== categoryFilter) {
      return false
    }

    return true
  })

  // Получаем уникальные категории
  const categories = Array.from(new Set(templateBlocks.map(b => b.templateCategory).filter(Boolean)))

  const getCategoryColor = (category?: string): string => {
    const colors: Record<string, string> = {
      card: 'bg-blue-100 text-blue-700 border-blue-200',
      list: 'bg-green-100 text-green-700 border-green-200',
      gallery: 'bg-pink-100 text-pink-700 border-pink-200',
      custom: 'bg-purple-100 text-purple-700 border-purple-200',
    }
    return colors[category || 'custom'] || 'bg-gray-100 text-gray-700 border-gray-200'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Sparkles size={24} className="text-purple-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Template Блоки</h1>
                <p className="text-gray-600">Блоки с включенным Template режимом для Data Binding</p>
              </div>
            </div>

            <Link to="/blocks">
              <Button variant="primary">
                <Plus size={18} />
                <span>Создать блок</span>
              </Button>
            </Link>
          </div>

          {/* Info Banner */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Sparkles size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Что такое Template блок?</p>
                <p>
                  Template блок - это обычный блок с включенным режимом "Template". 
                  Он может использоваться для отображения динамических данных через Data Binding.
                </p>
                <p className="mt-2">
                  <strong>Как создать:</strong> Откройте любой блок → вкладка "Данные" → нажмите "Включить Template"
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск Template блоков..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-500"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-gray-400" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-500"
              >
                <option value="">Все категории</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
              >
                <Grid size={18} className={viewMode === 'grid' ? 'text-purple-600' : 'text-gray-600'} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
              >
                <List size={18} className={viewMode === 'list' ? 'text-purple-600' : 'text-gray-600'} />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-4 text-sm text-gray-600">
            <span>Всего Template блоков: <strong>{templateBlocks.length}</strong></span>
            <span>•</span>
            <span>Найдено: <strong>{filteredBlocks.length}</strong></span>
            {categoryFilter && (
              <>
                <span>•</span>
                <span>Категория: <strong>{categoryFilter}</strong></span>
              </>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
              <p className="text-gray-600">Загрузка Template блоков...</p>
            </div>
          </div>
        )}

        {/* Empty State - No Template Blocks */}
        {!loading && templateBlocks.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Sparkles size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Нет Template блоков</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Чтобы создать Template блок, откройте любой блок в редакторе, перейдите на вкладку "Данные" 
              и нажмите "Включить Template"
            </p>
            <Link to="/blocks">
              <Button variant="primary">
                <Plus size={18} />
                <span>Перейти к блокам</span>
              </Button>
            </Link>
          </div>
        )}

        {/* Empty State - No Results */}
        {!loading && templateBlocks.length > 0 && filteredBlocks.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Search size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Ничего не найдено</h3>
            <p className="text-gray-600 mb-4">
              Попробуйте изменить критерии поиска или фильтры
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                setSearchQuery('')
                setCategoryFilter('')
              }}
            >
              Сбросить фильтры
            </Button>
          </div>
        )}

        {/* Grid View */}
        {!loading && viewMode === 'grid' && filteredBlocks.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBlocks.map(block => (
              <div
                key={block.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/editor/block/${block.id}`)}
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-gradient-to-br from-purple-100 to-blue-100 rounded-t-lg relative overflow-hidden">
                  {block.thumbnail ? (
                    <img
                      src={block.thumbnail}
                      alt={block.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Sparkles size={48} className="text-purple-400" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getCategoryColor(block.templateCategory)}`}>
                      {block.templateCategory || 'custom'}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-2 truncate">{block.name}</h3>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                    <Sparkles size={14} className="text-purple-600" />
                    <span>{block.detectedFields?.length || 0} полей</span>
                  </div>

                  {/* Template Fields Preview */}
                  {block.detectedFields && block.detectedFields.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {block.detectedFields.slice(0, 3).map((field, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded border border-purple-200"
                        >
                          {field.name}
                        </span>
                      ))}
                      {block.detectedFields.length > 3 && (
                        <span className="px-2 py-0.5 text-xs text-gray-500">
                          +{block.detectedFields.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/editor/block/${block.id}`)
                      }}
                      className="flex-1"
                    >
                      <Pencil size={14} />
                      <span>Редактировать</span>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* List View */}
        {!loading && viewMode === 'list' && filteredBlocks.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Название</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Категория</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Поля</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Обновлено</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredBlocks.map(block => (
                  <tr
                    key={block.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/editor/block/${block.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Sparkles size={18} className="text-purple-600 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-gray-900">{block.name}</div>
                          {block.detectedFields && block.detectedFields.length > 0 && (
                            <div className="text-xs text-gray-500 mt-1">
                              {block.detectedFields.slice(0, 3).map(f => f.name).join(', ')}
                              {block.detectedFields.length > 3 && ` +${block.detectedFields.length - 3}`}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getCategoryColor(block.templateCategory)}`}>
                        {block.templateCategory || 'custom'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {block.detectedFields?.length || 0}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(block.updatedAt).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/editor/block/${block.id}`)
                        }}
                      >
                        <Pencil size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default TemplateBlocksPage
