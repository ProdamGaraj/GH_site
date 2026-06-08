const mockRepo = { find: jest.fn(), save: jest.fn() }
const mockCached = {
  invalidateCache: jest.fn().mockResolvedValue(0),
  fetchData: jest.fn().mockResolvedValue({ success: true, data: [{ a: 1 }] }),
}

jest.mock('../config/database', () => ({ AppDataSource: { getRepository: () => mockRepo } }))
jest.mock('../services/CachedDataSourceService', () => ({ cachedDataSourceService: mockCached }))
jest.mock('../services/CredentialsManager', () => ({ CredentialsManager: { decryptAuthConfig: jest.fn() } }))

import { isFeedDue, FeedPollingScheduler } from '../services/FeedPollingScheduler'

const MIN = 60 * 1000

describe('isFeedDue', () => {
  const now = Date.now()
  it('interval 0/undefined → никогда не due', () => {
    expect(isFeedDue(null, 0, now)).toBe(false)
    expect(isFeedDue(new Date(now - 999999), undefined, now)).toBe(false)
  })
  it('нет lastFetchAt → due немедленно', () => {
    expect(isFeedDue(null, 60, now)).toBe(true)
    expect(isFeedDue(undefined, 60, now)).toBe(true)
  })
  it('свежий lastFetchAt → не due', () => {
    expect(isFeedDue(new Date(now), 60, now)).toBe(false)
    expect(isFeedDue(new Date(now - 30 * 1000), 60, now)).toBe(false)
  })
  it('истёк интервал → due', () => {
    expect(isFeedDue(new Date(now - 2 * MIN), 60, now)).toBe(true)
    expect(isFeedDue(new Date(now - 61 * 1000), 60, now)).toBe(true)
  })
  it('строковая дата поддерживается', () => {
    expect(isFeedDue(new Date(now - 2 * MIN).toISOString(), 60, now)).toBe(true)
  })
  it('невалидная дата → due (лучше обновить, чем застрять)', () => {
    expect(isFeedDue('not-a-date', 60, now)).toBe(true)
  })
})

describe('FeedPollingScheduler.tick', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCached.invalidateCache.mockResolvedValue(0)
    mockCached.fetchData.mockResolvedValue({ success: true, data: [{ a: 1 }] })
  })

  it('обновляет только due-источники', async () => {
    const now = Date.now()
    mockRepo.find.mockResolvedValue([
      { id: 'due', type: 'feed', pollingEnabled: true, status: 'active', pollingInterval: 60, lastFetchAt: new Date(now - 5 * MIN), config: {} },
      { id: 'fresh', type: 'feed', pollingEnabled: true, status: 'active', pollingInterval: 60, lastFetchAt: new Date(now), config: {} },
    ])

    const sched = new FeedPollingScheduler()
    await sched.tick(now)

    expect(mockCached.fetchData).toHaveBeenCalledTimes(1)
    expect(mockCached.invalidateCache).toHaveBeenCalledWith('due')
    expect(mockCached.fetchData).toHaveBeenCalledWith('due', expect.objectContaining({ type: 'feed' }), undefined)
    // lastFetch* зафиксированы у обновлённого
    expect(mockRepo.save).toHaveBeenCalledTimes(1)
    expect(mockRepo.save.mock.calls[0][0]).toMatchObject({ id: 'due', lastFetchStatus: 'success' })
  })

  it('берёт интервал из config, если колонка пуста', async () => {
    const now = Date.now()
    mockRepo.find.mockResolvedValue([
      { id: 'c', type: 'feed', pollingEnabled: true, status: 'active', pollingInterval: null, lastFetchAt: new Date(now - 5 * MIN), config: { pollingInterval: 120 } },
    ])
    const sched = new FeedPollingScheduler()
    await sched.tick(now)
    expect(mockCached.fetchData).toHaveBeenCalledTimes(1)
  })

  it('фиксирует ошибку фетча в lastFetchStatus', async () => {
    const now = Date.now()
    mockCached.fetchData.mockResolvedValue({ success: false, error: { code: 'X', message: 'boom' } })
    mockRepo.find.mockResolvedValue([
      { id: 'err', type: 'feed', pollingEnabled: true, status: 'active', pollingInterval: 60, lastFetchAt: null, config: {} },
    ])
    const sched = new FeedPollingScheduler()
    await sched.tick(now)
    expect(mockRepo.save.mock.calls[0][0]).toMatchObject({ id: 'err', lastFetchStatus: 'error', lastFetchError: 'boom' })
  })

  it('не запускает параллельный тик (guard)', async () => {
    mockRepo.find.mockImplementation(() => new Promise(r => setTimeout(() => r([]), 20)))
    const sched = new FeedPollingScheduler()
    const p1 = sched.tick()
    const p2 = sched.tick() // должен сразу выйти из-за running-guard
    await Promise.all([p1, p2])
    expect(mockRepo.find).toHaveBeenCalledTimes(1)
  })
})
