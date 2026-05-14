import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDataBindingWithTransforms } from '@/features/dataBindings/hooks/useDataBindingWithTransforms'
import { useAppSelector, useAppDispatch } from '@/app/hooks'
import { selectBlocks } from '@/features/blocks/blocksSlice'
import { selectNode } from '@/features/editor/editorSlice'
import { useComputedStyles } from '../../hooks/useComputedStyles'
import { BlockNode, CSSProperties } from '@/shared/types'
import { CanvasRenderer } from './CanvasRenderer'
import { BlockNodeWithViewport } from '../../utils/variationUtils'
import { getRepeatTemplate } from '../../utils/repeatTemplateHelper'
import { getStaticBefore, getStaticAfter, prepareHybridStaticNode } from '../../utils/hybridStaticHelper'
import { deepCloneNode } from '../../utils/carouselHelpers'

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

// Рекурсивно ищет первый file_url в объекте данных.
// Вынесена в module-scope: чистая функция, нет зависимости от state/props,
// что позволяет безопасно вызывать её из useEffect без TDZ-нарушений.
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
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const containerRef = useRef<HTMLElement | null>(null)
  const isCarouselTrack = node.attributes?.['data-carousel-track'] === 'true'
  const computedContainerStyles = useComputedStyles(node)

  const repeaterContainerStyles: React.CSSProperties = {
    ...computedContainerStyles,
    ...(isCarouselTrack
      ? {
          overflowX: 'auto',
          overflowY: 'hidden',
          position: (computedContainerStyles.position as React.CSSProperties['position']) || 'relative',
          scrollBehavior: 'smooth',
        }
      : {}),
  }

  // ====================== Derived state (вся мемоизация — перед эффектами и функциями) ======================
  // Получаем templateId из конфига привязки.
  // Мемоизируем производные значения, иначе при каждом ре-рендере родителя
  // fieldMappings / fieldOverrides / templateBlock получают новую ссылку,
  // что вызывает каскадный re-run useEffect ниже и бесконечный setRepeaterItems.
  const inputConfig = binding?.config?.inputConfig as InputConfig | undefined
  const inputConfigRaw = inputConfig as any
  const templateId = inputConfig?.templateId
  const arrayPath = inputConfigRaw?.arrayPath // путь к массиву в данных, например "data"

  const fieldMappings = useMemo(
    () => inputConfig?.fieldMappings || [],
    [inputConfig?.fieldMappings]
  )

  const fieldOverrides: Record<string, { joinField: string; values: Record<string, string | number>; displayTemplate?: string }> =
    useMemo(() => inputConfigRaw?.fieldOverrides || {}, [inputConfigRaw?.fieldOverrides])

  // Находим шаблон блока
  const templateBlock = useMemo(
    () => (templateId ? blocks.find(b => b.id === templateId) : null) || null,
    [blocks, templateId]
  )

  // Hybrid-MVP: первый non-static child трека — это template для клонирования.
  // Все остальные children с data-carousel-static="true" должны рендериться как обычные слайды
  // в их позиции относительно template'а. На бэке (DataBindingGenerator) — та же логика.
  const trackTemplateChild = useMemo(() => getRepeatTemplate(node), [node])

  const staticBeforeSlides = useMemo(
    () => getStaticBefore(node, trackTemplateChild),
    [node, trackTemplateChild]
  )
  const staticAfterSlides = useMemo(
    () => getStaticAfter(node, trackTemplateChild),
    [node, trackTemplateChild]
  )

  // Если non-static child — placeholder с linkedBlockId, раскрываем его в полную структуру из библиотеки.
  // Это аналог templateBlock, но взятый из трека вместо binding.config.inputConfig.templateId.
  const resolvedTrackTemplate = useMemo<BlockNode | null>(() => {
    if (!trackTemplateChild) return null
    const linkedId = trackTemplateChild.metadata?.linkedBlockId
    if (typeof linkedId === 'string' && linkedId.length > 0) {
      const linked = blocks.find(b => b.id === linkedId)
      if (linked?.structure) return linked.structure
    }
    return trackTemplateChild
  }, [blocks, trackTemplateChild])

  // Раскрытие linked-static слайдов: если static-слайд — это placeholder с linkedBlockId,
  // подменяем его структуру содержимым из library. На бэке это делает LinkedBlocksService при save,
  // но в Canvas мы хотим видеть результат сразу — без обязательного промежуточного сохранения.
  // Сохраняем id placeholder'а на корне, чтобы он матчился с allSlideIds и data-element-id в DOM.
  // Дочерние id перевыдаются детерминированно (`${slide.id}-lib-N`), чтобы:
  //   1) Не было коллизий с другими подобными слайдами на той же странице
  //   2) Стабильность между ре-рендерами — React не пересоздаёт DOM, выделение элементов не теряется
  //
  // После раскрытия:
  //   а) Прогоняем через prepareHybridStaticNode(template) — мержим layout-стили template-слайда
  //      (height/display/position/выравнивание + flex-shrink: 0).
  //   б) Дополнительно копируем width/min-width/max-width/flex-* template'а. В продакшене эти стили
  //      проставляет CarouselRuntime.applyTrackLayout, поэтому prepareHybridStaticNode их намеренно
  //      не трогает. В Canvas runtime не работает — без этих стилей library-блок остаётся со своей
  //      родной шириной и не растягивается на полный слайд (выглядит "обрезанным").
  const SLIDE_FULL_WIDTH_KEYS = ['width', 'minWidth', 'maxWidth', 'flex', 'flexBasis', 'flexGrow', 'flexShrink'] as const

  const expandLinkedSlide = (slide: BlockNode, template: BlockNode | null): BlockNode => {
    const linkedId = slide.metadata?.linkedBlockId
    let expanded: BlockNode = slide

    if (typeof linkedId === 'string' && linkedId.length > 0) {
      // Не раскрываем если backend уже это сделал (children заполнены) — иначе перезатрём правки.
      const alreadyExpanded = Array.isArray(slide.children) && slide.children.length > 0
      if (!alreadyExpanded) {
        const linked = blocks.find(b => b.id === linkedId)
        if (linked?.structure) {
          let counter = 0
          const genId = () => `${slide.id}-lib-${counter++}`
          const cloned = deepCloneNode(linked.structure, genId)
          cloned.id = slide.id
          cloned.attributes = { ...(cloned.attributes || {}), ...(slide.attributes || {}) }
          cloned.metadata = { ...(cloned.metadata || {}), ...(slide.metadata || {}) }
          expanded = cloned
        }
      }
    }

    // (а) Мержим layout-стили template'а (без width/flex — это делает prepareHybridStaticNode по дизайну).
    const prepared = prepareHybridStaticNode(expanded, template)

    // (б) Compensate for absent CarouselRuntime: переносим width/flex template'а вручную.
    const tplProps = (template?.styles?.properties || {}) as Record<string, unknown>
    const widthOverrides: Record<string, unknown> = {}
    for (const key of SLIDE_FULL_WIDTH_KEYS) {
      const v = tplProps[key]
      if (v !== undefined && v !== null && v !== '') widthOverrides[key] = v
    }
    if (Object.keys(widthOverrides).length === 0) {
      // template без явных width-стилей — используем reasonable default, чтобы слайд занял полный track.
      widthOverrides.width = '100%'
      widthOverrides.minWidth = '100%'
      widthOverrides.flexShrink = 0
    }

    return {
      ...prepared,
      styles: {
        ...(prepared.styles || { properties: {} }),
        properties: {
          ...((prepared.styles?.properties as Record<string, unknown>) || {}),
          ...widthOverrides,
        },
      } as BlockNode['styles'],
    }
  }

  const resolvedStaticBefore = useMemo(
    () => staticBeforeSlides.map(s => expandLinkedSlide(s, resolvedTrackTemplate)),
    [staticBeforeSlides, blocks, resolvedTrackTemplate]
  )
  const resolvedStaticAfter = useMemo(
    () => staticAfterSlides.map(s => expandLinkedSlide(s, resolvedTrackTemplate)),
    [staticAfterSlides, blocks, resolvedTrackTemplate]
  )

  // Полный набор id'шников всех слайдов в DOM-порядке: static-before, потом клоны, потом static-after.
  // Навигация (Prev/Next/scroll/индикатор) опирается на этот массив, а не на repeaterItems —
  // иначе static-слайды не достижимы кнопками и счётчик показывает неправильный total.
  const allSlideIds = useMemo<string[]>(() => {
    const before = resolvedStaticBefore.map(s => s.id)
    const clones = repeaterItems.map(i => i.id)
    const after = resolvedStaticAfter.map(s => s.id)
    return [...before, ...clones, ...after]
  }, [resolvedStaticBefore, resolvedStaticAfter, repeaterItems])

  const totalSlides = allSlideIds.length

  // ====================== Эффекты и функции навигации (используют derived state выше) ======================
  useEffect(() => {
    if (!isCarouselTrack) return
    setActiveSlideIndex(0)
    if (containerRef.current) containerRef.current.scrollLeft = 0
  }, [isCarouselTrack, node.id, totalSlides])

  const clampSlideIndex = (nextIndex: number) => {
    if (totalSlides <= 0) return 0
    return Math.min(Math.max(nextIndex, 0), totalSlides - 1)
  }

  const getSlideElements = (container: HTMLElement): HTMLElement[] => {
    if (totalSlides === 0) return []
    const ids = new Set(allSlideIds)
    // Сохраняем порядок DOM-children: он совпадает с allSlideIds, потому что
    // мы рендерим в том же порядке (static-before, clones, static-after).
    return Array.from(container.children).filter((child): child is HTMLElement => {
      if (!(child instanceof HTMLElement)) return false
      const elementId = child.getAttribute('data-element-id')
      return !!elementId && ids.has(elementId)
    })
  }

  const scrollToSlide = (nextIndex: number) => {
    if (!isCarouselTrack || !containerRef.current || totalSlides === 0) return
    const targetIndex = clampSlideIndex(nextIndex)
    const container = containerRef.current
    const slides = getSlideElements(container)
    const child = slides[targetIndex] || null
    if (!child) return

    container.scrollTo({
      left: child.offsetLeft,
      behavior: 'smooth',
    })
    setActiveSlideIndex(targetIndex)
  }

  const handleTrackScroll = (e: React.UIEvent<HTMLElement>) => {
    if (!isCarouselTrack || totalSlides === 0) return
    const container = e.currentTarget
    const slides = getSlideElements(container)
    if (slides.length === 0) return

    const scrollLeft = container.scrollLeft
    let nearestIndex = 0
    let nearestDistance = Number.POSITIVE_INFINITY

    slides.forEach((slide, index) => {
      const distance = Math.abs(slide.offsetLeft - scrollLeft)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    })

    if (nearestIndex !== activeSlideIndex) {
      setActiveSlideIndex(nearestIndex)
    }
  }

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

    // Источник template'а в порядке приоритета:
    //   1) binding.config.inputConfig.templateId → blocks library (templateBlock)
    //   2) Первый non-static child трека, раскрытый через linkedBlockId (если placeholder)
    //   3) Сам non-static child как inline-template
    // Раньше тут был fallback `node.children[0]`, который при hybrid-static настройке
    // указывал на STATIC слайд и клонировал его как template — корень бага
    // "одинаковый контент во всех клонированных слайдах".
    const template = templateBlock?.structure || resolvedTrackTemplate

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

    // ДИАГНОСТИКА: проверяем, не приходят ли из data source дубликаты image URLs.
    // Это частая причина "залипшего фона" на разных слайдах — корень обычно в JOIN/transform на бэкенде.
    if (items.length > 1) {
      const urlToIndices = new Map<string, number[]>()
      items.forEach((it, idx) => {
        const url = findFirstFileUrl(it)
        if (!url) return
        const list = urlToIndices.get(url) || []
        list.push(idx)
        urlToIndices.set(url, list)
      })
      const dupes = Array.from(urlToIndices.entries()).filter(([, idxs]) => idxs.length > 1)
      if (dupes.length > 0) {
        console.warn(
          '[RepeaterRenderer] Duplicate image URLs in data — likely a backend transform/join issue, not a render bug.',
          { bindingId: binding?.id, dupes }
        )
      }
    }
    // node.children намеренно не в deps — массив ссылочно нестабилен и заставлял useEffect перезапускаться на каждый рендер.
    // Нужный нам derived state — resolvedTrackTemplate, который сам мемоизирован и реагирует на изменение детей.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, node.id, templateBlock, resolvedTrackTemplate, fieldMappings, arrayPath, binding?.id])

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
        ref={(el) => {
          containerRef.current = el as HTMLElement | null
        }}
        style={{ ...repeaterContainerStyles, ...loadingStyle }}
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
        ref={(el) => {
          containerRef.current = el as HTMLElement | null
        }}
        style={{ ...repeaterContainerStyles, ...errorStyle }}
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
        ref={(el) => {
          containerRef.current = el as HTMLElement | null
        }}
        style={{ ...repeaterContainerStyles, ...emptyStyle }}
        data-element-id={node.id}
        className="repeater-empty"
      >
        Нет данных для отображения
      </div>
    )
  }

  // Обработчик клика - при клике на карточки внутри репитера выбираем контейнер-родитель
  const handleContainerClick = (e: React.MouseEvent) => {
    const target = e.target
    if (target instanceof Element && target.closest('[data-canvas-carousel-control="true"]')) {
      return
    }
    e.stopPropagation()
    dispatch(selectNode(node.id))
  }

  const carouselControls = isCarouselTrack && totalSlides > 1 ? (
    <div
      data-canvas-carousel-control="true"
      style={{
        position: 'absolute',
        right: 12,
        bottom: 12,
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 8,
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          pointerEvents: 'none',
          border: '1px solid #d1d5db',
          borderRadius: 6,
          background: 'rgba(255, 255, 255, 0.95)',
          color: '#374151',
          padding: '6px 10px',
          fontSize: 12,
          lineHeight: 1,
          minWidth: 40,
          textAlign: 'center',
        }}
      >
        {activeSlideIndex + 1}/{totalSlides}
      </div>
      <button
        data-canvas-carousel-control="true"
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          scrollToSlide(activeSlideIndex - 1)
        }}
        disabled={activeSlideIndex <= 0}
        style={{
          pointerEvents: 'auto',
          border: '1px solid #d1d5db',
          borderRadius: 6,
          background: '#ffffff',
          color: '#111827',
          padding: '6px 10px',
          fontSize: 12,
          lineHeight: 1,
          cursor: activeSlideIndex <= 0 ? 'not-allowed' : 'pointer',
          opacity: activeSlideIndex <= 0 ? 0.5 : 0.95,
        }}
      >
        Prev
      </button>
      <button
        data-canvas-carousel-control="true"
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          scrollToSlide(activeSlideIndex + 1)
        }}
        disabled={activeSlideIndex >= totalSlides - 1}
        style={{
          pointerEvents: 'auto',
          border: '1px solid #d1d5db',
          borderRadius: 6,
          background: '#ffffff',
          color: '#111827',
          padding: '6px 10px',
          fontSize: 12,
          lineHeight: 1,
          cursor: activeSlideIndex >= totalSlides - 1 ? 'not-allowed' : 'pointer',
          opacity: activeSlideIndex >= totalSlides - 1 ? 0.5 : 0.95,
        }}
      >
        Next
      </button>
    </div>
  ) : null

  // Рендерим контейнер с клонированными template блоками
  // Используем onClickCapture чтобы перехватить клики до дочерних элементов
  if (isCarouselTrack) {
    return React.createElement(
      'div',
      {
        style: {
          position: 'relative',
          display: 'block',
          width: '100%',
        },
      },
      React.createElement(
        node.tagName || 'div',
        {
          ref: (el: HTMLElement | null): void => {
            containerRef.current = el
          },
          style: repeaterContainerStyles,
          'data-element-id': node.id,
          'data-repeater': 'true',
          className: node.attributes?.class || node.attributes?.className || 'repeater-container',
          onClickCapture: handleContainerClick,
          onScroll: handleTrackScroll,
        },
        <>
          {resolvedStaticBefore.map((slide) => (
            <CanvasRenderer
              key={slide.id}
              node={slide as BlockNodeWithViewport}
              editorType={editorType}
              blockAlignment={blockAlignment}
              rootNode={rootNode}
            />
          ))}
          {repeaterItems.map((item) => (
            <CanvasRenderer
              key={item.id}
              node={item}
              editorType={editorType}
              blockAlignment={blockAlignment}
              rootNode={rootNode}
            />
          ))}
          {resolvedStaticAfter.map((slide) => (
            <CanvasRenderer
              key={slide.id}
              node={slide as BlockNodeWithViewport}
              editorType={editorType}
              blockAlignment={blockAlignment}
              rootNode={rootNode}
            />
          ))}
        </>
      ),
      carouselControls
    )
  }

  return React.createElement(
    node.tagName || 'div',
    {
      ref: (el: HTMLElement | null): void => {
        containerRef.current = el
      },
      style: repeaterContainerStyles,
      'data-element-id': node.id,
      'data-repeater': 'true',
      className: node.attributes?.class || node.attributes?.className || 'repeater-container',
      onClickCapture: handleContainerClick,
      onScroll: isCarouselTrack ? handleTrackScroll : undefined,
    },
    <>
      {staticBeforeSlides.map((slide) => (
        <CanvasRenderer
          key={slide.id}
          node={slide as BlockNodeWithViewport}
          editorType={editorType}
          blockAlignment={blockAlignment}
          rootNode={rootNode}
        />
      ))}
      {repeaterItems.map((item) => (
        <CanvasRenderer
          key={item.id}
          node={item}
          editorType={editorType}
          blockAlignment={blockAlignment}
          rootNode={rootNode}
        />
      ))}
      {staticAfterSlides.map((slide) => (
        <CanvasRenderer
          key={slide.id}
          node={slide as BlockNodeWithViewport}
          editorType={editorType}
          blockAlignment={blockAlignment}
          rootNode={rootNode}
        />
      ))}
    </>
  )
}
