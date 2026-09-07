import type { BlockNode } from '@/shared/types'

/**
 * Атрибуты автопрокрутки на корне карусели (читает CarouselRuntime):
 *   data-carousel-autoplay="<ms>" — интервал автолистания в мс (0/нет = выкл);
 *   data-carousel-loop="false"    — отключить зацикленность (по умолчанию рантайм = true).
 */
export const AUTOPLAY_ATTR = 'data-carousel-autoplay'
export const LOOP_ATTR = 'data-carousel-loop'
/** При автоплее видео-слайды листаются только после окончания видео. */
export const VIDEO_WAIT_ATTR = 'data-carousel-video-wait'
export const DEFAULT_DELAY_MS = 5000
export const MIN_SECONDS = 0.5

/** Текущий интервал автоплея в мс (0, если не задан/невалиден/≤0). */
export function readAutoplayMs(node: BlockNode): number {
  const raw = node.attributes?.[AUTOPLAY_ATTR]
  const n = raw ? parseInt(raw, 10) : 0
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Тип перехода между слайдами (читает CarouselRuntime):
 *   data-carousel-effect="<id>"   — вид перехода, отсутствие = 'slide';
 *   data-carousel-duration="<ms>" — длительность, отсутствие = дефолт эффекта.
 */
export const EFFECT_ATTR = 'data-carousel-effect'
export const DURATION_ATTR = 'data-carousel-duration'

export interface CarouselEffect {
  id: string
  label: string
  hint: string
  /** Длительность рантайма по умолчанию, мс. Показываем её как placeholder. */
  defaultMs: number
}

/** Порядок = порядок в выпадающем списке: сначала привычные, потом мгновенный. */
export const CAROUSEL_EFFECTS: CarouselEffect[] = [
  { id: 'slide', label: 'Сдвиг по горизонтали', hint: 'Слайды едут влево-вправо', defaultMs: 500 },
  { id: 'slide-vertical', label: 'Сдвиг по вертикали', hint: 'Слайды едут вверх-вниз', defaultMs: 500 },
  { id: 'fade', label: 'Перетекание', hint: 'Слайды плавно проступают друг сквозь друга', defaultMs: 600 },
  { id: 'zoom', label: 'Наплыв с отдалением', hint: 'Новый слайд проступает, уменьшаясь до масштаба', defaultMs: 600 },
  { id: 'zoom-out', label: 'Наплыв с приближением', hint: 'Новый слайд проступает, вырастая до масштаба', defaultMs: 600 },
  { id: 'none', label: 'Без анимации', hint: 'Мгновенная смена кадра', defaultMs: 0 },
]

export const DEFAULT_EFFECT_ID = 'slide'

/** Текущий эффект узла. Неизвестное значение трактуем как дефолт — так же, как рантайм. */
export function readEffect(node: BlockNode): CarouselEffect {
  const raw = node.attributes?.[EFFECT_ATTR]
  return CAROUSEL_EFFECTS.find((e) => e.id === raw)
    || CAROUSEL_EFFECTS.find((e) => e.id === DEFAULT_EFFECT_ID)!
}

/** Заданная вручную длительность в мс, либо null — тогда действует дефолт эффекта. */
export function readDurationMs(node: BlockNode): number | null {
  const raw = node.attributes?.[DURATION_ATTR]
  if (raw === undefined || raw === '') return null
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 ? n : null
}
