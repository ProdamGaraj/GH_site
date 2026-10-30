/**
 * История версий блоков библиотеки.
 *
 * Версии пишет триггер базы (migrations/add-block-versions.sql): при каждом
 * изменении и удалении блока его прежнее состояние уходит в block_versions.
 * Здесь — чтение, снимок по кнопке, метки и восстановление.
 *
 * Восстановление — обычное изменение блока, поэтому триггер сохраняет
 * состояние до него (с источником «restore»): восстановление можно отменить
 * следующим восстановлением. Удалённый блок возвращается с тем же id —
 * страницы, где он стоял, снова его находят.
 */
import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'
import { BlockVersion } from '../models/BlockVersion'
import { NotFoundError, AppError } from '../middleware'
import { cacheService } from './CacheService'
import { linkedBlocksService } from './LinkedBlocksService'
import { logger } from './Logger'

/** Поля версии в списке — без структуры (она тяжёлая). */
const LIST_FIELDS: (keyof BlockVersion)[] = ['id', 'blockId', 'version', 'name', 'source', 'label', 'savedAt', 'createdAt']

/** Удалённый блок: его последняя версия. */
export interface DeletedBlock {
  versionId: string
  blockId: string
  name: string
  deletedAt: Date
}

export class BlockVersionService {
  private versions = () => AppDataSource.getRepository(BlockVersion)
  private blocks = () => AppDataSource.getRepository(Block)

  list(blockId: string): Promise<BlockVersion[]> {
    return this.versions().find({ where: { blockId }, order: { version: 'DESC' }, select: LIST_FIELDS })
  }

  async get(blockId: string, versionId: string): Promise<BlockVersion> {
    const version = await this.versions().findOne({ where: { id: versionId, blockId } })
    if (!version) throw new NotFoundError('BlockVersion', versionId)
    return version
  }

  /** Снимок текущего состояния по кнопке, с меткой («перед редизайном»). */
  async snapshot(blockId: string, label?: string): Promise<BlockVersion> {
    const block = await this.blocks().findOne({ where: { id: blockId } })
    if (!block) throw new NotFoundError('Block', blockId)
    const last = await this.versions().findOne({ where: { blockId }, order: { version: 'DESC' }, select: ['id', 'version'] })
    const { structure, name, ...extra } = block as unknown as Record<string, unknown>
    return this.versions().save(
      this.versions().create({
        blockId,
        version: (last?.version ?? 0) + 1,
        name: String(name),
        structure,
        extra,
        source: 'manual',
        label: label?.trim() || null,
        savedAt: block.updatedAt,
      }),
    )
  }

  /**
   * Возвращает блоку состояние версии. Текущее состояние триггер сохранит
   * версией «restore». Страницы получат блок при следующей публикации.
   */
  async restore(blockId: string, versionId: string): Promise<Block> {
    const version = await this.get(blockId, versionId)
    const restored = await AppDataSource.transaction(async (m) => {
      const block = await m.getRepository(Block).findOne({ where: { id: blockId } })
      if (!block) throw new AppError('Блок удалён — восстановите его из списка удалённых', 409, 'BLOCK_DELETED')
      await m.query(`SELECT set_config('app.block_version_source', 'restore', true)`)
      block.structure = version.structure
      block.name = version.name
      return m.getRepository(Block).save(block)
    })
    await this.afterChange(blockId, restored.structure)
    return restored
  }

  async updateLabel(blockId: string, versionId: string, label: string): Promise<BlockVersion> {
    const version = await this.get(blockId, versionId)
    version.label = label.trim() || null
    return this.versions().save(version)
  }

  async remove(blockId: string, versionId: string): Promise<void> {
    const result = await this.versions().delete({ id: versionId, blockId })
    if (!result.affected) throw new NotFoundError('BlockVersion', versionId)
  }

  /** Удалённые блоки — последняя версия каждого блока, которого больше нет. */
  async listDeleted(): Promise<DeletedBlock[]> {
    const rows: Array<{ id: string; blockId: string; name: string; createdAt: Date }> = await AppDataSource.query(
      `SELECT DISTINCT ON (v."blockId") v.id, v."blockId", v.name, v."createdAt"
         FROM block_versions v
        WHERE NOT EXISTS (SELECT 1 FROM blocks b WHERE b.id = v."blockId")
        ORDER BY v."blockId", v.version DESC`,
    )
    return rows
      .map((r) => ({ versionId: r.id, blockId: r.blockId, name: r.name, deletedAt: r.createdAt }))
      .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime())
  }

  /**
   * Возвращает удалённый блок с прежним id и полями строки. Группы больше
   * нет — блок без группы.
   */
  async restoreDeleted(versionId: string): Promise<Block> {
    const version = await this.versions().findOne({ where: { id: versionId } })
    if (!version) throw new NotFoundError('BlockVersion', versionId)
    if (await this.blocks().findOne({ where: { id: version.blockId }, select: ['id'] })) {
      throw new AppError('Блок не удалён — восстановите версию в его истории', 409, 'BLOCK_EXISTS')
    }
    await AppDataSource.query(
      `INSERT INTO blocks
       SELECT * FROM jsonb_populate_record(NULL::blocks,
         $1::jsonb || jsonb_build_object('id', $2::uuid, 'name', $3::text, 'structure', $4::jsonb, 'updatedAt', now(),
           'groupId', (SELECT g.id FROM groups g WHERE g.id::text = ($1::jsonb ->> 'groupId'))))`,
      [JSON.stringify(version.extra ?? {}), version.blockId, version.name, JSON.stringify(version.structure)],
    )
    const block = await this.blocks().findOne({ where: { id: version.blockId } })
    if (!block) throw new AppError('Блок не восстановлен', 500, 'RESTORE_FAILED')
    await this.afterChange(block.id, block.structure)
    return block
  }

  /** Как после сохранения блока: кэш и устаревшие копии на страницах. */
  private async afterChange(blockId: string, structure: unknown): Promise<void> {
    await cacheService.invalidateByTag('blocks')
    try {
      await linkedBlocksService.syncBlockToAllPages(blockId, structure)
    } catch (err) {
      logger.warn(`Блок ${blockId}: страницы не обновлены после восстановления: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}

export const blockVersionService = new BlockVersionService()
