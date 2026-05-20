/**
 * Cache Service
 * 
 * Сервис кэширования для оптимизации производительности.
 * Поддерживает in-memory и Redis кэш.
 */

import { createClient, RedisClientType } from 'redis'
import { logger } from './Logger'

// ==================== TYPES ====================

export interface CacheOptions {
  ttl?: number           // Time to live in seconds
  tags?: string[]        // Cache tags for invalidation
  compression?: boolean  // Compress large values
}

export interface CacheEntry<T = unknown> {
  value: T
  createdAt: number
  expiresAt?: number
  tags?: string[]
}

export interface CacheStats {
  hits: number
  misses: number
  size: number
  hitRate: number
}

// ==================== IN-MEMORY CACHE ====================

class InMemoryCache {
  private cache: Map<string, CacheEntry> = new Map()
  private tagIndex: Map<string, Set<string>> = new Map()
  private maxSize: number
  private hits = 0
  private misses = 0

  constructor(maxSize = 1000) {
    this.maxSize = maxSize
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      this.misses++
      return null
    }

    // Check expiration
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.delete(key)
      this.misses++
      return null
    }

    this.hits++
    return entry.value as T
  }

  set<T>(key: string, value: T, options: CacheOptions = {}): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictOldest()
    }

    const entry: CacheEntry<T> = {
      value,
      createdAt: Date.now(),
      expiresAt: options.ttl ? Date.now() + options.ttl * 1000 : undefined,
      tags: options.tags,
    }

    this.cache.set(key, entry as CacheEntry)

    // Update tag index
    if (options.tags) {
      for (const tag of options.tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set())
        }
        this.tagIndex.get(tag)!.add(key)
      }
    }
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    // Remove from tag index
    if (entry.tags) {
      for (const tag of entry.tags) {
        this.tagIndex.get(tag)?.delete(key)
      }
    }

    return this.cache.delete(key)
  }

  invalidateByTag(tag: string): number {
    const keys = this.tagIndex.get(tag)
    if (!keys) return 0

    let count = 0
    for (const key of keys) {
      if (this.delete(key)) count++
    }

    this.tagIndex.delete(tag)
    return count
  }

  clear(): void {
    this.cache.clear()
    this.tagIndex.clear()
    this.hits = 0
    this.misses = 0
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.hits / total : 0,
    }
  }

  private evictOldest(): void {
    // Simple LRU-like eviction - remove oldest entry
    const firstKey = this.cache.keys().next().value
    if (firstKey) {
      this.delete(firstKey)
    }
  }
}

// ==================== REDIS CACHE ====================

class RedisCache {
  private client: RedisClientType | null = null
  private connected = false
  private stats = { hits: 0, misses: 0 }

  async connect(url?: string): Promise<void> {
    if (this.connected) return

    try {
      this.client = createClient({
        url: url || process.env.REDIS_URL || 'redis://localhost:6379',
      })

      this.client.on('error', (err) => {
        logger.error('Redis Client Error', err instanceof Error ? err : undefined)
      })

      await this.client.connect()
      this.connected = true
    } catch (error) {
      logger.error('Failed to connect to Redis', error instanceof Error ? error : undefined)
      this.connected = false
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.connected) {
      await this.client.quit()
      this.connected = false
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.connected || !this.client) return null

    try {
      const value = await this.client.get(`cache:${key}`)
      if (value) {
        this.stats.hits++
        return JSON.parse(value) as T
      }
      this.stats.misses++
      return null
    } catch (error) {
      logger.error('Redis get error', error instanceof Error ? error : undefined)
      return null
    }
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    if (!this.connected || !this.client) return

    try {
      const serialized = JSON.stringify(value)
      const redisKey = `cache:${key}`

      if (options.ttl) {
        await this.client.setEx(redisKey, options.ttl, serialized)
      } else {
        await this.client.set(redisKey, serialized)
      }

      // Store tags for invalidation
      if (options.tags) {
        for (const tag of options.tags) {
          await this.client.sAdd(`cache:tag:${tag}`, redisKey)
        }
      }
    } catch (error) {
      logger.error('Redis set error', error instanceof Error ? error : undefined)
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.connected || !this.client) return false

    try {
      const result = await this.client.del(`cache:${key}`)
      return result > 0
    } catch (error) {
      logger.error('Redis delete error', error instanceof Error ? error : undefined)
      return false
    }
  }

