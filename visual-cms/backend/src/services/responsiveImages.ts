/**
 * Внедрение `srcset`/`sizes` в готовый HTML (pure, без БД).
 *
 * На деплое сайт должен отдавать разные изображения под разные экраны.
 * В разметке `<img>` хранит один `src` вида `<prefix>/media/<uuid>.<ext>`,
 * где `<uuid>` — это id ассета (storageKey = `<uuid>.<ext>`). По uuid находим
 * заранее сгенерированные варианты и дописываем `srcset` + `sizes`.
 *
 * Чистая функция: на вход — html и карта вариантов по id, на выход — новый html.
 * Никаких обращений к БД/окружению — всё для юнит-тестов.
 */

export interface ResponsiveVariant {
  width: number
  storageKey: string
}

export interface InjectOptions {
  /** Значение `sizes`, если его нет у тега. По умолчанию "100vw". */
  defaultSizes?: string
}

/** UUID в пути `/media/<uuid>.<ext>`. */
const MEDIA_ID_RE = /\/media\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\./

/**
 * @param html      исходный HTML страницы
 * @param variantsById карта id ассета -> его варианты (могут быть пустыми)
 */
export function injectResponsiveImages(
  html: string,
  variantsById: Map<string, ResponsiveVariant[]>,
  opts: InjectOptions = {},
): string {
  if (!html || variantsById.size === 0) return html
  const defaultSizes = opts.defaultSizes ?? '100vw'

  return html.replace(/<img\b[^>]*?\/?>/gi, (tag) => {
    // Уважаем уже выставленный srcset (ручной или из другого источника).
    if (/\ssrcset\s*=/i.test(tag)) return tag

    const srcMatch = tag.match(/\ssrc\s*=\s*"([^"]*)"/i)
    if (!srcMatch) return tag
    const src = srcMatch[1]

    const idMatch = src.match(MEDIA_ID_RE)
    if (!idMatch) return tag
    const id = idMatch[1].toLowerCase()

    const variants = variantsById.get(id)
    if (!variants || variants.length === 0) return tag

    // Префикс пути до имени файла берём из самого src — устойчиво к origin/base.
    const prefix = src.slice(0, src.lastIndexOf('/') + 1)
    const sorted = [...variants].sort((a, b) => b.width - a.width)
    const srcset = sorted
      .map((v) => `${prefix}${v.storageKey} ${v.width}w`)
      .join(', ')

    const hasSizes = /\ssizes\s*=/i.test(tag)
    const additions = ` srcset="${srcset}"` + (hasSizes ? '' : ` sizes="${defaultSizes}"`)

    // Вставляем перед закрытием тега (поддержка и `/>`, и `>`).
    if (tag.endsWith('/>')) return tag.slice(0, -2) + additions + ' />'
    if (tag.endsWith('>')) return tag.slice(0, -1) + additions + '>'
    return tag
  })
}

/** Извлекает все уникальные id ассетов, на которые ссылается html через /media/<uuid>. */
export function extractMediaIds(html: string): string[] {
  if (!html) return []
  const re = /\/media\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\./g
  const ids = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    ids.add(m[1].toLowerCase())
  }
  return Array.from(ids)
}
