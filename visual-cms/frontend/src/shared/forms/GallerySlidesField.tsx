import React, { useEffect, useState } from 'react'
import { Boxes } from 'lucide-react'
import { blockApi } from '@/shared/api'
import { resolveMediaUrl } from '@/shared/api/mediaApi'
import { cn } from '@/shared/utils'
import { BlockPicker } from '@/features/editor/components/BlockPicker'
import {
  blockIdOf,
  blockSlideUrl,
  focusAt,
  isVideoUrl,
  readGallery,
  slidePosition,
  withUrls,
  writeGallery,
  type GalleryItem,
  type SlideFit,
  type SlideSettings,
  type SlideTheme,
} from './gallerySlides'
import { MediaListField, MediaThumb } from './mediaFields'

/**
 * Галерея слайдов ЖК: ссылки по одной на строку (как раньше) и кадрирование
 * каждого слайда — точка фокуса кликом по превью и режим «заполнить / целиком».
 *
 * Превью показывают крайние пропорции карточки на сайте: она меняется с
 * шириной экрана, и точка, видная в самом широком и самом узком кадре, видна
 * и во всех промежуточных.
 */

/**
 * Крайние пропорции карточки слайдера на сайте (ширина / высота). Высота
 * карточки постоянна (310px), ширина — от колонки: до 1439px секция в одну
 * колонку и карточка на всю ширину (до ~3.9:1), на телефоне ~0.9:1, на ПК
 * шире 1440px — колонка сетки дизайна (1.8–2.4:1, между крайними).
 */
export interface SlideFrame {
  label: string
  hint: string
  /** Ширина / высота кадра на сайте. */
  ratio: number
}

const FRAMES: readonly SlideFrame[] = [
  { label: 'Широкий кадр', hint: 'ноутбук, планшет', ratio: 4 },
  { label: 'Узкий кадр', hint: 'телефон', ratio: 0.9 },
]

/**
 * Крайние пропорции hero: секция на весь экран под шапкой — на ПК около 2:1,
 * на телефоне портрет около 0.55:1.
 */
export const HERO_FRAMES: readonly SlideFrame[] = [
  { label: 'Широкий кадр', hint: 'ПК', ratio: 2 },
  { label: 'Узкий кадр', hint: 'телефон', ratio: 0.55 },
]

const FIT_LABELS: Record<SlideFit, string> = { cover: 'Заполнить', contain: 'Целиком' }

const THEME_OPTIONS: Array<{ value: SlideTheme | null; label: string; title: string }> = [
  { value: null, label: 'Авто', title: 'Фото — по яркости верха, видео — по кадрам, блок — по его фону' },
  { value: 'dark', label: 'Тёмный фон', title: 'Под шапкой тёмное — текст шапки белый' },
  { value: 'light', label: 'Светлый фон', title: 'Под шапкой светлое — текст шапки тёмный' },
]

/** Названия блоков библиотеки для строк слайдов-блоков (загрузка один раз). */
function useBlockNames(enabled: boolean): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    blockApi
      .getReusable()
      .then((blocks) => {
        if (!cancelled) setNames(Object.fromEntries(blocks.map((b) => [b.id, b.name])))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [enabled])
  return names
}

