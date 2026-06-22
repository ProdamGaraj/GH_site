/**
 * Тесты модели «корень = домашняя страница» + чистых URL без .html.
 * isHomePage / pageRelPath приватные — дёргаем через `as any`.
 *
 * Инвариант: домашняя страница сайта (Site.homepageId) деплоится в index.html
 * (URL '/'), остальные — в <slug>/index.html (URL '/<slug>', без .html в адресе).
 * Legacy-конвенция slug 'index'/'home' остаётся фоллбэком, когда homepageId не задан.
 */
import * as path from 'path'

jest.mock('../config/database', () => {
  const cache = new Map<unknown, any>()
  return {
    AppDataSource: {
      getRepository: jest.fn().mockImplementation((entity: unknown) => {
        if (!cache.has(entity)) {
          cache.set(entity, {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            createQueryBuilder: jest.fn(),
          })
        }
        return cache.get(entity)
      }),
    },
  }
})

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DeployService } = require('../services/DeployService')

describe('DeployService — модель домашней страницы (homepageId)', () => {
  const svc: any = new DeployService()

  describe('isHomePage', () => {
    it('явно выбранная домашняя (homepageId) важнее slug', () => {
      const site = { homepageId: 'p-1' }
      expect(svc.isHomePage({ id: 'p-1', slug: 'about' }, site)).toBe(true)
      // другая страница не корень, даже если slug='home'
      expect(svc.isHomePage({ id: 'p-2', slug: 'home' }, site)).toBe(false)
    })

    it('без homepageId — legacy-фоллбэк на slug index/home', () => {
      expect(svc.isHomePage({ id: 'p-1', slug: 'index' }, null)).toBe(true)
      expect(svc.isHomePage({ id: 'p-1', slug: 'home' }, undefined)).toBe(true)
      expect(svc.isHomePage({ id: 'p-1', slug: 'about' }, {})).toBe(false)
    })
  })

  describe('pageRelPath — чистые URL без .html', () => {
    it('домашняя → index.html', () => {
      expect(svc.pageRelPath('about', true)).toBe('index.html')
    })

    it('обычная → <slug>/index.html (директорный формат)', () => {
      expect(svc.pageRelPath('about', false)).toBe(path.join('about', 'index.html'))
    })
  })
})
