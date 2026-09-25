/**
 * Публикация и снятие страниц: какие файлы принадлежат странице и что делает
 * «Опубликовать сайт».
 *
 * Зачем отдельный модуль. До него снятие удаляло только `/<slug>/`, а с
 * языковыми префиксами страница лежит ещё в `/<язык>/<slug>/` — после
 * «снятия» она продолжала открываться. А «Опубликовать сайт» выкладывал все
 * страницы кроме архивных и ставил им `published`, так что снятые черновики
 * возвращались на сайт первым же общим деплоем.
 *
 * Правило теперь одно: статус — источник истины. Опубликовать сайт = выложить
 * опубликованные и убрать файлы остальных.
 */
import * as fs from 'fs'
import * as path from 'path'

/**
 * Файлы, которые деплой кладёт для страницы: распознаватель языка в корне,
 * страница в каждом языке и плоский `<slug>.html` старого формата.
 *
 * Языки передаются ВСЕ, а не только активные: язык могли выключить после
 * деплоя, а его копия страницы осталась бы висеть.
 */
export function publishedFiles(
  siteDir: string,
  slug: string,
  isHome: boolean,
  languageCodes: string[]
): string[] {
  const rel = isHome ? 'index.html' : path.join(slug, 'index.html')
  const files = [path.join(siteDir, rel), ...languageCodes.map((code) => path.join(siteDir, code, rel))]
  if (!isHome) files.push(path.join(siteDir, `${slug}.html`))
  return files
}

/**
 * Удаляет файлы страницы и опустевшие папки её адреса.
 *
 * Папки удаляются только пустые и только вверх до корня сайта или папки языка.
 * Целиком каталог `<slug>/` не сносим: под ним могут жить другие адреса —
 * например, страницы коллекции `/complex/<проект>/` под страницей `/complex`.
 */
export function removePublishedFiles(siteDir: string, files: string[], languageCodes: string[]): string[] {
  const stop = new Set([path.resolve(siteDir), ...languageCodes.map((c) => path.resolve(siteDir, c))])
  const removed: string[] = []
  for (const file of files) {
    if (!fs.existsSync(file)) continue
    fs.unlinkSync(file)
    removed.push(file)
    let dir = path.resolve(path.dirname(file))
    while (!stop.has(dir) && dir.startsWith(path.resolve(siteDir)) && isEmptyDir(dir)) {
      fs.rmdirSync(dir)
      dir = path.dirname(dir)
    }
  }
  return removed
}

function isEmptyDir(dir: string): boolean {
  try {
    return fs.readdirSync(dir).length === 0
  } catch {
    return false
  }
}

export type PageStatus = 'draft' | 'published' | 'archived'

/**
 * Какой статус записать при сохранении страницы из редактора.
 *
 * «Опубликовано» ставят и снимают только публикация и снятие (routes/deploy):
 * при прямой смене статуса файлы на сайте расходились со статусом — страница
 * «черновик» открывалась, «опубликованная» отдавала 404. Черновик ↔ архив
 * менять можно. `undefined` — статус не трогать.
 */
export function allowedStatusChange(current: string, requested: unknown): PageStatus | undefined {
  if (requested === undefined || requested === current) return undefined
  if (requested === 'published' || current === 'published') return undefined
  if (requested === 'draft' || requested === 'archived') return requested
  return undefined
}

/** Статус новой страницы: опубликованной она становится только публикацией. */
export function initialStatus(requested: unknown): PageStatus {
  return requested === 'archived' ? 'archived' : 'draft'
}

export interface PublicationCandidate {
  id: string
  slug: string
  status: string
}

/**
 * Что делает «Опубликовать сайт»: какие страницы выложить и чьи файлы убрать.
 *
 * - выкладываются только опубликованные;
 * - файлы остальных убираются, если их адрес не занят опубликованной
 *   страницей (иначе снесли бы её файлы) и это не главная — корень сайта
 *   чисткой не трогаем, главную снимают сменой главной в настройках сайта.
 */
// --- Варианты страницы ---
//
// Вариант — черновик с тем же адресом (сайт + slug), что у другой страницы.
// Черновиков у адреса сколько угодно, опубликован всегда один: это держит
// частичный уникальный индекс в базе (migrations/page-variants-published-address.sql).
// Опубликовать вариант = заменить им опубликованный на том же адресе.

export interface AddressCandidate extends PublicationCandidate {
  siteId?: string | null
}

/** Один ли адрес у страниц: тот же сайт и тот же slug. */
export function sameAddress(a: AddressCandidate, b: AddressCandidate): boolean {
  return a.slug === b.slug && (a.siteId ?? null) === (b.siteId ?? null)
}

/** Опубликованный вариант того же адреса — другая страница, которую заменит публикация. */
export function findPublishedSibling<T extends AddressCandidate>(page: AddressCandidate, pages: T[]): T | undefined {
  return pages.find((p) => p.id !== page.id && p.status === 'published' && sameAddress(p, page))
}

/**
 * Файлы прежнего варианта, которые новый не перезаписал: языковые версии,
 * которых у нового нет. Их убирают, иначе на `/uz/<адрес>` висел бы прежний.
 */
export function leftoverFiles(previous: string[], written: string[]): string[] {
  const done = new Set(written.map((f) => path.resolve(f)))
  return previous.filter((f) => !done.has(path.resolve(f)))
}

/**
 * Почему нельзя сменить адрес или сайт страницы; `null` — можно.
 *
 * У опубликованной нельзя: файлы остались бы по старому адресу, а сам адрес
 * последней публикации нигде не хранится. Сначала снять с публикации.
 */
export function addressChangeError(
  page: AddressCandidate,
  patch: { slug?: unknown; siteId?: unknown }
): string | null {
  if (page.status !== 'published') return null
  if (patch.slug !== undefined && patch.slug !== page.slug) {
    return 'Адрес опубликованной страницы менять нельзя: сначала снимите её с публикации.'
  }
  if (patch.siteId !== undefined && (patch.siteId ?? null) !== (page.siteId ?? null)) {
    return 'Опубликованную страницу нельзя перенести в другой сайт: сначала снимите её с публикации.'
  }
  return null
}

const VARIANT_SUFFIX = / — вариант \d+$/

/** Имя нового варианта: «Harizma — вариант 3», где 3 — порядковый номер у адреса. */
export function variantName(name: string, pagesAtAddress: number): string {
  return `${name.replace(VARIANT_SUFFIX, '')} — вариант ${pagesAtAddress + 1}`
}

export function planSiteSync<T extends PublicationCandidate>(
  pages: T[],
  isHome: (page: T) => boolean
): { deploy: T[]; cleanup: T[] } {
  const deploy = pages.filter((p) => p.status === 'published')
  const liveSlugs = new Set(deploy.map((p) => p.slug))
  const cleanup = pages.filter((p) => p.status !== 'published' && !liveSlugs.has(p.slug) && !isHome(p))
  return { deploy, cleanup }
}
