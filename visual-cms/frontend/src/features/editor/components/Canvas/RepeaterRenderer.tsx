import React, { useEffect, useState } from 'react'
import { useDataBinding } from '@/features/dataBindings'
import { useAppSelector } from '@/app/hooks'
import { selectBlocks } from '@/features/blocks/blocksSlice'
import { BlockNode, CSSProperties } from '@/shared/types'
import { CanvasRenderer } from './CanvasRenderer'
import { BlockNodeWithViewport } from '../../utils/variationUtils'

interface RepeaterRendererProps {
  node: BlockNodeWithViewport
  editorType?: 'page' | 'block'
  blockAlignment?: 'left' | 'center' | 'right'
  rootNode?: BlockNode
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
  rootNode
}) => {
  // Получаем linkedBlockId из метаданных — привязка может быть сохранена по этому ID
  const linkedBlockId = node.metadata?.linkedBlockId
  
  const { data, loading, error, binding } = useDataBinding<any[]>(node.id, { 
    autoFetch: true,
    linkedBlockId // Передаём linkedBlockId для поиска привязки по ID библиотечного блока
  })
  
  console.log('[RepeaterRenderer] useDataBinding result:', { 
    nodeId: node.id,
    linkedBlockId,
    data, 
    dataType: typeof data,
    isArray: Array.isArray(data),
    loading, 
    error,
    binding: binding?.id 
  })
  
  const blocks = useAppSelector(selectBlocks)
  const [repeaterItems, setRepeaterItems] = useState<BlockNodeWithViewport[]>([])

  // Получаем templateId из конфига привязки
  const inputConfig = binding?.config?.inputConfig as InputConfig | undefined
  const templateId = inputConfig?.templateId
  const fieldMappings = inputConfig?.fieldMappings || []
  const arrayPath = (inputConfig as any)?.arrayPath // путь к массиву в данных, например "data"

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
      arrayPath
    })

    if (!data) {
      console.log('No data')
      setRepeaterItems([])
      return
    }

    // Извлекаем массив из данных используя arrayPath если указан
    let items: any[] = data
    if (arrayPath && !Array.isArray(data)) {
      items = getValueByPath(data, arrayPath)
      console.log(`Extracted array using arrayPath "${arrayPath}":`, items)
    }

    // Если всё ещё не массив, пытаемся найти в стандартных местах
    if (!Array.isArray(items)) {
      if ((data as any).data && Array.isArray((data as any).data)) {
        items = (data as any).data
      } else if ((data as any).items && Array.isArray((data as any).items)) {
        items = (data as any).items
      } else {
        console.log('Data is not array and no items found', { data, arrayPath })
        setRepeaterItems([])
        return
      }
    }

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
      children: clonedChildren,
      metadata: {
        ...template.metadata,
        name: `${template.metadata?.name || 'Item'} ${index + 1}`
      }
    }
  }

  // Получаем значение из объекта по пути (например, "user.name" -> obj.user.name)
  const getValueByPath = (obj: any, path: string): any => {
    if (!obj || !path) return undefined
    return path.split('.').reduce((acc, key) => acc?.[key], obj)
  }

  // Применяем field mappings к контенту блока
  const applyFieldMappings = (
    block: BlockNodeWithViewport, 
    dataItem: any,
    mappings: Array<{ sourceField: string; targetProperty: string; elementId?: string; id?: string }>
  ): string | undefined => {
    // Проверяем data-field атрибут блока
    const dataField = block.attributes?.['data-field']
    
    if (dataField) {
      // Ищем маппинг для этого data-field
      // targetProperty формата "item.project-name", data-field="project-name"
      const mapping = mappings.find(m => 
        m.targetProperty.endsWith(dataField) || 
        m.targetProperty === `item.${dataField}`
      )
      
      if (mapping) {
        const value = getValueByPath(dataItem, mapping.sourceField)
        console.log(`[applyFieldMappings] Found mapping for ${dataField}:`, { 
          sourceField: mapping.sourceField, 
          value,
          dataItem 
        })
        if (value !== undefined) {
          return String(value)
        }
      }
    }
    
    // Новый подход: сопоставление по targetProperty содержащему идентификатор
    // targetProperty: "item.project-name", ищем блок с content "Golden Residence" или по позиции
    if (!block.content || block.content.trim() === '') {
      return block.content
    }
    
    // Пробуем найти маппинг по targetProperty
    // "item.project-name" -> ищем поле с "name" в конце
    // "item.project-location" -> ищем поле с "location" в конце
    // "item.project-price" -> ищем поле с "price" в конце
    const contentLower = block.content.toLowerCase()
    
    for (const mapping of mappings) {
      const targetProp = mapping.targetProperty.toLowerCase()
      
      // Простая эвристика: если content похож на то, что должно быть по маппингу
      if (
        (targetProp.includes('name') && (contentLower.includes('golden') || contentLower.includes('residence'))) ||
        (targetProp.includes('location') && (contentLower.includes('юнусабад') || contentLower.includes('метро'))) ||
        (targetProp.includes('price') && contentLower.includes('$'))
      ) {
        const value = getValueByPath(dataItem, mapping.sourceField)
        if (value !== undefined) {
          console.log(`[applyFieldMappings] Matched by content heuristic:`, {
            targetProp: mapping.targetProperty,
            originalContent: block.content,
            sourceField: mapping.sourceField,
            value
          })
          return String(value)
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
        const value = getValueByPath(dataItem, mapping.sourceField)
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
        const value = getValueByPath(dataItem, imageMapping.sourceField)
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
      const value = getValueByPath(dataItem, mapping.sourceField)
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

  // Рендерим контейнер с клонированными template блоками
  return React.createElement(
    node.tagName || 'div',
    {
      style: node.styles?.properties as React.CSSProperties,
      'data-element-id': node.id,
      'data-repeater': 'true',
      className: node.attributes?.class || node.attributes?.className || 'repeater-container'
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
