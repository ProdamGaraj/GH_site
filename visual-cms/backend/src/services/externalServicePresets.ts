/**
 * Пресеты для DataSource типа 'external' — тонкий слой над rest-api с готовыми
 * endpoint'ами популярных сервисов (WordPress / Strapi / Shopify). Резолвит
 * конфиг источника в обычный REST-запрос (url + queryParams), который дальше
 * исполняет fetchRestApi. Один резолвер используется и в рантайме, и в тесте
 * подключения (DRY).
 */

export interface ExternalResolvedRequest {
  url: string
  queryParams: Record<string, string>
}

/**
 * Строит REST-запрос из конфига external-источника.
 *  - wordpress: {base}/wp-json/wp/v2/{endpoint}   (?per_page)
 *  - strapi:    {base}/api/{contentType}          (?populate=a,b)
 *  - shopify:   {base}/admin/api/{version}/{resource}.json  (?limit)
 *  - custom:    {base} как есть
 */
export function resolveExternalRequest(config: Record<string, unknown>): ExternalResolvedRequest {
  const serviceType = String(config.serviceType || 'custom').toLowerCase()
  const base = String(config.url || '').replace(/\/+$/, '')
  const queryParams: Record<string, string> = {}

  switch (serviceType) {
    case 'wordpress': {
      const wp = (config.wordpress || {}) as Record<string, unknown>
      const endpointRaw = String(wp.endpoint || '/wp-json/wp/v2/posts')
      const endpoint = endpointRaw.startsWith('/') ? endpointRaw : `/${endpointRaw}`
      if (wp.perPage) queryParams.per_page = String(wp.perPage)
      return { url: `${base}${endpoint}`, queryParams }
    }
    case 'strapi': {
      const strapi = (config.strapi || {}) as Record<string, unknown>
      const contentType = String(strapi.contentType || 'articles').replace(/^\/+/, '')
      if (Array.isArray(strapi.populate) && strapi.populate.length > 0) {
        queryParams.populate = strapi.populate.join(',')
      }
      return { url: `${base}/api/${contentType}`, queryParams }
    }
    case 'shopify': {
      const shopify = (config.shopify || {}) as Record<string, unknown>
      const version = String(config.apiVersion || '2024-01')
      const resource = String(shopify.resource || 'products').replace(/^\/+/, '').replace(/\.json$/, '')
      if (shopify.limit) queryParams.limit = String(shopify.limit)
      return { url: `${base}/admin/api/${version}/${resource}.json`, queryParams }
    }
    case 'custom':
    default:
      return { url: base, queryParams }
  }
}
