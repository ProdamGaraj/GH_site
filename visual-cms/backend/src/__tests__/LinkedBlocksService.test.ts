/**
 * LinkedBlocksService — unit-тесты для _collectLinkedNodes guard
 * и для syncBlockToAllPages (auto-sync library → pages).
 */

// Mock database before importing the service.
// Singleton repository mock — чтобы тесты могли получить доступ к find/save mock-ам.
jest.mock('../config/database', () => {
  const repo = {
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation((x: any) => Promise.resolve(x)),
  }
  return {
    AppDataSource: {
      getRepository: () => repo,
    },
  }
})

import { LinkedBlocksService } from '../services/LinkedBlocksService'
import { AppDataSource } from '../config/database'

describe('LinkedBlocksService', () => {
  let service: LinkedBlocksService

  beforeEach(() => {
    service = new LinkedBlocksService()
  })

  describe('syncLinkedBlocksToLibrary — placeholder guard', () => {
    // Access private method via bracket notation for testing
    const collectLinkedNodes = (node: any): Map<string, any> => {
      const result = new Map<string, any>()
      ;(service as any)._collectLinkedNodes(node, result)
      return result
    }

    it('should NOT collect placeholder nodes (0 children)', () => {
      const structure = {
        id: 'root',
        children: [
          {
            id: 'gh-tpl-header',
            tagName: 'header',
            metadata: { name: 'Header (linked)', linkedBlockId: 'block-123' },
            children: [],
          },
        ],
      }

      const result = collectLinkedNodes(structure)
      expect(result.size).toBe(0)
    })

    it('should NOT collect placeholder nodes (no children property)', () => {
      const structure = {
        id: 'root',
        children: [
          {
            id: 'gh-tpl-header',
            tagName: 'header',
            metadata: { name: 'Header (linked)', linkedBlockId: 'block-123' },
          },
        ],
      }

      const result = collectLinkedNodes(structure)
      expect(result.size).toBe(0)
    })

    it('should collect linked nodes WITH children', () => {
      const structure = {
        id: 'root',
        children: [
          {
            id: 'gh-tpl-header',
            tagName: 'header',
            metadata: { name: 'Header (linked)', linkedBlockId: 'block-123' },
            children: [
              { id: 'logo', tagName: 'a', content: 'GOLDEN HOUSE', children: [] },
              { id: 'nav', tagName: 'nav', children: [{ id: 'link1', tagName: 'a' }] },
            ],
          },
        ],
      }

      const result = collectLinkedNodes(structure)
      expect(result.size).toBe(1)
      expect(result.has('block-123')).toBe(true)
      expect(result.get('block-123').children.length).toBe(2)
    })

    it('should handle mixed: some placeholders, some with content', () => {
      const structure = {
        id: 'root',
        children: [
          {
            id: 'header-placeholder',
            tagName: 'header',
            metadata: { linkedBlockId: 'header-block' },
            children: [],
          },
          {
            id: 'section',
            children: [
              {
                id: 'footer-real',
                tagName: 'footer',
                metadata: { linkedBlockId: 'footer-block' },
                children: [{ id: 'copyright', tagName: 'p', content: '© 2026' }],
              },
            ],
          },
        ],
      }

      const result = collectLinkedNodes(structure)
      expect(result.size).toBe(1)
      expect(result.has('header-block')).toBe(false)
      expect(result.has('footer-block')).toBe(true)
    })

    it('should handle deeply nested linked nodes', () => {
      const structure = {
        id: 'root',
        children: [
          {
            id: 'wrapper',
            children: [
              {
                id: 'inner',
                children: [
                  {
                    id: 'deep-linked',
                    metadata: { linkedBlockId: 'deep-block' },
                    children: [{ id: 'child', tagName: 'div' }],
                  },
                ],
              },
            ],
          },
        ],
      }

      const result = collectLinkedNodes(structure)
      expect(result.size).toBe(1)
      expect(result.has('deep-block')).toBe(true)
    })

    it('should handle node without metadata', () => {
      const structure = {
        id: 'root',
        children: [
          { id: 'plain-node', tagName: 'div', children: [] },
        ],
      }

      const result = collectLinkedNodes(structure)
      expect(result.size).toBe(0)
    })

    it('should handle null/undefined input', () => {
      expect(collectLinkedNodes(null).size).toBe(0)
      expect(collectLinkedNodes(undefined).size).toBe(0)
    })
  })

  describe('syncBlockToAllPages — auto-sync library → pages', () => {
    const repo: any = (AppDataSource as any).getRepository()

    beforeEach(() => {
      repo.find.mockReset()
      repo.save.mockReset()
      repo.save.mockImplementation((x: any) => Promise.resolve(x))
    })

    it('обновляет только страницы, которые ссылаются на blockId', async () => {
      const newStructure = {
        id: 'lib-root',
        tagName: 'header',
        children: [{ id: 'logo-v2', tagName: 'a', content: 'GH v2' }],
      }

      const pageA = {
        id: 'page-a',
        name: 'Page A',
        slug: 'a',
        structure: {
          id: 'root-a',
          children: [
            { id: 'placeholder-1', metadata: { linkedBlockId: 'block-X' }, children: [] },
          ],
        },
      }
      const pageB = {
        id: 'page-b',
        name: 'Page B',
        slug: 'b',
        structure: {
          id: 'root-b',
          children: [
            { id: 'unrelated', tagName: 'div', children: [] },
          ],
        },
      }
      const pageC = {
        id: 'page-c',
        name: 'Page C',
        slug: 'c',
        structure: {
          id: 'root-c',
          children: [
            { id: 'placeholder-2', metadata: { linkedBlockId: 'block-X' }, children: [] },
          ],
        },
      }

      repo.find.mockResolvedValueOnce([pageA, pageB, pageC])

      const result = await service.syncBlockToAllPages('block-X', newStructure)

      expect(result.updatedPages.sort()).toEqual(['page-a', 'page-c'])
      expect(result.errors).toEqual([])
      expect(repo.save).toHaveBeenCalledTimes(2)
    })

    it('сохраняет id оригинального узла и проставляет linkedBlockId после замены', async () => {
      const newStructure = {
        id: 'lib-source',
        tagName: 'div',
        metadata: { name: 'Lib Block' },
        children: [{ id: 'lib-child', tagName: 'span', content: 'new' }],
      }

      const page = {
        id: 'page-1',
        name: 'P',
        slug: 'p',
        structure: {
          id: 'root',
          children: [
            {
              id: 'original-node-id',
              tagName: 'header',
              metadata: { linkedBlockId: 'block-Y', name: 'old name' },
              children: [],
            },
          ],
        },
      }

      repo.find.mockResolvedValueOnce([page])

      await service.syncBlockToAllPages('block-Y', newStructure)

      const savedPage = repo.save.mock.calls[0][0]
      const replacedNode = savedPage.structure.children[0]
      expect(replacedNode.id).toBe('original-node-id') // id ноды страницы сохранён
      expect(replacedNode.metadata.linkedBlockId).toBe('block-Y') // linkedBlockId сохранён
      // Placeholder-инвариант: page хранит только заглушку (children: []),
      // полная структура живёт в библиотеке и подставляется при чтении (_applyLinkedBlocks).
      expect(replacedNode.children).toEqual([])
    })

    it('возвращает пустой результат, если ни одна страница не использует блок', async () => {
      repo.find.mockResolvedValueOnce([
        { id: 'p1', name: 'P1', slug: 'p1', structure: { id: 'r', children: [] } },
      ])

      const result = await service.syncBlockToAllPages('block-Z', { id: 'lib', children: [] })

      expect(result.updatedPages).toEqual([])
      expect(result.errors).toEqual([])
      expect(repo.save).not.toHaveBeenCalled()
    })

    it('пропускает страницы с null structure без падения', async () => {
      repo.find.mockResolvedValueOnce([
        { id: 'p1', structure: null },
        {
          id: 'p2',
          name: 'P2',
          slug: 'p2',
          structure: {
            id: 'r',
            children: [{ id: 'n', metadata: { linkedBlockId: 'B' }, children: [] }],
          },
        },
      ])

      const result = await service.syncBlockToAllPages('B', { id: 'lib', children: [] })

      expect(result.updatedPages).toEqual(['p2'])
    })

    it('собирает ошибки в errors[], если save упал на одной из страниц', async () => {
      const page = {
        id: 'page-bad',
        name: 'Bad',
        slug: 'bad',
        structure: {
          id: 'r',
          children: [{ id: 'n', metadata: { linkedBlockId: 'block-W' }, children: [] }],
        },
      }
      repo.find.mockResolvedValueOnce([page])
      repo.save.mockRejectedValueOnce(new Error('DB write failed'))

      const result = await service.syncBlockToAllPages('block-W', { id: 'lib', children: [] })

      expect(result.updatedPages).toEqual([])
      expect(result.errors).toEqual(['Page page-bad: DB write failed'])
    })

    it('заменяет блок во вложенных детях (deep traversal)', async () => {
      const page = {
        id: 'p-deep',
        name: 'P',
        slug: 'p',
        structure: {
          id: 'root',
          children: [
            {
              id: 'wrap',
              children: [
                {
                  id: 'inner',
                  children: [
                    { id: 'target', metadata: { linkedBlockId: 'B-deep' }, children: [] },
                  ],
                },
              ],
            },
          ],
        },
      }
      repo.find.mockResolvedValueOnce([page])

      await service.syncBlockToAllPages('B-deep', {
        id: 'lib',
        tagName: 'section',
        children: [{ id: 'lib-c', content: 'X' }],
      })

      const savedPage = repo.save.mock.calls[0][0]
      const targetNode = savedPage.structure.children[0].children[0].children[0]
      expect(targetNode.id).toBe('target')
      // Placeholder-инвариант: вложенный linked-узел тоже схлопывается в заглушку,
      // library-структура (tagName: 'section') в page НЕ просачивается.
      expect(targetNode.children).toEqual([])
      expect(targetNode.metadata.linkedBlockId).toBe('B-deep')
    })
  })

  /**
   * B2 регресс: placeholder-инвариант для hybrid-карусели.
   *
   * Историческая ошибка: при синхронизации развёрнутая структура library
   * писалась в page и терялись attributes плейсхолдера (в т.ч.
   * data-carousel-static). После reload слайд терял роль и карусель
   * показывала 4/4 вместо 5/5.
   *
   * Инвариант, который пинится тут:
   *  - collapse (syncBlockToAllPages): узел остаётся placeholder (children: []),
   *    его id/attributes/linkedBlockId сохраняются, library в page НЕ
   *    просачивается, число слайдов в треке не меняется;
   *  - read/expand (updateLinkedBlocks): library-структура подставляется, но
   *    attributes плейсхолдера ПЕРЕКРЫВАЮТ library-attributes (карусель-маркеры
   *    выживают), id/linkedBlockId сохранены, число слайдов сохранено (5/5).
   */
  describe('B2 regression: hybrid-carousel placeholder invariant', () => {
    const LIB_ID = 'carousel-slide-block'

    const makeTrack = (slide4: any) => ({
      id: 'root',
      children: [
        {
          id: 'carousel-track',
          attributes: { 'data-carousel-track': 'true' },
          children: [
            { id: 's0', tagName: 'div', attributes: { 'data-carousel-slide': '0' }, children: [] },
            { id: 's1', tagName: 'div', attributes: { 'data-carousel-slide': '1' }, children: [] },
            { id: 's2', tagName: 'div', attributes: { 'data-carousel-slide': '2' }, children: [] },
            { id: 's3', tagName: 'div', attributes: { 'data-carousel-slide': '3' }, children: [] },
            slide4,
          ],
        },
      ],
    })

    it('collapse: linked-слайд схлопывается в placeholder, атрибуты и счёт 5/5 сохранены, library НЕ просачивается', async () => {
      const repo: any = (AppDataSource.getRepository as any)()

      // На странице — legacy: linked-слайд уже развёрнут (есть children)
      const page = {
        id: 'page-carousel',
        name: 'P',
        slug: 'p',
        structure: makeTrack({
          id: 'slide-linked',
          tagName: 'div',
          metadata: { linkedBlockId: LIB_ID, name: 'Promo slide' },
          attributes: { 'data-carousel-slide': '4', 'data-carousel-static': 'true' },
          children: [{ id: 'legacy-expanded', tagName: 'img' }],
        }),
      }
      repo.find.mockResolvedValueOnce([page])

      await service.syncBlockToAllPages(LIB_ID, {
        id: 'lib-root',
        tagName: 'div',
        children: [{ id: 'lib-img', tagName: 'img' }],
      })

      const saved = repo.save.mock.calls[0][0]
      const track = saved.structure.children[0]
      expect(track.children).toHaveLength(5) // счёт слайдов не изменился

      const placeholder = track.children[4]
      expect(placeholder.id).toBe('slide-linked')
      expect(placeholder.children).toEqual([]) // placeholder, library НЕ просочилась
      expect(placeholder.metadata.linkedBlockId).toBe(LIB_ID)
      // карусель-маркеры плейсхолдера сохранены
      expect(placeholder.attributes['data-carousel-static']).toBe('true')
      expect(placeholder.attributes['data-carousel-slide']).toBe('4')
    })

    it('read/expand: library подставляется, атрибуты плейсхолдера перекрывают library, счёт 5/5', async () => {
      const repo: any = (AppDataSource.getRepository as any)()

      const structure = makeTrack({
        id: 'slide-linked',
        tagName: 'div',
        metadata: { linkedBlockId: LIB_ID },
        attributes: { 'data-carousel-slide': '4', 'data-carousel-static': 'true' },
        children: [], // placeholder
      })

      repo.find.mockResolvedValueOnce([
        {
          id: LIB_ID,
          structure: {
            id: 'lib-root',
            tagName: 'section',
            attributes: { class: 'promo', 'data-carousel-slide': 'LIB' },
            children: [{ id: 'lib-img', tagName: 'img', children: [] }],
          },
        },
      ])

      const result = await service.updateLinkedBlocks(structure)

      const track = result.children[0]
      expect(track.children).toHaveLength(5) // карусель остаётся 5/5

      const expanded = track.children[4]
      expect(expanded.id).toBe('slide-linked') // id плейсхолдера сохранён
      expect(expanded.metadata.linkedBlockId).toBe(LIB_ID)
      expect(expanded.children).toEqual([{ id: 'lib-img', tagName: 'img', children: [] }]) // library-контент
      // attributes плейсхолдера ПЕРЕКРЫВАЮТ library
      expect(expanded.attributes['data-carousel-static']).toBe('true')
      expect(expanded.attributes['data-carousel-slide']).toBe('4')
      // library-attributes тоже присутствуют (merge)
      expect(expanded.attributes.class).toBe('promo')
    })

    it('_replaceLinkedBlock: НИКОГДА не пишет library-children в page (защита от реинтродукции expand)', () => {
      const node = {
        id: 'n',
        metadata: { linkedBlockId: 'X' },
        attributes: { 'data-carousel-static': 'true' },
        children: [{ id: 'old-expanded' }],
        variations: { mobile: { specificChildren: [{ id: 'm1' }] } },
      }

      const out = (service as any)._replaceLinkedBlock(node, 'X', {
        id: 'lib',
        children: [{ id: 'libc1' }, { id: 'libc2' }],
      })

      expect(out.id).toBe('n')
      expect(out.children).toEqual([])
      expect(out.variations.mobile.specificChildren).toEqual([])
      expect(out.metadata.linkedBlockId).toBe('X')
      expect(out.attributes['data-carousel-static']).toBe('true')
    })
  })
})
