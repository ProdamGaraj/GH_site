import React, { useEffect, useState } from 'react'
import { useDataBindingWithTransforms } from '@/features/dataBindings/hooks/useDataBindingWithTransforms'
import { useAppSelector, useAppDispatch } from '@/app/hooks'
import { selectBlocks } from '@/features/blocks/blocksSlice'
import { selectNode } from '@/features/editor/editorSlice'
import { BlockNode, CSSProperties } from '@/shared/types'
import { CanvasRenderer } from './CanvasRenderer'
import { BlockNodeWithViewport } from '../../utils/variationUtils'

interface RepeaterRendererProps {
  node: BlockNodeWithViewport
  editorType?: 'page' | 'block'
  blockAlignment?: 'left' | 'center' | 'right'
  rootNode?: BlockNode
  libraryBlockId?: string // ID библиотечного блока при редактировании
}

interface InputConfig {
  mode?: 'single' | 'repeater'
  templateId?: string
  fieldMappings?: Array<{ sourceField: string; targetProperty: string; elementId?: string }>
}

/**
 * Компонент для рендеринга repeater блоков с данными
 * Загружает данные через data binding и клонирует template блок для каждого элемента
 */
export const RepeaterRenderer: React.FC<RepeaterRendererProps> = ({
  node,
  editorType,
  blockAlignment,
  rootNode,
  libraryBlockId
}) => {
  const dispatch = useAppDispatch()
  
  // Получаем linkedBlockId из метаданных или из пропса libraryBlockId
  const linkedBlockId = libraryBlockId || node.metadata?.linkedBlockId
  
  const { data, loading, error, binding, meta } = useDataBindingWithTransforms<any>(node.id, { 
    autoFetch: true,
    linkedBlockId // Передаём linkedBlockId для поиска привязки по ID библиотечного блока
  })
  
  console.log('[RepeaterRenderer] useDataBindingWithTransforms result:', { 
    nodeId: node.id,
    linkedBlockId,
    data, 
    dataType: typeof data,
    isArray: Array.isArray(data),
    dataLength: Array.isArray(data) ? data.length : 0,
    meta,
    loading, 
    error,
    binding: binding?.id,
    transforms: binding?.config?.inputConfig?.transforms
  })
  
  const blocks = useAppSelector(selectBlocks)
  const [repeaterItems, setRepeaterItems] = useState<BlockNodeWithViewport[]>([])

  // Получаем templateId из конфига привязки
  const inputConfig = binding?.config?.inputConfig as InputConfig | undefined
  const templateId = inputConfig?.templateId
  const fieldMappings = inputConfig?.fieldMappings || []
  const arrayPath = (inputConfig as any)?.arrayPath // путь к массиву в данных, например "data"
  const fieldOverrides: Record<string, { joinField: string; values: Record<string, string | number>; displayTemplate?: string }> =
    (inputConfig as any)?.fieldOverrides || {}

  // Находим шаблон блока
  const templateBlock = templateId ? blocks.find(b => b.id === templateId) : null

  useEffect(() => {
    console.log('RepeaterRenderer effect:', { 
      nodeId: node.id, 
      data, 
      dataLength: data?.length,
      dataType: Array.isArray(data) ? 'array' : typeof data,
      templateId, 
      templateBlock: templateBlock?.name,
      templateStructure: templateBlock?.structure,
      fieldMappings,
      arrayPath,
      meta
    })

    if (!data || data.length === 0) {
      console.log('No data or empty array')
      setRepeaterItems([])
      return
    }

    // useDataBindingWithTransforms уже возвращает готовый массив
    // Не нужно извлекать через arrayPath
    let items: any[] = data
    
    console.log('Items array with length:', items.length, items)

    // Используем шаблон из библиотеки блоков (по templateId)
    // Или fallback на первый дочерний элемент контейнера
    const template = templateBlock?.structure || node.children[0]
    
    if (!template) {
      console.warn(`Repeater block ${node.id} has no template block. templateId: ${templateId}`)
      setRepeaterItems([])
      return
    }

    console.log('Using template:', template)

    // Клонируем template для каждого элемента данных
    const clonedItems = items.map((item, index) => {
      console.log(`Cloning item ${index}:`, item)
      // Создаем копию template с уникальным id и применяем данные
      const clonedNode = cloneBlockNode(template as BlockNodeWithViewport, index, item, fieldMappings)
      return clonedNode
    })

    console.log('Created repeater items:', clonedItems.length, clonedItems)
    setRepeaterItems(clonedItems)
  }, [data, node.children, node.id, templateBlock, templateId, fieldMappings, arrayPath])

  // Функция клонирования блока с применением field mappings
  const cloneBlockNode = (
    template: BlockNodeWithViewport, 
    index: number, 
    dataItem: any,
    mappings: Array<{ sourceField: string; targetProperty: string; elementId?: string; id?: string }>
  ): BlockNodeWithViewport => {
    const newId = `${template.id}-clone-${index}`
    
    // Рекурсивно клонируем детей с применением маппингов
    const clonedChildren = template.children.map((child, childIndex) => 
      cloneBlockNode(child as BlockNodeWithViewport, index * 1000 + childIndex, dataItem, mappings)
    )

    // Применяем field mappings из data binding
    const updatedContent = applyFieldMappings(template, dataItem, mappings)
    const updatedStyles = applyStyleMappings(template, dataItem, mappings)
    
    // Применяем атрибутные маппинги (src для img, href для a)
    const updatedAttributes = applyAttributeMappings(template, dataItem, mappings)

    console.log(`[cloneBlockNode] Block ${template.id}:`, {
      id: template.id,
      metadata: template.metadata,
      attributes: template.attributes,
      dataField: template.attributes?.['data-field'],
      mappings: mappings.filter(m => m.targetProperty.includes(template.attributes?.['data-field'] || 'xxx')),
      allMappings: mappings,
      originalContent: template.content,
      updatedContent,
      dataItem
    })

    return {
      ...template,
      id: newId,
      content: updatedContent,
      styles: updatedStyles,
      attributes: updatedAttributes,
      children: clonedChildren,
      metadata: {
        ...template.metadata,
        name: `${template.metadata?.name || 'Item'} ${index + 1}`
      }
    }
  }

  // Получаем значение из объекта по пути
  // Поддерживает: "name", "houses.address", "houses[0].files[0].file_url"
  const getValueByPath = (obj: any, path: string): any => {
    if (!obj || !path) return undefined
    // Разбиваем путь: "houses[0].files[0].file_url" → ["houses", "0", "files", "0", "file_url"]
    const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.')
    return keys.reduce((acc, key) => acc?.[key], obj)
  }

  // Нормализуем targetProperty: "item.project.-image" → "project-image"
  const normalizeTargetProp = (tp: string): string => {
    // Убираем префикс "item."
    let result = tp.startsWith('item.') ? tp.slice(5) : tp
    // Заменяем ".-" на "-" (артефакт формата)
    result = result.split('.-').join('-')
    return result.toLowerCase()
  }

  // Проверяем ручной override для поля (статические значения из конфига)
  const resolveOverride = (targetProperty: string, dataItem: any): string | undefined => {
    if (!fieldOverrides || Object.keys(fieldOverrides).length === 0) return undefined
    const fieldName = targetProperty.startsWith('item.') ? targetProperty.slice(5) : targetProperty
    const override = fieldOverrides[fieldName] || fieldOverrides[targetProperty]
    if (!override?.joinField || !override?.values) return undefined
    const keyValue = String(getValueByPath(dataItem, override.joinField) ?? '')
    const rawVal = override.values[keyValue]
    if (rawVal === undefined) return undefined
    if (override.displayTemplate) {
      return override.displayTemplate.split('{value}').join(String(rawVal))
    }
    return String(rawVal)
  }

  // Поддерживаем оба формата mapping:
  // 1) sourceField="name", targetProperty="item.project-name"
  // 2) sourceField="title", targetProperty="item.name"
  const getMappingValue = (
    dataItem: any,
    mapping: { sourceField: string; targetProperty: string }
  ): any => {
    const targetIsDataPath = typeof mapping.targetProperty === 'string' && mapping.targetProperty.startsWith('item.')
    const sourceIsDataPath = typeof mapping.sourceField === 'string' && mapping.sourceField.startsWith('item.')

    // Каноничный формат: sourceField = путь в API, targetProperty = item.<templateField>
    if (!sourceIsDataPath && targetIsDataPath) {
      return getValueByPath(dataItem, mapping.sourceField)
    }

    // Legacy перевёрнутый формат: sourceField = item.<templateField>, targetProperty = путь в API
    if (sourceIsDataPath && !targetIsDataPath) {
      return getValueByPath(dataItem, mapping.targetProperty)
    }

    // Fallback для смешанных/нестандартных кейсов
    if (sourceIsDataPath) {
      return getValueByPath(dataItem, mapping.sourceField.slice(5))
    }

    const directValue = getValueByPath(dataItem, mapping.sourceField)
    if (directValue !== undefined) {
      return directValue
    }

    // Специальный fallback для изображений MacroCRM:
    // если путь содержит file_url, ищем первый доступный file_url в объекте элемента
    if (mapping.sourceField.includes('file_url')) {
      const firstFileUrl = findFirstFileUrl(dataItem)
      if (firstFileUrl) {
        return firstFileUrl
      }
    }

    return undefined
  }

  const findFirstFileUrl = (value: any): string | undefined => {
    if (!value) return undefined

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findFirstFileUrl(item)
        if (found) return found
      }
      return undefined
    }

    if (typeof value === 'object') {
      if (typeof value.file_url === 'string' && value.file_url.length > 0) {
        return value.file_url
      }

      for (const child of Object.values(value)) {
        const found = findFirstFileUrl(child)
        if (found) return found
      }
    }

    return undefined
  }

  // Применяем маппинги к атрибутам (src для img, alt, href для a)
  const applyAttributeMappings = (
    block: BlockNodeWithViewport,
    dataItem: any,
    mappings: Array<{ sourceField: string; targetProperty: string; elementId?: string; id?: string }>
  ): typeof block.attributes => {
    if (!block.attributes && block.tagName !== 'img') return block.attributes
    
    const attrs = { ...block.attributes }
    
    if (block.tagName === 'img') {
      // 1) По data-field
      const dataField = attrs['data-field']
      if (dataField) {
        const mapping = mappings.find(m => 
          m.targetProperty.endsWith(dataField) || 
          m.targetProperty === `item.${dataField}`
        )
        if (mapping) {
          const value = getMappingValue(dataItem, mapping)
          if (value !== undefined) {
            attrs.src = String(value)
            return attrs
          }
        }
      }
      
      // 2) По metadata.name или mapping.id содержащему "image"
      const blockName = (block.metadata?.name || '').toLowerCase().replace(/\s+/g, '-')
      const imageMapping = mappings.find(m => {
        const norm = normalizeTargetProp(m.targetProperty)
        const idSuffix = m.id ? m.id.replace(/^mapping-field-/, '') : ''
        return norm.includes('image') || idSuffix.includes('image') ||
               blockName.includes(norm) || norm.includes(blockName)
      })
      if (imageMapping) {
        const value = getMappingValue(dataItem, imageMapping)
        if (value !== undefined) {
          attrs.src = String(value)
          console.log(`[applyAttributeMappings] Set img src for "${block.metadata?.name}":`, value)
          return attrs
        }
      }
    }
    
    return attrs
  }

  // Применяем field mappings к контенту блока
  const applyFieldMappings = (
    block: BlockNodeWithViewport, 
    dataItem: any,
    mappings: Array<{ sourceField: string; targetProperty: string; elementId?: string; id?: string }>
  ): string | undefined => {
    // 1. По data-field атрибуту (приоритет)
    const dataField = block.attributes?.['data-field']
    if (dataField) {
      const mapping = mappings.find(m => 
        m.targetProperty.endsWith(dataField) || 
        m.targetProperty === `item.${dataField}`
      )
      if (mapping) {
        const overrideValue = resolveOverride(mapping.targetProperty, dataItem)
        if (overrideValue !== undefined) return overrideValue
        const value = getMappingValue(dataItem, mapping)
        if (value !== undefined) return String(value)
      }
    }

    // 2. По targetProperty → metadata.name
    // targetProperty: "item.project-name" → нормализуем и сопоставляем с metadata.name "Project Name"
    if (block.metadata?.name && block.content && block.content.trim() !== '') {
      const blockName = block.metadata.name.toLowerCase().replace(/\s+/g, '-')
      
      for (const mapping of mappings) {
        const norm = normalizeTargetProp(mapping.targetProperty)
        if (norm === blockName || blockName.includes(norm) || norm.includes(blockName)) {
          const overrideValue = resolveOverride(mapping.targetProperty, dataItem)
          if (overrideValue !== undefined) return overrideValue
          const value = getMappingValue(dataItem, mapping)
          if (value !== undefined) {
            console.log(`[applyFieldMappings] Matched by name "${block.metadata.name}" → ${mapping.sourceField}:`, value)
            return String(value)
          }
        }
      }
    }

    // 3. По id маппинга → metadata.name  
    // mapping.id: "mapping-field-project-name" → metadata.name: "Project Name"
    if (block.metadata?.name && block.content && block.content.trim() !== '') {
      const blockName = block.metadata.name.toLowerCase().replace(/\s+/g, '-')
      
      for (const mapping of mappings) {
        if (mapping.id) {
          // "mapping-field-project-name" → "project-name"
          const idSuffix = mapping.id.replace(/^mapping-field-/, '')
          if (idSuffix === blockName || blockName.includes(idSuffix) || idSuffix.includes(blockName)) {
            const overrideValue = resolveOverride(mapping.targetProperty, dataItem)
            if (overrideValue !== undefined) return overrideValue
            const value = getMappingValue(dataItem, mapping)
            if (value !== undefined) {
              console.log(`[applyFieldMappings] Matched by id "${mapping.id}" → name "${block.metadata.name}":`, value)
              return String(value)
            }
          }
        }
      }
    }

    return block.content
  }

  // Применяем field mappings к стилям блока (например, backgroundImage)
  const applyStyleMappings = (
    block: BlockNodeWithViewport, 
    dataItem: any,
    mappings: Array<{ sourceField: string; targetProperty: string; elementId?: string; id?: string }>
  ): typeof block.styles => {
    if (!block.styles) return block.styles

    // Проверяем data-field для изображений
    const dataField = block.attributes?.['data-field']
    
    if (dataField) {
      const mapping = mappings.find(m => 
        m.targetProperty.endsWith(dataField) || 
        m.targetProperty === `item.${dataField}`
      )
      
      if (mapping && dataField.includes('image')) {
        const value = getMappingValue(dataItem, mapping)
        if (value !== undefined) {
          const updatedProperties = { ...block.styles.properties } as Record<string, unknown>
          updatedProperties.backgroundImage = `url(${value})`
          return {
            ...block.styles,
            properties: updatedProperties as CSSProperties
          }
        }
      }
    }

    // Новый подход: если блок имеет backgroundImage, применяем маппинг для image
    if (block.styles.properties?.backgroundImage) {
      const imageMapping = mappings.find(m => 
        m.targetProperty.toLowerCase().includes('image') ||
        m.sourceField.toLowerCase().includes('image')
      )
      
      if (imageMapping) {
        const value = getMappingValue(dataItem, imageMapping)
        if (value !== undefined) {
          const updatedProperties = { ...block.styles.properties } as Record<string, unknown>
          updatedProperties.backgroundImage = `url(${value})`
          console.log(`[applyStyleMappings] Applied image mapping:`, {
            sourceField: imageMapping.sourceField,
            value,
            originalBg: block.styles.properties.backgroundImage
          })
          return {
            ...block.styles,
            properties: updatedProperties as CSSProperties
          }
        }
      }
    }

    // Fallback: старая логика
    const styleMappings = mappings.filter(m => 
      (m.elementId === block.id || !m.elementId) &&
      (m.targetProperty.startsWith('style.') || m.targetProperty === 'src' || m.targetProperty === 'href')
    )

    if (styleMappings.length === 0) return block.styles

    const updatedProperties = { ...block.styles.properties } as Record<string, unknown>

    for (const mapping of styleMappings) {
      const value = getMappingValue(dataItem, mapping)
      if (value !== undefined) {
        if (mapping.targetProperty === 'src' || mapping.targetProperty === 'style.backgroundImage') {
          // Для изображений применяем как backgroundImage
          updatedProperties.backgroundImage = `url(${value})`
        } else if (mapping.targetProperty.startsWith('style.')) {
          const styleKey = mapping.targetProperty.replace('style.', '')
          updatedProperties[styleKey] = value
        }
      }
    }

    return {
      ...block.styles,
      properties: updatedProperties as CSSProperties
    }
  }

  if (loading) {
    const loadingStyle: React.CSSProperties = {
      padding: '20px',
      textAlign: 'center',
      color: '#666',
      fontSize: '14px'
    }
    
    return (
      <div 
        ref={(el) => el}
        style={{ ...(node.styles?.properties as React.CSSProperties || {}), ...loadingStyle }}
        data-element-id={node.id}
        className="repeater-loading"
      >
        Загрузка данных...
      </div>
    )
  }

  if (error) {
    const errorStyle: React.CSSProperties = {
      padding: '20px',
      textAlign: 'center',
      color: '#dc2626',
      fontSize: '14px'
    }
    
    return (
      <div 
        ref={(el) => el}
        style={{ ...(node.styles?.properties as React.CSSProperties || {}), ...errorStyle }}
        data-element-id={node.id}
        className="repeater-error"
      >
        Ошибка загрузки: {error}
      </div>
    )
  }

  if (!data || data.length === 0) {
    const emptyStyle: React.CSSProperties = {
      padding: '20px',
      textAlign: 'center',
      color: '#9ca3af',
      fontSize: '14px'
    }
    
    return (
      <div 
        ref={(el) => el}
        style={{ ...(node.styles?.properties as React.CSSProperties || {}), ...emptyStyle }}
        data-element-id={node.id}
        className="repeater-empty"
      >
        Нет данных для отображения
      </div>
    )
  }

  // Обработчик клика - при клике на карточки внутри репитера выбираем контейнер-родитель
  const handleContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch(selectNode(node.id))
  }

  // Рендерим контейнер с клонированными template блоками
  // Используем onClickCapture чтобы перехватить клики до дочерних элементов
  return React.createElement(
    node.tagName || 'div',
    {
      style: node.styles?.properties as React.CSSProperties,
      'data-element-id': node.id,
      'data-repeater': 'true',
      className: node.attributes?.class || node.attributes?.className || 'repeater-container',
      onClickCapture: handleContainerClick
    },
    repeaterItems.map((item) => (
      <CanvasRenderer
        key={item.id}
        node={item}
        editorType={editorType}
        blockAlignment={blockAlignment}
        rootNode={rootNode}
      />
    ))
  )
}
