/**
 * Перевод ссылок на внешний демо-хост дизайнера в медиатеку CMS.
 *
 * Часть графики опубликованного сайта грузится с `subkhonastanov-uzb.github.io`
 * — чужого GitHub Pages. Живая витрина застройщика зависит от репозитория, к
 * которому у нас нет доступа: он может быть переименован, сделан приватным или
 * просто удалён, и картинки пропадут без всякого предупреждения.
 *
 * Те же файлы уже лежат в медиатеке (совпадают побайтово), поэтому переносить
 * ничего не нужно — достаточно переписать адреса.
 *
 * Здесь чистые функции; обход базы — в `migrate-external-assets.ts`.
 */

/** Хост, ссылки на который заменяем. */
export const EXTERNAL_HOST = 'subkhonastanov-uzb.github.io'

/** Ассет медиатеки в том виде, в каком он нужен для сопоставления. */
export interface MediaAssetRef {
  fileName: string
  storageKey: string
}

export class ExternalAssetsError extends Error {}

/**
 * Ссылки на внешний хост внутри произвольного значения структуры.
 *
 * Адрес может лежать в тексте узла, в атрибуте, в CSS-переменной и в
 * `metadata.globalCss` — поэтому ищем по строке, а не по известным полям.
 * Хвостовые кавычки и скобки в совпадение не берём: адрес обычно обёрнут в
 * `url('…')`.
 */
export function collectExternalUrls(value: unknown, host = EXTERNAL_HOST): string[] {
  const found = new Set<string>()
  const re = new RegExp(`https?://${host.replace(/\./g, '\\.')}/[^"'\\)\\s\\\\]+`, 'g')

  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      for (const m of node.matchAll(re)) found.add(m[0])
      return
    }
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (node && typeof node === 'object') {
      Object.values(node as Record<string, unknown>).forEach(walk)
    }
  }
  walk(value)
  return [...found].sort()
}

/** Имя файла в адресе: последний сегмент пути без строки запроса. */
export function fileNameFromUrl(url: string): string {
  const withoutQuery = url.split(/[?#]/)[0]
  return decodeURIComponent(withoutQuery.split('/').pop() ?? '')
}

export interface RewriteMap {
  /** Внешний адрес → путь в медиатеке. */
  replacements: Map<string, string>
  /** Адреса, которым не нашлось файла в медиатеке. */
  unmatched: string[]
}

/**
 * Сопоставляет внешние адреса с файлами медиатеки по имени.
 *
 * Имя — единственный общий признак: содержимое совпадает, но в медиатеке файл
 * лежит под сгенерированным ключом. Совпадение регистронезависимое: имена в
 * вёрстке и в библиотеке заводились руками в разное время.
 */
export function buildRewriteMap(urls: string[], assets: MediaAssetRef[]): RewriteMap {
  const byName = new Map<string, MediaAssetRef>()
  for (const asset of assets) {
    const key = asset.fileName.toLowerCase()
    // При двух ассетах с одним именем берём первый: список приходит
    // отсортированным вызывающим, и выбор должен быть воспроизводимым.
    if (!byName.has(key)) byName.set(key, asset)
  }

  const replacements = new Map<string, string>()
  const unmatched: string[] = []
  for (const url of urls) {
    const asset = byName.get(fileNameFromUrl(url).toLowerCase())
    if (!asset) {
      unmatched.push(url)
      continue
    }
    replacements.set(url, `/media/${asset.storageKey}`)
  }
  return { replacements, unmatched }
}

/**
 * Заменяет адреса во всех строках структуры.
 *
 * Возвращает новое дерево и число замен. Исходное не мутируется: вызывающий
 * решает, писать ли результат, и должен иметь возможность сравнить.
 */
export function rewriteValue<T>(value: T, replacements: Map<string, string>): { value: T; count: number } {
  let count = 0

  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') {
      let out = node
      for (const [from, to] of replacements) {
        if (!out.includes(from)) continue
        // split/join, а не replace: адрес может встретиться в строке дважды,
        // а спецсимволы регулярок в нём экранировать не хочется.
        const parts = out.split(from)
        count += parts.length - 1
        out = parts.join(to)
      }
      return out
    }
    if (Array.isArray(node)) return node.map(walk)
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) out[k] = walk(v)
      return out
    }
    return node
  }

  return { value: walk(value) as T, count }
}
