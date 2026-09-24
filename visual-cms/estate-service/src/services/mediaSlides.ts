/**
 * Слайды медиа-каруселей страницы проекта: «О проекте», холлы, двор.
 *
 * Галереи ЖК — списки ссылок, и в них теперь можно класть и фото, и видео:
 * ссылка на видеофайл становится видеослайдом. Шаблон повторяет слайд по
 * этому списку и привязывает фон к `image`, а `data-slide-video` к `video`:
 * рантайм карусели сам создаёт у видеослайда <video> без интерфейса плеера
 * (без звука, по кругу, играет только активный слайд). Условий в движке
 * шаблонов нет, поэтому «фото или видео» решается здесь.
 *
 * Кадрирование. Карточка слайдера меняет пропорции с шириной экрана (на ПК
 * широкая полоса, на планшете почти квадрат), а фото бывают и вертикальные.
 * Поэтому у слайда не рамка обрезки, а точка фокуса — она остаётся в кадре при
 * любой пропорции, — и режим вписывания: «заполнить» (обрезка вокруг фокуса)
 * или «целиком» (кадр полностью, по бокам размытая подложка из него же).
 *
 * Элемент галереи в базе — ссылка строкой (слайд без настроек) или объект
 * {url, focus, fit}. Строки остаются валидными: старые данные и сиды не
 * требуют переноса, а админка пишет объект только когда есть настройки.
 *
 * Чистые функции без БД.
 */

/** Вписывание слайда: cover — заполнить с обрезкой, contain — целиком. */
export type SlideFit = 'cover' | 'contain'

/** Точка фокуса в процентах от ширины и высоты кадра, 0..100. */
export interface SlideFocus {
  x: number
  y: number
}

/** Элемент галереи ЖК, как он лежит в базе. */
export type GalleryItem = string | { url: string; focus?: SlideFocus; fit?: SlideFit }

export interface MediaSlide {
  /** Исходная ссылка из галереи. */
  url: string
  /** Фон слайда: само фото или постер видео. */
  image: string
  /** Видео слайда; пусто — слайд-фото. */
  video: string
  /** Точка фокуса для background-position и object-position видео, «x% y%». */
  position: string
  /** Вписывание: шаблон пишет его в data-slide-fit. */
  fit: SlideFit
}

/** Центр кадра — позиция слайда без фокуса и в режиме «целиком». */
export const CENTER_POSITION = '50% 50%'

const VIDEO_RE = /\.(mp4|webm|mov|m4v|ogv)(?:[?#].*)?$/i

export function isVideoUrl(url: string): boolean {
  return VIDEO_RE.test(url.trim())
}

/** Элемент галереи после разбора: всегда объект, без мусора. */
export interface GallerySlideSettings {
  url: string
  focus: SlideFocus | null
  fit: SlideFit
}

function percent(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.min(100, Math.max(0, value))
}

function readFocus(value: unknown): SlideFocus | null {
  if (!value || typeof value !== 'object') return null
  const x = percent((value as Record<string, unknown>).x)
  const y = percent((value as Record<string, unknown>).y)
  return x === null || y === null ? null : { x, y }
}

/**
 * Галерея из базы → список настроек слайдов. Строка — слайд без настроек;
 * объект без ссылки, пустые строки и прочий мусор отбрасываются. Не массив —
 * пустой список: колонка jsonb могла быть заполнена руками.
 */
export function readGallery(value: unknown): GallerySlideSettings[] {
  if (!Array.isArray(value)) return []
  const out: GallerySlideSettings[] = []
  for (const raw of value) {
    if (typeof raw === 'string') {
      const url = raw.trim()
      if (url) out.push({ url, focus: null, fit: 'cover' })
      continue
    }
    if (!raw || typeof raw !== 'object') continue
    const item = raw as Record<string, unknown>
    const url = typeof item.url === 'string' ? item.url.trim() : ''
    if (!url) continue
    out.push({ url, focus: readFocus(item.focus), fit: item.fit === 'contain' ? 'contain' : 'cover' })
  }
  return out
}

/** Только ссылки галереи — для полей DTO, которые отдают список строк. */
export function galleryUrls(value: unknown): string[] {
  return readGallery(value).map((item) => item.url)
}

/**
 * Позиция кадра. В режиме «целиком» кадр виден полностью, и фокус только
 * сдвинул бы видео к краю полосы — поэтому центр.
 */
function positionOf(item: GallerySlideSettings): string {
  if (item.fit === 'contain' || !item.focus) return CENTER_POSITION
  return `${item.focus.x}% ${item.focus.y}%`
}

/** Слайд без настроек кадрирования. */
function plainSlide(url: string, image: string, video: string): MediaSlide {
  return { url, image, video, position: CENTER_POSITION, fit: 'cover' }
}

/**
 * Галерея → слайды. Постер видео — первое фото той же галереи (оно
 * по смыслу ближе всего), а если фото в ней нет — `fallbackPoster`.
 */
export function toSlides(value: unknown, fallbackPoster = ''): MediaSlide[] {
  const items = readGallery(value)
  const poster = items.find((item) => !isVideoUrl(item.url))?.url ?? fallbackPoster.trim()
  return items.map((item) => {
    const video = isVideoUrl(item.url)
    return {
      url: item.url,
      image: video ? poster : item.url,
      video: video ? item.url : '',
      position: positionOf(item),
      fit: item.fit,
    }
  })
}

/**
 * Слайды «О проекте».
 *
 * Источник — «Общая галерея» ЖК (в админке: «О проекте — слайды»). Пока она
 * пуста, карточка ведёт себя как раньше: видео «О проекте», а без него —
 * картинка проекта. Так существующие ЖК не требуют переноса данных.
 */
export function aboutSlides(complex: { gallery?: unknown; aboutVideo?: string | null; media?: string | null }): MediaSlide[] {
  const media = (complex.media || '').trim()
  const gallery = toSlides(complex.gallery, media)
  if (gallery.length > 0) return gallery
  const video = (complex.aboutVideo || '').trim()
  if (video) return [plainSlide(video, media, video)]
  return media ? [plainSlide(media, media, '')] : []
}
