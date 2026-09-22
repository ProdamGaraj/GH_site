/**
 * Префикс языка во внутренних ссылках языковой версии страницы.
 *
 * Деплой переводил тексты, но адреса оставлял как есть. На `/uz/` все ссылки
 * вели на русские URL: один клик по меню или по карточке проекта — и посетитель
 * молча возвращался на русскую версию, хотя узбекская существует. Ошибки при
 * этом нет, страница открывается — поэтому баг и жил незаметно.
 *
 * Чистый модуль без БД: применяется в DeployService для не-дефолтных языков.
 */

/** Атрибуты, в которых лежат внутренние переходы. */
const LINK_ATTRS = ['href', 'data-href'] as const

/**
 * Префиксы, которые языку не принадлежат.
 *
 * Это статика и API: они общие для всех языков, и `/uz/media/…` просто не
 * существует — картинки и шрифты пропали бы со всей узбекской версии.
 */
const SHARED_PREFIXES = ['/media/', '/css/', '/js/', '/fonts/', '/images/', '/assets/', '/api/', '/uploads/']

/** Расширения, которые считаем страницей, а не файлом. */
const PAGE_EXTENSIONS = new Set(['html', 'htm'])

/**
 * Ссылка ведёт на страницу этого сайта и должна получить префикс языка?
 *
 * Внешние адреса, якоря без пути, `mailto:`/`tel:` и статика остаются как есть.
 */
export function isLocalizableLink(value: string, prefix: string): boolean {
  if (!value || !value.startsWith('/')) return false
  // Протокол-относительный адрес «//example.com» ведёт наружу.
  if (value.startsWith('//')) return false
  if (prefix && (value === prefix || value.startsWith(`${prefix}/`) || value.startsWith(`${prefix}#`)))
    return false
  if (SHARED_PREFIXES.some((p) => value.startsWith(p))) return false

  const path = value.split(/[?#]/)[0]
  const lastSegment = path.split('/').pop() || ''
  const dot = lastSegment.lastIndexOf('.')
  if (dot > 0) {
    const ext = lastSegment.slice(dot + 1).toLowerCase()
    // Файл с расширением — статика, кроме собственно страниц.
    if (!PAGE_EXTENSIONS.has(ext)) return false
  }
  return true
}

/**
 * Добавляет префикс языка к внутренней ссылке.
 *
 * `/` → `/uz/`, `/about` → `/uz/about`, `/#complexes` → `/uz/#complexes`.
 * Пустой префикс (язык по умолчанию) ничего не меняет.
 */
export function localizeLink(value: string, prefix: string): string {
  if (!prefix || !isLocalizableLink(value, prefix)) return value
  if (value === '/') return `${prefix}/`
  if (value.startsWith('/#')) return `${prefix}/${value.slice(1)}`
  return `${prefix}${value}`
}

/**
 * Проходит дерево и переписывает внутренние ссылки под язык.
 *
 * Возвращает новое дерево: вызывающий деплоит языковую копию, а исходная
 * структура остаётся языконезависимой.
 */
export function localizeInternalLinks<T>(structure: T, prefix: string): { value: T; count: number } {
  let count = 0
  if (!prefix) return { value: structure, count }

  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk)
    if (!node || typeof node !== 'object') return node

    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'attributes' && value && typeof value === 'object') {
        const attrs: Record<string, unknown> = { ...(value as Record<string, unknown>) }
        for (const attr of LINK_ATTRS) {
          const raw = attrs[attr]
          if (typeof raw !== 'string') continue
          const localized = localizeLink(raw, prefix)
          if (localized !== raw) {
            attrs[attr] = localized
            count++
          }
        }
        out[key] = attrs
        continue
      }
      out[key] = walk(value)
    }
    return out
  }

  return { value: walk(structure) as T, count }
}

/** Префикс пути для языка: дефолтный — пустой, остальные — `/<code>`. */
export function langPrefix(code: string, isDefault: boolean): string {
  return isDefault ? '' : `/${code}`
}
