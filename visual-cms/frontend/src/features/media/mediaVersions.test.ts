import { describe, it, expect } from 'vitest'
import type { MediaAsset } from '@/shared/api/mediaApi'
import { formatBytes, hasDerivedVersions, listMediaVersions, savingLabel } from './mediaVersions'

const asset = (overrides: Partial<MediaAsset> = {}): MediaAsset => ({
  id: 'a1',
  siteId: null,
  kind: 'image',
  fileName: 'photo.jpg',
  mimeType: 'image/jpeg',
  url: '/media/u.jpg',
  posterUrl: null,
  thumbnailUrl: '/media/u.thumb.webp',
  optimizedUrl: '/media/u.opt.webp',
  optimizedSizeBytes: 300_000,
  variants: [
    { width: 768, height: 384, url: '/media/u.w768.webp', sizeBytes: 40_000 },
    { width: 1920, height: 960, url: '/media/u.w1920.webp', sizeBytes: 150_000 },
  ],
  folderId: null,
  sizeBytes: 6_000_000,
  width: 3840,
  height: 1920,
  durationSec: null,
  title: null,
  alt: null,
  tags: [],
  createdAt: '2026-11-13T00:00:00Z',
  updatedAt: '2026-11-13T00:00:00Z',
  ...overrides,
})

describe('listMediaVersions', () => {
  it('оригинал, сжатая версия, затем размеры от широких к узким', () => {
    const versions = listMediaVersions(asset())
    expect(versions.map((v) => v.kind)).toEqual(['original', 'optimized', 'variant', 'variant'])
    expect(versions.map((v) => v.label)).toEqual(['Оригинал', 'Сжатая, полный размер', '1920 px', '768 px'])
    expect(versions.map((v) => v.url)).toEqual(['/media/u.jpg', '/media/u.opt.webp', '/media/u.w1920.webp', '/media/u.w768.webp'])
    expect(versions[1]).toMatchObject({ width: 3840, height: 1920, sizeBytes: 300_000 })
    expect(versions[3]).toMatchObject({ width: 768, height: 384, sizeBytes: 40_000 })
  })

  it('есть сжатая версия — оригинал на сайте не показывается; нет — показывается он', () => {
    expect(listMediaVersions(asset())[0].note).toBe('Хранится, на сайте не показывается')
    const plain = listMediaVersions(asset({ optimizedUrl: null, optimizedSizeBytes: null }))
    expect(plain.map((v) => v.kind)).toEqual(['original', 'variant', 'variant'])
    expect(plain[0].note).toBe('Показывается на широких экранах')
  })

  it('файл без производных — только оригинал; исходный массив размеров не переставляется', () => {
    expect(listMediaVersions(asset({ optimizedUrl: null, variants: [] }))).toHaveLength(1)
    const a = asset()
    listMediaVersions(a)
    expect(a.variants.map((v) => v.width)).toEqual([768, 1920])
  })

  it('высота размера 0 (не посчиталась) — неизвестна', () => {
    const versions = listMediaVersions(asset({ variants: [{ width: 768, height: 0, url: '/v', sizeBytes: 1 }] }))
    expect(versions[2].height).toBeNull()
  })
})

describe('hasDerivedVersions', () => {
  it('сжатая версия или хотя бы один размер', () => {
    expect(hasDerivedVersions(asset())).toBe(true)
    expect(hasDerivedVersions(asset({ variants: [] }))).toBe(true)
    expect(hasDerivedVersions(asset({ optimizedUrl: null }))).toBe(true)
    expect(hasDerivedVersions(asset({ optimizedUrl: null, variants: [] }))).toBe(false)
  })
})

describe('formatBytes', () => {
  it.each([
    [640, '640 Б'],
    [1024, '1 КБ'],
    [87_000, '85 КБ'],
    [1_500_000, '1,4 МБ'],
    [6_000_000, '5,7 МБ'],
    [25_000_000, '24 МБ'],
  ])('%d → %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected)
  })

  it('ноль, отрицательное и не число — прочерк', () => {
    expect(formatBytes(0)).toBe('—')
    expect(formatBytes(-5)).toBe('—')
    expect(formatBytes(NaN)).toBe('—')
  })
})

describe('savingLabel', () => {
  it('процент экономии относительно оригинала', () => {
    expect(savingLabel(300_000, 6_000_000)).toBe('−95%')
    expect(savingLabel(3_000_000, 6_000_000)).toBe('−50%')
  })

  it('не легче оригинала, меньше процента или вес неизвестен — пусто', () => {
    expect(savingLabel(6_000_000, 6_000_000)).toBe('')
    expect(savingLabel(7_000_000, 6_000_000)).toBe('')
    expect(savingLabel(5_999_000, 6_000_000)).toBe('')
    expect(savingLabel(0, 6_000_000)).toBe('')
    expect(savingLabel(100, 0)).toBe('')
  })
})
