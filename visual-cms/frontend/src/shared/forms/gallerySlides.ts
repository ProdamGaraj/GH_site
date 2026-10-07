/**
 * Кадрирование слайдов галерей ЖК («О проекте», холлы, двор).
 *
 * Карточка слайдера на сайте меняет пропорции с шириной экрана — от широкой
 * полосы на ПК до почти квадрата на телефоне, — а фото бывают вертикальные.
 * Поэтому у слайда не рамка обрезки, а точка фокуса (остаётся в кадре при любой
 * пропорции) и режим вписывания: «заполнить» (обрезка вокруг фокуса) или
 * «целиком» (кадр полностью на размытой подложке).
 *
 * Элемент галереи в базе — ссылка строкой или {url, focus, fit, theme}.
 * Строкой пишем слайд без настроек: так данные без кадрирования не меняют вид.
 * theme — тема шапки сайта над слайдом (dark | light; нет — авто). Ссылка
 * `block:<id>` — слайд-блок из библиотеки CMS (его разворачивает CMS при
 * публикации), у него нет кадрирования, только тема.
 * Разбор повторяет estate-service/src/services/mediaSlides.ts (readGallery,
 * позиция) — пакеты раздельные, держать в согласии.
 *
 * Чистые функции, без React.
 */

export type SlideFit = 'cover' | 'contain'

/** Точка фокуса в процентах от ширины и высоты кадра, 0..100. */
export interface SlideFocus {
  x: number
  y: number
}

/** Тема шапки над слайдом: dark — светлый текст шапки, light — тёмный; null — авто. */
export type SlideTheme = 'dark' | 'light'

/** Элемент галереи, как он лежит в базе и приходит из API. */
export type GalleryItem = string | { url: string; focus?: SlideFocus; fit?: SlideFit; theme?: SlideTheme }

/** Слайд в форме: всегда объект. */
export interface SlideSettings {
  url: string
  focus: SlideFocus | null
  fit: SlideFit
  theme: SlideTheme | null
}

/** Ссылка слайда-блока: `block:<id блока библиотеки>`. */
export const BLOCK_PREFIX = 'block:'

export const blockSlideUrl = (blockId: string): string => `${BLOCK_PREFIX}${blockId}`

/** id блока слайда-блока или null — слайд-файл. */
export function blockIdOf(url: string): string | null {
  const v = url.trim()
  if (!v.startsWith(BLOCK_PREFIX)) return null
  return v.slice(BLOCK_PREFIX.length).trim() || null
}

export const CENTER_POSITION = '50% 50%'

const VIDEO_RE = /\.(mp4|webm|mov|m4v|ogv)(?:[?#].*)?$/i

export function isVideoUrl(url: string): boolean {
  return VIDEO_RE.test(url.trim())
}

function percent(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.min(100, Math.max(0, value))
}

/** Галерея из API → слайды формы. Мусор и пустые ссылки отбрасываются. */
export function readGallery(items: readonly unknown[] | null | undefined): SlideSettings[] {
  if (!Array.isArray(items)) return []
  const out: SlideSettings[] = []
  for (const raw of items) {
    if (typeof raw === 'string') {
      const url = raw.trim()
      if (url) out.push({ url, focus: null, fit: 'cover', theme: null })
      continue
    }
    if (!raw || typeof raw !== 'object') continue
    const item = raw as Record<string, unknown>
    const url = typeof item.url === 'string' ? item.url.trim() : ''
    if (!url) continue
    const focusRaw = (item.focus ?? {}) as Record<string, unknown>
    const x = percent(focusRaw.x)
    const y = percent(focusRaw.y)
    out.push({
      url,
      focus: x === null || y === null ? null : { x, y },
      fit: item.fit === 'contain' ? 'contain' : 'cover',
      theme: item.theme === 'dark' || item.theme === 'light' ? item.theme : null,
    })
  }
  return out
}

/** Слайды формы → галерея для API. Без настроек — строкой. */
export function writeGallery(slides: readonly SlideSettings[]): GalleryItem[] {
  return slides.map((slide) => {
    if (!slide.focus && slide.fit === 'cover' && !slide.theme) return slide.url
    const item: { url: string; focus?: SlideFocus; fit?: SlideFit; theme?: SlideTheme } = { url: slide.url }
    if (slide.focus) item.focus = { ...slide.focus }
    if (slide.fit === 'contain') item.fit = 'contain'
    if (slide.theme) item.theme = slide.theme
    return item
  })
}

/**
 * Новый список ссылок (из текстового поля) → слайды. Настройки идут за
 * ссылкой: переставили строки — фокус переехал вместе с фото. Одинаковые
 * ссылки разбираются по порядку, новая ссылка — без настроек.
 */
export function withUrls(slides: readonly SlideSettings[], urls: readonly string[]): SlideSettings[] {
  const unused = [...slides]
  return urls.map((url) => {
    const at = unused.findIndex((s) => s.url === url)
    if (at === -1) return { url, focus: null, fit: 'cover' as const, theme: null }
    const [match] = unused.splice(at, 1)
    return match
  })
}

/** Клик по превью → точка фокуса в целых процентах, прижатая к краям кадра. */
export function focusAt(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number }
): SlideFocus {
  const along = (offset: number, size: number) =>
    size > 0 ? Math.min(100, Math.max(0, Math.round((offset / size) * 100))) : 50
  return { x: along(clientX - rect.left, rect.width), y: along(clientY - rect.top, rect.height) }
}

/**
 * Позиция кадра, как её поставит сайт. «Целиком» — центр: кадр виден
 * полностью, фокус лишь сдвинул бы его к краю.
 */
export function slidePosition(slide: SlideSettings): string {
  if (slide.fit === 'contain' || !slide.focus) return CENTER_POSITION
  return `${slide.focus.x}% ${slide.focus.y}%`
}
