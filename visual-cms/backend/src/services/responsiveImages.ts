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
 *    оригинал PNG/JPEG → оптимизированная версия, а на экранах поуже —
 *    вариант по ширине экрана (см. applyBackgroundVariants).
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

/**
 * Ширина, которую картинке задали в разметке: атрибут `width` или `width` в
 * px во встроенном стиле. Тогда `sizes` — она: логотип шириной 118px не
 * скачивает вариант 1024px. Ширина из CSS-класса здесь не видна — её
 * задают атрибутом.
 */
export function declaredWidth(tag: string): number | null {
  const attr = tag.match(/\swidth\s*=\s*"(\d+(?:\.\d+)?)"/i)
  if (attr) return Math.ceil(Number(attr[1]))
  const style = tag.match(/\sstyle\s*=\s*"([^"]*)"/i)?.[1] ?? ''
  const inline = style.match(/(?:^|;)\s*width\s*:\s*(\d+(?:\.\d+)?)px/i)
  return inline ? Math.ceil(Number(inline[1])) : null
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
  const fixed = declaredWidth(tag)
  const sizes = fixed ? `${Math.min(fixed, rendition.width)}px` : sizesFor(rendition.width)
  const additions = ` srcset="${candidates.join(', ')}"` + (hasSizes ? '' : ` sizes="${sizes}"`)
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

/**
 * Плотность экрана, под которую подбирается размер фона. У фона нет `srcset`:
 * браузер не выберет файл сам, а плотность в `@media` удвоила бы число правил.
 * Берём 2 — так чётко на телефонах и ноутбуках с плотным экраном; обычный
 * монитор получает файл с запасом, но не больше полноразмерного, как раньше.
 */
export const BACKGROUND_PIXEL_RATIO = 2

/** Экранов уже не бывает — правило для такого размера было бы мёртвым. */
const MIN_BACKGROUND_SCREEN = 320

/** Метка блока стилей с размерами фонов (и признак, что html уже обработан). */
const VARIANTS_STYLE_ATTR = 'data-media-variants'

/** До какой ширины экрана годится вариант. */
export interface BackgroundStep {
  maxWidth: number
  storageKey: string
}

/**
 * Ступени фона: вариант шириной W годится экранам до W / плотность.
 * По убыванию — в этом порядке идут `@media`, более узкий экран побеждает.
 * Экран шире самой большой ступени получает полноразмерную версию.
 */
export function backgroundSteps(rendition: MediaRendition): BackgroundStep[] {
  const limit = rendition.width && rendition.width > 0 ? rendition.width : Infinity
  const byScreen = new Map<number, BackgroundStep>()
  for (const v of rendition.variants) {
    if (!(v.width > 0) || v.width >= limit) continue
    const maxWidth = Math.floor(v.width / BACKGROUND_PIXEL_RATIO)
    if (maxWidth < MIN_BACKGROUND_SCREEN || byScreen.has(maxWidth)) continue
    byScreen.set(maxWidth, { maxWidth, storageKey: v.storageKey })
  }
  return Array.from(byScreen.values()).sort((a, b) => b.maxWidth - a.maxWidth)
}

