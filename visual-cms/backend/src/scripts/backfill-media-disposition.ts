/**
 * Backfill Content-Disposition: attachment for existing non-inline-safe assets
 * (SVG, PDF, office, любые файлы), чтобы они скачивались, а не исполнялись в браузере.
 *
 * Идемпотентно: повторный запуск просто перезапишет те же метаданные.
 * Run: docker exec -it visual-cms-backend-1 npx ts-node src/scripts/backfill-media-disposition.ts
 */
import 'reflect-metadata'
import { AppDataSource } from '../config/database'
import { MediaAsset } from '../models/MediaAsset'
import { minioStorageService } from '../services/MinioStorageService'
import { isInlineSafe, buildContentDisposition } from '../services/mediaMime'

async function main() {
  await AppDataSource.initialize()
  console.log('[backfill-disposition] DB connected')

  const repo = AppDataSource.getRepository(MediaAsset)
  const all = await repo.find()
  const candidates = all.filter((a) => !isInlineSafe(a.mimeType))

  console.log(
    `[backfill-disposition] ${all.length} assets total, ${candidates.length} need attachment`,
  )
  let ok = 0
  let fail = 0

  for (const a of candidates) {
    try {
      await minioStorageService.setObjectMetadata(
        a.storageKey,
        a.mimeType,
        buildContentDisposition(a.fileName),
      )
      ok++
      console.log(`  + ${a.fileName} (${a.mimeType})`)
    } catch (e: any) {
      fail++
      console.warn(`  ! ${a.fileName}: ${e?.message}`)
    }
  }

  console.log(`[backfill-disposition] done: ok=${ok} fail=${fail}`)
  await AppDataSource.destroy()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
