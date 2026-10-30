/**
 * История версий блоков: снимок, восстановление (с пометкой для триггера и
 * отменяемое), удалённые блоки. Версии при изменениях пишет триггер базы —
 * его SQL проверен на стенде в откатываемой транзакции; здесь — логика сервиса.
 */
const versionsRepo = { find: jest.fn(), findOne: jest.fn(), save: jest.fn(async (v: any) => v), create: jest.fn((v: any) => v), delete: jest.fn() }
const blocksRepo = { findOne: jest.fn(), save: jest.fn(async (b: any) => b) }
const txQuery = jest.fn()
const query = jest.fn()

jest.mock('../config/database', () => ({
  AppDataSource: {
    getRepository: (entity: any) => (entity?.name === 'BlockVersion' ? versionsRepo : blocksRepo),
    transaction: async (fn: any) => fn({ getRepository: () => blocksRepo, query: txQuery }),
    query: (...args: any[]) => query(...args),
  },
}))
jest.mock('../services/CacheService', () => ({ cacheService: { invalidateByTag: jest.fn() } }))
jest.mock('../services/LinkedBlocksService', () => ({ linkedBlocksService: { syncBlockToAllPages: jest.fn(async () => ({ updatedPages: [], errors: [] })) } }))

import { BlockVersionService } from '../services/BlockVersionService'
import { cacheService } from '../services/CacheService'
import { linkedBlocksService } from '../services/LinkedBlocksService'

const svc = new BlockVersionService()
const NAV = { id: 'nav', name: 'Navigation', type: 'container', isReusable: true, structure: { id: 'r', children: [] }, updatedAt: new Date('2026-10-29T13:14:53Z') }

beforeEach(() => {
  jest.clearAllMocks()
})

describe('snapshot', () => {
  it('версия «manual» со следующим номером, меткой и полями строки без структуры и имени', async () => {
    blocksRepo.findOne.mockResolvedValue(NAV)
    versionsRepo.findOne.mockResolvedValue({ id: 'v7', version: 7 })
    const v = await svc.snapshot('nav', '  перед редизайном ')
    expect(v).toMatchObject({ blockId: 'nav', version: 8, name: 'Navigation', source: 'manual', label: 'перед редизайном', structure: NAV.structure, savedAt: NAV.updatedAt })
    expect(v.extra).toEqual({ id: 'nav', type: 'container', isReusable: true, updatedAt: NAV.updatedAt })
  })

  it('первая версия — номер 1; пустая метка — без метки', async () => {
    blocksRepo.findOne.mockResolvedValue(NAV)
    versionsRepo.findOne.mockResolvedValue(null)
    const v = await svc.snapshot('nav', '   ')
    expect(v.version).toBe(1)
    expect(v.label).toBeNull()
  })

  it('блока нет — ошибка', async () => {
    blocksRepo.findOne.mockResolvedValue(null)
    await expect(svc.snapshot('gone')).rejects.toThrow()
  })
})

describe('restore', () => {
  it('структура и имя версии; в транзакции — пометка «restore» для триггера; затем кэш и страницы', async () => {
    versionsRepo.findOne.mockResolvedValue({ id: 'v3', blockId: 'nav', name: 'Navigation', structure: { id: 'r', children: [{ id: 'menu' }] } })
    blocksRepo.findOne.mockResolvedValue({ ...NAV })
    const block = await svc.restore('nav', 'v3')
    expect(txQuery).toHaveBeenCalledWith(expect.stringContaining(`set_config('app.block_version_source', 'restore', true)`))
    expect(block.structure).toEqual({ id: 'r', children: [{ id: 'menu' }] })
    expect(cacheService.invalidateByTag).toHaveBeenCalledWith('blocks')
    expect(linkedBlocksService.syncBlockToAllPages).toHaveBeenCalledWith('nav', block.structure)
  })

  it('версии нет у этого блока — 404, блок не тронут', async () => {
    versionsRepo.findOne.mockResolvedValue(null)
    await expect(svc.restore('nav', 'other')).rejects.toThrow()
    expect(blocksRepo.save).not.toHaveBeenCalled()
  })

  it('блок удалён — подсказка восстановить из удалённых', async () => {
    versionsRepo.findOne.mockResolvedValue({ id: 'v3', blockId: 'nav', name: 'N', structure: {} })
    blocksRepo.findOne.mockResolvedValue(null)
    await expect(svc.restore('nav', 'v3')).rejects.toThrow(/удалён/)
  })
})

describe('удалённые блоки', () => {
  it('список — последние версии, свежие удаления первыми', async () => {
    query.mockResolvedValue([
      { id: 'a', blockId: 'b1', name: 'Старый', createdAt: new Date('2026-10-01') },
      { id: 'b', blockId: 'b2', name: 'Новый', createdAt: new Date('2026-10-29') },
    ])
    const list = await svc.listDeleted()
    expect(list.map((d) => d.name)).toEqual(['Новый', 'Старый'])
    expect(list[0]).toEqual({ versionId: 'b', blockId: 'b2', name: 'Новый', deletedAt: new Date('2026-10-29') })
  })

  it('восстановление: тот же id, поля строки из версии; блок существует — отказ', async () => {
    versionsRepo.findOne.mockResolvedValue({ id: 'v', blockId: 'b2', name: 'Новый', structure: { id: 'r' }, extra: { type: 'container', groupId: 'g' } })
    blocksRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'b2', structure: { id: 'r' } })
    const block = await svc.restoreDeleted('v')
    expect(block.id).toBe('b2')
    const [sql, params] = query.mock.calls[0]
    expect(sql).toMatch(/INSERT INTO blocks/)
    expect(params).toEqual([JSON.stringify({ type: 'container', groupId: 'g' }), 'b2', 'Новый', JSON.stringify({ id: 'r' })])

    blocksRepo.findOne.mockResolvedValueOnce({ id: 'b2' })
    await expect(svc.restoreDeleted('v')).rejects.toThrow(/не удалён/)
  })
})

describe('метки', () => {
  it('метка обрезается; пустая — снимается', async () => {
    versionsRepo.findOne.mockResolvedValue({ id: 'v', blockId: 'nav', label: 'x' })
    expect((await svc.updateLabel('nav', 'v', '  итог  ')).label).toBe('итог')
    expect((await svc.updateLabel('nav', 'v', ' ')).label).toBeNull()
  })
})
