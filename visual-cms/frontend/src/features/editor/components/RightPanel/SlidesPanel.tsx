import React, { useEffect, useMemo, useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  deleteNode,
  insertPreparedNode,
  reorderNode,
  selectActiveRightPanel,
  selectNode,
  selectSelectedNode,
  selectRootNode,
} from '@/features/editor/editorSlice'
import { selectAllBindings, bumpBindingsVersion } from '@/features/dataBindings/dataBindingsSlice'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Plus, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/shared/components/Button'
import { pageApi, type PageVariable, type PageVariablesEnvelope } from '@/shared/api'
import { MediaPicker } from '@/features/media/MediaPicker'
import {
  createBlockReferenceNode,
  deepCloneNode,
  findTrackNode,
  findCarouselRootFor,
  getCarouselMode,
} from '@/features/editor/utils/carouselHelpers'
import {
  findRepeaterBinding,
  getMapperSchema,
  isSlideFieldVisible,
  type MapperField,
} from '@/features/editor/utils/bindingMapperHelper'
import { getRepeatTemplate } from '@/features/editor/utils/repeatTemplateHelper'
import {
  getStaticBefore,
  getStaticAfter,
  getHybridStaticDisplayName,
  prepareHybridStaticNode,
} from '@/features/editor/utils/hybridStaticHelper'
import { generateId } from '@/shared/utils'
import type { Block, BlockNode } from '@/shared/types'
import { BlockPicker, type BlockPickerSelection } from '@/features/editor/components/BlockPicker'
import { StaticSlidesPanel } from './StaticSlidesPanel'
import { RepeatTemplatePicker } from './RepeatTemplatePicker'
import { RepeatSourcePicker } from './RepeatSourcePicker'
import { GenericSlideRow } from './GenericSlideRow'
import { HybridStaticRow } from './HybridStaticRow'

const DEFAULT_VARIABLE_NAME = 'heroSlides'

type RawSlide = Record<string, unknown>

