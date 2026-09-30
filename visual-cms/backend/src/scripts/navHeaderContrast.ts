/**
 * Шапка: цвет текста — по тому, что лежит ЗА ней, а не под ней.
 *
 * syncLogoContrast (скрипт блока «Navigation») решал, светлый у шапки текст
 * или тёмный, по точкам на 12 px НИЖЕ её нижней кромки. На странице проекта
 * шапка висит над светлой полосой, а сразу под ней начинается фото. При
 * уменьшенном масштабе (80%) фото подходит к шапке ближе, точки попадали на
 * него, цвет фото не определяется — и срабатывал дефолт «тёмный фон»: белый
 * текст на светлой полосе. При увеличении точки оставались в полосе, и всё
 * было верно.
 *
 * Теперь точки — на средней линии самой шапки. Элементы шапки при пробе
 * пропускаются (`el.closest(".gnav")`), поэтому видно то, на чём лежит её
 * текст: светлая полоса — тёмный текст, фото — светлый.
 *
 * Правится globalJs блока и кэш-копии блока в страницах (linked-экземпляры):
 * на деплое берётся библиотечный блок, но старой логики не должно остаться
 * нигде. Чистое преобразование; запись — `migrate-nav-header-contrast.ts`.
 */
import { StructureNode, walk } from './choiceToPlanTypes'

export const PROBE_BEFORE = '    const y = clamp(box.bottom + 12, 1, window.innerHeight - 1);'

export const PROBE_AFTER = `    // Пробы — за самой шапкой, по её средней линии: цвет текста решает то, на
    // чём он лежит. Раньше мерили на 12 px ниже шапки — на странице проекта
    // там уже начиналось фото, и над светлой полосой текст белел (при
    // уменьшенном масштабе фото подходит к шапке ближе).
    const y = clamp(box.top + box.height / 2, 1, window.innerHeight - 1);`

export interface NavContrastResult {
  structure: StructureNode
  /** id узлов, чей globalJs поправлен. */
  patched: string[]
  alreadyMigrated: boolean
}

/** Скрипт шапки с пробой за шапкой; остальное — как было. */
export function patchContrastJs(js: string): string {
  return js.split(PROBE_BEFORE).join(PROBE_AFTER)
}

export function migrateNavHeaderContrast(input: StructureNode): NavContrastResult {
  const structure: StructureNode = JSON.parse(JSON.stringify(input))
  const patched: string[] = []
  walk(structure, (node) => {
    const js = node.metadata?.globalJs
    if (typeof js !== 'string' || !js.includes(PROBE_BEFORE)) return
    node.metadata!.globalJs = patchContrastJs(js)
    patched.push(node.id ?? '(корень)')
  })
  if (patched.length === 0) return { structure: input, patched, alreadyMigrated: true }
  return { structure, patched, alreadyMigrated: false }
}
