/**
 * @jest-environment jsdom
 *
 * Кнопки языка в мобильном меню шапки: преобразование живого блока
 * «Navigation» (fixtures/navigationBlock.json — копия со стенда) и проверка в
 * браузере, что нажатие на кнопку меню запускает переключатель языка CMS.
 */
jest.mock('../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockReturnValue({
      findOne: jest.fn(), find: jest.fn(), save: jest.fn(), findByIds: jest.fn(),
    }),
  },
}))

import { htmlGenerator, AvailableLanguage } from '../services/HtmlGenerator'
import { MigrationError, StructureNode, findAll } from '../scripts/choiceToPlanTypes'
import { migrateNavDrawerLang } from '../scripts/navDrawerLang'
import type { BlockNode } from '../types/blockNode'

const BLOCK: StructureNode = require('./fixtures/navigationBlock.json')

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))
const drawerButtons = (root: StructureNode) =>
  findAll(root, (n) => (n.attributes?.class ?? '').includes('gnav-drawer-lang'))[0].children!
const headerButtons = (root: StructureNode) =>
  findAll(root, (n) => n.attributes?.class === 'language-switch')[0].children!

const LANGUAGES: AvailableLanguage[] = [
  { code: 'ru', name: 'Русский', flag: 'ru', isDefault: true, direction: 'ltr' },
  { code: 'uz', name: 'Oʻzbekcha', flag: 'uz', isDefault: false, direction: 'ltr' },
]

describe('migrateNavDrawerLang — живой блок', () => {
  const { structure, changes, alreadyMigrated } = migrateNavDrawerLang(BLOCK)

  it('кнопки меню получают язык кнопок шапки с той же подписью', () => {
    expect(alreadyMigrated).toBe(false)
    expect(drawerButtons(structure).map((b) => [b.content, b.attributes])).toEqual([
      ['RU', { type: 'button', 'aria-pressed': 'true', 'data-lang-switch': 'ru', 'data-lang-active': 'ru' }],
      ['UZ', { type: 'button', 'aria-pressed': 'false', 'data-lang-switch': 'uz', 'data-lang-active': 'uz' }],
    ])
    expect(changes).toEqual([
      'Навигация: кнопка «RU» мобильного меню переключает язык (ru)',
      'Навигация: кнопка «UZ» мобильного меню переключает язык (uz)',
    ])
  })

  it('кроме двух кнопок меню ничего не меняется', () => {
    const expected = clone(BLOCK)
    drawerButtons(expected).forEach((b, i) => (b.attributes = drawerButtons(structure)[i].attributes))
    expect(structure).toEqual(expected)
    expect(headerButtons(structure)).toEqual(headerButtons(BLOCK))
  })

  it('повторный запуск ничего не меняет', () => {
    const again = migrateNavDrawerLang(structure)
    expect(again.alreadyMigrated).toBe(true)
    expect(again.structure).toBe(structure)
  })

  it('вход не меняется', () => {
    expect(drawerButtons(BLOCK)[0].attributes).toEqual({ type: 'button', class: 'active', 'aria-pressed': 'true' })
  })
})

describe('migrateNavDrawerLang — ошибки', () => {
  it('у кнопки шапки нет языка — не с чего брать', () => {
    const broken = clone(BLOCK)
    delete headerButtons(broken)[1].attributes!['data-lang-switch']
    expect(() => migrateNavDrawerLang(broken)).toThrow(/«UZ» в шапке нет data-lang-switch/)
  })

  it('у кнопки меню нет пары в шапке', () => {
    const broken = clone(BLOCK)
    drawerButtons(broken)[1].content = 'EN'
    expect(() => migrateNavDrawerLang(broken)).toThrow(MigrationError)
  })

  it('чужой блок без переключателей языка', () => {
    expect(() => migrateNavDrawerLang({ id: 'x', tagName: 'nav', children: [] })).toThrow(/переключатель языка в шапке/)
  })
})

describe('в браузере', () => {
  /** Страница с шапкой: тело и рантайм языков CMS, как их выдаёт генератор. */
  function mount(structure: StructureNode): void {
    const html = htmlGenerator.generatePage(structure as unknown as BlockNode, {
      metadata: { title: 'T', description: 'D', keywords: [] },
      slug: 'about',
      lang: 'uz',
      availableLanguages: LANGUAGES,
    })
    const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<!-- Language Runtime -->'))
    const runtimeStart = html.indexOf('<script>', html.indexOf('<!-- Language Runtime -->')) + 8
    const runtime = html.slice(runtimeStart, html.indexOf('</script>', runtimeStart))
    document.body.innerHTML = body
    // eslint-disable-next-line no-new-func
    new Function(runtime)()
  }

  const menuButton = (label: string) =>
    [...document.querySelectorAll('.gnav-drawer-lang button')].find((b) => b.textContent === label) as HTMLElement

  beforeEach(() => {
    localStorage.clear()
    // Переход по адресу jsdom не делает — рантайм успевает запомнить выбор.
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete (window as any).__gh
  })

  it('до правки: кнопка меню язык не переключает', () => {
    mount(BLOCK)
    menuButton('RU').click()
    expect(localStorage.getItem('gh-lang')).toBeNull()
  })

  it('после правки: кнопка меню переключает язык, как кнопка шапки', () => {
    mount(migrateNavDrawerLang(BLOCK).structure)
    menuButton('RU').click()
    expect(localStorage.getItem('gh-lang')).toBe('ru')
    expect((window as any).__gh.getLangUrl('ru')).toBe('/ru/about/')
  })

  it('на /uz/ в меню подсвечен UZ, а не RU', () => {
    mount(migrateNavDrawerLang(BLOCK).structure)
    expect(menuButton('UZ').classList.contains('active')).toBe(true)
    expect(menuButton('RU').classList.contains('active')).toBe(false)
    expect(menuButton('UZ').getAttribute('aria-pressed')).toBe('true')
  })
})