/** Стабильный uuid для DnD-ключа. */
const genId = (): string => {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (c?.randomUUID) return c.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0
    const v = ch === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Гарантирует, что у каждого слайда есть _id (служебный ключ для DnD/key). */
const ensureSlideIds = (raw: unknown): RawSlide[] => {
  if (!Array.isArray(raw)) return []
  return raw.map(item => {
    const obj = item && typeof item === 'object' ? { ...(item as RawSlide) } : ({} as RawSlide)
    if (typeof obj._id !== 'string' || !obj._id) obj._id = genId()
    return obj
  })
}

const rawSlidesFromEnvelope = (
  envelope: PageVariablesEnvelope | null | undefined,
  variableName: string
): RawSlide[] => {
  const v = envelope?.variables?.find(x => x.name === variableName)
  return ensureSlideIds(v?.defaultValue)
}

const writeRawSlidesToEnvelope = (
  envelope: PageVariablesEnvelope | null | undefined,
  variableName: string,
  slides: RawSlide[]
): PageVariablesEnvelope => {
  const existing = envelope?.variables ?? []
  const idx = existing.findIndex(v => v.name === variableName)
  if (idx === -1) {
    const created: PageVariable = {
      id: genId(),
      name: variableName,
      type: 'array',
      defaultValue: slides,
    }
    return { variables: [...existing, created] }
  }
  const updated: PageVariable = { ...existing[idx], type: 'array', defaultValue: slides }
  const next = existing.slice()
  next[idx] = updated
  return { variables: next }
}

/** Валидация slide'ов по mapper-схеме. */
const validateRawSlides = (slides: RawSlide[], schema: MapperField[]): string[] => {
  const errors: string[] = []
  if (slides.length === 0) {
    errors.push('Должен быть хотя бы один слайд')
    return errors
  }
  slides.forEach((s, i) => {
    const label = `Слайд ${i + 1}`
    schema.forEach(f => {
      // Скрытый блок (чекбокс «Отображать» снят) не обязателен к заполнению.
      if (!isSlideFieldVisible(s, f.sourceField)) return
      const v = s[f.sourceField]
      const str = typeof v === 'string' ? v.trim() : ''
      if (f.kind === 'media' && !str) {
        errors.push(`${label}: не задано поле «${f.label}»`)
      }
      if (f.kind === 'url' && str && !/^(\/|https?:\/\/)/.test(str)) {
        errors.push(`${label}: «${f.label}» должно начинаться с / или http(s)://`)
      }
    })
  })
  return errors
}

/** Создать пустой слайд на основе schema (все поля = ''). */
const createEmptyRawSlide = (schema: MapperField[]): RawSlide => {
  const s: RawSlide = { _id: genId(), alignment: 'center' }
  for (const f of schema) s[f.sourceField] = ''
  return s
}

interface SlidesPanelProps {
  pageId?: string
}

/**
 * Универсальный редактор слайдов карусели.
 * Активируется на любом узле с data-carousel="true".
 * Имя переменной берётся из data-carousel-variable (fallback: heroSlides).
 *
 * Архитектурный инвариант: новые блоки-карусели работают без изменений в этом
 * компоненте — достаточно поставить data-carousel="true" + data-carousel-variable="<name>".
 */
export const SlidesPanel: React.FC<SlidesPanelProps> = ({ pageId }) => {
  const dispatch = useAppDispatch()
  const activePanel = useAppSelector(selectActiveRightPanel)
  const selectedNode = useAppSelector(selectSelectedNode)
  const rootNode = useAppSelector(selectRootNode)
  const allBindings = useAppSelector(selectAllBindings)

  // Карусель, к которой относится панель: сам выбранный узел, если он карусель,
  // иначе ближайший предок-карусель. Так выбор слайда-ребёнка (клик по строке
  // в списке) не закрывает панель, а используется для позиционирования вставки.
  const node = useMemo(
    () => findCarouselRootFor(rootNode, selectedNode?.id) || selectedNode,
    [rootNode, selectedNode]
  )

  const isCarousel = node?.attributes?.['data-carousel'] === 'true'
  const variableName = node?.attributes?.['data-carousel-variable'] || DEFAULT_VARIABLE_NAME

  // Определяем режим карусели: static (произвольные слайды) или repeat (репитер по данным).
  // findTrackNode/getCarouselMode безопасны для null-входа.
  const track = useMemo(() => findTrackNode(node), [node])
  const mode = useMemo(() => getCarouselMode(node, allBindings), [node, allBindings])
  const template = useMemo(() => getRepeatTemplate(track), [track])
  const staticBefore = useMemo(() => getStaticBefore(track, template), [track, template])
  const staticAfter = useMemo(() => getStaticAfter(track, template), [track, template])

  const [envelope, setEnvelope] = useState<PageVariablesEnvelope | null>(null)
  const [slides, setSlides] = useState<RawSlide[]>([])
  const [siteId, setSiteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  // Контекст MediaPicker: {slideId, sourceField} — чтобы знать, какое поле какого слайда правим.
  const [pickerCtx, setPickerCtx] = useState<{ slideId: string; sourceField: string } | null>(null)
  const [staticPickerOpen, setStaticPickerOpen] = useState(false)
  // Отдельный MediaPicker для добавления слайда-фотографии (только картинка во весь слайд).
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false)

  // Repeater-binding для track-узла. Источник истины fieldMappings → mapper-схема UI.
  const binding = useMemo(
    () => findRepeaterBinding(allBindings, track?.id, pageId),
    [allBindings, track?.id, pageId]
  )
  const schema = useMemo(
    () => getMapperSchema(binding?.config?.inputConfig?.fieldMappings),
    [binding]
  )

  // Подгружаем data-settings + siteId при открытии панели на карусель-узле.
  // Только для repeat-режима (static-режим не работает с page-variables).
  useEffect(() => {
    if (!pageId || !isCarousel || activePanel !== 'slides' || mode !== 'repeat') return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([pageApi.getDataSettings(pageId), pageApi.getById(pageId)])
      .then(([settings, page]) => {
        if (cancelled) return
        const env = settings.variables ?? { variables: [] }
        setEnvelope(env)
        setSlides(rawSlidesFromEnvelope(env, variableName))
        setSiteId((page as { siteId?: string | null }).siteId ?? null)
        setDirty(false)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Не удалось загрузить данные страницы')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [pageId, variableName, activePanel, isCarousel, mode])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const errors = useMemo(() => validateRawSlides(slides, schema), [slides, schema])

  if (!node) {
    return <div className="p-4 text-sm text-gray-500">Выберите элемент карусели в дереве слоёв.</div>
  }
  if (!isCarousel) {
    return (
      <div className="p-4 text-sm text-gray-500 space-y-2">
        <p className="font-medium text-gray-700">Это не карусель</p>
        <p>
          Чтобы редактировать слайды, выделите элемент с атрибутом{' '}
          <code className="bg-gray-100 px-1 rounded">data-carousel="true"</code>.
        </p>
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────
  // STATIC-режим: гетерогенные слайды, редактируются через дерево + BlockPicker.
  // Не зависит от pageId / data-settings.
  // ──────────────────────────────────────────────────────────────────────
  if (mode === 'static') {
    if (!track) {
      return (
        <div className="p-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded space-y-1">
          <p className="font-medium">Структура карусели сломана</p>
          <p>
            Внутри элемента с <code className="bg-white/60 px-1 rounded">data-carousel="true"</code>{' '}
            нет дочернего узла с{' '}
            <code className="bg-white/60 px-1 rounded">data-carousel-track="true"</code>.
          </p>
        </div>
      )
    }
    return (
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-gray-900">Слайды карусели</h3>
          <p className="text-xs text-gray-500">Управляются как обычные блоки в треке.</p>
        </div>
        <StaticSlidesPanel track={track} />
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────
  // REPEAT-режим: исходный UI слайдов из page-variable.
  // ──────────────────────────────────────────────────────────────────────
  if (!pageId) {
    return <div className="p-4 text-sm text-gray-500">Слайды доступны только в контексте страницы.</div>
  }
  if (loading) {
    return <div className="p-4 text-sm text-gray-500">Загрузка слайдов…</div>
  }

  const updateSlide = (id: string, next: RawSlide) => {
    setSlides(prev => prev.map(s => (s._id === id ? next : s)))
    setDirty(true)
  }

  const removeSlide = (id: string) => {
    if (!confirm('Удалить слайд?')) return
    setSlides(prev => prev.filter(s => s._id !== id))
    setDirty(true)
  }

  const duplicateSlide = (id: string) => {
    setSlides(prev => {
      const idx = prev.findIndex(s => s._id === id)
      if (idx === -1) return prev
      const copy: RawSlide = { ...prev[idx], _id: genId() }
      const next = prev.slice()
      next.splice(idx + 1, 0, copy)
      return next
    })
    setDirty(true)
  }

  const addSlide = () => {
    const s = createEmptyRawSlide(schema)
    setSlides(prev => [...prev, s])
    setExpanded(prev => ({ ...prev, [s._id as string]: true }))
    setDirty(true)
  }

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const activeId = String(active.id)
    const overId = String(over.id)

    const slideIds = slides.map(s => s._id as string)
    const beforeIds = staticBefore.map(s => s.id)
    const afterIds = staticAfter.map(s => s.id)
    const allStaticIds = [...beforeIds, ...afterIds]

    const activeIsSlide = slideIds.includes(activeId)
    const overIsSlide = slideIds.includes(overId)
    const activeIsStatic = allStaticIds.includes(activeId)
    const overIsStatic = allStaticIds.includes(overId)

    // Случай 1: оба — generated (элементы массива). Reorder в массиве.
    if (activeIsSlide && overIsSlide) {
      setSlides(prev => {
        const from = prev.findIndex(s => s._id === activeId)
        const to = prev.findIndex(s => s._id === overId)
        if (from === -1 || to === -1) return prev
        return arrayMove(prev, from, to)
      })
      setDirty(true)
      return
    }

    // Случай 2: оба — static. Reorder детей трека через editorSlice.
    if (activeIsStatic && overIsStatic && track) {
      const trackChildrenIds = track.children.map(c => c.id)
      const fromIdx = trackChildrenIds.indexOf(activeId)
      // newIndex для reorderNode: позиция over в массиве track.children (ДО удаления active).
      const toIdx = trackChildrenIds.indexOf(overId)
      if (fromIdx === -1 || toIdx === -1) return
      // reorderNode internally adjusts: currentIndex < newIndex ? newIndex - 1 : newIndex.
      // Для перемещения «на позицию over» передаём индекс over напрямую.
      dispatch(reorderNode({ nodeId: activeId, parentId: track.id, newIndex: toIdx }))
      return
    }

    // Случай 3: static → generated. Перемещаем static на сторону template
    // (до или после) в зависимости от того, в какую половину generated упал drop.
    if (activeIsStatic && overIsSlide && track && template) {
      const overSlideIdx = slideIds.indexOf(overId)
      const half = slideIds.length / 2
      const targetSide: 'before' | 'after' = overSlideIdx < half ? 'before' : 'after'
      const tplIdxInTrack = track.children.findIndex(c => c.id === template.id)
      if (tplIdxInTrack === -1) return
      // newIndex для reorderNode:
      //  - 'before': хотим встать НЕПОСРЕДСТВЕННО перед template → индекс template
      //  - 'after':  хотим встать НЕПОСРЕДСТВЕННО после template → индекс template + 1
      const newIndex = targetSide === 'before' ? tplIdxInTrack : tplIdxInTrack + 1
      dispatch(reorderNode({ nodeId: activeId, parentId: track.id, newIndex }))
      return
    }

    // Случай 4: generated → static. Запрещено (visual feedback only).
    // Generated живут как массив page-variable, их нельзя «вставить» между static-children.
  }

  const handleSave = async () => {
    if (errors.length > 0) {
      alert('Исправьте ошибки:\n• ' + errors.join('\n• '))
      return
    }
    setSaving(true)
    setError(null)
    try {
      const next = writeRawSlidesToEnvelope(envelope, variableName, slides)
      const resp = await pageApi.updateVariables(pageId, next)
      setEnvelope(resp.variables)
      setDirty(false)
      // Источник данных репитера (page-переменная) изменился, но сама привязка — нет.
      // Бампаем версию привязок, чтобы RepeaterRenderer на канвасе перезапросил данные
      // и показал свежие слайды без перезагрузки страницы.
      dispatch(bumpBindingsVersion())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  // ─── Hybrid-static handlers (работают через editorSlice сразу, без dirty) ──

  // Позиция вставки нового static/photo слайда в трек:
  //  - если в списке выбран слайд этого трека → вставляем сразу ПОСЛЕ него
  //    (это и есть «вставка в середину»: кликни слайд → добавь рядом);
  //  - иначе → после template'а и существующих static-after (в конец группы).
  const computeStaticInsertPosition = (): number | undefined => {
    if (!track) return undefined
    const selId = selectedNode?.id
    if (selId) {
      const selIdx = track.children.findIndex(c => c.id === selId)
      if (selIdx !== -1) return selIdx + 1
    }
    const tplIdx = track.children.findIndex(c => c.id === template?.id)
    return tplIdx === -1 ? undefined : tplIdx + 1 + staticAfter.length
  }

  const handleStaticPick = (selection: BlockPickerSelection) => {
    if (!track) return
    const { block, mode: pickMode } = selection
    const raw = createBlockReferenceNode(block as Block, pickMode, { generateId })
    const node = prepareHybridStaticNode(raw, template)
    dispatch(insertPreparedNode({ parentId: track.id, node, position: computeStaticInsertPosition() }))
  }
  // Слайд-фотография: статический слайд, контент которого — только фон-картинка во весь слайд.
  // Технически это hybrid-static-слайд (рендерится как есть и на канвасе, и в деплое),
  // поэтому переиспользуем prepareHybridStaticNode + insertPreparedNode, как для «Статический».
  const handleAddPhotoSlide = (asset: { url: string; id?: string }) => {
    if (!track) return
    const raw: BlockNode = {
      id: generateId(),
      tag: 'div',
      tagName: 'div',
      elementType: 'container',
      content: '',
      children: [],
      attributes: {},
      metadata: { name: 'Фото-слайд', ...(asset.id ? { mediaAssetId: asset.id } : {}) },
      styles: {
        properties: {
          width: '100%',
          backgroundImage: `url("${asset.url}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        },
      },
    }
    const node = prepareHybridStaticNode(raw, template)
    dispatch(insertPreparedNode({ parentId: track.id, node, position: computeStaticInsertPosition() }))
  }
  const handleStaticDuplicate = (slide: { id: string }) => {
    if (!track) return
    const original = track.children.find(c => c.id === slide.id)
    if (!original) return
    const copy = prepareHybridStaticNode(deepCloneNode(original, generateId), template)
    const idx = track.children.findIndex(c => c.id === slide.id)
    dispatch(insertPreparedNode({ parentId: track.id, node: copy, position: idx + 1 }))
  }
  const handleStaticDelete = (slide: { id: string }) => {
    const target = track?.children.find(c => c.id === slide.id)
    if (!target) return
    if (!confirm(`Удалить статический слайд "${getHybridStaticDisplayName(target)}"?`)) return
    dispatch(deleteNode(slide.id))
  }
  const handleStaticSelect = (slideId: string) => {
    dispatch(selectNode(slideId))
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Слайды карусели</h3>
          <p className="text-xs text-gray-500">
            Переменная: <code className="bg-gray-100 px-1 rounded">{variableName}</code>
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
      </div>

      <div className="rounded border border-purple-200 bg-purple-50 p-2 text-xs text-purple-900">
        <div className="font-medium mb-0.5">Режим: повторение по данным</div>
        <div className="text-purple-800/80">
          Слайды генерируются из переменной страницы. Шаблон одного слайда лежит первым в треке
          и клонируется для каждого элемента массива.
        </div>
      </div>

      {track && <RepeatTemplatePicker track={track} />}

      <RepeatSourcePicker
        carouselRoot={node}
        envelope={envelope}
        pageId={pageId}
        onEnvelopeChanged={(next) => {
          setEnvelope(next)
          setSlides(rawSlidesFromEnvelope(next, variableName))
        }}
      />

      {!binding && track && (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded space-y-1">
          <div className="font-medium">Нет привязки к источнику данных</div>
          <p>
            Для этой карусели не настроен <code className="bg-white/60 px-1 rounded">DataBinding</code>{' '}
            режима <code className="bg-white/60 px-1 rounded">repeater</code> на узле трека.
            Настройте его в панели «Привязки данных», после чего здесь появится универсальный редактор
            полей слайда.
          </p>
        </div>
      )}

      {binding && schema.length === 0 && (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded">
          Binding найден, но в нём пустой <code className="bg-white/60 px-1 rounded">fieldMappings</code>.
          Добавьте сопоставления полей в настройках binding'а.
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-2 rounded">{error}</div>
      )}
      {errors.length > 0 && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded space-y-0.5">
          {errors.map((e, i) => (
            <div key={i}>• {e}</div>
          ))}
        </div>
      )}

      {binding && schema.length > 0 && (
        <>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext
              items={[
                ...staticBefore.map(s => s.id),
                ...slides.map(s => s._id as string),
                ...staticAfter.map(s => s.id),
              ]}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {staticBefore.map((s, i) => (
                  <HybridStaticRow
                    key={s.id}
                    slide={s}
                    displayIndex={i + 1}
                    selected={s.id === selectedNode?.id}
                    onSelect={() => handleStaticSelect(s.id)}
                    onDelete={() => handleStaticDelete(s)}
                    onDuplicate={() => handleStaticDuplicate(s)}
                  />
                ))}
                {slides.map((s, i) => {
                  const id = s._id as string
                  return (
                    <GenericSlideRow
                      key={id}
                      index={staticBefore.length + i}
                      slide={s}
                      schema={schema}
                      expanded={!!expanded[id]}
                      onToggle={() => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))}
                      onChange={next => updateSlide(id, next)}
                      onDelete={() => removeSlide(id)}
                      onDuplicate={() => duplicateSlide(id)}
                      onPickMedia={sourceField => setPickerCtx({ slideId: id, sourceField })}
                    />
                  )
                })}
                {staticAfter.map((s, i) => (
                  <HybridStaticRow
                    key={s.id}
                    slide={s}
                    displayIndex={staticBefore.length + slides.length + i + 1}
                    selected={s.id === selectedNode?.id}
                    onSelect={() => handleStaticSelect(s.id)}
                    onDelete={() => handleStaticDelete(s)}
                    onDuplicate={() => handleStaticDuplicate(s)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={addSlide} className="flex-1">
              + Слайд по шаблону
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setStaticPickerOpen(true)}
              className="flex-1"
              title="Вставить статический блок из библиотеки в карусель"
            >
              <Plus size={13} className="mr-1" /> Статический
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPhotoPickerOpen(true)}
              className="flex-1"
              title="Добавить слайд-фотографию (картинка во весь слайд)"
            >
              <ImageIcon size={13} className="mr-1" /> Фото
            </Button>
          </div>

          <p className="text-[11px] text-gray-500 leading-snug">
            <span className="text-emerald-700 font-medium">Static</span>-слайды можно перетащить
            в любое место списка — попадая в зону сгенерированных, статический слайд встаёт
            до или после блока повторов (в зависимости от половины). Перетаскивать сами
            сгенерированные слайды можно только между собой.
          </p>
        </>
      )}

      <BlockPicker
        isOpen={staticPickerOpen}
        onClose={() => setStaticPickerOpen(false)}
        onPick={handleStaticPick}
        title="Добавить статический слайд из библиотеки"
      />

      <MediaPicker
        open={pickerCtx !== null}
        kind="image"
        siteId={siteId}
        title="Выберите медиафайл"
        onClose={() => setPickerCtx(null)}
        onSelect={asset => {
          if (pickerCtx) {
            const target = slides.find(s => s._id === pickerCtx.slideId)
            if (target) {
              const next: RawSlide = { ...target }
              next[pickerCtx.sourceField] = asset.url
              next[`_${pickerCtx.sourceField}AssetId`] = asset.id
              updateSlide(pickerCtx.slideId, next)
            }
          }
          setPickerCtx(null)
        }}
      />

      <MediaPicker
        open={photoPickerOpen}
        kind="image"
        siteId={siteId}
        title="Выберите фото для слайда"
        onClose={() => setPhotoPickerOpen(false)}
        onSelect={asset => {
          handleAddPhotoSlide(asset)
          setPhotoPickerOpen(false)
        }}
      />
    </div>
  )
}
