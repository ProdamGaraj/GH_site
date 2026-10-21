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
 * screens — своё медиа слайда для экранов страницы-шаблона: `{ mobile: { url,
 * focus } }`, ключ — id брейкпоинта шаблона. Экран без своего медиа берёт
 * медиа экрана шире, самый широкий — основное. Вписывание и тема — общие.
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

/** Своё медиа слайда для экрана: в базе фокус необязателен. */
export interface SlideScreenItem {
  url: string
  focus?: SlideFocus
}

/** Элемент галереи, как он лежит в базе и приходит из API. */
export type GalleryItem =
  | string
  | { url: string; focus?: SlideFocus; fit?: SlideFit; theme?: SlideTheme; screens?: Record<string, SlideScreenItem> }

/** Своё медиа экрана в форме. */
export interface ScreenSettings {
  url: string
  focus: SlideFocus | null
}

/** Слайд в форме: всегда объект. */
export interface SlideSettings {
  url: string
  focus: SlideFocus | null
  fit: SlideFit
  theme: SlideTheme | null
  /** Свои медиа экранов по id экрана; пусто — слайд одинаковый на всех экранах. */
  screens: Record<string, ScreenSettings>
}

/** Новый слайд без настроек. */
export const plainSlide = (url: string): SlideSettings => ({ url, focus: null, fit: 'cover', theme: null, screens: {} })

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

function readFocus(value: unknown): SlideFocus | null {
  const raw = (value ?? {}) as Record<string, unknown>
  const x = percent(raw.x)
  const y = percent(raw.y)
  return x === null || y === null ? null : { x, y }
}

/** id экрана — как id брейкпоинта в CMS. */
const SCREEN_ID_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/i

function readScreens(value: unknown): Record<string, ScreenSettings> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, ScreenSettings> = {}
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!SCREEN_ID_RE.test(id) || !raw || typeof raw !== 'object') continue
    const screen = raw as Record<string, unknown>
    const url = typeof screen.url === 'string' ? screen.url.trim() : ''
    if (!url || blockIdOf(url)) continue
    out[id] = { url, focus: readFocus(screen.focus) }
  }
  return out
}

/** Галерея из API → слайды формы. Мусор и пустые ссылки отбрасываются. */
export function readGallery(items: readonly unknown[] | null | undefined): SlideSettings[] {
  if (!Array.isArray(items)) return []
  const out: SlideSettings[] = []
  for (const raw of items) {
    if (typeof raw === 'string') {
      const url = raw.trim()
      if (url) out.push(plainSlide(url))
      continue
    }
    if (!raw || typeof raw !== 'object') continue
    const item = raw as Record<string, unknown>
    const url = typeof item.url === 'string' ? item.url.trim() : ''
    if (!url) continue
    out.push({
      url,
      focus: readFocus(item.focus),
      fit: item.fit === 'contain' ? 'contain' : 'cover',
      theme: item.theme === 'dark' || item.theme === 'light' ? item.theme : null,
      screens: blockIdOf(url) ? {} : readScreens(item.screens),
    })
  }
  return out
}

/** Слайды формы → галерея для API. Без настроек — строкой. */
export function writeGallery(slides: readonly SlideSettings[]): GalleryItem[] {
  return slides.map((slide) => {
    const screenIds = Object.keys(slide.screens ?? {}).filter((id) => slide.screens[id]?.url)
    if (!slide.focus && slide.fit === 'cover' && !slide.theme && screenIds.length === 0) return slide.url
    const item: Exclude<GalleryItem, string> = { url: slide.url }
    if (slide.focus) item.focus = { ...slide.focus }
    if (slide.fit === 'contain') item.fit = 'contain'
    if (slide.theme) item.theme = slide.theme
    if (screenIds.length > 0) {
      item.screens = Object.fromEntries(
        screenIds.map((id) => {
          const screen = slide.screens[id]
          return [id, screen.focus ? { url: screen.url, focus: { ...screen.focus } } : { url: screen.url }]
        })
      )
    }
    return item
  })
}

/** Слайд с новым медиа экрана (пустая ссылка — экран снова берёт медиа экрана шире). */
export function withScreen(slide: SlideSettings, screenId: string, screen: ScreenSettings | null): SlideSettings {
  const screens = { ...slide.screens }
  if (screen && screen.url.trim()) screens[screenId] = { url: screen.url.trim(), focus: screen.focus }
  else delete screens[screenId]
  return { ...slide, screens }
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
    if (at === -1) return plainSlide(url)
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
export function slidePosition(slide: { fit: SlideFit; focus: SlideFocus | null }): string {
  if (slide.fit === 'contain' || !slide.focus) return CENTER_POSITION
  return `${slide.focus.x}% ${slide.focus.y}%`
}
