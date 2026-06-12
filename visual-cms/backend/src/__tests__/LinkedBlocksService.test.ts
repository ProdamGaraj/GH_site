/**
 * LinkedBlocksService — unit-тесты для syncBlockToAllPages (library → pages),
 * applyLinkedDecisions (решения пользователя) и detectChangedLinkedInstances.
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

  /**
   * Регресс: один и тот же library-блок несколько раз на странице.
   *
   * Историческая ошибка: processingIds в _applyLinkedBlocks никогда не очищался,
   * поэтому разворачивался только ПЕРВЫЙ инстанс блока — остальные оставались
   * пустыми placeholder'ами (children: []). На канвасе блок «исчезал», а клик
   * «В библиотеку» пушил пустышку обратно и затирал библиотечный блок.
   */
  describe('updateLinkedBlocks: повторные инстансы и циклы', () => {
    const repo: any = (AppDataSource as any).getRepository()

    beforeEach(() => {
      repo.find.mockReset()
    })

    it('разворачивает ВСЕ инстансы одного блока на странице, не только первый', async () => {
      const structure = {
        id: 'root',
        children: [
          { id: 'inst-1', metadata: { linkedBlockId: 'lib-X' }, children: [] },
          { id: 'middle', children: [
            { id: 'inst-2', metadata: { linkedBlockId: 'lib-X' }, children: [] },
          ] },
          { id: 'inst-3', metadata: { linkedBlockId: 'lib-X' }, children: [] },
        ],
      }
      repo.find.mockResolvedValueOnce([
        {
          id: 'lib-X',
          structure: { id: 'lib-root', tagName: 'section', children: [{ id: 'lib-c', content: 'X' }] },
        },
      ])

      const result = await service.updateLinkedBlocks(structure)

      const inst1 = result.children[0]
      const inst2 = result.children[1].children[0]
      const inst3 = result.children[2]
      for (const [inst, instId] of [[inst1, 'inst-1'], [inst2, 'inst-2'], [inst3, 'inst-3']] as const) {
        expect(inst.id).toBe(instId) // id плейсхолдера сохранён
        expect(inst.metadata.linkedBlockId).toBe('lib-X')
        expect(inst.children).toEqual([{ id: 'lib-c', content: 'X' }]) // развёрнут
      }
    })

    it('настоящий цикл (блок содержит сам себя) не приводит к бесконечной рекурсии', async () => {
      const structure = {
        id: 'root',
        children: [{ id: 'inst', metadata: { linkedBlockId: 'lib-cycle' }, children: [] }],
      }
      // Библиотечный блок внутри себя ссылается сам на себя (испорченные данные)
      repo.find.mockResolvedValueOnce([
        {
          id: 'lib-cycle',
          structure: {
            id: 'lib-root',
            children: [{ id: 'self-ref', metadata: { linkedBlockId: 'lib-cycle' }, children: [] }],
          },
        },
      ])

      const result = await service.updateLinkedBlocks(structure)

      const inst = result.children[0]
      expect(inst.id).toBe('inst')
      // Вложенная самоссылка осталась placeholder'ом — рекурсия остановлена
      expect(inst.children[0].id).toBe('self-ref')
      expect(inst.children[0].children).toEqual([])
    })
  })

  /**
   * applyLinkedDecisions — применение решений пользователя к структуре перед сохранением.
   * Чистый метод (без БД); сайд-эффекты в библиотеку возвращаются как libraryWrites.
   */
  describe('applyLinkedDecisions', () => {
    const makePage = () => ({
      id: 'root',
      children: [
        {
          id: 'footer-inst',
          tagName: 'footer',
          metadata: { linkedBlockId: 'lib-footer', name: 'Footer', styleOverrides: { x: 1 } },
          attributes: { 'data-carousel-static': 'true' },
          children: [{ id: 'c1', tagName: 'p', content: 'изменено' }],
          variations: { mobile: { specificChildren: [{ id: 'm1' }] } },
        },
        {
          id: 'plain',
          tagName: 'div',
          metadata: {},
          children: [{ id: 'header-inst', metadata: { linkedBlockId: 'lib-header' }, children: [{ id: 'h1' }] }],
        },
      ],
    })

    it("'push' пишет содержимое в библиотеку (без linkedBlockId/styleOverrides) и схлопывает инстанс", () => {
      const { structure, libraryWrites } = service.applyLinkedDecisions(makePage(), { 'footer-inst': 'push' })

      expect(libraryWrites).toHaveLength(1)
      expect(libraryWrites[0].blockId).toBe('lib-footer')
      expect(libraryWrites[0].structure.metadata.linkedBlockId).toBeUndefined()
      expect(libraryWrites[0].structure.metadata.styleOverrides).toBeUndefined()
      expect(libraryWrites[0].structure.children).toHaveLength(1) // содержимое сохранено для библиотеки

      const footer = structure.children[0]
      expect(footer.id).toBe('footer-inst')
      expect(footer.children).toEqual([]) // на странице — placeholder
      expect(footer.metadata.linkedBlockId).toBe('lib-footer')
      expect(footer.attributes['data-carousel-static']).toBe('true')
      expect(footer.variations.mobile.specificChildren).toEqual([])
    })

    it("'static' убирает linkedBlockId и замораживает содержимое; библиотека не трогается", () => {
      const { structure, libraryWrites } = service.applyLinkedDecisions(makePage(), { 'footer-inst': 'static' })

      expect(libraryWrites).toHaveLength(0)
      const footer = structure.children[0]
      expect(footer.metadata.linkedBlockId).toBeUndefined()
      expect(footer.children).toHaveLength(1) // содержимое заморожено развёрнутым
      expect(footer.children[0].content).toBe('изменено')
    })

    it("'revert' схлопывает инстанс в placeholder без записи в библиотеку", () => {
      const { structure, libraryWrites } = service.applyLinkedDecisions(makePage(), { 'footer-inst': 'revert' })
      expect(libraryWrites).toHaveLength(0)
      expect(structure.children[0].children).toEqual([])
      expect(structure.children[0].metadata.linkedBlockId).toBe('lib-footer')
    })

    it('без решения linked-инстанс схлопывается в placeholder (правка не сохраняется)', () => {
      const { structure, libraryWrites } = service.applyLinkedDecisions(makePage(), {})
      expect(libraryWrites).toHaveLength(0)
      // оба linked-инстанса схлопнуты
      expect(structure.children[0].children).toEqual([])
      expect(structure.children[1].children[0].children).toEqual([])
    })

    it('разные решения для разных инстансов применяются независимо (вложенный header)', () => {
      const { structure, libraryWrites } = service.applyLinkedDecisions(makePage(), {
        'footer-inst': 'static',
        'header-inst': 'push',
      })
      expect(libraryWrites.map((w) => w.blockId)).toEqual(['lib-header'])
      expect(structure.children[0].metadata.linkedBlockId).toBeUndefined() // footer static
      const header = structure.children[1].children[0]
      expect(header.children).toEqual([]) // header collapsed
      expect(header.metadata.linkedBlockId).toBe('lib-header')
    })

    it('не-linked узлы остаются нетронутыми по содержимому', () => {
      const { structure } = service.applyLinkedDecisions(makePage(), {})
      expect(structure.children[1].id).toBe('plain')
      expect(structure.children[1].tagName).toBe('div')
    })
  })

  /**
   * detectChangedLinkedInstances — какие linked-инстансы разошлись с библиотекой.
   * Использует замоканный blockRepository.find.
   */
  describe('detectChangedLinkedInstances', () => {
    const repo: any = (AppDataSource as any).getRepository()

    beforeEach(() => {
      repo.find.mockReset()
      repo.find.mockResolvedValue([])
    })

    const libBlock = {
      id: 'lib-footer',
      name: 'Footer',
      structure: {
        id: 'lib-root',
        tagName: 'footer',
        styles: { properties: { padding: '40px' } },
        attributes: { class: 'footer' },
        metadata: { name: 'Footer' },
        children: [{ id: 'c1', tagName: 'p', content: 'оригинал', styles: { properties: {} }, attributes: {}, metadata: {}, children: [] }],
      },
    }

    const expandedInstance = (override: any = {}) => ({
      id: 'root',
      children: [
        {
          ...JSON.parse(JSON.stringify(libBlock.structure)),
          id: 'footer-inst',
          attributes: { class: 'footer', 'data-carousel-static': 'true' },
          metadata: { name: 'Footer', linkedBlockId: 'lib-footer' },
          ...override,
        },
      ],
    })

    it('идентичный инстанс (только overlay) → пустой список', async () => {
      repo.find.mockResolvedValueOnce([libBlock])
      const result = await service.detectChangedLinkedInstances(expandedInstance())
      expect(result).toEqual([])
    })

    it('изменённый текст → инстанс в списке с changes и именем блока', async () => {
      repo.find.mockResolvedValueOnce([libBlock])
      const changed = expandedInstance()
      changed.children[0].children[0].content = 'НОВЫЙ ТЕКСТ'
      const result = await service.detectChangedLinkedInstances(changed)
      expect(result).toHaveLength(1)
      expect(result[0].instanceId).toBe('footer-inst')
      expect(result[0].linkedBlockId).toBe('lib-footer')
      expect(result[0].blockName).toBe('Footer')
      expect(result[0].changes.length).toBeGreaterThan(0)
    })

    it('блок отсутствует в библиотеке → пропускается (нет эталона)', async () => {
      repo.find.mockResolvedValueOnce([]) // библиотека пуста
      const changed = expandedInstance()
      changed.children[0].children[0].content = 'X'
      const result = await service.detectChangedLinkedInstances(changed)
      expect(result).toEqual([])
    })

    it('нет linked-инстансов → пустой список без запроса к БД', async () => {
      const result = await service.detectChangedLinkedInstances({ id: 'r', children: [{ id: 'plain', children: [] }] })
      expect(result).toEqual([])
      expect(repo.find).not.toHaveBeenCalled()
    })
  })
})
