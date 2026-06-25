import { describe, it, expect } from 'vitest'
import { buildMediaSlideNode, type SlideMediaAsset } from './slideMediaHelper'

// Детерминированный generateId — чтобы проверять структуру, не привязываясь к uuid.
let counter = 0
const generateId = () => `id-${++counter}`

const asset = (overrides: Partial<SlideMediaAsset>): SlideMediaAsset => ({
  kind: 'image',
  url: 'https://cdn/x.jpg',
  posterUrl: null,
  id: 'asset-1',
  ...overrides,
})

describe('buildMediaSlideNode', () => {
  it('фото (image) → слайд с background-image и именем «Фото-слайд»', () => {
    const node = buildMediaSlideNode(asset({ kind: 'image', url: 'https://cdn/p.jpg' }), {
      generateId,
    })
    expect(node).not.toBeNull()
    expect(node!.metadata.name).toBe('Фото-слайд')
    expect(node!.attributes['data-slide-video']).toBeUndefined()
    expect(node!.styles.properties.backgroundImage).toBe('url("https://cdn/p.jpg")')
    expect(node!.styles.properties.backgroundSize).toBe('cover')
    expect(node!.styles.properties.width).toBe('100%')
    expect(node!.metadata).toMatchObject({ mediaAssetId: 'asset-1' })
  })

  it('GIF приходит как kind=image → обрабатывается как фото-слайд (анимация через background-image)', () => {
    const node = buildMediaSlideNode(asset({ kind: 'image', url: 'https://cdn/anim.gif' }), {
      generateId,
    })
    expect(node!.metadata.name).toBe('Фото-слайд')
    expect(node!.styles.properties.backgroundImage).toBe('url("https://cdn/anim.gif")')
    expect(node!.attributes['data-slide-video']).toBeUndefined()
  })

  it('видео с постером → data-slide-video=<url> + постер в background-image', () => {
    const node = buildMediaSlideNode(
      asset({ kind: 'video', url: 'https://cdn/v.mp4', posterUrl: 'https://cdn/v.jpg' }),
      { generateId }
    )
    expect(node!.metadata.name).toBe('Видео-слайд')
    expect(node!.attributes['data-slide-video']).toBe('https://cdn/v.mp4')
    // Постер = posterUrl, а НЕ сам mp4.
    expect(node!.styles.properties.backgroundImage).toBe('url("https://cdn/v.jpg")')
  })

  it('видео без постера → data-slide-video есть, background-image отсутствует', () => {
    const node = buildMediaSlideNode(
      asset({ kind: 'video', url: 'https://cdn/v.mp4', posterUrl: null }),
      { generateId }
    )
    expect(node!.attributes['data-slide-video']).toBe('https://cdn/v.mp4')
    expect(node!.styles.properties.backgroundImage).toBeUndefined()
    expect(node!.styles.properties.backgroundSize).toBeUndefined()
  })

  it('документ → null (нельзя сделать слайдом)', () => {
    const node = buildMediaSlideNode(asset({ kind: 'document', url: 'https://cdn/doc.pdf' }), {
      generateId,
    })
    expect(node).toBeNull()
  })

  it('extraAttributes мержатся (static-режим: data-carousel-slide)', () => {
    const node = buildMediaSlideNode(asset({ kind: 'image' }), {
      generateId,
      extraAttributes: { 'data-carousel-slide': 'true' },
    })
    expect(node!.attributes['data-carousel-slide']).toBe('true')
  })

  it('video + extraAttributes: оба атрибута присутствуют', () => {
    const node = buildMediaSlideNode(asset({ kind: 'video', url: 'https://cdn/v.mp4' }), {
      generateId,
      extraAttributes: { 'data-carousel-slide': 'true' },
    })
    expect(node!.attributes['data-carousel-slide']).toBe('true')
    expect(node!.attributes['data-slide-video']).toBe('https://cdn/v.mp4')
  })

  it('minHeight применяется, когда задан (static-режим)', () => {
    const node = buildMediaSlideNode(asset({ kind: 'image' }), {
      generateId,
      minHeight: '240px',
    })
    expect(node!.styles.properties.minHeight).toBe('240px')
  })

  it('minHeight отсутствует по умолчанию (repeat-режим)', () => {
    const node = buildMediaSlideNode(asset({ kind: 'image' }), { generateId })
    expect(node!.styles.properties.minHeight).toBeUndefined()
  })

  it('ассет без id → metadata без mediaAssetId', () => {
    const node = buildMediaSlideNode(asset({ kind: 'image', id: '' }), { generateId })
    expect(node!.metadata.name).toBe('Фото-слайд')
    expect('mediaAssetId' in node!.metadata).toBe(false)
  })
})
