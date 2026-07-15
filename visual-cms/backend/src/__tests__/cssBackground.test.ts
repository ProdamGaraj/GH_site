/**
 * Хелперы многослойных фонов: поиск/замена url-слоя в background shorthand
 * и стеке background-image с сохранением градиентов (затемнения).
 */
import {
  firstCssUrl,
  splitCssLayers,
  replaceCssUrl,
  removeUrlLayers,
  extractBgUrl,
  bgUrlPatch,
  composeBgStack,
} from '../services/cssBackground'
import { applyTranslationsToTree } from '../services/TranslationService'
import { resolveResponsiveMedia } from '../services/ResponsiveMediaResolver'
import type { BlockNode, BreakpointDef } from '../types/blockNode'

// Реальный кейс: фон импортированного hero — градиент + url в background shorthand.
const HERO_BG =
  'linear-gradient(90deg, rgba(13,15,18,.74), rgba(13,15,18,.2) 58%, rgba(13,15,18,.55)), url("https://img.example/office.jpg") center / cover'

describe('firstCssUrl / splitCssLayers', () => {
  it('находит url внутри многослойного значения', () => {
    expect(firstCssUrl(HERO_BG)).toBe('https://img.example/office.jpg')
    expect(firstCssUrl('url(/a.png)')).toBe('/a.png')
    expect(firstCssUrl('linear-gradient(#000,#fff)')).toBeNull()
    expect(firstCssUrl(undefined)).toBeNull()
  })
  it('режет по запятым верхнего уровня', () => {
    const layers = splitCssLayers(HERO_BG)
    expect(layers).toHaveLength(2)
    expect(layers[0]).toContain('linear-gradient')
    expect(layers[1]).toContain('url(')
  })
})

describe('replaceCssUrl / removeUrlLayers', () => {
  it('заменяет только url, градиент и позиционирование сохраняются', () => {
    const next = replaceCssUrl(HERO_BG, '/media/new.jpg')
    expect(next).toContain('url("/media/new.jpg")')
    expect(next).toContain('linear-gradient(90deg')
    expect(next).toContain('center / cover')
    expect(next).not.toContain('office.jpg')
  })
  it('удаляет url-слои, оставляя градиенты', () => {
    expect(removeUrlLayers(HERO_BG)).toContain('linear-gradient')
    expect(removeUrlLayers(HERO_BG)).not.toContain('url(')
    expect(removeUrlLayers('url("/a.png")')).toBe('')
  })
})

describe('extractBgUrl / bgUrlPatch / composeBgStack', () => {
  it('видит фон и в backgroundImage, и в background shorthand', () => {
    expect(extractBgUrl({ backgroundImage: 'url("/a.png")' })).toBe('/a.png')
    expect(extractBgUrl({ background: HERO_BG })).toBe('https://img.example/office.jpg')
    expect(extractBgUrl({ background: '#fff' })).toBeNull()
    expect(extractBgUrl(undefined)).toBeNull()
  })
  it('патчит то свойство, где фон живёт', () => {
    expect(bgUrlPatch({ background: HERO_BG }, '/new.jpg')).toEqual({
      background: replaceCssUrl(HERO_BG, '/new.jpg'),
    })
    expect(bgUrlPatch({ backgroundImage: 'url("/a.png")' }, '/new.jpg')).toEqual({
      backgroundImage: 'url("/new.jpg")',
    })
    expect(bgUrlPatch({}, '/new.jpg')).toEqual({ backgroundImage: 'url("/new.jpg")' })
  })
  it('стек для override: градиенты базы + новый url', () => {
    expect(composeBgStack({ background: HERO_BG }, '/new.jpg')).toBe(
      'linear-gradient(90deg, rgba(13,15,18,.74), rgba(13,15,18,.2) 58%, rgba(13,15,18,.55)), url("/new.jpg")',
    )
    expect(composeBgStack({ backgroundImage: 'url("/a.png")' }, '/new.jpg')).toBe('url("/new.jpg")')
    expect(composeBgStack(undefined, '/new.jpg')).toBe('url("/new.jpg")')
  })
})

describe('интеграция: фон в background shorthand', () => {
  const heroNode = (): BlockNode =>
    ({
      id: 'hero',
      tagName: 'article',
      elementType: 'container',
      attributes: {},
      styles: { properties: { background: HERO_BG } },
      children: [],
    }) as unknown as BlockNode

  it('applyTranslations: перевод bg:image подменяет url внутри shorthand, градиент цел', () => {
    const structure = { id: 'root', tagName: 'div', children: [heroNode()], styles: { properties: {} }, attributes: {} }
    const { structure: result } = applyTranslationsToTree(structure, { hero: { 'bg:image': '/media/loc.jpg' } })
    const hero = result.children[0]
    expect(hero.styles.properties.background).toContain('url("/media/loc.jpg")')
    expect(hero.styles.properties.background).toContain('linear-gradient(90deg')
    expect(hero.styles.properties.backgroundImage).toBeUndefined()
  })

  it('resolver: языковая ячейка bg:image@bp даёт стек «градиент + url»', () => {
    const breakpoints: BreakpointDef[] = [{ id: 'mobile', name: 'Mobile', width: 767 }]
    const plan = resolveResponsiveMedia(
      heroNode(),
      { hero: { 'bg:image@mobile': '/media/m.jpg' } },
      breakpoints,
    )
    const bg = plan.get('hero')?.bg
    expect(bg).toHaveLength(1)
    expect(bg![0].value).toBe(
      'linear-gradient(90deg, rgba(13,15,18,.74), rgba(13,15,18,.2) 58%, rgba(13,15,18,.55)), url("/media/m.jpg")',
    )
  })
})
