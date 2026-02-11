import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { updateBinding, selectBindingsSaving } from '@/features/dataBindings/dataBindingsSlice'
import type { DataBinding, InputMode, InputBindingConfig } from '@/shared/types/dataBinding'
import { FieldMappingEditor } from './FieldMappingEditor'
import { FilterBuilder } from './FilterBuilder'
import { SortBuilder } from './SortBuilder'
import { RepeaterStatesEditor, type RepeaterStatesConfig } from './RepeaterStatesEditor'
import { AdditionalDataSourcesEditor, type AdditionalDataSource } from './AdditionalDataSourcesEditor'
import { ComputedFieldsEditor, type ComputedFieldConfig } from './ComputedFieldsEditor'
import { ConditionalMappingEditor, type ConditionalFieldConfig } from './ConditionalMappingEditor'
import { TransformsEditor } from './TransformsEditor'
import { BlockTemplateSelector } from '@/features/blocks/components/BlockTemplateSelector'
import { selectBlocks } from '@/features/blocks/blocksSlice'
import type { Block } from '@/shared/types'
import type { DetectedField } from '@/shared/types/template'
import type { DataTransform, DynamicFilter } from '@/shared/types/transforms'
// PaginationControlsEditor is imported but not yet used - will be integrated later

interface InputBindingEditorProps {
  binding: DataBinding
  onTest: (currentConfig: InputBindingConfig) => void
}

