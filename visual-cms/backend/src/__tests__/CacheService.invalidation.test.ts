/**
 * Кэш: корректность инвалидации по тегам.
 *
 * Регрессия к багу «новый блок не появляется в библиотеке»: записи с тегом
 * должны полностью удаляться через invalidateByTag, а memory-слой не должен
 * хранить «бестеговые» записи, переживающие инвалидацию.
 */
import { InMemoryCache, cacheService } from '../services/CacheService'

describe('InMemoryCache — инвалидация по тегам', () => {
  it('set(tag) → get → invalidateByTag → miss', () => {
    const c = new InMemoryCache()
    c.set('blocks:list', [1, 2, 3], { tags: ['blocks'] })
    expect(c.get('blocks:list')).toEqual([1, 2, 3])

    const removed = c.invalidateByTag('blocks')
    expect(removed).toBe(1)
    expect(c.get('blocks:list')).toBeNull()
  })

  it('invalidateByTag чистит все ключи тега', () => {
    const c = new InMemoryCache()
    c.set('a', 1, { tags: ['blocks'] })
    c.set('b', 2, { tags: ['blocks'] })
    c.set('c', 3, { tags: ['pages'] })

    expect(c.invalidateByTag('blocks')).toBe(2)
    expect(c.get('a')).toBeNull()
    expect(c.get('b')).toBeNull()
    expect(c.get('c')).toBe(3) // другой тег не затронут
  })

  it('TTL: запись истекает', async () => {
    const c = new InMemoryCache()
    c.set('k', 'v', { ttl: 0.05 }) // 50 мс
    expect(c.get('k')).toBe('v')
    await new Promise((r) => setTimeout(r, 70))
    expect(c.get('k')).toBeNull()
  })
})

describe('CacheService — memory-путь (Redis выключен)', () => {
  it('set(tag) → invalidateByTag → get null', async () => {
    await cacheService.set('svc:blocks', { x: 1 }, { tags: ['blocks-test'] })
    expect(await cacheService.get('svc:blocks')).toEqual({ x: 1 })

    await cacheService.invalidateByTag('blocks-test')
    expect(await cacheService.get('svc:blocks')).toBeNull()
  })
})
