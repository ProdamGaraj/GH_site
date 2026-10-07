/**
 * Слайды из данных ЖК: тема шапки и слайд-блок (v4 миграции слайдеров).
 *
 * Живой блок hero (фикстура) → миграция → подстановка данных проекта →
 * разворот слайдов-блоков: у слайда своя тема, блок из библиотеки — внутри
 * слайда и переведён переводами самого блока на язык страницы.
 */
const PROMO = '3d23aed7-be04-4ed7-934f-f0281b9c4670'
const NESTED = '11111111-2222-4333-8444-555555555555'

const blocks: Record<string, any> = {
  [PROMO]: {
    id: PROMO,
    name: 'Promo',
    structure: {
      id: 'promo-root',
      metadata: { globalCss: '.promo{color:red}' },
      children: [
        { id: 'promo-title', content: 'Рассрочка 0%' },
        { id: 'promo-badge', metadata: { linkedBlockId: NESTED }, children: [] },
      ],
    },
  },
  [NESTED]: { id: NESTED, name: 'Badge', structure: { id: 'badge-root', children: [{ id: 'badge-text', content: 'Новинка' }] } },
}

jest.mock('../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(() => ({
      find: jest.fn(async ({ where }: any) => {
        const ids: string[] = where?.id?.value ?? []
        return ids.map((id) => blocks[id]).filter(Boolean)
      }),
      findOne: jest.fn(),
      save: jest.fn(),
    })),
  },
}))
jest.mock('../services/LanguageService', () => ({
  languageService: { getActive: jest.fn(async () => [{ code: 'ru', isDefault: true, isActive: true }, { code: 'uz', isDefault: false, isActive: true }]) },
}))
jest.mock('../services/TranslationService', () => {
  const actual = jest.requireActual('../services/TranslationService')
  return {
    ...actual,
    translationService: {
      getBlockTreeTranslationMap: jest.fn(async (_id: string, _tree: unknown, lang: string) =>
        lang === 'uz' ? { 'promo-title': { content: 'Muddatli to‘lov 0%' }, 'badge-text': { content: 'Yangi' } } : {}
      ),
    },
  }
})

import { deployService } from '../services/DeployService'
import { migrateHeroBlock, migrateHeroInstances } from '../scripts/complexMedia'
import type { StructureNode } from '../scripts/choiceToPlanTypes'

const LIVE: StructureNode = require('./fixtures/complexHeroBlockLive.json')
const svc = deployService as any
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

function slidesOf(root: any): any[] {
  const out: any[] = []
  const visit = (n: any) => {
    if (n?.attributes?.['data-carousel-slide'] === 'true') out.push(n)
    for (const c of n?.children ?? []) visit(c)
  }
  visit(root)
  return out
}

const item = {
  heroPoster: '/media/p.jpg',
  heroSlides: [
    { url: '/media/p.jpg', image: '/media/p.jpg', video: '', position: '50% 50%', fit: 'cover', theme: 'light', block: '' },
    { url: `block:${PROMO}`, image: '', video: '', position: '50% 50%', fit: 'cover', theme: 'dark', block: PROMO },
    { url: '/media/v.mp4', image: '/media/p.jpg', video: '/media/v.mp4', position: '50% 50%', fit: 'cover', theme: '', block: '' },
  ],
  aboutVideo: '',
  className: 'Бизнес',
  name: 'Harizma',
  intro: '',
  soldOut: [],
}

describe('миграция v4: тема шапки и слайд-блок у шаблона слайда', () => {
  const migrated = migrateHeroBlock(clone(LIVE))

  it('шаблон слайда привязан к $.theme и $.block', () => {
    const [slide] = slidesOf(migrated.structure)
    expect(slide.attributes).toMatchObject({ 'data-header-theme': '{{$.theme}}', 'data-slide-block': '{{$.block}}' })
    expect(migrated.changes).toEqual(expect.arrayContaining(['Hero: тема шапки и слайд-блок из данных ЖК']))
  })

  it('общая «тёмная» тема секции снята — и у блока, и у экземпляра на странице', () => {
    expect(LIVE.attributes?.['data-header-theme']).toBe('dark')
    expect(migrated.structure.attributes).not.toHaveProperty('data-header-theme')
    const page = { id: 'r', children: [{ id: 'top', metadata: { linkedBlockId: 'hero' }, attributes: { 'data-header-theme': 'dark', class: 'x' }, children: [] }] }
    const out = migrateHeroInstances(page as StructureNode, 'hero')
    expect(out.structure.children![0].attributes).toEqual({ class: 'x' })
    expect(out.changes).toEqual(expect.arrayContaining([expect.stringContaining('общая тема шапки секции снята')]))
  })

  it('уже применённое v3 (стенд) довносит только v4; повторно — без правок', () => {
    expect(migrateHeroBlock(migrated.structure).alreadyMigrated).toBe(true)
  })
})

describe('страница проекта: слайды из данных', () => {
  const template = migrateHeroBlock(clone(LIVE)).structure

  async function render(lang?: string) {
    return svc.expandDataSlideBlocks(svc.substituteItemData(template, item), lang)
  }

  it('у каждого слайда своя тема; пустая — авто', async () => {
    const slides = slidesOf(await render())
    expect(slides.map((s) => s.attributes['data-header-theme'])).toEqual(['light', 'dark', ''])
  })

  it('слайд-блок: блок библиотеки со вложенным блоком — внутри слайда, со своими стилями', async () => {
    const block = slidesOf(await render())[1]
    expect(block.attributes['data-slide-block']).toBe(PROMO)
    const [tree] = block.children
    expect(tree.id).toBe('promo-root')
    expect(tree.metadata.globalCss).toBe('.promo{color:red}')
    expect(tree.children[0].content).toBe('Рассрочка 0%')
    expect(tree.children[1].children[0].content).toBe('Новинка')
    // У фото-слайдов внутри ничего не появляется.
    expect(slidesOf(await render())[0].children ?? []).toEqual([])
  })

  it('на языке страницы блок переведён переводами самого блока (и вложенного)', async () => {
    const [tree] = slidesOf(await render('uz'))[1].children
    expect(tree.children[0].content).toBe('Muddatli to‘lov 0%')
    expect(tree.children[1].children[0].content).toBe('Yangi')
  })

  it('основной язык — без перевода', async () => {
    const [tree] = slidesOf(await render('ru'))[1].children
    expect(tree.children[0].content).toBe('Рассрочка 0%')
  })

  it('блок удалён из библиотеки — слайд пустой, страница строится', async () => {
    const gone = { ...item, heroSlides: [{ ...item.heroSlides[1], block: 'deleted-block' }] }
    const slides = slidesOf(await svc.expandDataSlideBlocks(svc.substituteItemData(template, gone)))
    expect(slides).toHaveLength(1)
    expect(slides[0].children ?? []).toEqual([])
  })
})
