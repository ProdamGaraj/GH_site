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
  children?: SlideNode[]
  variations?: unknown
}

const isSlide = (node: SlideNode) => node.attributes?.['data-carousel-slide'] === 'true'
const assetIdOf = (node: SlideNode) => {
  const id = (node.metadata as Record<string, unknown> | undefined)?.mediaAssetId
  return typeof id === 'string' && id ? id : null
}

/** Фото-слайды без своей метки — кому нужна тема из медиатеки. */
function needsAutoTheme(node: SlideNode): boolean {
  return isSlide(node) && !node.attributes?.['data-header-theme'] && !node.attributes?.['data-slide-video'] && !!assetIdOf(node)
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

/** id медиафайлов фото-слайдов без ручной метки. */
export function slideAssetIds(structure: SlideNode): string[] {
  const ids = new Set<string>()
  walkNodes(structure, (node) => {
    if (needsAutoTheme(node)) ids.add(assetIdOf(node)!)
  })
  return [...ids]
}

/**
 * Ставит data-header-theme фото-слайдам без ручной метки по яркости их
 * картинки. Структура копируется; нет яркости — слайд остаётся без метки
 * (шапка решит как раньше).
 */
export function applyAutoHeaderThemes<T extends SlideNode>(structure: T, brightnessByAssetId: Map<string, number>): T {
  if (brightnessByAssetId.size === 0) return structure
  const copy: T = JSON.parse(JSON.stringify(structure))
  walkNodes(copy, (node) => {
    if (!needsAutoTheme(node)) return
    const brightness = brightnessByAssetId.get(assetIdOf(node)!)
    if (brightness === undefined) return
    node.attributes = { ...(node.attributes ?? {}), 'data-header-theme': themeFromBrightness(brightness) }
  })
  return copy
}
