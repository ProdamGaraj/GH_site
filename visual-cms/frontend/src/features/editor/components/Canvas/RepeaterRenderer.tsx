import React, { useEffect, useState } from 'react'
import { useDataBinding } from '@/features/dataBindings'
import { BlockNode } from '@/shared/types'
import { CanvasRenderer } from './CanvasRenderer'
import { BlockNodeWithViewport } from '../../utils/variationUtils'

interface RepeaterRendererProps {
  node: BlockNodeWithViewport
  editorType?: 'page' | 'block'
  blockAlignment?: 'left' | 'center' | 'right'
  rootNode?: BlockNode
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
  const { data, loading, error } = useDataBinding<any[]>(node.id, { autoFetch: true })
  const [repeaterItems, setRepeaterItems] = useState<BlockNodeWithViewport[]>([])

  useEffect(() => {
    if (!data || !Array.isArray(data)) {
      setRepeaterItems([])
      return
    }

    // Находим template блок (первый child с data-repeater-template)
    // В режиме repeater первый child считается template
    const templateBlock = node.children[0]
    
    if (!templateBlock) {
      console.warn(`Repeater block ${node.id} has no template block`)
      setRepeaterItems([])
      return
    }

    // Клонируем template для каждого элемента данных
    const items = data.map((item, index) => {
      // Создаем копию template с уникальным id
      const clonedNode = cloneBlockNode(templateBlock as BlockNodeWithViewport, index, item)
      return clonedNode
    })

    setRepeaterItems(items)
  }, [data, node.children, node.id])

  // Функция клонирования блока с применением field mappings
  const cloneBlockNode = (
    template: BlockNodeWithViewport, 
    index: number, 
    dataItem: any
  ): BlockNodeWithViewport => {
    const newId = `${template.id}-clone-${index}`
    
    // Рекурсивно клонируем детей
    const clonedChildren = template.children.map((child, childIndex) => 
      cloneBlockNode(child as BlockNodeWithViewport, index * 1000 + childIndex, dataItem)
    )

    // Применяем field mappings из data binding
    const updatedContent = applyFieldMappings(template, dataItem)

    return {
      ...template,
      id: newId,
      content: updatedContent || template.content,
      children: clonedChildren,
      metadata: {
        ...template.metadata,
        name: `${template.metadata?.name || 'Item'} (clone ${index})`
      }
    }
  }

  // Применяем field mappings к контенту блока
  const applyFieldMappings = (block: BlockNodeWithViewport, _dataItem: any): string | undefined => {
    // TODO: получить field mappings из data binding конфигурации
    // Пока просто возвращаем исходный контент
    // В будущем здесь нужно будет:
    // 1. Получить fieldMappings из binding config
    // 2. Найти соответствие для этого блока по data-element-id
    // 3. Применить маппинг sourceField -> targetProperty
    
    return block.content
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
      className: 'repeater-container'
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
