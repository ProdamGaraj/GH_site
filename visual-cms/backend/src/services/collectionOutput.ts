import fs from 'fs'
import path from 'path'

/**
 * Папка страниц элементов коллекции: `/<язык>/<basePath>/<slug>/index.html`.
 *
 * Раньше перед генерацией папка `<basePath>` удалялась целиком. Но там могут
 * жить и другие страницы: у новостей список — `/ru/news/index.html`, а
 * страницы новостей — `/ru/news/<slug>/`. Передеплой коллекции стирал бы
 * страницу списка. Теперь коллекция записывает в папку манифест — какие
 * папки элементов она создала, — и перед следующей генерацией удаляет только
 * их. Чужие файлы и папки остаются.
 *
 * Папка без манифеста (выкачена до этого изменения): удаляются вложенные
 * папки, файлы в корне остаются. Раньше удалялось всё, так что это не
 * опаснее прежнего, а страница списка уже уцелеет.
 */
export const COLLECTION_MANIFEST = '.collection-items.json'

/** Имя папки элемента: без разделителей и `..` — манифест не выведет за пределы папки. */
const SAFE_SLUG = /^[a-z0-9][a-z0-9._-]*$/i

function readManifest(dir: string): string[] | null {
  const file = path.join(dir, COLLECTION_MANIFEST)
  if (!fs.existsSync(file)) return null
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'))
    return Array.isArray(parsed?.items) ? parsed.items.filter((s: unknown) => typeof s === 'string') : []
  } catch {
    return []
  }
}

/** Удаляет папки элементов, созданные прошлой генерацией коллекции. */
export function pruneCollectionItems(dir: string): void {
  if (!fs.existsSync(dir)) return
  const manifest = readManifest(dir)
  const targets =
    manifest ?? fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
  for (const slug of targets) {
    if (!SAFE_SLUG.test(slug) || slug.includes('..')) continue
    fs.rmSync(path.join(dir, slug), { recursive: true, force: true })
  }
  fs.rmSync(path.join(dir, COLLECTION_MANIFEST), { force: true })
}

/** Запоминает папки элементов этой генерации — их удалит следующая. */
export function writeCollectionManifest(dir: string, slugs: readonly string[]): void {
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, COLLECTION_MANIFEST), JSON.stringify({ items: [...new Set(slugs)] }, null, 2), 'utf-8')
}
