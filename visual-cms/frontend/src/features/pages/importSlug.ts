/**
 * Адрес страницы из имени импортированного файла.
 *
 * Импорт index.html давал адрес «index» — а он зарезервирован за главной
 * сайта (pagePublication.reservedSlugError на сервере): такую страницу нельзя
 * было ни снять с публикации, ни переименовать. Зарезервированные имена
 * получают суффикс, пустое имя (кириллица, символы) — «page».
 */
const RESERVED_SLUGS = ['index', 'home']

export function importedPageSlug(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/\.html?$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!base) return 'page'
  return RESERVED_SLUGS.includes(base) ? `${base}-page` : base
}
