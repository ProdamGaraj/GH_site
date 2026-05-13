/**
 * Тест идемпотентности миграции migrate-hero-to-repeater.
 *
 * Сценарии:
 *  1. Чистая страница → status=migrated, создаётся 1 DS, 1 Binding, в variables появляется heroSlides.
 *  2. Повторный прогон с уже мигрированной страницей → status=already-migrated, ни DS ни binding не пересохраняются.
 *  3. Reset variables, но DS+Binding остались → DS не дублируется (UPSERT по name), binding обновляется (UPSERT по pageId+blockId).
 */

import 'reflect-metadata'

// Мокаем AppDataSource ДО импорта скрипта
jest.mock('../config/database', () => {
  const repos = new Map<any, any>()
  return {
    AppDataSource: {
      isInitialized: true,
      initialize: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
      getRepository: jest.fn((entity: any) => repos.get(entity)),
      __setRepo: (entity: any, repo: any) => repos.set(entity, repo),
      __clearRepos: () => repos.clear(),
    },
  }
})

import { AppDataSource } from '../config/database'
import { Page } from '../models/Page'
import { DataSource as DataSourceEntity } from '../models/DataSource'
import { DataBinding } from '../models/DataBinding'
import { migrateHeroToRepeater } from '../scripts/migrate-hero-to-repeater'

const PAGE_ID = '5f597235-130e-4f57-a0ac-1eb1f77af920'
const TRACK_ID = 'gh-1776249962431-22'
const TEMPLATE_SLIDE_ID = 'gh-1776249962431-7'

