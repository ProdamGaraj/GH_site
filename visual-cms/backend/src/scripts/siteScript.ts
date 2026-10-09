/**
 * Сведение общего скрипта сайта в один Site JS.
 *
 * Что было: скрипт шапки из статичного прототипа (контраст логотипа, язык,
 * меню, SEO, формы, виджеты, подвал, дорожная карта) лежал копиями в JS 14
 * блоков и страницы news, в трёх разных версиях. Генератор убирает только
 * одинаковые копии, поэтому на страницах проектов скрипт выполнялся дважды
 * (копия внутри скрипта фильтров), а на главной — ни разу.
 *
 * Как стало: один Site JS (scripts/assets/site-runtime.js) — только то, что
 * сайту ещё нужно; из блоков и страниц копии вырезаются. Что убрано из
 * скрипта и почему — в шапке site-runtime.js.
 *
 * Здесь только чистые преобразования: чтение и запись — в
 * `migrate-site-script.ts`. Все правки идемпотентны.
 */
import { MigrationError } from './choiceToPlanTypes'

/** Начало первой строки Site JS любой версии — по нему узнаём свой скрипт. */
export const SITE_JS_HEAD = '/* Общий скрипт сайта Golden House (Site JS), v'

/** Первая строка текущей версии — по ней видно, что она уже стоит. */
export const SITE_JS_MARKER = `${SITE_JS_HEAD}2.`

/** Начало скрипта шапки во всех найденных версиях. */
const HEADER_START = 'function syncLogoContrast() {'

/** Конец скрипта шапки во всех версиях: запуск на DOMContentLoaded. */
const HEADER_END_RE =
  /window\.addEventListener\("DOMContentLoaded",\s*\(\)\s*=>\s*\{\s*syncLogoContrast\(\);\s*bootTechnicalFeatures\(\);\s*\}\);\s*syncLogoContrast\(\);/

/** Признак того, что копия скрипта шапки где-то осталась. */
const HEADER_SIGNATURE = 'function bootTechnicalFeatures'

export function hasHeaderScript(js: string | null | undefined): boolean {
  return typeof js === 'string' && js.includes(HEADER_SIGNATURE)
}

/**
 * Вырезает копию скрипта шапки, сохраняя код до и после неё.
 *
 * У блока «Выбрать» после копии идёт скрипт фильтров — он должен остаться.
 * Если начало найдено, а конца нет, или после вырезания копия осталась,
 * это другая версия скрипта: ошибка, а не тихая порча JS.
 */
export function stripHeaderScript(js: string, label: string): { js: string; removed: boolean } {
  const start = js.indexOf(HEADER_START)
  if (start === -1 || !hasHeaderScript(js)) return { js, removed: false }
  const rest = js.slice(start)
  const end = HEADER_END_RE.exec(rest)
  if (!end) throw new MigrationError(`${label}: не найден конец скрипта шапки — другая версия, не трогаю`)
  const span = rest.slice(0, end.index + end[0].length)
  if (!span.includes(HEADER_SIGNATURE)) {
    throw new MigrationError(`${label}: вырезаемый кусок — не скрипт шапки`)
  }
  const before = js.slice(0, start).trim()
  const after = rest.slice(span.length).trim()
  const out = [before, after].filter(Boolean).join('\n\n')
  if (hasHeaderScript(out)) {
    throw new MigrationError(`${label}: после вырезания копия скрипта шапки осталась — их две`)
  }
  return { js: out, removed: true }
}

export interface ScriptOwner {
  id: string
  label: string
  js: string
}

export interface SiteScriptPlan {
  siteJs: string
  /** Новые JS тех блоков и страниц, из которых вырезана копия. */
  updates: Array<{ id: string; label: string; js: string }>
  changes: string[]
}

/**
 * План сведения: что положить в Site JS и какие JS блоков/страниц переписать.
 *
 * Наш скрипт прежней версии (начинается с SITE_JS_HEAD) заменяется текущим
 * целиком — правки руками в нём не предусмотрены, копия старого уходит в
 * резервную копию миграции. Site JS, в котором уже что-то есть (и это не наш
 * скрипт), не трогаем — ошибка: чужой код молча затирать нельзя.
 */
export function planSiteScript(
  currentSiteJs: string,
  runtime: string,
  owners: ScriptOwner[]
): SiteScriptPlan {
  if (!runtime.startsWith(SITE_JS_MARKER)) {
    throw new MigrationError('site-runtime.js начинается не с маркера — файл повреждён?')
  }
  const changes: string[] = []
  let siteJs = currentSiteJs
  const current = (currentSiteJs || '').trim()
  if (current.startsWith(SITE_JS_MARKER)) {
    // Текущая версия уже стоит.
  } else if (current.startsWith(SITE_JS_HEAD)) {
    siteJs = runtime
    changes.push('Site JS: обновлён до новой версии (тексты окон на языке страницы, промо-окно реже, чат на телефоне)')
  } else if (current) {
    throw new MigrationError('В Site JS уже есть другой код — проверьте его и очистите вручную')
  } else {
    siteJs = runtime
    changes.push('Site JS: общий скрипт сайта (виджеты, формы, дорожная карта, события)')
  }

  const updates: SiteScriptPlan['updates'] = []
  for (const owner of owners) {
    const { js, removed } = stripHeaderScript(owner.js || '', owner.label)
    if (!removed) continue
    updates.push({ id: owner.id, label: owner.label, js })
    changes.push(`${owner.label}: копия скрипта шапки убрана${js ? ' (свой код сохранён)' : ''}`)
  }
  return { siteJs, updates, changes }
}
