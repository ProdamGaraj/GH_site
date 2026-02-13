import React, { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  fetchBindingsForBlock,
  createBinding,
  updateBinding,
  selectCurrentBlockBindings,
} from '@/features/dataBindings/dataBindingsSlice'
import { fetchDataSources, selectDataSources } from '@/features/data-sources/dataSourcesSlice'
import { fetchBlockById, selectBlocks } from '@/features/blocks/blocksSlice'
import { markAsDirty } from '@/features/editor/editorSlice'
import { BlockTemplateSelector } from '@/features/blocks/components/BlockTemplateSelector'
import { TransformsEditor } from './TransformsEditor'
import { Database, Link, Sparkles, CheckCircle, AlertCircle, ArrowRight, Loader2, ChevronDown, ChevronUp, Settings2 } from 'lucide-react'
import { EndpointConfigEditor, DEFAULT_ENDPOINT_CONFIG } from './EndpointConfigEditor'
import type { DetectedField } from '@/shared/types/template'
import type { CreateDataBindingRequest, FieldMapping, InputMode, EndpointConfig } from '@/shared/types/dataBinding'
import type { Block } from '@/shared/types'
import type { DataTransform, DynamicFilter } from '@/shared/types/transforms'

interface SmartDataBindingTabProps {
  blockId: string
  linkedBlockId?: string // ID библиотечного блока для поиска привязки
  pageId?: string
}

/**
 * Улучшенный таб для простой настройки привязки данных с Template блоками
 */
