/**
 * Блок данных из библиотечного блока: якоря на месте содержимого (dataAnchors.ts).
 *
 *   info(blockId)        — якоря блока, кандидаты («данные» / «интерфейс»), где
 *                          используется, какие действия допустимы;
 *   makeDataBlock(...)   — rewrite: переписать этот блок (только если он нигде
 *                          не показывается со своим текстом; копия прежней
 *                          структуры — в файл резервной копии); copy: новый
 *                          библиотечный блок с новыми id узлов, исходный не меняется.
 *
 * Переводы. У заменённых полей текст теперь из данных — их строки в
 * block_translations уходят (иначе перевод на деплое затёр бы плейсхолдер).
 * Копия получает переводы неизменённых узлов исходного блока под новыми id.
 */
import { randomUUID } from 'crypto'
import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'
import { BlockTranslation } from '../models/BlockTranslation'
import { writeBackup } from '../scripts/migrationIo'
import { ValidationError, NotFoundError } from '../middleware'
import { anchorActions, findBlockDataUsage, type AnchorAction, type BlockDataUsage } from './blockDataUsage'
import { applyAnchors, cloneWithNewIds, detectAnchorCandidates, findAnchors, type AnchorCandidate, type AnchorPick, type DataAnchor } from './dataAnchors'
import { cacheService } from './CacheService'
import { logger } from './Logger'

export interface BlockAnchorInfo {
  block: { id: string; name: string }
  anchors: Array<DataAnchor & { nodeId: string }>
  candidates: AnchorCandidate[]
  usage: BlockDataUsage
  actions: AnchorAction[]
}

export interface MakeDataBlockResult {
  blockId: string
  name: string
  anchors: Array<DataAnchor & { nodeId: string }>
  /** Файл резервной копии (rewrite). */
  backup?: string
}

const BACKUP_DIR = process.env.BACKUP_DIR || '/app/backups'

export class BlockDataAnchorsService {
  private blocks = () => AppDataSource.getRepository(Block)

  private async load(blockId: string): Promise<Block> {
    const block = await this.blocks().findOne({ where: { id: blockId } })
    if (!block) throw new NotFoundError('Block', blockId)
    return block
  }

  /**
   * withUsage=false — только имя и якоря (форма секции в редакторе новости):
   * без обхода страниц и запросов к сервисам.
   */
  async info(blockId: string, withUsage = true): Promise<BlockAnchorInfo> {
    const block = await this.load(blockId)
    const anchors = findAnchors(block.structure)
    const usage = withUsage ? await findBlockDataUsage(blockId) : { pages: [], blocks: [], projects: [], news: [], unchecked: ['не проверялось'] }
    return {
      block: { id: block.id, name: block.name },
      anchors,
      candidates: detectAnchorCandidates(block.structure),
      usage,
      actions: anchorActions(anchors.length > 0, usage),
    }
  }

  async makeDataBlock(blockId: string, mode: 'rewrite' | 'copy', picks: AnchorPick[], name?: string): Promise<MakeDataBlockResult> {
    const block = await this.load(blockId)
    // Копия блока данных — с его якорями как есть; иначе нужен хоть один якорь.
    if (picks.length === 0 && !(mode === 'copy' && findAnchors(block.structure).length > 0)) {
      throw new ValidationError('Не выбрано ни одного якоря')
    }
    const usage = await findBlockDataUsage(blockId)
    const actions = anchorActions(findAnchors(block.structure).length > 0, usage)
    if (!actions.includes(mode)) {
      throw new ValidationError(
        mode === 'rewrite'
          ? 'Блок показывается со своим текстом на других страницах (или проверить это не удалось) — переписать нельзя, только создать копию'
          : `Действие «${mode}» для этого блока недоступно`
      )
    }
    return mode === 'rewrite' ? this.rewrite(block, picks) : this.copy(block, picks, name)
  }

  private async rewrite(block: Block, picks: AnchorPick[]): Promise<MakeDataBlockResult> {
    const result = applyAnchors(block.structure, picks)
    const backup = writeBackup(BACKUP_DIR, `block-anchors-${block.id}`, { id: block.id, name: block.name, structure: block.structure })
    await AppDataSource.transaction(async (m) => {
      await m.getRepository(Block).update(block.id, { structure: result.structure as never })
      for (const { nodeId, field } of result.replacedFields) {
        await m.getRepository(BlockTranslation).delete({ blockId: block.id, nodeId, field })
      }
    })
    await cacheService.invalidateByTag('blocks')
    logger.info(`Блок «${block.name}» переписан якорями данных (${result.anchors.length}); копия: ${backup}`)
    return { blockId: block.id, name: block.name, anchors: result.anchors, backup }
  }

  private async copy(block: Block, picks: AnchorPick[], name?: string): Promise<MakeDataBlockResult> {
    const { structure: cloned, idMap } = cloneWithNewIds(block.structure, randomUUID)
    const remapped = picks.map((p) => {
      const nodeId = idMap.get(p.nodeId)
      if (!nodeId) throw new ValidationError(`Узла ${p.nodeId} нет в блоке «${block.name}»`)
      return { ...p, nodeId }
    })
    const result = applyAnchors(cloned, remapped)
    const replaced = new Set(result.replacedFields.map((r) => `${r.nodeId}\u0000${r.field}`))
    const copyName = (name ?? '').trim() || `${block.name} — для новостей`

    const saved = await AppDataSource.transaction(async (m) => {
      const repo = m.getRepository(Block)
      const created = await repo.save(
        repo.create({
          name: copyName,
          type: block.type,
          groupId: block.groupId,
          isReusable: true,
          structure: result.structure,
          thumbnail: block.thumbnail,
          tags: block.tags ?? [],
        })
      )
      // Переводы неизменённых узлов — под новыми id; заменённые поля — из данных.
      const rows = await m.getRepository(BlockTranslation).find({ where: { blockId: block.id } })
      const copies = rows
        .map((r) => ({ ...r, nodeId: idMap.get(r.nodeId) }))
        .filter((r): r is typeof r & { nodeId: string } => typeof r.nodeId === 'string' && !replaced.has(`${r.nodeId}\u0000${r.field}`))
        .map(({ id: _id, createdAt: _c, updatedAt: _u, block: _b, ...r }) => ({ ...r, blockId: created.id }))
      for (let i = 0; i < copies.length; i += 200) await m.getRepository(BlockTranslation).insert(copies.slice(i, i + 200))
      return created
    })
    await cacheService.invalidateByTag('blocks')
    logger.info(`Блок данных «${copyName}» создан копией «${block.name}» (${result.anchors.length} якорей)`)
    return { blockId: saved.id, name: copyName, anchors: result.anchors }
  }

  /**
   * Якоря, пропавшие при правке блока, которые используют новости: ключи и
   * новости. Пусто — ничего не сломано. Сохранение не запрещаем (блок может
   * править дизайнер), но администратор должен это увидеть.
   */
  async lostAnchorsInNews(blockId: string, before: unknown, after: unknown): Promise<{ keys: string[]; news: Array<{ id: string; title: string }> }> {
    const now = new Set(findAnchors(after as never).map((a) => a.key))
    const keys = findAnchors(before as never).map((a) => a.key).filter((k) => !now.has(k))
    if (keys.length === 0) return { keys, news: [] }
    const usage = await findBlockDataUsage(blockId)
    return { keys, news: usage.news }
  }
}

export const blockDataAnchorsService = new BlockDataAnchorsService()
