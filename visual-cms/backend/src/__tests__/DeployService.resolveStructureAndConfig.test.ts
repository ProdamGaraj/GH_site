/**
 * Регрессионный тест для DeployService.resolveStructureAndConfig.
 * Метод приватный, дёргаем через `as any`.
 *
 * Баг, который ловим (deploySite/deployAll показывали в карусели только статичные
 * DOM-слайды, без клонирования по данным): repeater-привязка трека hero-карусели
 * висит на блоке, который физически лежит ВНУТРИ linked-блока. В сырой page.structure
 * у linked-блока children пустые → preparePageDataConfig не видит этот blockId →
 * теряет привязку → на опубликованной странице нет Data Binding Runtime.
 *
 * Раньше развёртку linked-блоков перед построением config делал только deployPage.
 * deploySite/deployAll вызывали preparePageDataConfig по СЫРОЙ структуре и роняли
 * привязку. Теперь все три пути идут через resolveStructureAndConfig, который строит
 * config на РАЗВЁРНУТОЙ структуре. Тест фиксирует именно этот инвариант.
 */

// Мокаем БД ДО импорта сервиса — конструктор берёт репозитории через getRepository.
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

jest.mock('../services/LinkedBlocksService', () => ({
  linkedBlocksService: { updateLinkedBlocks: jest.fn() },
}))

import { linkedBlocksService } from '../services/LinkedBlocksService'
// Импортируем после моков
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DeployService } = require('../services/DeployService')

describe('DeployService.resolveStructureAndConfig', () => {
  it('строит data-config на РАЗВЁРНУТОЙ структуре, а не на сырой page.structure', async () => {
    const svc: any = new DeployService()

    // Сырая структура: hero-карусель сохранена как linked-блок с пустыми children.
    const rawStructure = {
      id: 'gh-hero-root',
      metadata: { linkedBlockId: 'lib-1' },
      children: [],
    }
    // Развёрнутая структура: внутри появился трек с repeater-привязкой.
    const expandedStructure = {
      id: 'gh-hero-root',
      children: [
        {
          id: 'gh-track-22',
          attributes: { 'data-carousel-track': 'true' },
          children: [{ id: 'gh-tpl-7' }],
        },
      ],
    }

    ;(linkedBlocksService.updateLinkedBlocks as jest.Mock).mockResolvedValue(expandedStructure)
    // injectLibraryTemplates приватный и ходит в БД — подменяем, возвращая структуру как есть.
    const injectSpy = jest.spyOn(svc, 'injectLibraryTemplates').mockResolvedValue(expandedStructure)
    // preparePageDataConfig тоже приватный + БД — перехватываем аргументы.
    const prepSpy = jest.spyOn(svc, 'preparePageDataConfig').mockResolvedValue(undefined)

    const page = { id: 'page-1', structure: rawStructure }
    const result = await svc.resolveStructureAndConfig(page)

    // 1. updateLinkedBlocks вызван с сырой структурой страницы.
    expect(linkedBlocksService.updateLinkedBlocks).toHaveBeenCalledWith(rawStructure)
    // 2. injectLibraryTemplates получил результат updateLinkedBlocks + pageId.
    expect(injectSpy).toHaveBeenCalledWith(expandedStructure, 'page-1')
    // 3. КЛЮЧЕВОЕ: config строится по РАЗВЁРНУТОЙ структуре (где виден трек), а не по сырой.
    //    Именно отсутствие этого шага в deploySite/deployAll и было багом.
    expect(prepSpy).toHaveBeenCalledWith('page-1', expandedStructure)
    // 4. Возвращается развёрнутая структура — её же отдаём в htmlGenerator, чтобы
    //    HTML и config были согласованы.
    expect(result.structure).toBe(expandedStructure)
  })
})
