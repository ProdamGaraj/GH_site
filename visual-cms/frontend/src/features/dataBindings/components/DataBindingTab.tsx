import React, { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  fetchBindingsForBlock,
  createBinding,
  deleteBinding,
  setCurrentBinding,
  selectCurrentBlockBindings,
  selectCurrentBinding,
  selectBindingsLoading,
  selectBindingsSaving,
  selectBindingsError,
  fetchDataWithBinding,
  testBindingWithCurrentConfig,
  selectFetchedData,
  selectIsFetching,
} from '@/features/dataBindings/dataBindingsSlice'
import { fetchDataSources, selectDataSources } from '@/features/data-sources/dataSourcesSlice'
import type { 
  DataBinding, 
  CreateDataBindingRequest, 
  BindingType,
  InputMode,
  InputBindingConfig
} from '@/shared/types/dataBinding'
import type { DataTransform } from '@/shared/types/transforms'
import { InputBindingEditor } from './InputBindingEditor'
import { OutputBindingEditor } from './OutputBindingEditor'
import { DataPreview } from './DataPreview'

interface DataBindingTabProps {
  blockId: string
  pageId?: string
}

/**
 * Таб настройки привязки данных к блоку
 */
export const DataBindingTab: React.FC<DataBindingTabProps> = ({ blockId, pageId }) => {
  const dispatch = useAppDispatch()
  
  // State
  const bindings = useAppSelector(selectCurrentBlockBindings)
  const currentBinding = useAppSelector(selectCurrentBinding)
  const dataSources = useAppSelector(selectDataSources)
  const loading = useAppSelector(selectBindingsLoading)
  const saving = useAppSelector(selectBindingsSaving)
  const error = useAppSelector(selectBindingsError)
  
  // Локальный стейт для создания новой привязки
  const [isCreating, setIsCreating] = useState(false)
  const [newBindingType, setNewBindingType] = useState<BindingType>('input')
  const [selectedDataSourceId, setSelectedDataSourceId] = useState<string>('')

  // Загружаем привязки и источники данных при монтировании
  useEffect(() => {
    dispatch(fetchBindingsForBlock({ blockId, pageId }))
    dispatch(fetchDataSources({}))
  }, [dispatch, blockId, pageId])

  // Получаем input binding (если есть)
  const inputBinding = bindings.find(
    b => b.bindingType === 'input' || b.bindingType === 'bidirectional'
  )

  // Превью данных
  const previewKey = inputBinding?.id || `preview-${blockId}`
  const fetchedData = useAppSelector(selectFetchedData(previewKey))
  const isFetching = useAppSelector(selectIsFetching(previewKey))

  // Создание новой привязки
  const handleCreateBinding = async () => {
    if (!selectedDataSourceId) return

    const newBinding: CreateDataBindingRequest = {
      blockId,
      pageId: pageId || undefined,
      dataSourceId: selectedDataSourceId,
      bindingType: newBindingType,
      config: {
        inputConfig: newBindingType === 'input' || newBindingType === 'bidirectional' ? {
          mode: 'single' as InputMode,
          fieldMappings: [],
        } : undefined,
      },
    }

    try {
      await dispatch(createBinding(newBinding)).unwrap()
      setIsCreating(false)
      setSelectedDataSourceId('')
    } catch (err) {
      console.error('Failed to create binding:', err)
    }
  }

  // Удаление привязки
  const handleDeleteBinding = async (id: string) => {
    if (!confirm('Удалить привязку данных?')) return
    try {
      await dispatch(deleteBinding(id)).unwrap()
    } catch (err) {
      console.error('Failed to delete binding:', err)
    }
  }

  // Тестирование привязки с текущими настройками (включая несохранённые)
  const handleTestBinding = async (currentConfig?: InputBindingConfig) => {
    if (!inputBinding) return
    
    // Если передана текущая конфигурация - используем тест с transforms override
    if (currentConfig) {
      const transforms = (currentConfig as InputBindingConfig & { transforms?: DataTransform[] }).transforms || []
      dispatch(testBindingWithCurrentConfig({
        key: previewKey,
        request: { 
          bindingId: inputBinding.id,
          transformsOverride: transforms.length > 0 ? transforms : undefined
        }
      }))
    } else {
      // Fallback - стандартный запрос с сохранённой привязкой
      dispatch(fetchDataWithBinding({
        key: previewKey,
        request: { bindingId: inputBinding.id }
      }))
    }
  }

  // Выбор привязки для редактирования
  const handleSelectBinding = (binding: DataBinding) => {
    dispatch(setCurrentBinding(binding))
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        <span className="ml-2 text-gray-600">Загрузка...</span>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Привязка данных
        </h3>
        {!isCreating && bindings.length === 0 && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Добавить привязку
          </button>
        )}
      </div>

      {/* Ошибка */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Форма создания новой привязки */}
      {isCreating && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
          <h4 className="font-medium text-gray-800">Новая привязка</h4>
          
          {/* Тип привязки */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Тип привязки
            </label>
            <select
              value={newBindingType}
              onChange={(e) => setNewBindingType(e.target.value as BindingType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
            >
              <option value="input">Input (чтение данных)</option>
              <option value="output">Output (запись данных)</option>
              <option value="bidirectional">Двунаправленная</option>
            </select>
          </div>

          {/* Источник данных */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Источник данных
            </label>
            <select
              value={selectedDataSourceId}
              onChange={(e) => setSelectedDataSourceId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
            >
              <option value="">Выберите источник...</option>
              {dataSources.map(ds => (
                <option key={ds.id} value={ds.id}>
                  {ds.name} ({ds.type})
                </option>
              ))}
            </select>
          </div>

          {/* Кнопки */}
          <div className="flex gap-2">
            <button
              onClick={handleCreateBinding}
              disabled={!selectedDataSourceId || saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Создание...' : 'Создать'}
            </button>
            <button
              onClick={() => {
                setIsCreating(false)
                setSelectedDataSourceId('')
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Список привязок */}
      {bindings.length > 0 && (
        <div className="space-y-3">
          {bindings.map(binding => (
            <div
              key={binding.id}
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                currentBinding?.id === binding.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
              onClick={() => handleSelectBinding(binding)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Иконка типа */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    binding.bindingType === 'input' ? 'bg-green-100 text-green-600' :
                    binding.bindingType === 'output' ? 'bg-orange-100 text-orange-600' :
                    'bg-purple-100 text-purple-600'
                  }`}>
                    {binding.bindingType === 'input' ? '↓' :
                     binding.bindingType === 'output' ? '↑' : '↕'}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {binding.dataSource?.name || 'Источник данных'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {binding.bindingType === 'input' ? 'Чтение' :
                       binding.bindingType === 'output' ? 'Запись' : 'Двунаправленная'} 
                      {binding.config.inputConfig?.mode && ` • ${binding.config.inputConfig.mode}`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Статус */}
                  {binding.lastFetchStatus && (
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      binding.lastFetchStatus === 'success' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {binding.lastFetchStatus}
                    </span>
                  )}
                  
                  {/* Удалить */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteBinding(binding.id)
                    }}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    title="Удалить привязку"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Редактор текущей привязки */}
      {currentBinding && (
        <div className="border-t pt-6 space-y-6">
          {/* Input Binding Editor */}
          {(currentBinding.bindingType === 'input' || currentBinding.bindingType === 'bidirectional') && (
            <InputBindingEditor
              binding={currentBinding}
              onTest={handleTestBinding}
            />
          )}

          {/* Output Binding Editor */}
          {(currentBinding.bindingType === 'output' || currentBinding.bindingType === 'bidirectional') && (
            <OutputBindingEditor
              binding={currentBinding}
              onTest={handleTestBinding}
            />
          )}

          {/* Превью данных */}
          <DataPreview
            data={fetchedData}
            loading={isFetching}
            onRefresh={handleTestBinding}
          />
        </div>
      )}

      {/* Пустое состояние */}
      {bindings.length === 0 && !isCreating && (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">🔗</div>
          <p>Нет привязок данных</p>
          <p className="text-sm">Добавьте привязку для подключения блока к источнику данных</p>
        </div>
      )}
    </div>
  )
}
