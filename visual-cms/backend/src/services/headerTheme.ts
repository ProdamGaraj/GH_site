/**
 * Тема шапки над слайдом с фото: тёмный или светлый фон под ней.
 *
 * Шапка сайта (скрипт блока «Navigation») красит текст по фону под собой, но
 * цвет фото по стилям не узнать. Поэтому яркость верхней полосы картинки — то,
 * над чем висит шапка, — считается один раз при загрузке в медиатеку
 * (MediaAsset.topBrightness), а при публикации слайд карусели с этой картинкой
 * получает data-header-theme. В браузере — ноль работы. Ручная метка слайда
 * (из редактора) главнее; видео-слайды здесь не размечаются — их кадры
 * оценивает runtime карусели.
 */
import sharp from 'sharp'

/** Порог YIQ-яркости — тот же, что у скрипта шапки (contrastCore, BRIGHT_THRESHOLD). */
export const HEADER_BRIGHT_THRESHOLD = 140

/** Полоса под шапкой: верхняя четверть кадра по центральным 70% ширины. */
const BAND = { left: 0.15, width: 0.7, height: 0.25 }

export type HeaderTheme = 'dark' | 'light'

export function themeFromBrightness(brightness: number): HeaderTheme {
  return brightness < HEADER_BRIGHT_THRESHOLD ? 'dark' : 'light'
}

/**
 * YIQ-яркость (0..255) полосы под шапкой. Прозрачность — как на белом.
 * null — картинку не удалось разобрать.
 */
export async function topBandBrightness(image: Buffer): Promise<number | null> {
  try {
    const rotated = await sharp(image, { failOn: 'none' }).rotate().toBuffer({ resolveWithObject: true })
    const { width, height } = rotated.info
    if (!width || !height) return null
    const region = {
      left: Math.floor(width * BAND.left),
      top: 0,
      width: Math.max(1, Math.floor(width * BAND.width)),
      height: Math.max(1, Math.floor(height * BAND.height)),
    }
    const { data, info } = await sharp(rotated.data, { failOn: 'none' })
      .extract(region)
      .flatten({ background: '#ffffff' })
      .resize(8, 4, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const channels = info.channels
    let sum = 0
    let pixels = 0
    for (let i = 0; i + 2 < data.length; i += channels) {
      sum += (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000
      pixels++
    }
    return pixels ? Math.round(sum / pixels) : null
  } catch {
    return null
  }
}

/** Узел структуры в той мере, в какой он нужен здесь (BlockNode и узлы миграций подходят). */
interface SlideNode {
  attributes?: Record<string, string>
  metadata?: Record<string, unknown> | object
  styles?: { properties?: Record<string, unknown> } | object
  children?: SlideNode[]
  variations?: unknown
}

export const HEADER_THEME_ATTR = 'data-header-theme'
/**
 * «Авто» явно — у языковой версии слайда (строка перевода data-header-theme):
 * «по фото этого языка», даже если в основном языке тема задана руками.
 */
export const AUTO_THEME = 'auto'

const isSlide = (node: SlideNode) => node.attributes?.['data-carousel-slide'] === 'true'
const isVideoSlide = (node: SlideNode) => !!node.attributes?.['data-slide-video']

/** Ручная тема слайда: только dark | light; auto и мусор — не ручная. */
function manualTheme(node: SlideNode): HeaderTheme | null {
  const value = node.attributes?.[HEADER_THEME_ATTR]
  return value === 'dark' || value === 'light' ? value : null
}

const MEDIA_ID_RE = /\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i

/**
 * Ссылка на файл медиатеки, который реально стоит фоном слайда:
 *   file:<uuid>  — из адреса фона (/media/<uuid>.png, .opt.webp, .w800.webp —
 *                  у всех производных один uuid хранилища);
 *   asset:<id>   — фона в стилях нет: исходный файл слайда (metadata.mediaAssetId).
 * Фон — главный источник: на языковой версии там уже фото этого языка
 * (перевод bg:image подставлен до публикации), а mediaAssetId мог устареть,
 * если картинку слайда меняли в стилях. Фон не из медиатеки — темы нет.
 */
function mediaRefOf(node: SlideNode): string | null {
  const props = ((node.styles as { properties?: Record<string, unknown> } | undefined)?.properties ?? {}) as Record<string, unknown>
  const background = [props.backgroundImage, props.background].find((v) => typeof v === 'string' && v.includes('url(')) as
    | string
    | undefined
  if (background) {
    const file = MEDIA_ID_RE.exec(background)?.[1]
    return file ? `file:${file.toLowerCase()}` : null
  }
  const id = (node.metadata as Record<string, unknown> | undefined)?.mediaAssetId
  return typeof id === 'string' && id ? `asset:${id}` : null
}

/** Фото-слайд без ручной темы — кому нужна тема из медиатеки. */
function needsAutoTheme(node: SlideNode): boolean {
  return isSlide(node) && !isVideoSlide(node) && !manualTheme(node) && !!mediaRefOf(node)
}

/** Все узлы, включая экранные вставки (variations.specificChildren). */
function walkNodes(node: SlideNode, visit: (n: SlideNode) => void): void {
  visit(node)
  for (const child of node.children ?? []) walkNodes(child, visit)
  const variations = (node.variations ?? {}) as Record<string, { specificChildren?: SlideNode[] } | null>
  for (const variation of Object.values(variations)) {
    for (const child of variation?.specificChildren ?? []) walkNodes(child, visit)
  }
}

/** Ссылки (file:<uuid> | asset:<id>) на файлы фото-слайдов без ручной темы. */
export function slideMediaRefs(structure: SlideNode): string[] {
  const refs = new Set<string>()
  walkNodes(structure, (node) => {
    if (needsAutoTheme(node)) refs.add(mediaRefOf(node)!)
  })
  return [...refs]
}

/**
 * Ставит data-header-theme фото-слайдам без ручной темы по яркости их
 * картинки. «auto» (явное у языковой версии) снимается: дальше решает фото,
 * а у видео-слайда — кадры (runtime карусели). Структура копируется; нет
 * яркости — слайд остаётся без метки (шапка решит как раньше).
 */
export function applyAutoHeaderThemes<T extends SlideNode>(structure: T, brightnessByRef: Map<string, number>): T {
  let hasAuto = false
  walkNodes(structure, (node) => {
    if (isSlide(node) && node.attributes?.[HEADER_THEME_ATTR] === AUTO_THEME) hasAuto = true
  })
  if (brightnessByRef.size === 0 && !hasAuto) return structure
  const copy: T = JSON.parse(JSON.stringify(structure))
  walkNodes(copy, (node) => {
    if (!isSlide(node)) return
    if (node.attributes?.[HEADER_THEME_ATTR] === AUTO_THEME) {
      const { [HEADER_THEME_ATTR]: _auto, ...rest } = node.attributes
      node.attributes = rest
    }
    if (!needsAutoTheme(node)) return
    const brightness = brightnessByRef.get(mediaRefOf(node)!)
    if (brightness === undefined) return
    node.attributes = { ...(node.attributes ?? {}), [HEADER_THEME_ATTR]: themeFromBrightness(brightness) }
  })
  return copy
}
