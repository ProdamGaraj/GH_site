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
 * Чистые функции без БД.
 */

export interface MediaSlide {
  /** Исходная ссылка из галереи. */
  url: string
  /** Фон слайда: само фото или постер видео. */
  image: string
  /** Видео слайда; пусто — слайд-фото. */
  video: string
}

const VIDEO_RE = /\.(mp4|webm|mov|m4v|ogv)(?:[?#].*)?$/i

export function isVideoUrl(url: string): boolean {
  return VIDEO_RE.test(url.trim())
}

function cleanUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean)
}

/**
 * Список ссылок → слайды. Постер видео — первое фото той же галереи (оно
 * по смыслу ближе всего), а если фото в ней нет — `fallbackPoster`.
 */
export function toSlides(urls: unknown, fallbackPoster = ''): MediaSlide[] {
  const list = cleanUrls(urls)
  const poster = list.find((u) => !isVideoUrl(u)) ?? fallbackPoster.trim()
  return list.map((url) =>
    isVideoUrl(url) ? { url, image: poster, video: url } : { url, image: url, video: '' }
  )
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
  if (video) return [{ url: video, image: media, video }]
  return media ? [{ url: media, image: media, video: '' }] : []
}