export const InputBindingEditor: React.FC<InputBindingEditorProps> = ({ binding, onTest }) => {
  const dispatch = useAppDispatch()
  const saving = useAppSelector(selectBindingsSaving)
  const blocks = useAppSelector(selectBlocks)
  const [config, setConfig] = useState<InputBindingConfig>(binding.config.inputConfig || { mode: 'single', fieldMappings: [] })
  const [activeSection, setActiveSection] = useState<string>('mode')
  const [hasChanges, setHasChanges] = useState(false)

  const updateConfig = (updates: Partial<InputBindingConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    try {
      await dispatch(updateBinding({ id: binding.id, data: { config: { ...binding.config, inputConfig: config } } })).unwrap()
      setHasChanges(false)
    } catch (err) { console.error('Failed to save binding:', err) }
  }

  const sections = [
    { id: 'mode', label: 'Mode' },
    { id: 'template', label: 'Template', show: config.mode === 'repeater' || config.mode === 'paginated' },
    { id: 'mapping', label: 'Mapping' },
    { id: 'filters', label: 'Filters' },
    { id: 'sorting', label: 'Sorting' },
    { id: 'transforms', label: 'Transforms' },
    { id: 'pagination', label: 'Pagination' },
    { id: 'states', label: 'States' },
    { id: 'sources', label: 'Sources' },
    { id: 'computed', label: 'Computed' },
    { id: 'conditional', label: 'Conditional' },
  ].filter(s => s.show !== false)

  // Handle template block selection
  const handleTemplateSelect = (blockId: string | null, block?: Block) => {
    updateConfig({
      templateId: blockId || undefined,
      // Auto-populate field mappings from block's detected fields
      fieldMappings: block?.detectedFields?.map((field: DetectedField, index: number) => ({
        id: `mapping-${index}-${Date.now()}`,
        sourceField: field.name,
        targetProperty: `data.${field.name}`,
        transform: undefined,
        fallbackValue: field.defaultValue,
      })) || config.fieldMappings,
    })
  }

  // Get selected template block
  const selectedTemplateBlock = config.templateId 
    ? blocks.find(b => b.id === config.templateId) 
    : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-800">Input Binding Settings</h4>
        <div className="flex gap-2">
          <button onClick={() => onTest(config)} className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 flex items-center gap-1">
            <span>🔍</span> Протестировать привязку
          </button>
          {hasChanges && <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>}
        </div>
      </div>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex border-b border-gray-200 bg-gray-50">
          {sections.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)} className={'flex-1 px-4 py-2 text-sm font-medium ' + (activeSection === s.id ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-100')}>{s.label}</button>
          ))}
        </div>
        <div className="p-4">
          {activeSection === 'mode' && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Data Fetch Mode</label>
              <div className="grid grid-cols-3 gap-3">
                {[{v:'single',l:'Single',d:'One object'},{v:'repeater',l:'Repeater',d:'Array'},{v:'paginated',l:'Paginated',d:'With pages'}].map(m => (
                  <button key={m.v} onClick={() => updateConfig({ mode: m.v as InputMode })} className={'p-3 border rounded-lg text-left ' + (config.mode === m.v ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300')}>
                    <div className="font-medium text-gray-900">{m.l}</div>
                    <div className="text-xs text-gray-500">{m.d}</div>
                  </button>
                ))}
              </div>
              {(config.mode === 'repeater' || config.mode === 'paginated') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Array Path</label>
                  <input type="text" value={config.arrayPath || ''} onChange={(e) => updateConfig({ arrayPath: e.target.value })} placeholder="data.items" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              )}
            </div>
          )}
          {activeSection === 'mapping' && <FieldMappingEditor mappings={config.fieldMappings || []} onChange={(fieldMappings) => updateConfig({ fieldMappings })} dataSourceId={binding.dataSourceId} />}
          {activeSection === 'template' && (config.mode === 'repeater' || config.mode === 'paginated') && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item Template (Template блок)
                </label>
                <p className="text-sm text-gray-500 mb-3">
                  Выберите Template блок для отображения каждого элемента. Поля будут автоматически сопоставлены с данными.
                </p>
                <BlockTemplateSelector
                  value={config.templateId}
                  onChange={handleTemplateSelect}
                  placeholder="Выберите Template блок..."
                />
              </div>
              
              {selectedTemplateBlock && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <h5 className="font-medium text-purple-900">Template блок: {selectedTemplateBlock.name}</h5>
                    {selectedTemplateBlock.templateCategory && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                        {selectedTemplateBlock.templateCategory}
                      </span>
                    )}
                  </div>
                  {selectedTemplateBlock.detectedFields && selectedTemplateBlock.detectedFields.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-purple-800 mb-2">Обнаруженные поля ({selectedTemplateBlock.detectedFields.length}):</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedTemplateBlock.detectedFields.map(field => (
                          <span 
                            key={field.name}
                            className="px-2 py-1 bg-white text-purple-700 text-xs rounded border border-purple-200"
                          >
                            {field.name} <span className="text-purple-400">({field.type})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!selectedTemplateBlock && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
                  <p className="text-sm text-gray-600 mb-2">
                    Template блок не выбран
                  </p>
                  <p className="text-xs text-gray-500">
                    Вы можете использовать field mappings для привязки данных к атрибутам элементов
                  </p>
                </div>
              )}
            </div>
          )}
          {activeSection === 'filters' && <FilterBuilder filters={config.filters || []} onChange={(filters) => updateConfig({ filters })} />}
          {activeSection === 'sorting' && <SortBuilder sorting={config.sorting || []} onChange={(sorting) => updateConfig({ sorting })} />}
          {activeSection === 'transforms' && (
            <TransformsEditor
              transforms={(config as InputBindingConfig & { transforms?: DataTransform[] }).transforms || []}
              onChange={(transforms) => updateConfig({ transforms } as Partial<InputBindingConfig>)}
              dynamicFilters={(config as InputBindingConfig & { dynamicFilters?: DynamicFilter[] }).dynamicFilters || []}
              onDynamicFiltersChange={(dynamicFilters) => updateConfig({ dynamicFilters } as Partial<InputBindingConfig>)}
            />
          )}
          {activeSection === 'pagination' && (
            <div className="space-y-4">
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={config.pagination?.enabled || false} onChange={(e) => updateConfig({ pagination: { ...config.pagination, enabled: e.target.checked } })} className="w-4 h-4" />
                <span className="text-sm font-medium text-gray-700">Enable Pagination</span>
              </label>
              {config.pagination?.enabled && (
                <>
                  <div><label className="block text-sm text-gray-700 mb-1">Page Size</label><input type="number" min="1" max="100" value={config.pagination?.pageSize || 10} onChange={(e) => updateConfig({ pagination: { ...config.pagination, enabled: true, pageSize: parseInt(e.target.value) || 10 } })} className="w-32 px-3 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm text-gray-700 mb-1">Strategy</label><select value={config.pagination?.strategy || 'offset'} onChange={(e) => updateConfig({ pagination: { ...config.pagination, enabled: true, strategy: e.target.value as 'offset' | 'cursor' } })} className="w-48 px-3 py-2 border rounded-lg"><option value="offset">Offset</option><option value="cursor">Cursor</option></select></div>
                </>
              )}
            </div>
          )}
          {activeSection === 'states' && (config.mode === 'repeater' || config.mode === 'paginated') && <RepeaterStatesEditor config={(config.repeaterStates || {}) as RepeaterStatesConfig} onChange={(repeaterStates) => updateConfig({ repeaterStates: repeaterStates as InputBindingConfig['repeaterStates'] })} />}
          {activeSection === 'sources' && (
            <AdditionalDataSourcesEditor
              sources={(config as InputBindingConfig & { additionalSources?: AdditionalDataSource[] }).additionalSources || []}
              primaryDataSourceId={binding.dataSourceId}
              onChange={(additionalSources) => updateConfig({ additionalSources } as Partial<InputBindingConfig>)}
            />
          )}
          {activeSection === 'computed' && (
            <ComputedFieldsEditor
              fields={(config as InputBindingConfig & { computedFields?: ComputedFieldConfig[] }).computedFields || []}
              dataSourceId={binding.dataSourceId}
              onChange={(computedFields) => updateConfig({ computedFields } as Partial<InputBindingConfig>)}
            />
          )}
          {activeSection === 'conditional' && (
            <ConditionalMappingEditor
              mappings={(config as InputBindingConfig & { conditionalMappings?: ConditionalFieldConfig[] }).conditionalMappings || []}
              dataSourceId={binding.dataSourceId}
              onChange={(conditionalMappings) => updateConfig({ conditionalMappings } as Partial<InputBindingConfig>)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
