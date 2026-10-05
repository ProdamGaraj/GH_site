import { logger } from './Logger'
import { findAssetsByStorageUuids, storageUuidOf } from './mediaAssetLookup'
import { extractMediaUuids, optimizeMediaInHtml, type MediaRendition } from './responsiveImages'

/**
 * Облегчает картинки готового HTML страницы (см. responsiveImages.ts):
 * `<img>` получает оптимизированный `src`, `srcset` и `sizes`, CSS-фоны —
 * оптимизированную версию вместо оригинала PNG/JPEG.
 *
 * Файлы ищутся по uuid хранилища из адреса `/media/<uuid>.<ext>` — он не
 * совпадает с id записи MediaAsset. Раньше искали по id, ничего не находили,
 * и сайт грузил оригиналы (слайды по 6 МБ вместо 0,3 МБ webp).
 *
 * Один батч-запрос на страницу — без N+1.
 * Best-effort: при ошибке возвращает исходный html (деплой не падает).
 */
export class ResponsiveImageService {
  async enrich(html: string): Promise<string> {
    try {
      const uuids = extractMediaUuids(html)
      if (uuids.length === 0) return html

      const assets = await findAssetsByStorageUuids(uuids, {
        optimizedStorageKey: true,
        width: true,
        variants: true,
      })
      const renditions = new Map<string, MediaRendition>()
      for (const a of assets) {
        renditions.set(storageUuidOf(a.storageKey), {
          storageKey: a.storageKey,
          optimizedKey: a.optimizedStorageKey ?? null,
          width: a.width ?? null,
          variants: (a.variants ?? []).map((v) => ({ width: v.width, storageKey: v.storageKey })),
        })
      }
      if (renditions.size === 0) return html

      return optimizeMediaInHtml(html, renditions)
    } catch (err: any) {
      logger.warn('[ResponsiveImageService] enrich failed, returning original html', {
        error: err?.message,
      })
      return html
    }
  }
}

export const responsiveImageService = new ResponsiveImageService()
