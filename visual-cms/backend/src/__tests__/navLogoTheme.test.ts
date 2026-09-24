/**
 * @jest-environment jsdom
 *
 * Логотип шапки под цвет её текста: две картинки в .glogo, CSS блока
 * показывает нужную по классу темы на .gnav (его ставит syncLogoContrast).
 */
import { MigrationError, StructureNode, incompleteNodes } from '../scripts/choiceToPlanTypes'
import { LOGO_DARK_CLASS, LOGO_LIGHT_CLASS, NAV_LOGO_CSS, NAV_LOGO_CSS_MARKER, migrateNavLogoTheme } from '../scripts/navLogoTheme'

const DARK = '/media/black.png'

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

const logoImages = (root: StructureNode) => {
  const stack = [root]
  while (stack.length) {
    const n = stack.pop()!
    if (n.id === 'logo-link') return n.children!
    stack.push(...(n.children ?? []))
  }
  throw new Error('no .glogo')
}

describe('migrateNavLogoTheme — структура', () => {
  const result = migrateNavLogoTheme(nav(), DARK)
  const [light, dark] = logoImages(result.structure)

  it('текущий логотип — для белого текста, рядом тёмный с той же подписью', () => {
    expect(light.attributes).toMatchObject({ src: '/media/white.png', class: LOGO_LIGHT_CLASS })
    expect(dark.attributes).toEqual({ alt: 'Golden House', src: DARK, class: LOGO_DARK_CLASS })
    expect(dark.tagName).toBe('img')
  })

  it('новая картинка — полный узел: иначе редактор CMS падает на открытии', () => {
    expect(incompleteNodes(dark)).toEqual([])
  })

  it('CSS дописан секцией в конец, прежние правила блока на месте', () => {
    const css = result.structure.metadata!.globalCss as string
    expect(css.startsWith('.gnav.logo-light .glogo img { filter: brightness(0) invert(1); }')).toBe(true)
    expect(css.trimEnd().endsWith(NAV_LOGO_CSS.trimEnd())).toBe(true)
  })

  it('повторный запуск ничего не меняет, вход не мутируется', () => {
    expect(migrateNavLogoTheme(result.structure, DARK).alreadyMigrated).toBe(true)
    const input = nav()
    const snapshot = JSON.stringify(input)
    migrateNavLogoTheme(input, DARK)
    expect(JSON.stringify(input)).toBe(snapshot)
  })

  it('старая версия секции заменяется, а не дописывается второй', () => {
    const old = migrateNavLogoTheme(nav(), DARK).structure
    old.metadata!.globalCss = (old.metadata!.globalCss as string).replace(NAV_LOGO_CSS_MARKER, '/* ==== nav-logo-theme v0 ====')
    const css = migrateNavLogoTheme(old, DARK).structure.metadata!.globalCss as string
    expect(css.split('/* ==== nav-logo-theme')).toHaveLength(2)
    expect(css).toContain(NAV_LOGO_CSS_MARKER)
  })

  it('без .glogo, без картинки или без тёмного логотипа — ошибка', () => {
    const noLink = nav()
    noLink.children![0].children = []
    expect(() => migrateNavLogoTheme(noLink, DARK)).toThrow(MigrationError)
    const noImg = nav()
    logoImages(noImg).length = 0
    expect(() => migrateNavLogoTheme(noImg, DARK)).toThrow(MigrationError)
    expect(() => migrateNavLogoTheme(nav(), ' ')).toThrow(MigrationError)
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
    const shown = (cls: string) => getComputedStyle(document.querySelector(`.${cls}`)!).display !== 'none'
    return { light: shown(LOGO_LIGHT_CLASS), dark: shown(LOGO_DARK_CLASS) }
  }

  it('белый текст (logo-light) — белый логотип', () => {
    expect(mount('logo-light')).toEqual({ light: true, dark: false })
  })

  it('тёмный текст (logo-dark) — тёмный логотип', () => {
    expect(mount('logo-dark')).toEqual({ light: false, dark: true })
  })

  it('до первого срабатывания скрипта — белый, как было', () => {
    expect(mount('')).toEqual({ light: true, dark: false })
  })
})
