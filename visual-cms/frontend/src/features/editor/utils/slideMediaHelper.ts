import type { BlockNode } from '@/shared/types'
import type { MediaAsset } from '@/shared/api/mediaApi'

/**
 * Построение узла-слайда карусели из медиа-ассета (фото / GIF / видео).
 *
 * Используется кнопкой «Из файлов» в обоих режимах карусели:
 *  - static-режим  (StaticSlidesPanel): слайд кладётся в трек как есть, поэтому
 *    помечаем data-carousel-slide и задаём minHeight для видимости пустого слайда;
 *  - repeat-режим  (SlidesPanel): сырой узел затем прогоняется через
 *    prepareHybridStaticNode (он сам добавит data-carousel-slide и layout-стили).
 *
 * Соответствие kind → слайд:
 *  - image (в т.ч. GIF) → div с background-image (браузер анимирует GIF сам);
 *  - video             → div с data-slide-video=<url>; постером служит
 *                        asset.posterUrl в background-image. Живое <video>
 *                        создаёт CarouselRuntime в деплое; на канвасе виден постер.
 *  - document          → нельзя сделать слайдом → вернётся null.
 */

/** Подмножество MediaAsset, достаточное для постройки слайда. */
export type SlideMediaAsset = Pick<MediaAsset, 'kind' | 'url' | 'posterUrl' | 'id'>

export interface BuildMediaSlideOptions {
  generateId: () => string
  /** Доп. атрибуты узла (например data-carousel-slide для static-режима). */
  extraAttributes?: Record<string, string>
  /** Минимальная высота слайда (static-режим задаёт '240px'). */
  minHeight?: string
  /**
   * Вписывание слайда: 'cover' (обрезать, заполнить) | 'contain' (целиком, с полосами).
   * Управляет background-size фото/постера и data-slide-fit (object-fit видео в рантайме).
   * По умолчанию 'cover'.
   */
  fit?: string
}

/** Позиционирование фона — общее для фото-слайда и постера видео (размер задаётся отдельно через fit). */
const BG_POSITION = {
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
} as const

/**
 * Построить узел-слайд из медиа-ассета.
 * Возвращает null, если ассет — документ (его нельзя сделать слайдом).
 */
export function buildMediaSlideNode(
  asset: SlideMediaAsset,
  opts: BuildMediaSlideOptions
): BlockNode | null {
  if (asset.kind === 'document') return null

  const isVideo = asset.kind === 'video'
  // Для фото/GIF постер = сама картинка; для видео = сгенерированный poster (если есть).
  const poster = isVideo ? asset.posterUrl : asset.url
  const fit = opts.fit || 'cover'

  return {
    id: opts.generateId(),
    tag: 'div',
    tagName: 'div',
    elementType: 'container',
    content: '',
    children: [],
    attributes: {
      ...(opts.extraAttributes || {}),
      // data-slide-fit: рантайм берёт отсюда object-fit видео; для фото дублирует background-size.
      // Ставим всегда, чтобы новый слайд сразу наследовал текущее «Вписывание» слайдера.
      'data-slide-fit': fit,
      ...(isVideo ? { 'data-slide-video': asset.url } : {}),
    },
    metadata: {
      name: isVideo ? 'Видео-слайд' : 'Фото-слайд',
      ...(asset.id ? { mediaAssetId: asset.id } : {}),
    },
    styles: {
      properties: {
        width: '100%',
        ...(opts.minHeight ? { minHeight: opts.minHeight } : {}),
        ...(poster ? { backgroundImage: `url("${poster}")`, backgroundSize: fit, ...BG_POSITION } : {}),
      },
    },
  }
}
