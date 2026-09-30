/**
 * Яркость верхней полосы для уже загруженных картинок медиатеки
 * (MediaAsset.topBrightness, services/headerTheme.ts). Новые файлы получают её
 * при загрузке; по ней фото-слайд карусели получает тему шапки при публикации.
 *
 * Запуск на сервере:
 *   docker exec -w /app visual-cms-backend-1 npx ts-node --transpile-only src/scripts/backfill-media-top-brightness.ts --dry-run
 *   docker exec -w /app visual-cms-backend-1 npx ts-node --transpile-only src/scripts/backfill-media-top-brightness.ts
 *
 * Флаг --dry-run — посчитать и показать, в базу не писать. Пишется только
 * новая колонка; повторный запуск берёт лишь картинки без значения.
 * После записи нужен передеплой страниц со слайдерами (главной).
 */
import 'reflect-metadata'
import { AppDataSource } from '../config/database'
import { MediaAsset } from '../models/MediaAsset'
import { minioStorageService } from '../services/MinioStorageService'
import { themeFromBrightness, topBandBrightness } from '../services/headerTheme'
import { hasFlag } from './migrationIo'

async function main(): Promise<void> {
  const dryRun = hasFlag('dry-run')
  await AppDataSource.initialize()
  try {
    const repo = AppDataSource.getRepository(MediaAsset)
    const candidates = await repo
      .createQueryBuilder('m')
      .where('m.kind = :k', { k: 'image' })
      .andWhere('m."mimeType" <> :svg', { svg: 'image/svg+xml' })
      .andWhere('m."topBrightness" IS NULL')
      .getMany()
    console.log(`Картинок без яркости: ${candidates.length}`)

    let ok = 0
    let fail = 0
    for (const asset of candidates) {
      try {
        const original = await minioStorageService.getObject(asset.storageKey)
        const brightness = await topBandBrightness(original)
        if (brightness === null) throw new Error('не удалось разобрать картинку')
        console.log(`  ${asset.fileName} (${asset.id}): ${brightness} → фон ${themeFromBrightness(brightness) === 'dark' ? 'тёмный' : 'светлый'}`)
        if (!dryRun) await repo.update(asset.id, { topBrightness: brightness })
        ok++
      } catch (err: any) {
        fail++
        console.warn(`  ! ${asset.fileName}: ${err?.message}`)
      }
    }
    console.log(`Готово: ${ok}, ошибок: ${fail}.${dryRun ? ' --dry-run: в базу ничего не записано.' : ' Теперь нужен передеплой главной.'}`)
  } finally {
    await AppDataSource.destroy()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
