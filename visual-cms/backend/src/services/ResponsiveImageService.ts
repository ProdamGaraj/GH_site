import { In } from 'typeorm'
import { AppDataSource } from '../config/database'
import { MediaAsset } from '../models/MediaAsset'
import { logger } from './Logger'
import {
  injectResponsiveImages,
  extractMediaIds,
  type ResponsiveVariant,
} from './responsiveImages'

/**
 * Обогащает готовый HTML страницы адаптивными `srcset`/`sizes`.
 *
 * Для каждого `<img src=".../media/<uuid>...">` находит варианты ассета (по uuid)
 * и дописывает srcset, чтобы на сайте под разные экраны грузились разные размеры.
 *
 * Один батч-запрос на страницу (id IN (...)) — без N+1.
 * Best-effort: при ошибке возвращает исходный html (деплой не падает).
 */
export class ResponsiveImageService {
  async enrich(html: string): Promise<string> {
    try {
      const ids = extractMediaIds(html)
      if (ids.length === 0) return html

      const assets = await AppDataSource.getRepository(MediaAsset).find({
        where: { id: In(ids) },
        select: ['id', 'variants'],
      })

      const map = new Map<string, ResponsiveVariant[]>()
      for (const a of assets) {
        if (a.variants && a.variants.length > 0) {
          map.set(
            a.id.toLowerCase(),
            a.variants.map((v) => ({ width: v.width, storageKey: v.storageKey })),
          )
        }
      }
      if (map.size === 0) return html

      return injectResponsiveImages(html, map)
    } catch (err: any) {
      logger.warn('[ResponsiveImageService] enrich failed, returning original html', {
        error: err?.message,
      })
      return html
    }
  }
}

export const responsiveImageService = new ResponsiveImageService()