/** `url(...)` целиком, с кавычками любого вида; перед ним — уже подставленная переменная. */
const CSS_URL_TOKEN = /(var\(\s*--m-[0-9a-f]+\s*,\s*)?url\(\s*(&quot;|&#39;|"|')?([^"'()&\s]+)(&quot;|&#39;|"|')?\s*\)/gi

/**
 * Фоны и CSS-переменные с картинкой — по размеру экрана.
 *
 * `url(<полноразмерная>)` в стилях заменяется на
 * `var(--m-<uuid>, url(<полноразмерная>))`, а в `<head>` добавляется блок:
 *
 *   @media (max-width: 512px) { :root { --m-<uuid>: url(<uuid>.w1024.webp) } }
 *
 * На широком экране переменная не задана — работает запасное значение, то
 * есть прежняя полноразмерная версия. Браузер скачивает только выбранный файл.
 *
 * Почему переменная, а не правило на элемент:
 *  - элементы списка (слайды, карточки) делят один `data-element-id`, а
 *    картинки у них разные — правилом по id их не различить;
 *  - правило с `!important` перебило бы фон, который скрипт страницы ставит
 *    элементу сам (смена слайда, экранное медиа);
 *  - адрес остаётся в самом стиле: скрипты, которые читают его оттуда
 *    (увеличение фото по клику), получают полноразмерную картинку.
 *
 * `<script>` не трогаем: там адрес — данные, а не стиль. Без `</head>` (кусок
 * разметки) и при повторном вызове html не меняется.
 */
export function applyBackgroundVariants(html: string, renditions: Map<string, MediaRendition>): string {
  if (!html || renditions.size === 0) return html
  if (html.includes(VARIANTS_STYLE_ATTR)) return html
  const headEnd = html.search(/<\/head\s*>/i)
  if (headEnd < 0) return html

  /** uuid → имя переменной и её значения по ступеням. */
  const used = new Map<string, { name: string; prefix: string; steps: BackgroundStep[] }>()
  const takenNames = new Set<string>()

  const nameFor = (uuid: string): string => {
    const short = `--m-${uuid.slice(0, 8)}`
    const name = takenNames.has(short) ? `--m-${uuid.replace(/-/g, '')}` : short
    takenNames.add(name)
    return name
  }

  const rewrite = (chunk: string): string =>
    chunk.replace(CSS_URL_TOKEN, (whole, wrapped: string | undefined, open: string | undefined, url: string, close: string | undefined) => {
      if (wrapped || open !== close) return whole
      const ref = parseMediaUrl(url)
      if (!ref) return whole
      const rendition = renditions.get(ref.uuid)
      if (!rendition) return whole
      // Только полноразмерные версии: вариант, выбранный вручную, не подменяем.
      const file = `${ref.uuid}.${ref.rest}`.toLowerCase()
      const isFullSize =
        file === rendition.storageKey.toLowerCase() || file === (rendition.optimizedKey ?? '').toLowerCase()
      if (!isFullSize || NO_VARIANTS_EXT.test(ref.rest.split('.').pop() ?? '')) return whole

      let entry = used.get(ref.uuid)
      if (!entry) {
        const steps = backgroundSteps(rendition)
        if (steps.length === 0) return whole
        entry = { name: nameFor(ref.uuid), prefix: ref.prefix, steps }
        used.set(ref.uuid, entry)
      }
      return `var(${entry.name}, ${whole})`
    })

  // Нечётные куски — <script>…</script>, их пропускаем.
  const out = html
    .split(/(<script\b[\s\S]*?<\/script\s*>)/gi)
    .map((chunk, i) => (i % 2 === 1 ? chunk : rewrite(chunk)))
    .join('')
  if (used.size === 0) return html

  const byScreen = new Map<number, string[]>()
  for (const { name, prefix, steps } of used.values()) {
    for (const step of steps) {
      const list = byScreen.get(step.maxWidth) ?? []
      list.push(`${name}:url("${prefix}${step.storageKey}")`)
      byScreen.set(step.maxWidth, list)
    }
  }
  const css = Array.from(byScreen.keys())
    .sort((a, b) => b - a)
    .map((maxWidth) => `@media (max-width:${maxWidth}px){:root{${byScreen.get(maxWidth)!.join(';')}}}`)
    .join('\n')

  const at = out.search(/<\/head\s*>/i)
  return `${out.slice(0, at)}<style ${VARIANTS_STYLE_ATTR}>\n${css}\n</style>\n${out.slice(at)}`
}

/** Всё сразу: `<img>` и CSS. */
export function optimizeMediaInHtml(html: string, renditions: Map<string, MediaRendition>): string {
  const lighter = swapCssMediaUrls(injectResponsiveImages(html, renditions), renditions)
  return applyBackgroundVariants(lighter, renditions)
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