const buildPage = (): any => ({
  id: PAGE_ID,
  variables: { variables: [] },
  metadata: {},
  structure: {
    id: 'root',
    children: [
      {
        id: 'gh-1776249962431-29',
        attributes: {},
        styles: { properties: {} },
        children: [
          {
            id: TRACK_ID,
            attributes: {},
            styles: { properties: {} },
            children: [
              {
                id: TEMPLATE_SLIDE_ID,
                attributes: {},
                styles: { properties: { backgroundImage: 'url(/media/a.png)' } },
                children: [
                  { tag: 'h1', attributes: {}, styles: { properties: {} }, content: 'Title A' },
                  { tag: 'p', attributes: {}, styles: { properties: { fontSize: '14px' } }, content: 'Sub A' },
                  { tag: 'p', attributes: {}, styles: { properties: { fontSize: '18px' } }, content: 'Desc A' },
                  { tag: 'a', attributes: { href: '/x' }, styles: { properties: {} }, content: 'CTA A' },
                ],
              },
              {
                id: 'slide-2',
                attributes: {},
                styles: { properties: { backgroundImage: 'url(/media/b.png)' } },
                children: [
                  { tag: 'h1', attributes: {}, styles: { properties: {} }, content: 'Title B' },
                  { tag: 'p', attributes: {}, styles: { properties: { fontSize: '14px' } }, content: 'Sub B' },
                  { tag: 'p', attributes: {}, styles: { properties: { fontSize: '18px' } }, content: 'Desc B' },
                  { tag: 'a', attributes: { href: '/y' }, styles: { properties: {} }, content: 'CTA B' },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
})

const makeRepo = () => {
  const store: any[] = []
  return {
    store,
    findOne: jest.fn(async ({ where }: any) => {
      return store.find(item => Object.entries(where).every(([k, v]) => item[k] === v)) || null
    }),
    create: jest.fn((data: any) => ({ ...data, id: data.id ?? `generated-${store.length + 1}` })),
    save: jest.fn(async (entity: any) => {
      const existing = entity.id ? store.find(s => s.id === entity.id) : null
      if (existing) {
        Object.assign(existing, entity)
        return existing
      }
      const persisted = { ...entity, id: entity.id ?? `saved-${store.length + 1}` }
      store.push(persisted)
      return persisted
    }),
  }
}

describe('migrate-hero-to-repeater (идемпотентность)', () => {
  let pageRepo: ReturnType<typeof makeRepo>
  let dsRepo: ReturnType<typeof makeRepo>
  let bindingRepo: ReturnType<typeof makeRepo>

  beforeEach(() => {
    ;(AppDataSource as any).__clearRepos()
    pageRepo = makeRepo()
    dsRepo = makeRepo()
    bindingRepo = makeRepo()
    pageRepo.store.push(buildPage())
    ;(AppDataSource as any).__setRepo(Page, pageRepo)
    ;(AppDataSource as any).__setRepo(DataSourceEntity, dsRepo)
    ;(AppDataSource as any).__setRepo(DataBinding, bindingRepo)
  })

  it('первый прогон: создаёт DS + Binding + variable heroSlides', async () => {
    const result = await migrateHeroToRepeater({ initDb: false })
    expect(result.status).toBe('migrated')
    expect(dsRepo.store).toHaveLength(1)
    expect(dsRepo.store[0].type).toBe('page-variable')
    expect(dsRepo.store[0].config.variableName).toBe('heroSlides')
    expect(bindingRepo.store).toHaveLength(1)
    expect(bindingRepo.store[0].pageId).toBe(PAGE_ID)
    expect(bindingRepo.store[0].blockId).toBe(TRACK_ID)
    const page = pageRepo.store[0]
    const heroVar = page.variables.variables.find((v: any) => v.name === 'heroSlides')
    expect(heroVar).toBeDefined()
    expect(Array.isArray(heroVar.defaultValue)).toBe(true)
    expect(heroVar.defaultValue.length).toBe(2)
    // hero root помечен атрибутом data-carousel-variable=heroSlides → SlidesTab сможет его найти
    const heroRoot = page.structure.children[0]
    expect(heroRoot.attributes['data-carousel']).toBe('true')
    expect(heroRoot.attributes['data-carousel-variable']).toBe('heroSlides')
  })

  it('повторный прогон на уже мигрированной странице: status=already-migrated, ничего не создаётся', async () => {
    await migrateHeroToRepeater({ initDb: false })
    const dsCountAfterFirst = dsRepo.store.length
    const bindingCountAfterFirst = bindingRepo.store.length
    const varsCountAfterFirst = pageRepo.store[0].variables.variables.length

    const result = await migrateHeroToRepeater({ initDb: false })

    expect(result.status).toBe('already-migrated')
    expect(dsRepo.store).toHaveLength(dsCountAfterFirst)
    expect(bindingRepo.store).toHaveLength(bindingCountAfterFirst)
    expect(pageRepo.store[0].variables.variables).toHaveLength(varsCountAfterFirst)
  })

  it('если variable удалили, но DS+Binding остались: DS не дублируется, binding обновляется', async () => {
    await migrateHeroToRepeater({ initDb: false })
    // Симулируем «откат» variable (например, ручной правкой)
    pageRepo.store[0].variables.variables = pageRepo.store[0].variables.variables.filter(
      (v: any) => v.name !== 'heroSlides'
    )
    // Восстанавливаем структуру (миграция мутирует track) — иначе extractSlide упадёт.
    pageRepo.store.splice(0, 1, buildPage())

    const dsCountBefore = dsRepo.store.length
    const bindingCountBefore = bindingRepo.store.length

    const result = await migrateHeroToRepeater({ initDb: false })

    expect(result.status).toBe('migrated')
    expect(dsRepo.store).toHaveLength(dsCountBefore) // UPSERT по name → не дублируется
    expect(bindingRepo.store).toHaveLength(bindingCountBefore) // UPSERT по pageId+blockId
  })

  it('backfill: на уже мигрированной странице без data-carousel-variable атрибут проставляется', async () => {
    // Симулируем БД, мигрированную старой версией скрипта (variable есть, attribute нет)
    const page = pageRepo.store[0]
    page.variables.variables.push({
      id: 'old-var-id',
      name: 'heroSlides',
      scope: 'page',
      type: 'array',
      defaultValue: [],
    })
    const heroRoot = page.structure.children[0]
    heroRoot.attributes['data-carousel'] = 'true'
    delete heroRoot.attributes['data-carousel-variable']

    const result = await migrateHeroToRepeater({ initDb: false })

    expect(result.status).toBe('already-migrated')
    expect(heroRoot.attributes['data-carousel-variable']).toBe('heroSlides')
  })
})
