/**
 * Кнопки языка в мобильном меню шапки (блок «Navigation», 3d23aed7).
 *
 * Язык переключает рантайм CMS (HtmlGenerator.generateLanguageSwitcher): он
 * привязывается к кнопкам с data-lang-switch и подсвечивает текущий язык по
 * data-lang-active. В шапке для компьютера у кнопок RU/UZ оба атрибута есть. В
 * выдвижном меню телефона (.gnav-drawer-lang) те же кнопки перенесены из
 * дизайна без них, и нажатие только перекрашивало кнопку (обработчик дизайна
 * в скрипте блока) — перехода на другой язык не было. А шапка для компьютера
 * на телефоне скрыта: язык там было не переключить вовсе.
 *
 * Правка: кнопка меню получает атрибуты кнопки шапки с тем же текстом.
 * Жёсткий class="active" снимается — текущий язык подсвечивает рантайм, иначе
 * на /uz/ горел бы RU.
 *
 * Чистое преобразование; запись — migrate-nav-drawer-lang.ts.
 */
import { MigrationError, MigrationResult, StructureNode, findAll, hasClass } from './choiceToPlanTypes'

const SWITCH_CLASS = 'language-switch'
const DRAWER_CLASS = 'gnav-drawer-lang'
const ACTIVE_CLASS = 'active'
const LANG_ATTRIBUTES = ['data-lang-switch', 'data-lang-active'] as const

function buttonsOf(node: StructureNode): StructureNode[] {
  return (node.children ?? []).filter((c) => c.tagName === 'button')
}

/** Подпись кнопки — по ней кнопки меню и шапки находят пару. */
function labelOf(button: StructureNode): string {
  return (button.content ?? '').trim().toUpperCase()
}

function exactlyOne(nodes: StructureNode[], what: string): StructureNode {
  if (nodes.length !== 1) throw new MigrationError(`Навигация: ожидался один ${what}, найдено ${nodes.length}`)
  return nodes[0]
}

export function migrateNavDrawerLang(input: StructureNode): MigrationResult {
  const structure: StructureNode = JSON.parse(JSON.stringify(input))
  const changes: string[] = []

  const switches = findAll(structure, (n) => hasClass(n, SWITCH_CLASS))
  const header = exactlyOne(switches.filter((n) => !hasClass(n, DRAWER_CLASS)), 'переключатель языка в шапке')
  const drawer = exactlyOne(switches.filter((n) => hasClass(n, DRAWER_CLASS)), 'переключатель языка в мобильном меню')

  const byLabel = new Map<string, Record<string, string>>()
  for (const button of buttonsOf(header)) {
    const attrs = button.attributes ?? {}
    if (!attrs['data-lang-switch']) {
      throw new MigrationError(`Навигация: у кнопки «${labelOf(button)}» в шапке нет data-lang-switch — не с чего брать язык`)
    }
    byLabel.set(labelOf(button), Object.fromEntries(LANG_ATTRIBUTES.map((key) => [key, attrs[key] ?? attrs['data-lang-switch']])))
  }

  const buttons = buttonsOf(drawer)
  if (buttons.length === 0) throw new MigrationError('Навигация: в мобильном меню нет кнопок языка')
  for (const button of buttons) {
    const lang = byLabel.get(labelOf(button))
    if (!lang) throw new MigrationError(`Навигация: для кнопки «${labelOf(button)}» мобильного меню нет пары в шапке`)
    const attrs: Record<string, string> = { ...(button.attributes ?? {}) }
    let changed = false
    for (const key of LANG_ATTRIBUTES) {
      if (attrs[key] !== lang[key]) {
        attrs[key] = lang[key]
        changed = true
      }
    }
    if (hasClass(button, ACTIVE_CLASS)) {
      const rest = (attrs.class ?? '').split(/\s+/).filter((c) => c && c !== ACTIVE_CLASS)
      if (rest.length) attrs.class = rest.join(' ')
      else delete attrs.class
      changed = true
    }
    if (changed) {
      button.attributes = attrs
      changes.push(`Навигация: кнопка «${labelOf(button)}» мобильного меню переключает язык (${lang['data-lang-switch']})`)
    }
  }

  if (changes.length === 0) return { structure: input, changes, alreadyMigrated: true }
  return { structure, changes, alreadyMigrated: false }
}