  async invalidateByTag(tag: string): Promise<number> {
    if (!this.connected || !this.client) return 0

    try {
      const keys = await this.client.sMembers(`cache:tag:${tag}`)
      if (keys.length === 0) return 0

      const result = await this.client.del(keys)
      await this.client.del(`cache:tag:${tag}`)
      return result
    } catch (error) {
      logger.error('Redis invalidateByTag error', error instanceof Error ? error : undefined)
      return 0
    }
  }

  async clear(): Promise<void> {
    if (!this.connected || !this.client) return

    try {
      const keys = await this.client.keys('cache:*')
      if (keys.length > 0) {
        await this.client.del(keys)
      }
      this.stats = { hits: 0, misses: 0 }
    } catch (error) {
      logger.error('Redis clear error', error instanceof Error ? error : undefined)
    }
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: -1, // Redis doesn't easily expose size
      hitRate: total > 0 ? this.stats.hits / total : 0,
    }
  }
}

// ==================== UNIFIED CACHE SERVICE ====================

class CacheService {
  private memoryCache: InMemoryCache
  private redisCache: RedisCache
  private useRedis: boolean

  constructor() {
    this.memoryCache = new InMemoryCache()
    this.redisCache = new RedisCache()
    this.useRedis = false
  }

  async initialize(useRedis = false): Promise<void> {
    this.useRedis = useRedis
    if (useRedis) {
      await this.redisCache.connect()
      this.useRedis = this.redisCache.isConnected()
    }
  }

  async get<T>(key: string): Promise<T | null> {
    // Try memory cache first
    const memoryResult = this.memoryCache.get<T>(key)
    if (memoryResult !== null) return memoryResult

    // Try Redis if enabled
    if (this.useRedis) {
      const redisResult = await this.redisCache.get<T>(key)
      if (redisResult !== null) {
        // Populate memory cache
        this.memoryCache.set(key, redisResult, { ttl: 60 })
        return redisResult
      }
    }

    return null
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    // Always set in memory
    this.memoryCache.set(key, value, options)

    // Also set in Redis if enabled
    if (this.useRedis) {
      await this.redisCache.set(key, value, options)
    }
  }

  async delete(key: string): Promise<boolean> {
    const memoryResult = this.memoryCache.delete(key)
    
    if (this.useRedis) {
      await this.redisCache.delete(key)
    }

    return memoryResult
  }

  async invalidateByTag(tag: string): Promise<number> {
    let count = this.memoryCache.invalidateByTag(tag)
    
    if (this.useRedis) {
      count += await this.redisCache.invalidateByTag(tag)
    }

    return count
  }

  async clear(): Promise<void> {
    this.memoryCache.clear()
    if (this.useRedis) {
      await this.redisCache.clear()
    }
  }

  getStats(): CacheStats {
    return this.memoryCache.getStats()
  }

  /**
   * Cache wrapper for async functions
   */
  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== null) return cached

    const result = await fn()
    await this.set(key, result, options)
    return result
  }

  /**
   * Memoize function with caching
   */
  memoize<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>,
    keyFn: (...args: TArgs) => string,
    options: CacheOptions = {}
  ): (...args: TArgs) => Promise<TResult> {
    return async (...args: TArgs): Promise<TResult> => {
      const key = keyFn(...args)
      return this.wrap(key, () => fn(...args), options)
    }
  }
}

// ==================== EXPORTS ====================

export const cacheService = new CacheService()
export { InMemoryCache, RedisCache }
export default cacheService
