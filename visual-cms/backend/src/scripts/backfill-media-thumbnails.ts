/**
 * Backfill thumbnails for existing media_assets that don't have one yet.
 * Run: docker exec -it visual-cms-backend-1 npx ts-node src/scripts/backfill-media-thumbnails.ts
 */
import 'reflect-metadata'
import sharp from 'sharp'
import { AppDataSource } from '../config/database'
import { MediaAsset } from '../models/MediaAsset'
import { minioStorageService } from '../services/MinioStorageService'

async function main() {
  await AppDataSource.initialize()
  console.log('[backfill] DB connected')

  const repo = AppDataSource.getRepository(MediaAsset)
  const candidates = await repo
    .createQueryBuilder('m')
    .where('m.kind = :k', { k: 'image' })
    .andWhere('m."mimeType" <> :svg', { svg: 'image/svg+xml' })
    .andWhere('m."thumbnailStorageKey" IS NULL')
    .getMany()

  console.log(`[backfill] found ${candidates.length} candidates`)
  let ok = 0
  let fail = 0

  for (const a of candidates) {
    try {
      const orig = await minioStorageService.getObject(a.storageKey)
      const img = sharp(orig, { failOn: 'none' })
      const meta = await img.metadata()
      const thumb = await img
        .rotate()
        .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer()
      const thumbKey = `${a.id}.thumb.webp`
      await minioStorageService.putObject(thumbKey, thumb, 'image/webp')
      a.thumbnailStorageKey = thumbKey
      if (meta.width && !a.width) a.width = meta.width
      if (meta.height && !a.height) a.height = meta.height
      await repo.save(a)
      ok++
      console.log(`  + ${a.fileName} (${a.id})`)
    } catch (e: any) {
      fail++
      console.warn(`  ! ${a.fileName}: ${e?.message}`)
    }
  }

  console.log(`[backfill] done: ok=${ok} fail=${fail}`)
  await AppDataSource.destroy()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
