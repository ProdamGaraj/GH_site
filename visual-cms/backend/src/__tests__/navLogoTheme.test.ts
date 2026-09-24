/**
 * @jest-environment jsdom
 *
 * Логотип шапки под цвет её текста: две картинки в .glogo, наложенные одна на
 * другую; CSS блока показывает нужную прозрачностью по классу темы на .gnav
 * (его ставит syncLogoContrast).
 */
import { MigrationError, StructureNode, incompleteNodes } from '../scripts/choiceToPlanTypes'
import { LOGO_DARK_CLASS, LOGO_LIGHT_CLASS, NAV_LOGO_CSS, NAV_LOGO_CSS_MARKER, migrateNavLogoTheme } from '../scripts/navLogoTheme'

const LIGHT = '/media/white-yellow.png'
const DARK = '/media/black-yellow.png'
const SOURCES = { lightSrc: LIGHT, darkSrc: DARK }

function nav(): StructureNode {
  return {
    id: 'header',
    tagName: 'div',
    attributes: { class: 'site-header' },
    metadata: { globalCss: '.gnav.logo-light .glogo img { filter: brightness(0) invert(1); }\n' },
    children: [
      {
        id: 'gnav',
        tagName: 'nav',
        attributes: { class: 'gnav' },
        children: [
          {
            id: 'logo-link',
            tagName: 'a',
            attributes: { href: '/', class: 'glogo' },
            children: [{ id: 'logo', tagName: 'img', elementType: 'image', attributes: { alt: 'Golden House', src: '/media/white.png' } }],
          },
          { id: 'menu', tagName: 'div', attributes: { class: 'gmenu' }, children: [] },
        ],
      },
    ],
  }
}

function logoImages(root: StructureNode): StructureNode[] {
  const stack = [root]
  while (stack.length) {
    const n = stack.pop()!
    if (n.id === 'logo-link') return n.children!
    stack.push(...(n.children ?? []))
  }
  throw new Error('no .glogo')
}

/** Блок после первой версии: тёмный логотип виден через display, у картинки — alt-дубль. */
function navV1(): StructureNode {
  const v1 = nav()
  const link = logoImages(v1)
  link[0].attributes = { ...link[0].attributes, class: LOGO_LIGHT_CLASS }
  link.push({ id: 'logo-dark', tagName: 'img', elementType: 'image', attributes: { alt: 'Golden House', src: '/media/black.png', class: LOGO_DARK_CLASS }, children: [], styles: { properties: {} }, metadata: {} })
  v1.metadata!.globalCss += '\n/* ==== nav-logo-theme v1 ====\n*/\n.glogo .glogo-dark { display: none; }\n'
  return v1
}

describe('migrateNavLogoTheme — структура', () => {
  const result = migrateNavLogoTheme(nav(), SOURCES)
  const [light, dark] = logoImages(result.structure)

  it('светлый логотип — присланный, с подписью; рядом тёмный', () => {
    expect(light.attributes).toEqual({ alt: 'Golden House', src: LIGHT, class: LOGO_LIGHT_CLASS })
    expect(dark.tagName).toBe('img')
    expect(dark.attributes).toMatchObject({ src: DARK, class: LOGO_DARK_CLASS })
  })

  it('тёмный — дубль для глаз: пустой alt и aria-hidden, название не читается дважды', () => {
    expect(dark.attributes).toMatchObject({ alt: '', 'aria-hidden': 'true' })
  })

  it('новая картинка — полный узел: иначе редактор CMS падает на открытии', () => {
    expect(incompleteNodes(dark)).toEqual([])
  })

  it('CSS дописан секцией в конец, прежние правила блока на месте', () => {
    const css = result.structure.metadata!.globalCss as string
    expect(css.startsWith('.gnav.logo-light .glogo img { filter: brightness(0) invert(1); }')).toBe(true)
    expect(css.trimEnd().endsWith(NAV_LOGO_CSS.trimEnd())).toBe(true)
  })

  it('без lightSrc светлый логотип остаётся прежним', () => {
    const [keep] = logoImages(migrateNavLogoTheme(nav(), { darkSrc: DARK }).structure)
    expect(keep.attributes!.src).toBe('/media/white.png')
  })

  it('повторный запуск ничего не меняет, вход не мутируется', () => {
    expect(migrateNavLogoTheme(result.structure, SOURCES).alreadyMigrated).toBe(true)
    const input = nav()
    const snapshot = JSON.stringify(input)
    migrateNavLogoTheme(input, SOURCES)
    expect(JSON.stringify(input)).toBe(snapshot)
  })

  it('с v1: картинки меняются на присланные, тёмная скрыта от диктора, CSS v1 заменён на v2', () => {
    const upgraded = migrateNavLogoTheme(navV1(), SOURCES)
    const images = logoImages(upgraded.structure)
    expect(images).toHaveLength(2)
    expect(images[0].attributes!.src).toBe(LIGHT)
    expect(images[1].attributes).toMatchObject({ src: DARK, alt: '', 'aria-hidden': 'true' })
    const css = upgraded.structure.metadata!.globalCss as string
    expect(css.split('/* ==== nav-logo-theme')).toHaveLength(2)
    expect(css).toContain(NAV_LOGO_CSS_MARKER)
    expect(css).not.toContain('display: none')
  })

  it('без .glogo, без картинки или без тёмного логотипа — ошибка', () => {
    const noLink = nav()
    noLink.children![0].children = []
    expect(() => migrateNavLogoTheme(noLink, SOURCES)).toThrow(MigrationError)
    const noImg = nav()
    logoImages(noImg).length = 0
    expect(() => migrateNavLogoTheme(noImg, SOURCES)).toThrow(MigrationError)
    expect(() => migrateNavLogoTheme(nav(), { darkSrc: ' ' })).toThrow(MigrationError)
    expect(() => migrateNavLogoTheme(nav(), { lightSrc: '', darkSrc: DARK })).toThrow(MigrationError)
  })
})

describe('CSS логотипа в браузере', () => {
  beforeAll(() => {
    const style = document.createElement('style')
    style.textContent = NAV_LOGO_CSS
    document.head.appendChild(style)
  })

  function mount(theme: string) {
    document.body.innerHTML = `
      <nav class="gnav ${theme}">
        <a class="glogo"><img class="${LOGO_LIGHT_CLASS}" src="/w.png"><img class="${LOGO_DARK_CLASS}" src="/b.png"></a>
      </nav>`
    const opacity = (cls: string) => getComputedStyle(document.querySelector(`.${cls}`)!).opacity || '1'
    return { light: opacity(LOGO_LIGHT_CLASS), dark: opacity(LOGO_DARK_CLASS) }
  }

  it('белый текст (logo-light) — виден светлый логотип', () => {
    expect(mount('logo-light')).toEqual({ light: '1', dark: '0' })
  })

  it('тёмный текст (logo-dark) — виден тёмный логотип', () => {
    expect(mount('logo-dark')).toEqual({ light: '0', dark: '1' })
  })

  it('до первого срабатывания скрипта — светлый, как было', () => {
    expect(mount('')).toEqual({ light: '1', dark: '0' })
  })

  it('тёмный наложен на светлый и не перехватывает клик по ссылке', () => {
    mount('logo-light')
    const dark = getComputedStyle(document.querySelector(`.${LOGO_DARK_CLASS}`)!)
    expect(dark.position).toBe('absolute')
    expect(dark.pointerEvents).toBe('none')
  })
})
