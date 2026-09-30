/**
 * @jest-environment jsdom
 *
 * Цвет текста шапки — по тому, что лежит за ней. Настоящий скрипт блока
 * «Navigation» (снимок со стенда) запускается в jsdom до и после правки;
 * `elementsFromPoint` отдаёт стек, как на странице проекта: сверху светлая
 * полоса, с 176 px — фото (его цвет скрипт не определяет).
 */
import navigationBlock from './fixtures/navigationBlock.json'
import { StructureNode } from '../scripts/choiceToPlanTypes'
import {
  CAROUSEL_THEME_FN,
  LISTENER_AFTER,
  LISTENER_ANCHOR,
  PROBE_AFTER,
  PROBE_BEFORE,
  SKIP_AFTER,
  SKIP_BEFORE,
  migrateNavHeaderContrast,
  patchContrastJs,
} from '../scripts/navHeaderContrast'

const BLOCK = navigationBlock as unknown as StructureNode
const LIVE_JS = BLOCK.metadata!.globalJs as string

/** Шапка-«пилюля»: 15..165 px по высоте. */
const HEADER = { top: 15, bottom: 165, height: 150, left: 380, width: 1145 }

function mount(js: string, photoFrom: number): HTMLElement {
  document.body.innerHTML = `
    <div class="band" style="background-color: rgb(233, 236, 240)"></div>
    <div class="photo" style="background-image: url('/media/hero.jpg')"></div>
    <nav class="gnav"></nav>`
  const nav = document.querySelector('.gnav') as HTMLElement
  nav.getBoundingClientRect = () => ({ ...HEADER, right: HEADER.left + HEADER.width, x: HEADER.left, y: HEADER.top }) as DOMRect
  const band = document.querySelector('.band')!
  const photo = document.querySelector('.photo')!
  ;(document as any).elementsFromPoint = (_x: number, y: number) => {
    const under = y < photoFrom ? [band] : [photo]
    // Если точка на шапке — сама шапка сверху стека (скрипт её пропускает).
    return y >= HEADER.top && y <= HEADER.bottom ? [nav, ...under] : under
  }
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1920 })
  new Function(js)()
  ;(window as any).syncLogoContrast()
  return nav
}

const textColor = (nav: HTMLElement) =>
  nav.classList.contains('logo-dark') ? 'тёмный' : nav.classList.contains('logo-light') ? 'белый' : '?'

afterEach(() => {
  delete (window as any).syncLogoContrast
  document.body.innerHTML = ''
})

describe('скрипт шапки со стенда: проба под шапкой', () => {
  it('в фикстуре старая проба — та, что на стенде', () => {
    expect(LIVE_JS).toContain(PROBE_BEFORE)
  })

  it('баг: фото сразу под шапкой (масштаб 80%) — белый текст на светлой полосе', () => {
    expect(textColor(mount(LIVE_JS, 176))).toBe('белый')
  })
})

describe('после правки: проба за шапкой', () => {
  const fixed = patchContrastJs(LIVE_JS)

  it('светлая полоса за шапкой — тёмный текст, как бы близко ни было фото', () => {
    expect(textColor(mount(fixed, 176))).toBe('тёмный')
    expect(textColor(mount(fixed, 400))).toBe('тёмный')
  })

  it('шапка над фото (страница прокручена или фото с самого верха) — белый текст', () => {
    expect(textColor(mount(fixed, 0))).toBe('белый')
  })

  it('заменены только проба и опрос слайда, остальной скрипт цел', () => {
    expect(fixed).not.toContain(PROBE_BEFORE)
    expect(fixed).toContain(PROBE_AFTER)
    const reverted = fixed
      .replace(PROBE_AFTER, PROBE_BEFORE)
      .replace(CAROUSEL_THEME_FN, '')
      .replace(SKIP_AFTER, SKIP_BEFORE)
      .replace(LISTENER_AFTER, LISTENER_ANCHOR)
    expect(reverted).toBe(LIVE_JS)
  })

  it('уже поправленный скрипт второй раз не правится', () => {
    expect(patchContrastJs(fixed)).toBe(fixed)
  })
})

