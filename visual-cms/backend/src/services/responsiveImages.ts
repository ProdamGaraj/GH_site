/**
 * Лёгкие картинки в готовом HTML (pure, без БД).
 *
 * В медиатеке у растрового файла есть оптимизированная полноразмерная версия
 * (`<uuid>.opt.webp`, если она меньше оригинала) и адаптивные варианты по
 * ширинам (`<uuid>.w768.webp`). В разметке же стоит адрес оригинала
 * `<prefix>/media/<uuid>.<ext>` — его вставил редактор или данные. Здесь:
 *  - `<img>`: `src` → оптимизированная версия, плюс `srcset` из вариантов и
 *    полноразмерной версии и `sizes` по ширине файла (см. sizesFor);
 *  - CSS `url(...)` (встроенные стили, `<style>`, переменные `--image`):
 *    оригинал PNG/JPEG → оптимизированная версия.
 *
 * `<uuid>` — uuid ХРАНИЛИЩА, не id записи MediaAsset (см. mediaAssetLookup.ts).
 * GIF и SVG не трогаем: webp-версия GIF — только первый кадр анимации, у SVG
 * производных нет. Ссылки (`href`), meta и data-атрибуты не трогаем: там
 * может быть нужен именно оригинал.
 *
 * Чистые функции: на вход — html и карта версий по uuid, на выход — новый html.
 * Идемпотентно.
 */

export interface ResponsiveVariant {
  width: number
  storageKey: string
}

/** Версии одного файла медиатеки. */
export interface MediaRendition {
  /** Оригинал: `<uuid>.<ext>`. */
  storageKey: string
  /** Полноразмерная webp-версия, если она меньше оригинала. */
  optimizedKey: string | null
  /** Ширина оригинала, px; null — неизвестна. */
  width: number | null
  variants: ResponsiveVariant[]
}

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'

/** Файл медиатеки в пути: `/media/<uuid>.<остаток имени>`. */
const MEDIA_FILE_RE = new RegExp(`/media/(${UUID})\\.([^"'()&\\s]+)$`)

/** Оригинал растровой картинки, который стоит заменить оптимизированной версией. */
const SWAPPABLE_EXT = /^(png|jpe?g)$/i

/** У этих файлов адаптивных вариантов нет или они ломают картинку. */
const NO_VARIANTS_EXT = /^(gif|svg)$/i

interface MediaRef {
  uuid: string
  /** Часть пути до имени файла, включая `/media/`. */
  prefix: string
  /** Имя файла после `<uuid>.`: `png`, `opt.webp`, `w768.webp`. */
  rest: string
}

function parseMediaUrl(url: string): MediaRef | null {
  const m = url.match(MEDIA_FILE_RE)
  if (!m) return null
  return { uuid: m[1].toLowerCase(), prefix: url.slice(0, url.length - m[0].length) + '/media/', rest: m[2] }
}

/** Адрес оптимизированной версии вместо оригинала PNG/JPEG; null — менять нечего. */
function optimizedUrl(ref: MediaRef, rendition: MediaRendition | undefined): string | null {
  if (!rendition?.optimizedKey || !SWAPPABLE_EXT.test(ref.rest)) return null
  return ref.prefix + rendition.optimizedKey
}

/**
 * `sizes` для картинки шириной `width`. С `srcset` по ширинам браузер берёт
 * собственный размер картинки из `sizes`, а не из файла: при `100vw` логотип
 * или значок без заданной в CSS ширины растянулся бы на весь экран. Поэтому
 * `sizes` — не шире самого файла: min(100vw, width), как у картинки без srcset
 * под `max-width: 100%` из базовых стилей.
 */
export function sizesFor(width: number): string {
  return `(max-width: ${width}px) 100vw, ${width}px`
}

function enrichImgTag(tag: string, renditions: Map<string, MediaRendition>): string {
  // Уважаем уже выставленный srcset (ручной или из другого источника).
  if (/\ssrcset\s*=/i.test(tag)) return tag

  const srcMatch = tag.match(/\ssrc\s*=\s*"([^"]*)"/i)
  if (!srcMatch) return tag
  const src = srcMatch[1]
  const ref = parseMediaUrl(src)
  if (!ref || NO_VARIANTS_EXT.test(ref.rest.split('.').pop() ?? '')) return tag
  const rendition = renditions.get(ref.uuid)
  if (!rendition) return tag

  const lighter = optimizedUrl(ref, rendition)
  const finalSrc = lighter ?? src
  let out = lighter ? tag.replace(srcMatch[0], srcMatch[0].replace(src, lighter)) : tag

  // Без ширины файла не посчитать `sizes` — только лёгкий src, без srcset.
  if (rendition.variants.length === 0 || !rendition.width) return out

  // Полноразмерная версия — тоже кандидат: иначе широкий экран получил бы
  // самый большой вариант, даже если он уже экрана.
  const sorted = [...rendition.variants].sort((a, b) => b.width - a.width)
  const candidates = sorted.map((v) => `${ref.prefix}${v.storageKey} ${v.width}w`)
  const finalRest = finalSrc.slice(finalSrc.lastIndexOf('/') + 1)
  const isFullSize = finalRest === rendition.optimizedKey || finalRest === rendition.storageKey
  if (isFullSize && rendition.width > sorted[0].width) {
    candidates.unshift(`${finalSrc} ${rendition.width}w`)
  }

  const hasSizes = /\ssizes\s*=/i.test(out)
  const additions = ` srcset="${candidates.join(', ')}"` + (hasSizes ? '' : ` sizes="${sizesFor(rendition.width)}"`)
  // Вставляем перед закрытием тега (поддержка и `/>`, и `>`).
  if (out.endsWith('/>')) return out.slice(0, -2).trimEnd() + additions + ' />'
  if (out.endsWith('>')) return out.slice(0, -1) + additions + '>'
  return out
}

/** `<img>`: оптимизированный `src`, `srcset` и `sizes`. */
export function injectResponsiveImages(html: string, renditions: Map<string, MediaRendition>): string {
  if (!html || renditions.size === 0) return html
  return html.replace(/<img\b[^>]*?\/?>/gi, (tag) => enrichImgTag(tag, renditions))
}

/**
 * CSS `url(...)` с оригиналом PNG/JPEG → оптимизированная версия. Кавычки —
 * любые: `"`, `'`, без кавычек и `&quot;`/`&#39;` (так генератор пишет
 * кавычки во встроенных стилях).
 */
export function swapCssMediaUrls(html: string, renditions: Map<string, MediaRendition>): string {
  if (!html || renditions.size === 0) return html
  return html.replace(/(url\(\s*)(&quot;|&#39;|"|')?([^"'()&\s]+)/gi, (whole, open: string, quote: string | undefined, url: string) => {
    const ref = parseMediaUrl(url)
    const lighter = ref ? optimizedUrl(ref, renditions.get(ref.uuid)) : null
    return lighter ? `${open}${quote ?? ''}${lighter}` : whole
  })
}

/** Всё сразу: `<img>` и CSS. */
export function optimizeMediaInHtml(html: string, renditions: Map<string, MediaRendition>): string {
  return swapCssMediaUrls(injectResponsiveImages(html, renditions), renditions)
}

/** Уникальные uuid хранилища, на которые ссылается html через `/media/<uuid>.`. */
export function extractMediaUuids(html: string): string[] {
  if (!html) return []
  const re = new RegExp(`/media/(${UUID})\\.`, 'g')
  const uuids = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    uuids.add(m[1].toLowerCase())
  }
  return Array.from(uuids)
}
