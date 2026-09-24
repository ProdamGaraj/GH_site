import React from 'react'
import { resolveMediaUrl } from '@/shared/api/mediaApi'
import { cn } from '@/shared/utils'
import {
  focusAt,
  isVideoUrl,
  readGallery,
  slidePosition,
  withUrls,
  writeGallery,
  type GalleryItem,
  type SlideFit,
  type SlideSettings,
} from '../gallerySlides'
import { StringListField } from './fields'

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
const FRAMES = [
  { label: 'Широкий кадр', hint: 'ноутбук, планшет', ratio: 4 },
  { label: 'Узкий кадр', hint: 'телефон', ratio: 0.9 },
] as const

const FIT_LABELS: Record<SlideFit, string> = { cover: 'Заполнить', contain: 'Целиком' }

export const GallerySlidesField: React.FC<{
  label: string
  hint?: string
  value: GalleryItem[]
  onChange: (value: GalleryItem[]) => void
}> = ({ label, hint, value, onChange }) => {
  const slides = readGallery(value)

  const update = (index: number, patch: Partial<SlideSettings>) =>
    onChange(writeGallery(slides.map((s, i) => (i === index ? { ...s, ...patch } : s))))

  return (
    <div>
      <StringListField
        label={label}
        hint={hint}
        value={slides.map((s) => s.url)}
        onChange={(urls) => onChange(writeGallery(withUrls(slides, urls)))}
      />
      {slides.length > 0 && (
        <div className="mt-2 space-y-2" data-testid="slide-framing">
          {slides.map((slide, i) => (
            <SlideFramingRow key={`${i}:${slide.url}`} index={i} slide={slide} onChange={(patch) => update(i, patch)} />
          ))}
        </div>
      )}
    </div>
  )
}

const SlideFramingRow: React.FC<{
  index: number
  slide: SlideSettings
  onChange: (patch: Partial<SlideSettings>) => void
}> = ({ index, slide, onChange }) => {
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
        <SlideMedia src={src} video={isVideoUrl(slide.url)} className="block w-full h-auto rounded" />
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
        <div className="flex flex-wrap gap-3 items-end">
          {FRAMES.map((frame) => (
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
        <SlideMedia
          src={src}
          video={video}
          className="absolute -inset-2 w-[calc(100%+1rem)] h-[calc(100%+1rem)] max-w-none object-cover blur-md brightness-90"
        />
      )}
      <SlideMedia
        src={src}
        video={video}
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: slide.fit, objectPosition: position }}
      />
    </div>
  )
}

/** Фото или первый кадр видео (без звука и без интерфейса плеера). */
const SlideMedia: React.FC<{ src: string; video: boolean; className?: string; style?: React.CSSProperties }> = ({
  src,
  video,
  className,
  style,
}) =>
  video ? (
    <video src={src} muted playsInline preload="metadata" className={className} style={style} />
  ) : (
    <img src={src} alt="" loading="lazy" draggable={false} className={className} style={style} />
  )
