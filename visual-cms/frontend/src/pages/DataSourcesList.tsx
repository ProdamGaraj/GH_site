import React, { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Input'
import { Header } from '@/shared/components/Header'
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Copy, 
  Play, 
  MoreVertical,
  Globe,
  Database,
  Rss,
  FileJson,
  Braces,
  Plug,
  Calculator,
  FormInput,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { 
  fetchDataSources, 
  deleteDataSource, 
  testDataSourceConnection,
  duplicateDataSource,
  selectDataSources, 
  selectDataSourcesLoading,
  selectDataSourcesTotal,
  selectDataSourcesPage,
  selectDataSourcesLimit,
  selectTotalPages,
  setPage,
  setFilters,
  clearFilters,
  selectDataSourcesFilters
} from '@/features/data-sources/dataSourcesSlice'
import type { DataSourceType, DataSourceStatus } from '@/shared/types/dataSource'
import { DATA_SOURCE_TYPES } from '@/shared/types/dataSource'

/**
 * DataSourcesList - Страница списка источников данных
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 1.2 Frontend: DataSourcesList
 * 
 * Требования:
 * - Список всех источников (таблица)
 * - Поиск и фильтрация
 * - Кнопка "+ Create Data Source"
 * - Actions: Edit, Duplicate, Delete, Test
 */

// Иконки для типов источников
const typeIcons: Record<DataSourceType, React.ReactNode> = {
  'rest-api': <Globe size={18} className="text-blue-500" />,
  'feed': <Rss size={18} className="text-orange-500" />,
  'graphql': <Braces size={18} className="text-pink-500" />,
  'database': <Database size={18} className="text-purple-500" />,
  'external': <Plug size={18} className="text-green-500" />,
  'static': <FileJson size={18} className="text-gray-500" />,
  'computed': <Calculator size={18} className="text-cyan-500" />,
  'form-data': <FormInput size={18} className="text-yellow-500" />
}

// Метки типов
const typeLabels: Record<DataSourceType, string> = {
  'rest-api': 'REST API',
  'feed': 'JSON Feed',
  'graphql': 'GraphQL',
  'database': 'Database',
  'external': 'External Service',
  'static': 'Static Data',
  'computed': 'Computed',
  'form-data': 'Form Data'
}

// Стили статусов
const statusStyles: Record<DataSourceStatus, string> = {
  active: 'bg-green-100 text-green-700',
  draft: 'bg-gray-100 text-gray-700',
  archived: 'bg-red-100 text-red-700'
}

const statusLabels: Record<DataSourceStatus, string> = {
  active: 'Active',
  draft: 'Draft',
  archived: 'Archived'
}

export const DataSourcesList: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  
  const dataSources = useAppSelector(selectDataSources)
  const loading = useAppSelector(selectDataSourcesLoading)
  const total = useAppSelector(selectDataSourcesTotal)
  const page = useAppSelector(selectDataSourcesPage)
  const limit = useAppSelector(selectDataSourcesLimit)
  const totalPages = useAppSelector(selectTotalPages)
  const filters = useAppSelector(selectDataSourcesFilters)
  
  const [searchQuery, setSearchQuery] = useState(filters.search || '')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedType, setSelectedType] = useState<DataSourceType | ''>('')
  const [selectedStatus, setSelectedStatus] = useState<DataSourceStatus | ''>('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  // Загрузка данных при монтировании и изменении фильтров
  useEffect(() => {
    dispatch(fetchDataSources(filters))
  }, [dispatch, filters])

  // Поиск с debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== filters.search) {
        dispatch(setFilters({ ...filters, search: searchQuery || undefined, page: 1 }))
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, dispatch])

  // Применение фильтров
  const handleApplyFilters = useCallback(() => {
    dispatch(setFilters({
      ...filters,
      type: selectedType || undefined,
      status: selectedStatus || undefined,
      page: 1
    }))
    setShowFilters(false)
  }, [dispatch, filters, selectedType, selectedStatus])

  // Сброс фильтров
  const handleClearFilters = useCallback(() => {
    setSearchQuery('')
    setSelectedType('')
    setSelectedStatus('')
    dispatch(clearFilters())
    setShowFilters(false)
  }, [dispatch])

  // Удаление
  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Вы уверены, что хотите удалить "${name}"?`)) {
      try {
        await dispatch(deleteDataSource(id)).unwrap()
      } catch (error) {
        console.error('Failed to delete data source:', error)
        alert('Ошибка при удалении источника данных')
      }
    }
    setOpenMenuId(null)
  }

  // Тестирование
  const handleTest = async (id: string) => {
    setTestingId(id)
    setOpenMenuId(null)
    try {
      await dispatch(testDataSourceConnection(id)).unwrap()
    } catch (error) {
      console.error('Connection test failed:', error)
    } finally {
      setTestingId(null)
    }
  }

  // Дублирование
  const handleDuplicate = async (id: string) => {
    setOpenMenuId(null)
    try {
      const result = await dispatch(duplicateDataSource({ id })).unwrap()
      navigate(`/data-sources/${result.id}/edit`)
    } catch (error) {
      console.error('Failed to duplicate:', error)
      alert('Ошибка при дублировании')
    }
  }

  // Навигация по страницам
  const handlePageChange = (newPage: number) => {
    dispatch(setPage(newPage))
    dispatch(fetchDataSources({ ...filters, page: newPage }))
  }

  // Форматирование даты
  const formatDate = (dateString?: string) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null)
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [openMenuId])

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header />
      
      <div className="flex-1 overflow-y-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Data Sources</h1>
            <p className="text-gray-600 mt-1">
              Управление источниками данных для динамических блоков
            </p>
          </div>
          <Link to="/data-sources/new">
            <Button>
              <Plus size={16} className="mr-2" />
              Create Data Source
            </Button>
          </Link>
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Search data sources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter Button */}
            <Button 
              variant="secondary" 
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? 'bg-blue-50 border-blue-200' : ''}
            >
              <Filter size={16} className="mr-2" />
              Filters
              {(selectedType || selectedStatus) && (
                <span className="ml-2 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {(selectedType ? 1 : 0) + (selectedStatus ? 1 : 0)}
                </span>
              )}
            </Button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-end gap-4">
                {/* Type Filter */}
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value as DataSourceType | '')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All types</option>
                    {DATA_SOURCE_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value as DataSourceStatus | '')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={handleClearFilters}>
                    Clear
                  </Button>
                  <Button onClick={handleApplyFilters}>
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Data Table */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-4">Loading data sources...</p>
          </div>
        ) : dataSources.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Database size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No data sources found
            </h3>
            <p className="text-gray-500 mb-6">
              {filters.search || filters.type || filters.status
                ? 'Try adjusting your filters'
                : 'Create your first data source to get started'}
            </p>
            {!filters.search && !filters.type && !filters.status && (
              <Link to="/data-sources/new">
                <Button>
                  <Plus size={16} className="mr-2" />
                  Create Data Source
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Fetch
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Updated
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dataSources.map((ds) => (
                    <tr 
                      key={ds.id} 
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/data-sources/${ds.id}/edit`)}
                    >
                      {/* Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                            {typeIcons[ds.type]}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {ds.name}
                            </div>
                            {ds.description && (
                              <div className="text-sm text-gray-500 truncate max-w-xs">
                                {ds.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">
                          {typeLabels[ds.type]}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusStyles[ds.status]}`}>
                          {statusLabels[ds.status]}
                        </span>
                      </td>

                      {/* Last Fetch */}
                      <td className="px-6 py-4">
                        <div className="flex items-center text-sm">
                          {testingId === ds.id ? (
                            <span className="flex items-center text-blue-600">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                              Testing...
                            </span>
                          ) : ds.lastFetchStatus === 'success' ? (
                            <span className="flex items-center text-green-600">
                              <CheckCircle size={14} className="mr-1" />
                              Success
                            </span>
                          ) : ds.lastFetchStatus === 'error' ? (
                            <span className="flex items-center text-red-600">
                              <XCircle size={14} className="mr-1" />
                              Failed
                            </span>
                          ) : (
                            <span className="flex items-center text-gray-400">
                              <Clock size={14} className="mr-1" />
                              Not tested
                            </span>
                          )}
                        </div>
                        {ds.lastFetchAt && (
                          <div className="text-xs text-gray-400 mt-1">
                            {formatDate(ds.lastFetchAt)}
                          </div>
                        )}
                      </td>

                      {/* Updated */}
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(ds.updatedAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTest(ds.id)}
                            disabled={testingId === ds.id}
                            title="Test Connection"
                            
                          >
                            <Play size={14} color='black' />
                          </Button>
                          
                          <div className="relative">
                            <Button
                              variant="ghost"
                              size="sm"
                              style={{ color: 'black' }}
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenMenuId(openMenuId === ds.id ? null : ds.id)
                              }}
                            >
                              <MoreVertical size={14} />
                            </Button>

                            {openMenuId === ds.id && (
                              <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                                <button
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                                  color='black'
                                  onClick={() => {
                                    setOpenMenuId(null)
                                    navigate(`/data-sources/${ds.id}/edit`)
                                  }}
                                >
                                  <Edit size={14} className="mr-2" color='black'/>
                                  Edit
                                </button>
                                <button
                                color='black'
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                                  onClick={() => handleDuplicate(ds.id)}
                                >
                                  <Copy size={14} className="mr-2" color='black'/>
                                  Duplicate
                                </button>
                                <button
                                color='black'
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                                  onClick={() => handleTest(ds.id)}
                                >
                                  <Play size={14} className="mr-2" color="black" />
                                  Test Connection
                                </button>
                                <hr className="my-1" />
                                <button
                                color='black'
                                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
                                  onClick={() => handleDelete(ds.id, ds.name)}
                                >
                                  <Trash2 size={14} className="mr-2" color='black' />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-500">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} results
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => handlePageChange(page - 1)}
                  >
                    <ChevronLeft size={14} className="mr-1" color="black" />
                    Previous
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1))
                      .map((p, idx, arr) => (
                        <React.Fragment key={p}>
                          {idx > 0 && arr[idx - 1] !== p - 1 && (
                            <span className="px-2 text-gray-400">...</span>
                          )}
                          <Button
                            variant={p === page ? 'primary' : 'secondary'}
                            size="sm"
                            onClick={() => handlePageChange(p)}
                            className="w-8"
                          >
                            {p}
                          </Button>
                        </React.Fragment>
                      ))
                    }
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => handlePageChange(page + 1)}
                  >
                    Next
                    <ChevronRight size={14} className="ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default DataSourcesList