export const GallerySlidesField: React.FC<{
  label: string
  hint?: string
  value: GalleryItem[]
  onChange: (value: GalleryItem[]) => void
  /** Крайние пропорции кадра на сайте; по умолчанию — карточка слайдера. */
  frames?: readonly SlideFrame[]
  /**
   * Тема шапки над каждым слайдом (Авто / Тёмный / Светлый фон). Только там,
   * где шаблон её читает (слайдеры страницы проекта); у новостей — нет.
   */
  withTheme?: boolean
  /** Слайд-блок из библиотеки CMS (`block:<id>`); его разворачивает CMS при публикации. */
  withBlocks?: boolean
}> = ({ label, hint, value, onChange, frames = FRAMES, withTheme = false, withBlocks = false }) => {
  const slides = readGallery(value)
  const [pickerOpen, setPickerOpen] = useState(false)
  const blockNames = useBlockNames(withBlocks && slides.some((s) => blockIdOf(s.url)))

  const update = (index: number, patch: Partial<SlideSettings>) =>
    onChange(writeGallery(slides.map((s, i) => (i === index ? { ...s, ...patch } : s))))

  return (
    <div>
      {/* Свои превью с кадрированием — ниже, миниатюры списка не нужны. */}
      <MediaListField
        label={label}
        hint={hint}
        kind="any"
        thumbnails={false}
        value={slides.map((s) => s.url)}
        onChange={(urls) => onChange(writeGallery(withUrls(slides, urls)))}
      />
      {withBlocks && (
        <>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-700 border border-gray-300 rounded-md bg-white hover:bg-gray-50"
          >
            <Boxes size={14} /> Блок из библиотеки
          </button>
          <BlockPicker
            isOpen={pickerOpen}
            onClose={() => setPickerOpen(false)}
            title="Блок — слайдом"
            forcedMode="linked"
            onPick={({ block }) => {
              setPickerOpen(false)
              onChange(writeGallery([...slides, { url: blockSlideUrl(block.id), focus: null, fit: 'cover', theme: null }]))
            }}
          />
        </>
      )}
      {slides.length > 0 && (
        <div className="mt-2 space-y-2" data-testid="slide-framing">
          {slides.map((slide, i) => {
            const blockId = blockIdOf(slide.url)
            const theme = withTheme ? <ThemeSwitch index={i} value={slide.theme} onChange={(t) => update(i, { theme: t })} /> : null
            return blockId ? (
              <div key={`${i}:${slide.url}`} className="flex gap-3 items-start rounded-md border border-indigo-200 bg-indigo-50/40 p-2" data-testid={`slide-${i}`}>
                <div className="w-28 h-16 shrink-0 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Boxes size={22} />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="text-xs text-gray-700 truncate" title={slide.url}>
                    {i + 1}. Блок «{blockNames[blockId] ?? blockId}»
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Слайд целиком — блок из библиотеки, с его текстами, стилями и переводами. На сайте появится после публикации.
                  </div>
                  {theme}
                </div>
              </div>
            ) : (
              <SlideFramingRow key={`${i}:${slide.url}`} index={i} slide={slide} frames={frames} onChange={(patch) => update(i, patch)}>
                {theme}
              </SlideFramingRow>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Тема шапки сайта над слайдом. */
const ThemeSwitch: React.FC<{ index: number; value: SlideTheme | null; onChange: (theme: SlideTheme | null) => void }> = ({
  index,
  value,
  onChange,
}) => (
  <div className="flex flex-wrap items-center gap-2 text-xs" role="group" aria-label={`Шапка над слайдом ${index + 1}`}>
    <span className="text-gray-500">Шапка над слайдом:</span>
    {THEME_OPTIONS.map((o) => (
      <button
        key={o.label}
        type="button"
        title={o.title}
        onClick={() => onChange(o.value)}
        aria-pressed={value === o.value}
        className={cn(
          'px-2 py-1 rounded border',
          value === o.value ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-300 text-gray-600'
        )}
      >
        {o.label}
      </button>
    ))}
  </div>
)

const SlideFramingRow: React.FC<{
  index: number
  slide: SlideSettings
  frames: readonly SlideFrame[]
  onChange: (patch: Partial<SlideSettings>) => void
  /** Доп. настройки слайда под кадрированием (тема шапки). */
  children?: React.ReactNode
}> = ({ index, slide, frames, onChange, children }) => {
  const contain = slide.fit === 'contain'
  const src = resolveMediaUrl(slide.url)

  const pickFocus = (event: React.MouseEvent<HTMLDivElement>) => {
    if (contain) return
    onChange({ focus: focusAt(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect()) })
  }

  return (
    <div className="flex gap-3 items-start rounded-md border border-gray-200 p-2" data-testid={`slide-${index}`}>
      <div
        role="button"
        tabIndex={-1}
        aria-label="Точка фокуса"
        title={contain ? 'В режиме «Целиком» кадр виден полностью' : 'Клик — точка, которая останется в кадре'}
        onClick={pickFocus}
        className={cn('relative w-28 shrink-0 select-none', contain ? 'cursor-default opacity-60' : 'cursor-crosshair')}
        data-testid={`focus-${index}`}
      >
        <MediaThumb src={src} video={isVideoUrl(slide.url)} className="block w-full h-auto rounded" />
        {!contain && (
          <span
            className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 border-white bg-primary-500 shadow pointer-events-none"
            style={{ left: `${slide.focus?.x ?? 50}%`, top: `${slide.focus?.y ?? 50}%` }}
            data-testid={`focus-dot-${index}`}
          />
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="text-xs text-gray-500 truncate" title={slide.url}>
          {index + 1}. {slide.url}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {(Object.keys(FIT_LABELS) as SlideFit[]).map((fit) => (
            <button
              key={fit}
              type="button"
              onClick={() => onChange({ fit })}
              aria-pressed={slide.fit === fit}
              className={cn(
                'px-2 py-1 rounded border',
                slide.fit === fit ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-300 text-gray-600'
              )}
            >
              {FIT_LABELS[fit]}
            </button>
          ))}
          {!contain && slide.focus && (
            <button type="button" onClick={() => onChange({ focus: null })} className="px-2 py-1 text-gray-500 hover:text-gray-700">
              В центр
            </button>
          )}
        </div>
        {children}
        <div className="flex flex-wrap gap-3 items-end">
          {frames.map((frame) => (
            <figure key={frame.label} className="m-0">
              <FramePreview src={src} slide={slide} ratio={frame.ratio} />
              <figcaption className="mt-1 text-[11px] text-gray-400">
                {frame.label} <span className="text-gray-300">· {frame.hint}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Кадр слайда в пропорции карточки — так, как его покажет сайт. */
const FramePreview: React.FC<{ src: string; slide: SlideSettings; ratio: number }> = ({ src, slide, ratio }) => {
  const video = isVideoUrl(slide.url)
  const contain = slide.fit === 'contain'
  const position = slidePosition(slide)
  return (
    <div
      className="relative overflow-hidden rounded bg-gray-100"
      style={{ height: 64, width: Math.round(64 * ratio) }}
      data-testid="frame-preview"
      data-position={position}
      data-fit={slide.fit}
    >
      {contain && (
        <MediaThumb
          src={src}
          video={video}
          className="absolute -inset-2 w-[calc(100%+1rem)] h-[calc(100%+1rem)] max-w-none object-cover blur-md brightness-90"
        />
      )}
      <MediaThumb
        src={src}
        video={video}
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: slide.fit, objectPosition: position }}
      />
    </div>
  )
}
