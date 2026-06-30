import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  fetchBindingsForBlock,
  createBinding,
  updateBinding,
  selectCurrentBlockBindings,
} from '@/features/dataBindings/dataBindingsSlice'
import { fetchDataSources, selectDataSources } from '@/features/data-sources/dataSourcesSlice'
import { fetchBlockById, updateBlock, selectBlocks } from '@/features/blocks/blocksSlice'
import { markAsDirty, selectIsDirty } from '@/features/editor/editorSlice'
import { BlockTemplateSelector } from '@/features/blocks/components/BlockTemplateSelector'
import { TransformsEditor } from './TransformsEditor'
import { TemplateFieldsEditor } from './TemplateFieldsEditor'
import { Database, Link, CheckCircle, AlertCircle, ArrowRight, Loader2, ChevronDown, ChevronUp, Settings2 } from 'lucide-react'
import { EndpointConfigEditor, DEFAULT_ENDPOINT_CONFIG } from './EndpointConfigEditor'
import { BlockSubRequestsEditor, type BlockSubSource } from './BlockSubRequestsEditor'
import type { DetectedField } from '@/shared/types/template'
import type { CreateDataBindingRequest, FieldMapping, InputMode, EndpointConfig } from '@/shared/types/dataBinding'
import type { Block } from '@/shared/types'
import type { DataTransform, DynamicFilter } from '@/shared/types/transforms'
import { collectionApi, type Collection } from '@/shared/api/collectionApi'
import { isClientRuntimeType } from '@/shared/types/dataSource'
import { apiFetch } from '@/shared/api/http'

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
  const [arrayPath, setArrayPath] = useState<string>('')
  const [mappings, setMappings] = useState<FieldMapping[]>([])
  const [loading, setLoading] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [transforms, setTransforms] = useState<DataTransform[]>([])
  const [dynamicFilters, setDynamicFilters] = useState<DynamicFilter[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [endpointConfig, setEndpointConfig] = useState<EndpointConfig>(DEFAULT_ENDPOINT_CONFIG)
  const [hasChanges, setHasChanges] = useState(false)
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, { joinField: string; values: Record<string, string | number>; displayTemplate?: string }>>({})
  const [overrideOpenFor, setOverrideOpenFor] = useState<string | null>(null) // targetProperty поля с открытой редакцией
  const [overrideJsonDraft, setOverrideJsonDraft] = useState<string>('') // raw-текст JSON textarea
  const [linkedCollection, setLinkedCollection] = useState<Collection | null>(null)
  const [collectionLinkSelector, setCollectionLinkSelector] = useState<string>('')
  const [subSources, setSubSources] = useState<BlockSubSource[]>([])
  const [mainExtract, setMainExtract] = useState<Record<string, string>>({})

  // Отслеживание сохранения страницы для авто-сохранения привязки
  const isDirty = useAppSelector(selectIsDirty)
  const prevIsDirtyRef = useRef(isDirty)
  const hasChangesRef = useRef(false)

  // Синхронизируем ref с state для доступа из эффекта
  useEffect(() => { hasChangesRef.current = hasChanges }, [hasChanges])

  // Пометить как изменённое — локально + на уровне страницы
  const markChanged = () => {
    setHasChanges(true)
    dispatch(markAsDirty())
  }

  // Найти блок и его Template Fields.
  // blockId может быть canvas-нодой (DataPanel), а реальный библиотечный блок — в linkedBlockId.
  const block = blocks.find(b => b.id === blockId)
             || (linkedBlockId ? blocks.find(b => b.id === linkedBlockId) : undefined)
  const templateFields = block?.detectedFields || []
  const isTemplate = block?.isTemplate

  // Выбранный источник client-runtime (form-data) — endpoint/тест по сети не применимы.
  const selectedDataSource = dataSources.find(ds => ds.id === selectedDataSourceId)
  const isSelectedClientRuntime = !!selectedDataSource && isClientRuntimeType(selectedDataSource.type)
  // database — server-fetch, но без HTTP-endpoint (SQL задаётся в источнике).
  const isSelectedDatabase = selectedDataSource?.type === 'database'

  // Нормализуем mapping для editor-состояния:
  // sourceField = поле API, targetProperty = item.<templateField>
  const normalizeMappingForEditor = (mapping: FieldMapping): FieldMapping => {
    const sourceIsTemplate = typeof mapping.sourceField === 'string' && mapping.sourceField.startsWith('item.')
    const targetIsTemplate = typeof mapping.targetProperty === 'string' && mapping.targetProperty.startsWith('item.')

    // Legacy-перевернутый формат: source=item.xxx, target=apiField
    if (sourceIsTemplate && !targetIsTemplate) {
      return {
        ...mapping,
        sourceField: mapping.targetProperty,
        targetProperty: mapping.sourceField
      }
    }

    return mapping
  }

  const inferApiFieldName = (dataBindValue: string): string => {
    // Убираем только префикс именования template-поля.
    // Не делаем автозамену name->title, чтобы не подмешивать legacy-поля.
    return dataBindValue.replace(/^(project|item|element|card|product)-/, '')
  }

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
      setMappings(existingBinding.config.inputConfig.fieldMappings.map(normalizeMappingForEditor))
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
      // Восстанавливаем fieldOverrides
      if ((existingBinding.config.inputConfig as any).fieldOverrides) {
        setFieldOverrides((existingBinding.config.inputConfig as any).fieldOverrides)
      } else {
        setFieldOverrides({})
      }
      // Восстанавливаем collectionLinkSelector
      setCollectionLinkSelector((existingBinding.config.inputConfig as any).collectionLinkSelector || '')

      // Восстанавливаем под-запросы (обогащение элементов)
      setSubSources(((existingBinding.config.inputConfig as any).additionalSources as BlockSubSource[]) || [])
      setMainExtract((existingBinding.config.inputConfig as any).mainExtract || {})
      // Сброс флага изменений после восстановления из существующей привязки
      setHasChanges(false)
    }
  }, [existingBinding])

  // При смене DataSource — ищем связанную коллекцию
  useEffect(() => {
    if (!selectedDataSourceId) {
      setLinkedCollection(null)
      return
    }
    collectionApi.getAll().then(collections => {
      const found = collections.find(c => c.dataSourceId === selectedDataSourceId && c.isActive) || null
      setLinkedCollection(found)
    }).catch(() => setLinkedCollection(null))
  }, [selectedDataSourceId])

  // Debug: отслеживаем изменения testResult
  useEffect(() => {
    console.log('📊 testResult изменился:', testResult)
  }, [testResult])

  // Автоматическое создание mappings при выборе Data Source
  const handleDataSourceChange = (dataSourceId: string) => {
    setSelectedDataSourceId(dataSourceId)
    markChanged()
    
    // Автоматически создать mappings на основе template fields
    if (templateFields.length > 0 && dataSourceId) {
      const autoMappings: FieldMapping[] = templateFields.map((field: DetectedField) => {
        // Извлекаем data-bind значение
        const selectorMatch = field.selector?.match(/\[data-bind="([^"]+)"\]/)
        const dataBindValue = selectorMatch ? selectorMatch[1] : field.name
        
        // Поле API по умолчанию выводим из data-bind без legacy-эвристик
        const apiFieldName = inferApiFieldName(dataBindValue)
        
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
    markChanged()
    
    // Если выбран Template блок, создать mappings на основе его полей
    if (block && block.detectedFields && block.detectedFields.length > 0) {
      const autoMappings: FieldMapping[] = block.detectedFields.map((field: DetectedField) => {
        // Извлекаем data-bind значение из selector (например [data-bind="project-image"] -> project-image)
        const selectorMatch = field.selector?.match(/\[data-bind="([^"]+)"\]/)
        const dataBindValue = selectorMatch ? selectorMatch[1] : field.name
        
        // Например: "project-image" -> "image", "project-name" -> "name"
        const apiFieldName = inferApiFieldName(dataBindValue)
        
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
    markChanged()
  }

  // Сохранить привязку (silent = true при авто-сохранении с страницей)
  const handleSave = useCallback(async (silent = false) => {
    if (!selectedDataSourceId) {
      if (!silent) alert('Выберите источник данных')
      return
    }

    // Для Repeater режима требуется Template блок
    if (mode === 'repeater' && !selectedTemplateBlockId) {
      if (!silent) alert('Для режима Repeater необходимо выбрать Template блок')
      return
    }

    setLoading(true)
    try {
      // Очищаем под-запросы: только заполненные, без пустых extract/join
      const cleanedSubSources = subSources
        .filter(s => s.itemKey && s.dataSourceId)
        .map(s => ({
          ...s,
          extract: s.extract ? Object.fromEntries(Object.entries(s.extract).filter(([k, v]) => k && v)) : undefined,
          join: s.join?.itemField && s.join?.sourceField ? s.join : undefined,
        }))
      const cleanedMainExtract = Object.fromEntries(Object.entries(mainExtract).filter(([k, v]) => k && v))

      // Формируем inputConfig
      const inputConfig = {
        mode,
        endpoint: endpointConfig.path ? endpointConfig : undefined,
        fieldMappings: mappings,
        transforms,
        dynamicFilters,
        ...(mode === 'repeater' && selectedTemplateBlockId && { templateId: selectedTemplateBlockId }),
        ...(mode === 'repeater' && arrayPath && { arrayPath }),
        ...(Object.keys(fieldOverrides).length > 0 && { fieldOverrides }),
        ...(mode === 'repeater' && collectionLinkSelector && { collectionLinkSelector }),
        ...(cleanedSubSources.length > 0 && { additionalSources: cleanedSubSources }),
        ...(Object.keys(cleanedMainExtract).length > 0 && { mainExtract: cleanedMainExtract }),
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
        if (!silent) dispatch(markAsDirty())
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
        if (!silent) dispatch(markAsDirty())
      }
      setHasChanges(false)
      if (!silent) alert('✅ Привязка данных сохранена!')
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
      
      if (!silent) alert(`❌ Ошибка сохранения привязки: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }, [selectedDataSourceId, mode, selectedTemplateBlockId, endpointConfig, mappings, transforms, dynamicFilters, arrayPath, fieldOverrides, collectionLinkSelector, subSources, mainExtract, existingBinding, blockId, pageId, dispatch])

  // Авто-сохранение привязки при сохранении страницы (isDirty: true → false)
  useEffect(() => {
    if (prevIsDirtyRef.current && !isDirty && hasChangesRef.current) {
      console.log('📎 Страница сохранена — авто-сохраняем привязку данных')
      handleSave(true)
    }
    prevIsDirtyRef.current = isDirty
  }, [isDirty, handleSave])

  // Тест привязки с применением трансформаций
  const handleTest = async () => {
    // form-data резолвится в браузере посетителя — на бэкенде тестировать нечего.
    if (isSelectedClientRuntime) {
      setTestResult({
        success: true,
        infoOnly: true,
        title: 'Источник Form Data',
        dataSource: { name: selectedDataSource?.name || 'Form Data', type: selectedDataSource?.type || 'form-data' },
        message: 'Источник Form Data резолвится на стороне браузера при открытии страницы. Проверьте результат на опубликованной/предпросмотренной странице.',
      })
      return
    }
    // database без сохранённой привязки — SQL выполняется на сервере, нужен binding.
    if (isSelectedDatabase && !existingBinding) {
      setTestResult({
        success: true,
        infoOnly: true,
        title: 'Источник Database',
        dataSource: { name: selectedDataSource?.name || 'Database', type: 'database' },
        message: 'Сохраните привязку — после этого SQL-запрос выполнится на сервере и здесь появятся данные.',
      })
      return
    }
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
        
        const savedDynamicFilters = (savedConfig as any)?.dynamicFilters || []
        
        const hasUnsavedChanges = 
          arrayPath !== savedArrayPath ||
          JSON.stringify(transforms) !== JSON.stringify(savedTransforms) ||
          JSON.stringify(dynamicFilters) !== JSON.stringify(savedDynamicFilters) ||
          mode !== savedMode
        
        console.log('🧪 Есть несохранённые изменения:', hasUnsavedChanges)
        
        const response = await apiFetch('/api/data/fetch-with-transforms', {
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

      {/* Управление Template Fields */}
      {isTemplate && (
        <TemplateFieldsEditor
          fields={templateFields}
          blockId={linkedBlockId || blockId}
          onFieldsChange={(newFields) => {
            const targetId = linkedBlockId || blockId
            dispatch(updateBlock({ id: targetId, data: { detectedFields: newFields } }))
            dispatch(markAsDirty())
          }}
        />
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
        {(() => {
          const ds = dataSources.find(d => d.id === selectedDataSourceId)
          if (!ds || ds.type !== 'feed') return null
          const cfg = ds.config as { pollingEnabled?: boolean; pollingInterval?: number }
          const polling = !!cfg?.pollingEnabled && (cfg?.pollingInterval ?? 0) > 0
          return (
            <div className="flex items-center gap-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1.5">
              <span className="font-semibold">JSON Feed</span>
              {polling
                ? <span>авто-обновление каждые {cfg.pollingInterval} c на опубликованной странице</span>
                : <span>авто-обновление выключено (включается в настройках источника)</span>}
            </div>
          )
        })()}
      </div>

      {/* form-data (client-runtime): endpoint не нужен — значение резолвится в браузере */}
      {selectedDataSourceId && isSelectedClientRuntime && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          <p className="font-medium mb-0.5">Источник Form Data</p>
          <p className="text-xs text-yellow-700">
            Значение читается в браузере посетителя (URL-параметры / localStorage / cookies) — настройка
            endpoint не требуется. Источник и ключ задаются при создании источника данных.
          </p>
        </div>
      )}

      {/* database: SQL задаётся в источнике, endpoint не нужен */}
      {selectedDataSourceId && isSelectedDatabase && (
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">
          <p className="font-medium mb-0.5">Источник Database</p>
          <p className="text-xs text-purple-700">
            SQL-запрос (read-only) и подключение настроены в самом источнике данных.
            Здесь достаточно сопоставить поля результата с элементами блока.
          </p>
        </div>
      )}

      {/* Endpoint настройка */}
      {selectedDataSourceId && !isSelectedClientRuntime && !isSelectedDatabase && (
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
            onChange={(c) => { setEndpointConfig(c); markChanged() }}
            showBody={true}
            baseUrl={(dataSources.find(ds => ds.id === selectedDataSourceId)?.config as any)?.url}
          />
          <BlockSubRequestsEditor
            dataSources={dataSources.map(ds => ({ id: ds.id, name: ds.name, url: (ds.config as any)?.url }))}
            mainExtract={mainExtract}
            sources={subSources}
            onMainExtractChange={(next) => { setMainExtract(next); markChanged() }}
            onSourcesChange={(next) => { setSubSources(next); markChanged() }}
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
              onClick={() => { setMode('single'); markChanged() }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                mode === 'single'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Single
            </button>
            <button
              onClick={() => { setMode('repeater'); markChanged() }}
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
              onChange={(e) => { setArrayPath(e.target.value); markChanged() }}
              placeholder="data"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
            />
            <p className="text-xs text-gray-500">
              Путь к массиву в ответе API (например, "data" для {`{success: true, data: [...]}`}). Оставьте пустым, если ответ сам является массивом.
            </p>
          </div>
        </>
      )}

      {/* Collection Link — индикатор и linkSelector */}
      {selectedDataSourceId && mode === 'repeater' && linkedCollection && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg space-y-3">
          <div className="flex items-start gap-2">
            <Link size={16} className="text-indigo-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-indigo-900">
                Связано с коллекцией «{linkedCollection.name}»
              </p>
              <p className="text-xs text-indigo-700 mt-0.5">
                Ссылки добавятся автоматически при деплое: <code className="bg-indigo-100 px-1 rounded">{linkedCollection.basePath.replace(/\/+$/, '')}/{'{'}slug{'}'}.html</code>
              </p>
              <p className="text-xs text-indigo-600 mt-1">
                Поле slug: <code className="bg-indigo-100 px-1 rounded">{linkedCollection.slugField}</code>
              </p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-indigo-800 mb-1">
              CSS-селектор ссылки (необязательно)
            </label>
            <input
              type="text"
              value={collectionLinkSelector}
              onChange={e => { setCollectionLinkSelector(e.target.value); markChanged() }}
              placeholder="Авто: первый <a> внутри карточки"
              className="w-full px-2 py-1.5 text-sm border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 bg-white"
            />
            <p className="text-xs text-indigo-600 mt-1">
              Укажите CSS-селектор, если в карточке несколько ссылок. Например: <code className="bg-indigo-100 px-1 rounded">.card-link</code>
            </p>
          </div>
        </div>
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
              (() => {
                const fieldName = (mapping.targetProperty || '').startsWith('item.')
                  ? mapping.targetProperty.slice(5)
                  : (mapping.targetProperty || '')
                const override = fieldOverrides[fieldName]
                const isOverrideOpen = overrideOpenFor === mapping.targetProperty

                return (
                  <div
                    key={index}
                    className={`bg-white border rounded-lg transition-colors ${override ? 'border-amber-400' : 'border-gray-200 hover:border-blue-300'}`}
                  >
                    <div className="flex items-center gap-3 p-3">
                      {/* Поле API */}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-500 mb-1">Поле API (из ответа источника)</div>
                        <input
                          type="text"
                          value={mapping.sourceField || ''}
                          onChange={(e) => handleUpdateMapping(index, { sourceField: e.target.value })}
                          placeholder="name, houses[0].address, houses[0].files[0].file_url"
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <ArrowRight size={16} className="text-gray-400 flex-shrink-0" />

                      {/* Поле Template */}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-500 mb-1">Поле Template (data-bind)</div>
                        <div className="px-2 py-1 text-sm border border-gray-200 rounded bg-gray-50 text-gray-700 truncate" title={mapping.targetProperty || ''}>
                          {mapping.targetProperty || 'item.<template-field>'}
                        </div>
                      </div>

                      {/* Кнопка override */}
                      <button
                        title={override ? 'Ручные значения настроены' : 'Задать вручную'}
                        onClick={() => {
                          if (isOverrideOpen) {
                            setOverrideOpenFor(null)
                          } else {
                            // Инициализируем draft при открытии
                            const currentValues = fieldOverrides[fieldName]?.values ?? {}
                            setOverrideJsonDraft(JSON.stringify(currentValues, null, 2))
                            setOverrideOpenFor(mapping.targetProperty)
                          }
                        }}
                        className={`flex-shrink-0 px-2 py-1 rounded text-xs font-medium transition-colors ${
                          override
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {override ? '🔧' : '+ вручную'}
                      </button>

                      {/* Status */}
                      <div className="flex-shrink-0">
                        {mapping.sourceField && mapping.targetProperty ? (
                          <CheckCircle size={16} className="text-green-600" />
                        ) : (
                          <AlertCircle size={16} className="text-amber-600" />
                        )}
                      </div>
                    </div>

                    {/* Панель ручных значений */}
                    {isOverrideOpen && (() => {
                      const joinField = override?.joinField ?? 'id'
                      const displayTemplate = override?.displayTemplate ?? ''
                      // Собираем ID из уже загруженных тестовых данных
                      const apiItems: any[] = Array.isArray(testResult?.items)
                        ? testResult.items
                        : Array.isArray(testResult?.data)
                          ? testResult.data
                          : []
                      const availableIds: string[] = apiItems
                        .map((it: any) => {
                          const val = joinField.split('.').reduce((acc: any, k: string) => acc?.[k], it)
                          return val !== undefined && val !== null ? String(val) : null
                        })
                        .filter((v): v is string => v !== null)

                      const addIdToValues = (id: string) => {
                        const currentValues = override?.values ?? {}
                        if (id in currentValues) return // уже есть
                        const newValues = { ...currentValues, [id]: 0 }
                        const updated = { joinField, displayTemplate: displayTemplate || undefined, values: newValues }
                        setFieldOverrides({ ...fieldOverrides, [fieldName]: updated })
                        setOverrideJsonDraft(JSON.stringify(newValues, null, 2))
                        markChanged()
                      }

                      const updateOverride = (patch: Partial<{ joinField: string; displayTemplate: string; values: Record<string, string | number> }>) => {
                        const current = override || { joinField: 'id', displayTemplate: undefined, values: {} }
                        const merged = { ...current, ...patch }
                        // Не сохраняем displayTemplate если пустая строка
                        if (!merged.displayTemplate) delete merged.displayTemplate
                        setFieldOverrides({ ...fieldOverrides, [fieldName]: merged })
                        // Синхронизируем draft только если values явно изменились
                        if (patch.values !== undefined) {
                          setOverrideJsonDraft(JSON.stringify(patch.values, null, 2))
                        }
                        markChanged()
                      }

                      return (
                        <div className="border-t border-amber-200 bg-amber-50 p-3 space-y-2 rounded-b-lg">
                          <div className="text-xs font-medium text-amber-800">Ручные значения — числа для фильтрации</div>

                          {/* Ключевое поле */}
                          <div className="flex gap-2 items-center">
                            <label className="text-xs text-amber-700 whitespace-nowrap">Ключевое поле:</label>
                            <input
                              type="text"
                              value={joinField}
                              onChange={(e) => updateOverride({ joinField: e.target.value })}
                              placeholder="id"
                              className="w-24 px-2 py-1 text-xs border border-amber-300 rounded bg-white"
                            />
                            <span className="text-xs text-amber-600">— поле API для идентификации</span>
                          </div>

                          {/* Шаблон отображения */}
                          <div className="flex gap-2 items-center">
                            <label className="text-xs text-amber-700 whitespace-nowrap">Шаблон показа:</label>
                            <input
                              type="text"
                              value={displayTemplate}
                              onChange={(e) => updateOverride({ displayTemplate: e.target.value })}
                              placeholder="от {value} млн сум"
                              className="flex-1 px-2 py-1 text-xs border border-amber-300 rounded bg-white"
                            />
                          </div>
                          <div className="text-xs text-amber-600">
                            Числа → для фильтрации (gte/lte). Шаблон <code className="bg-amber-100 px-1 rounded">{'{value}'}</code> → как показывать на странице.
                          </div>

                          {/* Список ID из данных API */}
                          {availableIds.length > 0 && (
                            <div className="space-y-1">
                              <div className="text-xs text-amber-700">
                                Ключи из данных ({availableIds.length}) — нажми чтобы добавить:
                              </div>
                              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                                {availableIds.map((id) => {
                                  const alreadySet = override?.values && id in override.values
                                  return (
                                    <button
                                      key={id}
                                      onClick={() => addIdToValues(id)}
                                      title={alreadySet ? `Уже задано: ${override!.values[id]}` : `Добавить ключ "${id}"`}
                                      className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
                                        alreadySet
                                          ? 'bg-green-100 text-green-700 border border-green-300 cursor-default'
                                          : 'bg-white text-amber-800 border border-amber-300 hover:bg-amber-100 cursor-pointer'
                                      }`}
                                    >
                                      {id}{alreadySet ? ' ✓' : ''}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                          {availableIds.length === 0 && (
                            <div className="text-xs text-amber-600 italic">
                              Нет данных — сначала нажмите «Протестировать привязку», чтобы увидеть список ключей
                            </div>
                          )}

                          {/* JSON редактор — числовые значения или полный конфиг */}
                          <textarea
                            value={overrideJsonDraft}
                            onChange={(e) => {
                              const raw = e.target.value
                              setOverrideJsonDraft(raw)
                              try {
                                const parsed = JSON.parse(raw)
                                // Если вставлен полный override-объект (есть ключ "values") — применяем целиком
                                if (parsed && typeof parsed === 'object' && 'values' in parsed && typeof parsed.values === 'object') {
                                  const full: { joinField: string; values: Record<string, string | number>; displayTemplate?: string } = {
                                    joinField: parsed.joinField || joinField,
                                    values: parsed.values,
                                  }
                                  if (parsed.displayTemplate) full.displayTemplate = parsed.displayTemplate
                                  setFieldOverrides({ ...fieldOverrides, [fieldName]: full })
                                  markChanged()
                                } else {
                                  updateOverride({ values: parsed })
                                }
                              } catch { /* невалидный JSON в процессе ввода — игнорируем */ }
                            }}
                            rows={4}
                            placeholder={'{\n  "Business Park": 850,\n  "Greenwich-CC": 950\n}'}
                            className="w-full px-2 py-1 text-xs font-mono border border-amber-300 rounded bg-white resize-y"
                          />

                          <div className="flex justify-between items-center">
                            <span className="text-xs text-amber-600">
                              {override ? `${Object.keys(override.values).length} значений` : 'Нет значений'}
                            </span>
                            {override && (
                              <button
                                onClick={() => {
                                  const updated = { ...fieldOverrides }
                                  delete updated[fieldName]
                                  setFieldOverrides(updated)
                                  setOverrideOpenFor(null)
                                  markChanged()
                                }}
                                className="text-xs text-red-600 hover:text-red-800"
                              >
                                Удалить override
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )
              })()
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
                onChange={(t) => { setTransforms(t); markChanged() }}
                dynamicFilters={dynamicFilters}
                onDynamicFiltersChange={(f) => { setDynamicFilters(f); markChanged() }}
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
              onClick={() => handleSave()}
              disabled={loading || mappings.length === 0}
              className={`flex-1 px-4 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                hasChanges ? 'bg-orange-500 hover:bg-orange-600 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? 'Сохранение...' : hasChanges ? '💾 Сохранить изменения' : existingBinding ? 'Обновить привязку' : 'Создать привязку'}
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
              {testResult.success && testResult.infoOnly ? (
                <>
                  <h4 className="font-medium text-green-900 mb-1">✅ {testResult.title || 'Проверка'}</h4>
                  <p className="text-sm text-green-800">{testResult.message}</p>
                </>
              ) : testResult.success ? (
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
