import { resolveExternalRequest } from '../services/externalServicePresets'

describe('resolveExternalRequest', () => {
  it('wordpress: строит /wp-json/wp/v2/{endpoint} + per_page', () => {
    const r = resolveExternalRequest({
      serviceType: 'wordpress',
      url: 'https://blog.example.com/',
      wordpress: { endpoint: '/wp-json/wp/v2/posts', perPage: 20 },
    })
    expect(r.url).toBe('https://blog.example.com/wp-json/wp/v2/posts')
    expect(r.queryParams).toEqual({ per_page: '20' })
  })

  it('wordpress: дефолтный endpoint posts', () => {
    const r = resolveExternalRequest({ serviceType: 'wordpress', url: 'https://x.com' })
    expect(r.url).toBe('https://x.com/wp-json/wp/v2/posts')
  })

  it('strapi: /api/{contentType} + populate', () => {
    const r = resolveExternalRequest({
      serviceType: 'strapi',
      url: 'https://cms.example.com',
      strapi: { contentType: 'projects', populate: ['cover', 'tags'] },
    })
    expect(r.url).toBe('https://cms.example.com/api/projects')
    expect(r.queryParams).toEqual({ populate: 'cover,tags' })
  })

  it('shopify: /admin/api/{version}/{resource}.json + limit', () => {
    const r = resolveExternalRequest({
      serviceType: 'shopify',
      url: 'https://shop.example.com',
      apiVersion: '2024-04',
      shopify: { resource: 'products', limit: 50 },
    })
    expect(r.url).toBe('https://shop.example.com/admin/api/2024-04/products.json')
    expect(r.queryParams).toEqual({ limit: '50' })
  })

  it('shopify: не дублирует .json в ресурсе', () => {
    const r = resolveExternalRequest({ serviceType: 'shopify', url: 'https://s.com', shopify: { resource: 'orders.json' } })
    expect(r.url).toBe('https://s.com/admin/api/2024-01/orders.json')
  })

  it('custom: базовый URL как есть', () => {
    const r = resolveExternalRequest({ serviceType: 'custom', url: 'https://api.example.com/v1/data/' })
    expect(r.url).toBe('https://api.example.com/v1/data')
    expect(r.queryParams).toEqual({})
  })

  it('неизвестный serviceType → как custom', () => {
    const r = resolveExternalRequest({ serviceType: 'wat', url: 'https://x.com/' })
    expect(r.url).toBe('https://x.com')
  })

  it('обрезает завершающие слэши базового URL', () => {
    const r = resolveExternalRequest({ serviceType: 'wordpress', url: 'https://x.com///', wordpress: { endpoint: 'wp-json/wp/v2/pages' } })
    expect(r.url).toBe('https://x.com/wp-json/wp/v2/pages')
  })
})
