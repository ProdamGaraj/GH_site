/**
 * Логотип шапки под цвет её текста.
 *
 * Шапка сама решает, светлый у неё текст или тёмный: syncLogoContrast (скрипт
 * блока «Navigation») смотрит на фон под ней и ставит на .gnav класс
 * logo-light (белый текст) или logo-dark (тёмный). Логотип же был один —
 * белая картинка, — и на светлом фоне с тёмным текстом оставался белым.
 * В дизайне там стоял цветной логотип, а белый получался фильтром; в CMS
 * картинку заменили на белую, и тёмного варианта не стало.
 *
 * Теперь в .glogo две картинки: .glogo-light (при белом тексте) и .glogo-dark
 * (при тёмном), CSS блока показывает нужную. Обе меняются в CMS как обычные
 * картинки; перекрашивать логотип фильтром больше не нужно.
 *
 * Чистое преобразование структуры блока; запись — `migrate-nav-logo-theme.ts`.
 */
import { MigrationError, MigrationResult, StructureNode, findOne, hasClass, makeNode } from './choiceToPlanTypes'

export const LOGO_LIGHT_CLASS = 'glogo-light'
export const LOGO_DARK_CLASS = 'glogo-dark'

const CSS_HEAD = '/* ==== nav-logo-theme'
export const NAV_LOGO_CSS_MARKER = `${CSS_HEAD} v1 ====`

export const NAV_LOGO_CSS = `
${NAV_LOGO_CSS_MARKER}
   Логотип под цвет текста шапки: .glogo-light — при белом тексте (logo-light
   и до первого срабатывания скрипта), .glogo-dark — при тёмном (logo-dark).
   Картинки меняются в CMS; перекрашивать их фильтром не нужно, поэтому у
   светлой темы остаётся только тень. */
.glogo .${LOGO_DARK_CLASS} {
  display: none;
}

.gnav.logo-dark .glogo .${LOGO_LIGHT_CLASS} {
  display: none;
}

.gnav.logo-dark .glogo .${LOGO_DARK_CLASS} {
  display: block;
}

.gnav.logo-light .glogo img {
  filter: drop-shadow(0 2px 16px rgba(0, 0, 0, .28));
}
`

function withClass(node: StructureNode, name: string): boolean {
  if (hasClass(node, name)) return false
  const current = (node.attributes?.class ?? '').trim()
  node.attributes = { ...node.attributes, class: current ? `${current} ${name}` : name }
  return true
}

/**
 * @param darkSrc картинка логотипа для тёмного текста (ссылка медиатеки)
 */
export function migrateNavLogoTheme(input: StructureNode, darkSrc: string): MigrationResult {
  if (!darkSrc.trim()) throw new MigrationError('Навигация: не задана картинка тёмного логотипа')
  const structure: StructureNode = JSON.parse(JSON.stringify(input))
  const changes: string[] = []

  const link = findOne(structure, (n) => hasClass(n, 'glogo'), 'Навигация: ссылка-логотип .glogo')
  const images = (link.children ?? []).filter((c) => c.tagName === 'img')
  if (images.length === 0) throw new MigrationError('Навигация: в .glogo нет картинки логотипа')

  const light = images.find((img) => hasClass(img, LOGO_LIGHT_CLASS)) ?? images.find((img) => !hasClass(img, LOGO_DARK_CLASS))
  if (!light) throw new MigrationError('Навигация: не найдена картинка логотипа для белого текста')
  if (withClass(light, LOGO_LIGHT_CLASS)) {
    light.metadata = { ...light.metadata, name: 'Логотип — при белом тексте' }
    changes.push(`Навигация: текущий логотип (${light.attributes?.src}) — для белого текста`)
  }

  if (!images.some((img) => hasClass(img, LOGO_DARK_CLASS))) {
    const dark = makeNode({
      id: `${light.id}-dark`,
      tagName: 'img',
      elementType: 'image',
      attributes: { alt: light.attributes?.alt ?? '', src: darkSrc, class: LOGO_DARK_CLASS },
      metadata: { name: 'Логотип — при тёмном тексте' },
    })
    const children = link.children ?? []
    link.children = [...children.slice(0, children.indexOf(light) + 1), dark, ...children.slice(children.indexOf(light) + 1)]
    changes.push(`Навигация: добавлен логотип для тёмного текста (${darkSrc})`)
  }

  const metadata = (structure.metadata ??= {})
  const css = typeof metadata.globalCss === 'string' ? metadata.globalCss : ''
  if (!css.includes(NAV_LOGO_CSS_MARKER)) {
    const at = css.indexOf(CSS_HEAD)
    metadata.globalCss = (at === -1 ? css.trimEnd() : css.slice(0, at).trimEnd()) + '\n' + NAV_LOGO_CSS
    changes.push('Навигация: CSS показывает логотип под цвет текста')
  }

  if (changes.length === 0) return { structure: input, changes, alreadyMigrated: true }
  return { structure, changes, alreadyMigrated: false }
}
