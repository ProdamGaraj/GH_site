import { AppDataSource } from '../config/database'
import { MediaFolder } from '../models/MediaFolder'
import { MediaAsset } from '../models/MediaAsset'
import { ValidationError, NotFoundError } from '../middleware'

export interface FolderListFilter {
  siteId?: string | null
  includeGlobal?: boolean
}

export interface CreateFolderInput {
  siteId?: string | null
  parentId?: string | null
  name: string
}

/**
 * CRUD папок медиатеки (дерево).
 *
 * Бизнес-правила:
 *   - имя не пустое;
 *   - parent должен существовать и быть в той же области видимости (siteId);
 *   - перемещение не должно создавать цикл;
 *   - удалять можно только пустую папку (нет подпапок и ассетов) — явно и безопасно.
 */
export class MediaFolderService {
  private repo() {
    return AppDataSource.getRepository(MediaFolder)
  }
  private assetRepo() {
    return AppDataSource.getRepository(MediaAsset)
  }

  /** Все папки области видимости (для построения дерева на клиенте). */
  async list(filter: FolderListFilter): Promise<MediaFolder[]> {
    const qb = this.repo().createQueryBuilder('f')
    if (filter.siteId) {
      if (filter.includeGlobal) {
        qb.where('(f."siteId" = :siteId OR f."siteId" IS NULL)', { siteId: filter.siteId })
      } else {
        qb.where('f."siteId" = :siteId', { siteId: filter.siteId })
      }
    } else if (filter.includeGlobal === false) {
      qb.where('f."siteId" IS NOT NULL')
    }
    qb.orderBy('f.name', 'ASC')
    return qb.getMany()
  }

  async getById(id: string): Promise<MediaFolder | null> {
    return this.repo().findOne({ where: { id } })
  }

  async create(input: CreateFolderInput): Promise<MediaFolder> {
    const name = (input.name || '').trim()
    if (!name) throw new ValidationError('Folder name is required')
    const siteId = input.siteId ?? null
    const parentId = input.parentId ?? null

    if (parentId) {
      const parent = await this.getById(parentId)
      if (!parent) throw new ValidationError('Parent folder not found')
      this.assertSameScope(parent.siteId ?? null, siteId)
    }

    const folder = this.repo().create({ siteId, parentId, name })
    return this.repo().save(folder)
  }

  async rename(id: string, name: string): Promise<MediaFolder> {
    const folder = await this.getById(id)
    if (!folder) throw new NotFoundError('MediaFolder', id)
    const trimmed = (name || '').trim()
    if (!trimmed) throw new ValidationError('Folder name is required')
    folder.name = trimmed
    return this.repo().save(folder)
  }

  /** Перемещение папки под нового родителя (или в корень при null). */
  async move(id: string, newParentId: string | null): Promise<MediaFolder> {
    const folder = await this.getById(id)
    if (!folder) throw new NotFoundError('MediaFolder', id)

    if (newParentId) {
      if (newParentId === id) throw new ValidationError('Cannot move a folder into itself')
      const parent = await this.getById(newParentId)
      if (!parent) throw new ValidationError('Target folder not found')
      this.assertSameScope(parent.siteId ?? null, folder.siteId ?? null)
      // Защита от циклов: новый родитель не должен быть потомком перемещаемой папки.
      const descendants = await this.collectDescendantIds(id, folder.siteId ?? null)
      if (descendants.has(newParentId)) {
        throw new ValidationError('Cannot move a folder into its own descendant')
      }
    }

    folder.parentId = newParentId
    return this.repo().save(folder)
  }

  /** Удаление папки. Разрешено только если папка пуста (нет подпапок и ассетов). */
  async delete(id: string): Promise<boolean> {
    const folder = await this.getById(id)
    if (!folder) return false

    const childCount = await this.repo().count({ where: { parentId: id } })
    if (childCount > 0) {
      throw new ValidationError('Folder is not empty (contains subfolders)')
    }
    const assetCount = await this.assetRepo().count({ where: { folderId: id } })
    if (assetCount > 0) {
      throw new ValidationError('Folder is not empty (contains files)')
    }

    await this.repo().delete(id)
    return true
  }

  /** id папки + id всех её потомков (для удаления поддерева вместе с содержимым). */
  async collectSubtreeIds(id: string): Promise<string[]> {
    const folder = await this.getById(id)
    if (!folder) throw new NotFoundError('MediaFolder', id)
    const descendants = await this.collectDescendantIds(id, folder.siteId ?? null)
    return [id, ...descendants]
  }

  /**
   * Перемещает содержимое папки (подпапки и ассеты) на один уровень вверх — к её родителю,
   * затем удаляет саму (теперь пустую) папку.
   */
  async deleteMovingContentsToParent(id: string): Promise<void> {
    const folder = await this.getById(id)
    if (!folder) throw new NotFoundError('MediaFolder', id)
    const newParent = folder.parentId ?? null

    await this.repo()
      .createQueryBuilder()
      .update(MediaFolder)
      .set({ parentId: newParent })
      .where('"parentId" = :id', { id })
      .execute()

    await this.assetRepo()
      .createQueryBuilder()
      .update(MediaAsset)
      .set({ folderId: newParent })
      .where('"folderId" = :id', { id })
      .execute()

    await this.repo().delete(id)
  }

  /** Удаляет строки папок по списку id (ассеты должны быть удалены/перемещены заранее). */
  async deleteFolders(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    await this.repo().delete(ids)
  }

  /** Множество id всех потомков папки (для проверки циклов). */
  private async collectDescendantIds(rootId: string, siteId: string | null): Promise<Set<string>> {
    const all = await this.list({ siteId: siteId ?? undefined, includeGlobal: siteId == null })
    const childrenByParent = new Map<string, string[]>()
    for (const f of all) {
      const key = f.parentId ?? '__root__'
      if (!childrenByParent.has(key)) childrenByParent.set(key, [])
      childrenByParent.get(key)!.push(f.id)
    }
    const result = new Set<string>()
    const stack = [rootId]
    while (stack.length) {
      const cur = stack.pop()!
      for (const child of childrenByParent.get(cur) ?? []) {
        if (!result.has(child)) {
          result.add(child)
          stack.push(child)
        }
      }
    }
    return result
  }

  private assertSameScope(parentSiteId: string | null, siteId: string | null): void {
    // Глобальная папка (siteId=null) может содержать только глобальные подпапки,
    // и наоборот — сайтовая в сайтовой. Не смешиваем области видимости.
    if (parentSiteId !== siteId) {
      throw new ValidationError('Folder scope (siteId) must match its parent')
    }
  }

  toDto(folder: MediaFolder) {
    return {
      id: folder.id,
      siteId: folder.siteId ?? null,
      parentId: folder.parentId ?? null,
      name: folder.name,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    }
  }
}

export const mediaFolderService = new MediaFolderService()
