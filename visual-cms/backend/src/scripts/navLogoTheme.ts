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
 * (при тёмном). Они лежат одна на другой и сменяются прозрачностью — плавно,
 * как текст шапки. Обе меняются в CMS как обычные картинки; перекрашивать
 * логотип фильтром больше не нужно. Тёмная — дубль для глаз: у неё пустой alt
 * и aria-hidden, иначе название читалось бы дважды.
 *
 * Картинкам нужны одинаковые поля: они вписываются в одну рамку, и логотип с
 * прозрачной каймой при смене «прыгал» бы в размере.
 *
 * Чистое преобразование структуры блока; запись — `migrate-nav-logo-theme.ts`.
 */
import { MigrationError, MigrationResult, StructureNode, findOne, hasClass, makeNode } from './choiceToPlanTypes'

export const LOGO_LIGHT_CLASS = 'glogo-light'
export const LOGO_DARK_CLASS = 'glogo-dark'

const CSS_HEAD = '/* ==== nav-logo-theme'
export const NAV_LOGO_CSS_MARKER = `${CSS_HEAD} v2 ====`

export const NAV_LOGO_CSS = `
${NAV_LOGO_CSS_MARKER}
   Логотип под цвет текста шапки: .glogo-light — при белом тексте (logo-light
   и до первого срабатывания скрипта), .glogo-dark — при тёмном (logo-dark).
   Тёмная картинка наложена на светлую: размер и сдвиг у обеих общие
   (.glogo img), смена — прозрачностью за то же время, что и у текста шапки
   (transition у .glogo img в CSS блока). Картинки меняются в CMS;
   перекрашивать их фильтром не нужно, поэтому у светлой темы только тень. */
.glogo {
  position: relative;
}

.glogo .${LOGO_DARK_CLASS} {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  margin: auto 0;
  opacity: 0;
  pointer-events: none;
}

.gnav.logo-dark .glogo .${LOGO_LIGHT_CLASS} {
  opacity: 0;
}

.gnav.logo-dark .glogo .${LOGO_DARK_CLASS} {
  opacity: 1;
}

.gnav.logo-light .glogo img {
  filter: drop-shadow(0 2px 16px rgba(0, 0, 0, .28));
}
`

export interface NavLogoSources {
  /** Логотип при белом тексте; не задан — остаётся текущий. */
  lightSrc?: string
  /** Логотип при тёмном тексте. */
  darkSrc: string
}

/** Атрибуты тёмного логотипа: дубль для глаз, экранному диктору не нужен. */
const DARK_A11Y = { alt: '', 'aria-hidden': 'true' }

function withClass(node: StructureNode, name: string): boolean {
  if (hasClass(node, name)) return false
  const current = (node.attributes?.class ?? '').trim()
  node.attributes = { ...node.attributes, class: current ? `${current} ${name}` : name }
  return true
}

/** Ставит атрибуты картинки; true — если что-то поменялось. */
function withAttributes(node: StructureNode, attrs: Record<string, string>): boolean {
  if (Object.entries(attrs).every(([k, v]) => node.attributes?.[k] === v)) return false
  node.attributes = { ...node.attributes, ...attrs }
  return true
}

export function migrateNavLogoTheme(input: StructureNode, sources: NavLogoSources): MigrationResult {
  const { lightSrc, darkSrc } = sources
  if (!darkSrc.trim()) throw new MigrationError('Навигация: не задана картинка тёмного логотипа')
  if (lightSrc !== undefined && !lightSrc.trim()) throw new MigrationError('Навигация: пустая картинка светлого логотипа')
  const structure: StructureNode = JSON.parse(JSON.stringify(input))
  const changes: string[] = []

  const link = findOne(structure, (n) => hasClass(n, 'glogo'), 'Навигация: ссылка-логотип .glogo')
  const images = (link.children ?? []).filter((c) => c.tagName === 'img')
  if (images.length === 0) throw new MigrationError('Навигация: в .glogo нет картинки логотипа')

  const light = images.find((img) => hasClass(img, LOGO_LIGHT_CLASS)) ?? images.find((img) => !hasClass(img, LOGO_DARK_CLASS))
  if (!light) throw new MigrationError('Навигация: не найдена картинка логотипа для белого текста')
  if (withClass(light, LOGO_LIGHT_CLASS)) {
    light.metadata = { ...light.metadata, name: 'Логотип — при белом тексте' }
    changes.push(`Навигация: логотип ${light.attributes?.src} — для белого текста`)
  }
  if (lightSrc && withAttributes(light, { src: lightSrc })) {
    changes.push(`Навигация: логотип при белом тексте — ${lightSrc}`)
  }

  const dark = images.find((img) => hasClass(img, LOGO_DARK_CLASS))
  if (!dark) {
    const node = makeNode({
      id: `${light.id}-dark`,
      tagName: 'img',
      elementType: 'image',
      attributes: { ...DARK_A11Y, src: darkSrc, class: LOGO_DARK_CLASS },
      metadata: { name: 'Логотип — при тёмном тексте' },
    })
    const children = link.children ?? []
    const at = children.indexOf(light) + 1
    link.children = [...children.slice(0, at), node, ...children.slice(at)]
    changes.push(`Навигация: добавлен логотип для тёмного текста (${darkSrc})`)
  } else {
    if (withAttributes(dark, { src: darkSrc })) changes.push(`Навигация: логотип при тёмном тексте — ${darkSrc}`)
    if (withAttributes(dark, DARK_A11Y)) changes.push('Навигация: тёмный логотип скрыт от экранного диктора (дубль)')
  }

  const metadata = (structure.metadata ??= {})
  const css = typeof metadata.globalCss === 'string' ? metadata.globalCss : ''
  if (!css.includes(NAV_LOGO_CSS_MARKER)) {
    const at = css.indexOf(CSS_HEAD)
    metadata.globalCss = (at === -1 ? css.trimEnd() : css.slice(0, at).trimEnd()) + '\n' + NAV_LOGO_CSS
    changes.push('Навигация: CSS — логотип под цвет текста, плавная смена')
  }

  if (changes.length === 0) return { structure: input, changes, alreadyMigrated: true }
  return { structure, changes, alreadyMigrated: false }
}
