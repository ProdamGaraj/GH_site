/**
 * Пересоздаёт адаптивные размеры уже загруженных картинок по текущему правилу
 * выбора ширин (services/mediaVariants.ts: от телефона до самого широкого
 * экрана, а не шесть самых широких).
 *
 * По умолчанию ТОЛЬКО СЧИТАЕТ (ничего не пишет). Порядок работы:
 *
 *   1. посмотреть, что изменится:
 *        docker exec visual-cms-backend-1 npx ts-node src/scripts/regenerate-media-variants.ts
 *   2. создать недостающие размеры:
 *        docker exec visual-cms-backend-1 npx ts-node src/scripts/regenerate-media-variants.ts --apply
 *   3. передеплоить сайт и коллекции (страницы начнут ссылаться на новые размеры);
 *   4. убрать лишние размеры — только ПОСЛЕ передеплоя, иначе у опубликованных
 *      страниц будут битые картинки:
 *        docker exec visual-cms-backend-1 npx ts-node src/scripts/regenerate-media-variants.ts --apply --prune
 *
 * Ширины: `--widths=375,768,1920` либо, без параметра, все ширины, которые
 * уже встречаются у картинок медиатеки (то есть список экранов проекта).
 */
import 'reflect-metadata'
import { AppDataSource } from '../config/database'
import { MediaAsset } from '../models/MediaAsset'
import { mediaService } from '../services/MediaService'
import { parseVariantWidths } from '../services/mediaVariants'

export interface RegenerateOptions {
  apply?: boolean
  prune?: boolean
  widths?: number[]
  initDb?: boolean
  log?: (line: string) => void
}

export interface RegenerateReport {
  images: number
  changed: number
  created: number
  removed: number
  failed: number
}

/** Все ширины, которые уже есть у картинок медиатеки. */
export function knownWidths(assets: Pick<MediaAsset, 'variants'>[]): number[] {
  const widths = new Set<number>()
  for (const asset of assets) {
    for (const v of asset.variants ?? []) {
      if (v.width > 0) widths.add(v.width)
    }
  }
  return Array.from(widths).sort((a, b) => b - a)
}

export async function regenerateMediaVariants(options: RegenerateOptions = {}): Promise<RegenerateReport> {
  const log = options.log ?? ((line: string) => console.log(line))
  if (options.initDb ?? true) await AppDataSource.initialize()

  const assets = await AppDataSource.getRepository(MediaAsset).find({ where: { kind: 'image' }, order: { createdAt: 'ASC' } })
  const widths = options.widths && options.widths.length > 0 ? options.widths : knownWidths(assets)
  log(`[variants] картинок: ${assets.length}; ширины: ${widths.join(', ') || '—'}`)
  log(`[variants] режим: ${options.apply ? 'запись' : 'только подсчёт'}${options.prune ? ', с удалением лишних' : ''}`)

  const report: RegenerateReport = { images: assets.length, changed: 0, created: 0, removed: 0, failed: 0 }
  if (widths.length === 0) return report

  for (const asset of assets) {
    try {
      const changes = await mediaService.regenerateVariants(asset, widths, {
        prune: options.prune,
        dryRun: !options.apply,
      })
      if (changes.create.length === 0 && changes.remove.length === 0) continue
      report.changed += 1
      report.created += changes.create.length
      report.removed += changes.remove.length
      log(
        `[variants] ${asset.fileName} (${asset.width ?? '?'}px): ` +
          `+[${changes.create.join(', ')}] −[${changes.remove.join(', ')}]`,
      )
    } catch (err: any) {
      // Один битый файл не должен останавливать остальные.
      report.failed += 1
      log(`[variants] ОШИБКА ${asset.fileName} (${asset.storageKey}): ${err?.message}`)
    }
  }

  log(
    `[variants] итог: изменится картинок ${report.changed}, создать ${report.created}, ` +
      `удалить ${report.removed}, ошибок ${report.failed}` +
      (options.apply ? '' : ' — ничего не записано, для записи добавьте --apply'),
  )
  return report
}

if (require.main === module) {
  const args = process.argv.slice(2)
  const widthsArg = args.find((a) => a.startsWith('--widths='))
  regenerateMediaVariants({
    apply: args.includes('--apply'),
    prune: args.includes('--prune'),
    widths: widthsArg ? parseVariantWidths(widthsArg.slice('--widths='.length)) : undefined,
  })
    .then(async (report) => {
      await AppDataSource.destroy()
      process.exit(report.failed > 0 ? 1 : 0)
    })
    .catch(async (err) => {
      console.error('[variants] FAILED', err)
      try {
        await AppDataSource.destroy()
      } catch {
        // соединение могло не открыться
      }
      process.exit(1)
    })
}
