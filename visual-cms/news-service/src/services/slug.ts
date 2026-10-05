/**
 * Адрес новости из заголовка: транслитерация русской и узбекской кириллицы,
 * узбекская латиница без апострофов (o‘ → o), только [a-z0-9-].
 * Адрес правится до первой публикации, потом фиксируется (News.slugLocked),
 * чтобы не ломать ссылки.
 */
const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  // узбекская кириллица
  ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
}

export const SLUG_MAX_LENGTH = 80
export const SLUG_FALLBACK = 'news'
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function slugify(title: string): string {
  const latin = Array.from((title || '').toLowerCase())
    .map((ch) => (ch in CYRILLIC ? CYRILLIC[ch] : ch))
    .join('')
    // узбекская латиница: o‘, g‘, oʻ, o' — апостроф выпадает
    .replace(/['‘’ʻʼ`]/g, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    // после NFKD: № → No, ﬁ → fi
    .toLowerCase()
  const slug = latin.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (!slug) return SLUG_FALLBACK
  if (slug.length <= SLUG_MAX_LENGTH) return slug
  // Обрезаем по границе слова, чтобы не оставлять обрубок.
  const cut = slug.slice(0, SLUG_MAX_LENGTH)
  const lastDash = cut.lastIndexOf('-')
  return (lastDash > SLUG_MAX_LENGTH / 2 ? cut.slice(0, lastDash) : cut).replace(/-+$/, '')
}

/** Свободный адрес: base, base-2, base-3… */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`
    if (!taken.has(candidate)) return candidate
  }
}
