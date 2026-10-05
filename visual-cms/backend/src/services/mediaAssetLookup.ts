import { FindOptionsSelect, Like } from 'typeorm'
import { AppDataSource } from '../config/database'
import { MediaAsset } from '../models/MediaAsset'

/**
 * Поиск ассетов медиатеки по uuid ХРАНИЛИЩА из адреса `/media/<uuid>.<ext>`.
 *
 * uuid в адресе — не id записи MediaAsset: MediaService генерирует для файла
 * свой uuid (storageKey = `<uuid>.<ext>`), а id записи создаёт база. У
 * оригинала и всех производных (`.opt.webp`, `.w800.webp`, `.thumb.webp`) uuid
 * хранилища один, поэтому ищем по префиксу storageKey.
 */
export async function findAssetsByStorageUuids(
  uuids: readonly string[],
  select: FindOptionsSelect<MediaAsset>,
): Promise<MediaAsset[]> {
  if (uuids.length === 0) return []
  return AppDataSource.getRepository(MediaAsset).find({
    where: uuids.map((uuid) => ({ storageKey: Like(`${uuid}.%`) })),
    select: { ...select, storageKey: true },
  })
}

/** uuid хранилища из storageKey (`<uuid>.<ext>` → `<uuid>`). */
export function storageUuidOf(storageKey: string): string {
  return storageKey.split('.')[0].toLowerCase()
}