describe('после правки: шапка над слайдером', () => {
  const fixed = patchContrastJs(LIVE_JS)

  /**
   * Слайдер с самого верха страницы, шапка над ним. Под точками пробы —
   * слайд `underPoint` (при листании лентой это ещё прошлый кадр), активный —
   * с классом is-active.
   */
  function mountSlider(themes: Array<string | null>, active: number, underPoint: number, live: Array<string | null> = []): HTMLElement {
    const slides = themes
      .map((theme, i) => {
        const attrs = [theme ? `data-header-theme="${theme}"` : '', live[i] ? `data-header-theme-live="${live[i]}"` : '']
        return `<div class="slide${i === active ? ' is-active' : ''}" data-carousel-slide="true" id="s${i}" ${attrs.join(' ')}
                     style="background-image: url('/media/s${i}.jpg')"></div>`
      })
      .join('')
    document.body.innerHTML = `
      <div data-carousel="true" id="hero"><div data-carousel-track="true">${slides}</div></div>
      <nav class="gnav"></nav>`
    const nav = document.querySelector('.gnav') as HTMLElement
    nav.getBoundingClientRect = () => ({ ...HEADER, right: HEADER.left + HEADER.width, x: HEADER.left, y: HEADER.top }) as DOMRect
    const hero = document.getElementById('hero')!
    ;(document as any).elementsFromPoint = () => [nav, document.getElementById(`s${underPoint}`)!, hero.firstElementChild!, hero]
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1920 })
    new Function(fixed)()
    ;(window as any).syncLogoContrast()
    return nav
  }

  it('тема — у активного слайда, даже если под шапкой ещё прошлый кадр', () => {
    expect(textColor(mountSlider(['light', 'dark'], 1, 0))).toBe('белый')
    expect(textColor(mountSlider(['light', 'dark'], 0, 1))).toBe('тёмный')
  })

  it('у видео-слайда без метки — тема кадра от карусели (data-header-theme-live)', () => {
    expect(textColor(mountSlider([null, null], 0, 0, ['light']))).toBe('тёмный')
  })

  it('ручная метка главнее темы кадра', () => {
    expect(textColor(mountSlider(['dark'], 0, 0, ['light']))).toBe('белый')
  })

  it('без меток — как раньше: фото не определить, светлый текст', () => {
    expect(textColor(mountSlider([null, null], 0, 0))).toBe('белый')
  })

  it('смена слайда (carousel:change) перекрашивает шапку без прокрутки', async () => {
    jest.useRealTimers()
    const nav = mountSlider(['light', 'dark'], 0, 0)
    expect(textColor(nav)).toBe('тёмный')
    document.getElementById('s0')!.classList.remove('is-active')
    document.getElementById('s1')!.classList.add('is-active')
    document.getElementById('hero')!.dispatchEvent(new CustomEvent('carousel:change', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(textColor(nav)).toBe('белый')
  })
})

describe('migrateNavHeaderContrast', () => {
  it('правит globalJs блока; повторный запуск ничего не меняет; исходник не мутируется', () => {
    const snapshot = JSON.stringify(BLOCK)
    const once = migrateNavHeaderContrast(BLOCK)
    expect(once.alreadyMigrated).toBe(false)
    expect(once.patched).toEqual([BLOCK.id])
    expect(once.structure.metadata!.globalJs).toBe(patchContrastJs(LIVE_JS))
    expect(JSON.stringify(BLOCK)).toBe(snapshot)
    expect(migrateNavHeaderContrast(once.structure)).toMatchObject({ alreadyMigrated: true, patched: [] })
  })

  it('на стенде, где проба уже поправлена, довносится только тема слайдера', () => {
    const probeOnly: StructureNode = { ...BLOCK, metadata: { ...BLOCK.metadata, globalJs: LIVE_JS.replace(PROBE_BEFORE, PROBE_AFTER) } }
    const out = migrateNavHeaderContrast(probeOnly)
    expect(out.alreadyMigrated).toBe(false)
    expect(out.structure.metadata!.globalJs).toBe(patchContrastJs(LIVE_JS))
  })

  it('кэш-копия блока в странице (вложенный узел) правится так же', () => {
    const page: StructureNode = { id: 'root', children: [{ ...BLOCK, id: 'linked-nav' }, { id: 'other', metadata: { globalJs: 'x()' } }] }
    const out = migrateNavHeaderContrast(page)
    expect(out.patched).toEqual(['linked-nav'])
    expect(out.structure.children![1].metadata!.globalJs).toBe('x()')
  })
})