export const SmartDataBindingTab: React.FC<SmartDataBindingTabProps> = ({ blockId, linkedBlockId, pageId }) => {
  const dispatch = useAppDispatch()
  
  // State
  const bindings = useAppSelector(selectCurrentBlockBindings)
  const dataSources = useAppSelector(selectDataSources)
  const blocks = useAppSelector(selectBlocks)
  
  const [selectedDataSourceId, setSelectedDataSourceId] = useState<string>('')
  const [mode, setMode] = useState<InputMode>('single')
  const [selectedTemplateBlockId, setSelectedTemplateBlockId] = useState<string>('')
  const [arrayPath, setArrayPath] = useState<string>('data')
  const [mappings, setMappings] = useState<FieldMapping[]>([])
  const [loading, setLoading] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [transforms, setTransforms] = useState<DataTransform[]>([])
  const [dynamicFilters, setDynamicFilters] = useState<DynamicFilter[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [endpointConfig, setEndpointConfig] = useState<EndpointConfig>(DEFAULT_ENDPOINT_CONFIG)

  // Найти блок и его Template Fields
  const block = blocks.find(b => b.id === blockId)
  const templateFields = block?.detectedFields || []
  const isTemplate = block?.isTemplate

  // Существующая привязка (если есть) - ищем по blockId или linkedBlockId
  const existingBinding = bindings.find(b => 
    (b.bindingType === 'input' || b.bindingType === 'bidirectional') &&
    (b.blockId === blockId || (linkedBlockId && b.blockId === linkedBlockId))
  )

  // Загрузка данных - загружаем биндинги для обоих ID одним запросом
  useEffect(() => {
    dispatch(fetchBindingsForBlock({ blockId, linkedBlockId, pageId }))
    dispatch(fetchDataSources({}))
    if (blockId) {
      dispatch(fetchBlockById(blockId))
    }
    if (linkedBlockId && linkedBlockId !== blockId) {
      dispatch(fetchBlockById(linkedBlockId))
    }
  }, [dispatch, blockId, linkedBlockId, pageId])

  // Загрузить существующие mappings
  useEffect(() => {
    if (existingBinding?.config?.inputConfig?.fieldMappings) {
      setMappings(existingBinding.config.inputConfig.fieldMappings)
      setSelectedDataSourceId(existingBinding.dataSourceId)
      setMode(existingBinding.config.inputConfig.mode || 'single')
      
      // Восстанавливаем arrayPath если есть
      if (existingBinding.config.inputConfig.arrayPath) {
        setArrayPath(existingBinding.config.inputConfig.arrayPath)
      }
      
      // Восстанавливаем Template блок для Repeater режима
      const templateId = existingBinding.config.inputConfig.templateId
      if (templateId) {
        setSelectedTemplateBlockId(templateId)
      }

      // Восстанавливаем endpoint config
      if (existingBinding.config.inputConfig.endpoint) {
        setEndpointConfig(existingBinding.config.inputConfig.endpoint)
      }

      // Восстанавливаем transforms и dynamicFilters
      if (existingBinding.config.inputConfig.transforms) {
        setTransforms(existingBinding.config.inputConfig.transforms)
        setShowAdvanced(true)
      }
      if (existingBinding.config.inputConfig.dynamicFilters) {
        setDynamicFilters(existingBinding.config.inputConfig.dynamicFilters)
        setShowAdvanced(true)
      }
    }
  }, [existingBinding])

  // Debug: отслеживаем изменения testResult
  useEffect(() => {
    console.log('📊 testResult изменился:', testResult)
  }, [testResult])

  // Автоматическое создание mappings при выборе Data Source
  const handleDataSourceChange = (dataSourceId: string) => {
    setSelectedDataSourceId(dataSourceId)
    
    // Автоматически создать mappings на основе template fields
    if (templateFields.length > 0 && dataSourceId) {
      const autoMappings: FieldMapping[] = templateFields.map((field: DetectedField) => {
        // Извлекаем data-bind значение
        const selectorMatch = field.selector?.match(/\[data-bind="([^"]+)"\]/)
        const dataBindValue = selectorMatch ? selectorMatch[1] : field.name
        
        // Попытка извлечь имя поля API
        const apiFieldName = dataBindValue.replace(/^(project|item|element|card|product)-/, '')
          .replace('name', 'title')
          .replace('location', 'location')
          .replace('price', 'price')
          .replace('image', 'image')
        
        return {
          id: `mapping-field-${dataBindValue}`,
          sourceField: apiFieldName, // Поле из API
          targetProperty: `item.${dataBindValue}`, // item. + HTML элемент идентификатор
        }
      })
      setMappings(autoMappings)
    }
  }

  // Обработчик выбора Template блока (для Repeater режима)
  const handleTemplateBlockChange = (blockId: string | null, block?: Block) => {
    setSelectedTemplateBlockId(blockId || '')
    
    // Если выбран Template блок, создать mappings на основе его полей
    if (block && block.detectedFields && block.detectedFields.length > 0) {
      const autoMappings: FieldMapping[] = block.detectedFields.map((field: DetectedField) => {
        // Извлекаем data-bind значение из selector (например [data-bind="project-image"] -> project-image)
        const selectorMatch = field.selector?.match(/\[data-bind="([^"]+)"\]/)
        const dataBindValue = selectorMatch ? selectorMatch[1] : field.name
        
        // Попытка извлечь имя поля API из data-bind value
        // Например: "project-image" -> "image", "project-name" -> "title"
        const apiFieldName = dataBindValue.replace(/^(project|item|element|card|product)-/, '')
          .replace('name', 'title')  // Частый случай: project-name -> title
          .replace('location', 'location')
          .replace('price', 'price')
          .replace('image', 'image')
        
        return {
          id: `mapping-field-${dataBindValue}`,
          sourceField: apiFieldName, // Поле из API
          targetProperty: `item.${dataBindValue}`, // item. + data-bind значение (для client-side кода)
        }
      })

      setMappings(autoMappings)
    }
  }

  // Обновить mapping
  const handleUpdateMapping = (index: number, updates: Partial<FieldMapping>) => {
    const newMappings = [...mappings]
    newMappings[index] = { ...newMappings[index], ...updates }
    setMappings(newMappings)
  }

  // Сохранить привязку
  const handleSave = async () => {
    if (!selectedDataSourceId) {
      alert('Выберите источник данных')
      return
    }

    // Для Repeater режима требуется Template блок
    if (mode === 'repeater' && !selectedTemplateBlockId) {
      alert('Для режима Repeater необходимо выбрать Template блок')
      return
    }

    setLoading(true)
    try {
      // Формируем inputConfig
      const inputConfig = {
        mode,
        endpoint: endpointConfig.path ? endpointConfig : undefined,
        fieldMappings: mappings,
        transforms,
        dynamicFilters,
        ...(mode === 'repeater' && selectedTemplateBlockId && { templateId: selectedTemplateBlockId }),
        ...(mode === 'repeater' && arrayPath && { arrayPath }),
      }

      console.log('💾 Saving binding with inputConfig:', inputConfig)

      if (existingBinding) {
        // Обновить существующую привязку
        console.log('Updating existing binding:', {
          id: existingBinding.id,
          dataSourceId: selectedDataSourceId,
          mode,
          templateId: selectedTemplateBlockId,
          mappings,
          transforms,
          dynamicFilters
        })
        await dispatch(updateBinding({
          id: existingBinding.id,
          data: {
            dataSourceId: selectedDataSourceId,
            config: {
              inputConfig,
            },
          },
        })).unwrap()
        
        // Помечаем страницу как изменённую
        dispatch(markAsDirty())
      } else {
        // Создать новую привязку
        const newBinding: CreateDataBindingRequest = {
          blockId,
          pageId: pageId || undefined,
          dataSourceId: selectedDataSourceId,
          bindingType: 'input',
          config: {
            inputConfig,
          },
        }
        console.log('Creating new binding:', newBinding)
        await dispatch(createBinding(newBinding)).unwrap()
        
        // Помечаем страницу как изменённую
        dispatch(markAsDirty())
      }
      alert('✅ Привязка данных сохранена!')
    } catch (error: any) {
      console.error('Failed to save binding:', error)
      console.error('Error details:', {
        message: error?.message,
        response: error?.response,
        data: error?.response?.data,
        status: error?.response?.status,
        stack: error?.stack,
        fullError: error
      })
      
      let errorMessage = 'Unknown error'
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error
      } else if (error?.message) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      
      alert(`❌ Ошибка сохранения привязки: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  // Тест привязки с применением трансформаций
  const handleTest = async () => {
    console.log('🧪 handleTest вызвана')
    console.log('selectedDataSourceId:', selectedDataSourceId)
    console.log('existingBinding:', existingBinding?.id)
    console.log('transforms:', transforms)
    
    // Используем выбранный источник или источник из существующей привязки
    const effectiveDataSourceId = selectedDataSourceId || existingBinding?.dataSourceId
    
    if (!effectiveDataSourceId && !existingBinding) {
      alert('Выберите источник данных')
      return
    }

    setTestLoading(true)
    setTestResult(null)

    try {
      // Если есть существующая привязка - используем fetch-with-transforms через бэкенд
      if (existingBinding) {
        console.log('🧪 Тестирование через бэкенд с текущими настройками:', existingBinding.id)
        console.log('🧪 Текущие настройки из UI:', { arrayPath, transforms, mode, mappings })
        
        // Проверяем, есть ли несохранённые изменения
        const savedConfig = existingBinding.config?.inputConfig
        const savedArrayPath = savedConfig?.arrayPath || ''
        const savedTransforms = (savedConfig as any)?.transforms || []
        const savedMode = savedConfig?.mode || 'single'
        
        const hasUnsavedChanges = 
          arrayPath !== savedArrayPath ||
          JSON.stringify(transforms) !== JSON.stringify(savedTransforms) ||
          mode !== savedMode
        
        console.log('🧪 Есть несохранённые изменения:', hasUnsavedChanges)
        
        const response = await fetch('/api/data/fetch-with-transforms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bindingId: existingBinding.id,
            // Передаём текущие настройки из UI только если они отличаются
            configOverride: hasUnsavedChanges ? {
              arrayPath: arrayPath || undefined,
              transforms: transforms.length > 0 ? transforms : undefined,
              mode: mode
            } : undefined
          })
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
        }

        const result = await response.json()
        console.log('✅ Результат с текущими настройками:', result)

        const dataSource = dataSources.find(ds => ds.id === existingBinding.dataSourceId)
        
        setTestResult({
          success: true,
          dataSource: dataSource ? {
            name: dataSource.name,
            type: dataSource.type,
            url: (dataSource.config as any)?.url
          } : { name: 'Источник данных', type: 'unknown' },
          data: result.data,
          items: result.data,
          itemsCount: Array.isArray(result.data) ? result.data.length : 0,
          mode: mode,
          templateBlock: mode === 'repeater' ? blocks.find(b => b.id === selectedTemplateBlockId)?.name : null,
          mappings: mappings,
          meta: result.meta,
          transformsApplied: transforms.length,
          // Показываем configUsed только если есть несохранённые изменения
          configUsed: hasUnsavedChanges ? {
            arrayPath,
            transformsCount: transforms.length,
            mode
          } : undefined
        })
        
        return
      }

      // Fallback: если нет привязки - прямой запрос без трансформаций
      const dataSource = dataSources.find(ds => ds.id === effectiveDataSourceId)
      console.log('Найден Data Source:', dataSource)
      
      if (!dataSource) {
        throw new Error('Источник данных не найден')
      }
      
      const config = dataSource.config as any
      const url = config.endpoint || config.url
      
      console.log('Config:', config)
      console.log('URL:', url)

      if (!url) {
        throw new Error('URL не указан в конфигурации источника данных')
      }

      console.log('🧪 Тестирование Data Source напрямую (без трансформаций):', url)
      const response = await fetch(url, {
        method: config.method || 'GET',
        headers: config.headers || {}
      })

      console.log('Response status:', response.status)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('✅ Получены данные:', data)

      // Определяем структуру данных
      let items = data
      if (data.data && Array.isArray(data.data)) {
        items = data.data
      } else if (data.items && Array.isArray(data.items)) {
        items = data.items
      } else if (!Array.isArray(data)) {
        items = [data]
      }

      setTestResult({
        success: true,
        dataSource: {
          name: dataSource.name,
          type: dataSource.type,
          url
        },
        data: data,
        items: items,
        itemsCount: Array.isArray(items) ? items.length : 1,
        mode: mode,
        templateBlock: mode === 'repeater' ? blocks.find(b => b.id === selectedTemplateBlockId)?.name : null,
        mappings: mappings
      })
      
      console.log('✅ Test result установлен:', {
        success: true,
        itemsCount: Array.isArray(items) ? items.length : 1
      })
    } catch (error: any) {
      console.error('❌ Ошибка тестирования:', error)
      setTestResult({
        success: false,
        error: error.message
      })
    } finally {
      setTestLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center gap-2">
        <Database size={20} className="text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Привязка данных</h3>
      </div>

      {/* Информация о Template */}
      {isTemplate && templateFields.length > 0 && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-start gap-3">
            <Sparkles size={18} className="text-purple-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-purple-900 mb-1">Template блок</h4>
              <p className="text-sm text-purple-700 mb-2">
                Обнаружено {templateFields.length} полей для автоматической привязки данных
              </p>
              <div className="flex flex-wrap gap-2">
                {templateFields.map((field: DetectedField) => (
                  <span
                    key={field.id}
                    className="px-2 py-1 bg-white border border-purple-300 rounded text-xs font-medium text-purple-800"
                  >
                    {field.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Нет Template Fields */}
      {!isTemplate && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-900 mb-1">Блок не является Template</h4>
              <p className="text-sm text-amber-700">
                Для автоматической привязки данных, сначала включите Template режим для этого блока.
                Template Fields определяются автоматически из элементов с metadata.name.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Выбор источника данных */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Источник данных
        </label>
        <select
          value={selectedDataSourceId}
          onChange={(e) => handleDataSourceChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
        >
          <option value="">Выберите источник данных...</option>
          {dataSources.map(ds => (
            <option key={ds.id} value={ds.id}>
              {ds.name} ({ds.type})
            </option>
          ))}
        </select>
        {dataSources.length === 0 && (
          <p className="text-sm text-gray-500">
            Нет доступных источников данных. <a href="/data-sources/new" className="text-blue-600 hover:underline">Создать новый</a>
          </p>
        )}
      </div>

      {/* Endpoint настройка */}
      {selectedDataSourceId && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
            <Link size={14} />
            Настройка запроса
          </label>
          <p className="text-xs text-gray-500 -mt-1">
            Укажите конкретный endpoint и метод для получения данных из этого источника
          </p>
          <EndpointConfigEditor
            value={endpointConfig}
            onChange={setEndpointConfig}
            showBody={true}
            baseUrl={(dataSources.find(ds => ds.id === selectedDataSourceId)?.config as any)?.url}
          />
        </div>
      )}

      {/* Режим */}
      {selectedDataSourceId && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Режим привязки
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode('single')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                mode === 'single'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Single
            </button>
            <button
              onClick={() => setMode('repeater')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                mode === 'repeater'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Repeater
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {mode === 'single' && 'Заполнить блок одним объектом данных'}
            {mode === 'repeater' && 'Повторить блок для каждого элемента массива'}
          </p>
        </div>
      )}

      {/* Template Block Selector - только для Repeater режима */}
      {selectedDataSourceId && mode === 'repeater' && (
        <>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Template блок
            </label>
            <BlockTemplateSelector
              value={selectedTemplateBlockId}
              onChange={handleTemplateBlockChange}
              placeholder="Выберите Template блок для повторения..."
            />
            <p className="text-xs text-gray-500">
              Template блок будет повторяться для каждого элемента из массива данных
            </p>
          </div>

          {/* Array Path - путь к массиву в данных API */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Array Path
            </label>
            <input
              type="text"
              value={arrayPath}
              onChange={(e) => setArrayPath(e.target.value)}
              placeholder="data"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
            />
            <p className="text-xs text-gray-500">
              Путь к массиву в ответе API (например, "data" для {`{success: true, data: [...]}`})
            </p>
          </div>
        </>
      )}

      {/* Field Mappings */}
      {selectedDataSourceId && mappings.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              Связь полей
            </label>
            <span className="text-xs text-gray-500">
              {mappings.length} полей
            </span>
          </div>

          <div className="space-y-2">
            {mappings.map((mapping, index) => (
              <div
                key={index}
                className="p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {/* Template Field */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 mb-1">Template поле</div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm font-medium">
                        {mapping.sourceField}
                      </span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <ArrowRight size={16} className="text-gray-400 flex-shrink-0" />

                  {/* Data Source Field */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 mb-1">Поле данных</div>
                    <input
                      type="text"
                      value={mapping.targetProperty || ''}
                      onChange={(e) => handleUpdateMapping(index, { targetProperty: e.target.value })}
                      placeholder="data.fieldName"
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Status */}
                  <div className="flex-shrink-0">
                    {mapping.targetProperty ? (
                      <CheckCircle size={16} className="text-green-600" />
                    ) : (
                      <AlertCircle size={16} className="text-amber-600" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advanced Settings - Transforms */}
      {selectedDataSourceId && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings2 size={18} className="text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Расширенные настройки</span>
              {(transforms.length > 0 || dynamicFilters.length > 0) && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                  {transforms.length + dynamicFilters.length}
                </span>
              )}
            </div>
            {showAdvanced ? (
              <ChevronUp size={18} className="text-gray-500" />
            ) : (
              <ChevronDown size={18} className="text-gray-500" />
            )}
          </button>
          
          {showAdvanced && (
            <div className="p-4 border-t border-gray-200">
              <TransformsEditor
                transforms={transforms}
                onChange={setTransforms}
                dynamicFilters={dynamicFilters}
                onDynamicFiltersChange={setDynamicFilters}
              />
            </div>
          )}
        </div>
      )}

      {/* Действия */}
      {(selectedDataSourceId || existingBinding) && (
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          {selectedDataSourceId && (
            <button
              onClick={handleSave}
              disabled={loading || mappings.length === 0}
              className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Сохранение...' : existingBinding ? 'Обновить привязку' : 'Создать привязку'}
            </button>
          )}
          <button
            onClick={handleTest}
            disabled={testLoading || (!selectedDataSourceId && !existingBinding)}
            className="px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {testLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <span>🔍</span>
            )}
            Протестировать привязку
          </button>
        </div>
      )}

      {/* Результат теста */}
      {testResult && (
        <div className={`p-4 rounded-lg border ${
          testResult.success 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-start gap-3">
            {testResult.success ? (
              <CheckCircle size={20} className="text-green-600 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              {testResult.success ? (
                <>
                  <h4 className="font-medium text-green-900 mb-2">✅ Данные успешно загружены</h4>
                  {testResult.configUsed && (
                    <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                      <span className="font-medium">⚠️ Использованы текущие настройки из редактора (несохранённые)</span>
                      <div className="mt-1 text-yellow-700">
                        arrayPath: <code className="bg-yellow-100 px-1 rounded">{testResult.configUsed.arrayPath || 'не указан'}</code>
                        {testResult.configUsed.transformsCount > 0 && (
                          <>, трансформаций: <code className="bg-yellow-100 px-1 rounded">{testResult.configUsed.transformsCount}</code></>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-green-700">Источник:</span>
                      <span className="font-mono text-xs text-green-800 bg-green-100 px-2 py-0.5 rounded">
                        {testResult.dataSource.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-700">Режим:</span>
                      <span className="font-medium text-green-800">
                        {testResult.mode === 'repeater' ? `Repeater (${testResult.itemsCount} элементов)` : 'Single'}
                      </span>
                    </div>
                    {testResult.templateBlock && (
                      <div className="flex items-center gap-2">
                        <span className="text-green-700">Template:</span>
                        <span className="font-medium text-green-800">{testResult.templateBlock}</span>
                      </div>
                    )}
                    <div className="mt-3">
                      <details className="cursor-pointer">
                        <summary className="text-green-700 font-medium mb-2">Просмотр данных</summary>
                        <pre className="mt-2 p-3 bg-green-100 rounded text-xs overflow-auto max-h-64 text-gray-900">
                          {JSON.stringify(testResult.data, null, 2)}
                        </pre>
                      </details>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h4 className="font-medium text-red-900 mb-2">❌ Ошибка загрузки данных</h4>
                  <p className="text-sm text-red-700">
                    {testResult.error}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Пустое состояние */}
      {!selectedDataSourceId && templateFields.length > 0 && (
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-3">
            <Link size={24} className="text-gray-400" />
          </div>
          <h4 className="text-sm font-medium text-gray-900 mb-1">
            Нет привязок данных
          </h4>
          <p className="text-sm text-gray-500 mb-4">
            Добавьте привязку для подключения блока к источнику данных
          </p>
        </div>
      )}
    </div>
  )
}
