/**
 * Сервис для работы со связанными блоками
 * бновляет блоки с linkedBlockId на актуальные версии из библиотеки
 * вусторонняя синхронизация: библиотека <-> страницы
 *
 * птимизация: batch-загрузка всех linked блоков одним запросом (вместо N+1)
 */

import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'
import { Page } from '../models/Page'
import { In } from 'typeorm'
import { diffLinkedInstance, LinkedChange } from './linkedBlockDiff'

/** Решение пользователя по одному изменённому linked-инстансу. */
export type LinkedDecision = 'push' | 'static' | 'revert'

/** Описание изменённого инстанса для UI-модалки. */
export interface ChangedLinkedInstance {
  /** id узла-инстанса на странице (стабильный ключ для решения). */
  instanceId: string
  /** id блока в библиотеке. */
  linkedBlockId: string
  /** Имя блока для отображения. */
  blockName: string
  /** Детализация изменений внутри блока (для раскрытия в модалке). */
  changes: LinkedChange[]
}

const blockRepository = AppDataSource.getRepository(Block)
const pageRepository = AppDataSource.getRepository(Page)

export class LinkedBlocksService {
  /**
   * бновляет структуру, заменяя блоки с linkedBlockId на актуальные из библиотеки.
   * Batch-загрузка: собирает все linkedBlockId за один проход, делает один SELECT ... WHERE id IN (...),
   * затем подставляет из Map.
   */
  async updateLinkedBlocks(structure: any): Promise<any> {
    // Шаг 1: собрать все linkedBlockId из дерева
    const linkedIds = new Set<string>()
    this._collectLinkedIds(structure, linkedIds)

    if (linkedIds.size === 0) return structure

    // Шаг 2: один запрос к 
    const blocks = await blockRepository.find({
      where: { id: In(Array.from(linkedIds)) }
    })
    const blockMap = new Map<string, any>()
    for (const block of blocks) {
      if (block.structure) {
        blockMap.set(block.id, block.structure)
      }
    }

    // Шаг 3: подставить из Map (рекурсивно)
    const processingIds = new Set<string>()
    return this._applyLinkedBlocks(structure, blockMap, processingIds)
  }

  /** екурсивно собирает все linkedBlockId из дерева */
  private _collectLinkedIds(node: any, ids: Set<string>): void {
    if (!node) return
    if (node.metadata?.linkedBlockId) {
      ids.add(node.metadata.linkedBlockId)
    }
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        this._collectLinkedIds(child, ids)
      }
    }
    // Traverse viewport-specific children (responsive variations)
    if (node.variations) {
      for (const variation of Object.values(node.variations) as any[]) {
        if (variation.specificChildren && Array.isArray(variation.specificChildren)) {
          for (const child of variation.specificChildren) {
            this._collectLinkedIds(child, ids)
          }
        }
      }
    }
  }

  /** екурсивно подставляет библиотечные структуры из Map */
  private _applyLinkedBlocks(
    structure: any,
    blockMap: Map<string, any>,
    processingIds: Set<string>
  ): any {
    if (!structure) return structure

    if (structure.metadata?.linkedBlockId) {
      const linkedId = structure.metadata.linkedBlockId

      // ащита от бесконечной рекурсии
      if (processingIds.has(linkedId)) {
        return structure
      }
      processingIds.add(linkedId)

      const libraryStructure = blockMap.get(linkedId)
      if (libraryStructure) {
        // Глубокая копия
        let result = JSON.parse(JSON.stringify(libraryStructure))
        // Рекурсивно обрабатываем вложенные linkedBlockId
        result = this._applyLinkedBlocks(result, blockMap, processingIds)
        // Сохраняем id placeholder'а (стабильность для UI и предотвращение коллизий
        // если один и тот же library блок используется несколько раз на странице) и
        // его attributes — например data-carousel-static / data-carousel-slide для
        // hybrid-карусели. Без этого после reload плейсхолдер теряет роль и слайд "исчезает".
        return {
          ...result,
          id: structure.id || result.id,
          attributes: {
            ...(result.attributes || {}),
            ...(structure.attributes || {}),
          },
          metadata: {
            ...result.metadata,
            linkedBlockId: linkedId
          }
        }
      }
    }

    // екурсивно обрабатываем дочерние элементы
    if (structure.children && Array.isArray(structure.children)) {
      structure.children = structure.children.map(
        (child: any) => this._applyLinkedBlocks(child, blockMap, processingIds)
      )
    }

    // Traverse viewport-specific children (responsive variations)
    if (structure.variations) {
      for (const [bpId, variation] of Object.entries(structure.variations) as [string, any][]) {
        if (variation.specificChildren && Array.isArray(variation.specificChildren)) {
          structure.variations[bpId] = {
            ...variation,
            specificChildren: variation.specificChildren.map(
              (child: any) => this._applyLinkedBlocks(child, blockMap, processingIds)
            )
          }
        }
      }
    }

    return structure
  }

  /**
   * Синхронизирует обновлённый блок библиотеки на все страницы, где он используется как linked block.
   */
  async syncBlockToAllPages(blockId: string, newStructure: any): Promise<{ updatedPages: string[]; errors: string[] }> {
    const updatedPages: string[] = []
    const errors: string[] = []

    const pages = await pageRepository.find()
    for (const page of pages) {
      if (!page.structure) continue
      const json = JSON.stringify(page.structure)
      if (!json.includes(blockId)) continue

      try {
        const updated = this._replaceLinkedBlock(page.structure, blockId, newStructure)
        page.structure = updated
        await pageRepository.save(page)
        updatedPages.push(page.id)
      } catch (err: any) {
        errors.push(`Page ${page.id}: ${err.message}`)
      }
    }

    return { updatedPages, errors }
  }

  /**
   * Схлопывает linked block в placeholder.
   *
   * Раньше функция записывала развёрнутую структуру library-блока прямо в page.structure,
   * сохраняя только id и metadata.linkedBlockId — при этом терялись attributes плейсхолдера
   * (в т.ч. data-carousel-static="true" у hybrid-static слайдов). После следующего F5 фронт
   * получал узел без маркера и считал его обычным template'ом карусели → 4/4 вместо 5/5.
   *
   * Инвариант: полная структура linked-блока живёт только в библиотеке. На странице хранится
   * только placeholder (children: []). При чтении страницы _applyLinkedBlocks подставляет
   * актуальную структуру из библиотеки на лету. Поэтому syncBlockToAllPages здесь нужна
   * только чтобы очистить устаревшие развёрнутые копии в page.structure (legacy-данные).
   *
   * @param newStructure — параметр оставлен для обратной совместимости вызова, но больше
   *                       не используется: структура подставляется при чтении страницы.
   */
  private _replaceLinkedBlock(node: any, blockId: string, _newStructure: any): any {
    if (!node) return node

    if (node.metadata?.linkedBlockId === blockId) {
      return this._collapseNodeToPlaceholder(node)
    }

    if (node.children && Array.isArray(node.children)) {
      node.children = node.children.map((child: any) => this._replaceLinkedBlock(child, blockId, _newStructure))
    }

    if (node.variations) {
      for (const [bpId, variation] of Object.entries(node.variations) as [string, any][]) {
        if (variation.specificChildren && Array.isArray(variation.specificChildren)) {
          node.variations[bpId] = {
            ...variation,
            specificChildren: variation.specificChildren.map(
              (child: any) => this._replaceLinkedBlock(child, blockId, _newStructure)
            ),
          }
        }
      }
    }

    return node
  }

  /**
   * Находит все страницы, на которых используется данный блок (по linkedBlockId).
   */
  async findBlockUsages(blockId: string): Promise<Array<{ pageId: string; pageName: string; pageSlug: string }>> {
    const pages = await pageRepository.find()
    const usages: Array<{ pageId: string; pageName: string; pageSlug: string }> = []

    for (const page of pages) {
      if (!page.structure) continue
      if (this._containsLinkedBlock(page.structure, blockId)) {
        usages.push({ pageId: page.id, pageName: page.name, pageSlug: page.slug })
      }
    }

    return usages
  }

  /**
   * Для всех блоков из библиотеки — находит какие страницы их используют.
   */
  async findAllBlockUsages(): Promise<Map<string, Array<{ pageId: string; pageName: string; pageSlug: string }>>> {
    const pages = await pageRepository.find()
    const result = new Map<string, Array<{ pageId: string; pageName: string; pageSlug: string }>>()

    for (const page of pages) {
      if (!page.structure) continue
      const linkedIds = new Set<string>()
      this._collectLinkedIds(page.structure, linkedIds)

      for (const blockId of linkedIds) {
        if (!result.has(blockId)) result.set(blockId, [])
        result.get(blockId)!.push({ pageId: page.id, pageName: page.name, pageSlug: page.slug })
      }
    }

    return result
  }

  /** Рекурсивно проверяет, ссылается ли дерево на данный blockId */
  private _containsLinkedBlock(node: any, blockId: string): boolean {
    if (!node) return false
    if (node.metadata?.linkedBlockId === blockId) return true
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        if (this._containsLinkedBlock(child, blockId)) return true
      }
    }
    if (node.variations) {
      for (const variation of Object.values(node.variations) as any[]) {
        if (variation.specificChildren && Array.isArray(variation.specificChildren)) {
          for (const child of variation.specificChildren) {
            if (this._containsLinkedBlock(child, blockId)) return true
          }
        }
      }
    }
    return false
  }

  /**
   * Схлопывает один узел в placeholder: children: [], variations.specificChildren: [].
   * id/attributes/metadata (включая linkedBlockId и карусель-маркеры) сохраняются.
   * Полная структура подставляется при чтении через _applyLinkedBlocks.
   */
  private _collapseNodeToPlaceholder(node: any): any {
    const cleaned: any = { ...node, children: [] }
    if (cleaned.variations) {
      cleaned.variations = Object.fromEntries(
        Object.entries(cleaned.variations).map(([bpId, variation]: [string, any]) => [
          bpId,
          { ...variation, specificChildren: [] },
        ])
      )
    }
    return cleaned
  }

  /** Готовит развёрнутый инстанс к записи в библиотеку: убирает linkedBlockId и styleOverrides. */
  private _cleanForLibrary(node: any): any {
    const copy = JSON.parse(JSON.stringify(node))
    if (copy.metadata) {
      delete copy.metadata.linkedBlockId
      delete copy.metadata.styleOverrides
    }
    return copy
  }

  /** Рекурсивно собирает linked-инстансы (узлы с linkedBlockId) с их instanceId. */
  private _collectLinkedInstances(node: any, out: Array<{ instanceId: string; linkedBlockId: string; node: any }>): void {
    if (!node) return
    if (node.metadata?.linkedBlockId && node.id) {
      out.push({ instanceId: node.id, linkedBlockId: node.metadata.linkedBlockId, node })
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) this._collectLinkedInstances(child, out)
    }
    if (node.variations) {
      for (const variation of Object.values(node.variations) as any[]) {
        if (Array.isArray(variation.specificChildren)) {
          for (const child of variation.specificChildren) this._collectLinkedInstances(child, out)
        }
      }
    }
  }

  /**
   * Детектирует linked-инстансы на странице, контент которых разошёлся с библиотекой.
   * Используется при сохранении страницы (preflight): по результату фронт показывает
   * модалку выбора действия (в библиотеку / сделать статическим / откатить).
   *
   * Инстансы, у которых нет соответствующего блока в библиотеке, пропускаются — для них
   * нет «эталона» сравнения (это, как правило, осиротевшие ссылки или ещё не сохранённые
   * секции; см. отдельную фичу «создать блок из секции»).
   */
  async detectChangedLinkedInstances(structure: any): Promise<ChangedLinkedInstance[]> {
    if (!structure) return []

    const instances: Array<{ instanceId: string; linkedBlockId: string; node: any }> = []
    this._collectLinkedInstances(structure, instances)
    if (instances.length === 0) return []

    const linkedIds = Array.from(new Set(instances.map((i) => i.linkedBlockId)))
    const blocks = await blockRepository.find({ where: { id: In(linkedIds) } })
    const blockMap = new Map<string, any>()
    for (const block of blocks) {
      blockMap.set(block.id, { structure: block.structure, name: block.name })
    }

    const changed: ChangedLinkedInstance[] = []
    for (const inst of instances) {
      const lib = blockMap.get(inst.linkedBlockId)
      if (!lib || !lib.structure) continue
      const diff = diffLinkedInstance(inst.node, lib.structure)
      if (diff.changed) {
        changed.push({
          instanceId: inst.instanceId,
          linkedBlockId: inst.linkedBlockId,
          blockName: inst.node.metadata?.name || lib.name || 'Блок',
          changes: diff.changes,
        })
      }
    }
    return changed
  }

  /**
   * Применяет решения пользователя к структуре страницы перед сохранением и возвращает
   * новую структуру + список записей в библиотеку (их выполняет контроллер, т.к. это
   * сайд-эффекты в БД).
   *
   * Правила для каждого linked-инстанса:
   *  - 'push'   — содержимое инстанса записывается в библиотеку (libraryWrites),
   *               сам инстанс схлопывается в placeholder (контент придёт из библиотеки).
   *  - 'static' — у инстанса удаляется metadata.linkedBlockId, содержимое замораживается
   *               развёрнутым (блок становится обычным, обновления из библиотеки не приходят).
   *  - 'revert' / без решения — инстанс схлопывается в placeholder (правка не сохраняется,
   *               при чтении подставится версия библиотеки).
   *  - неизменённый linked-инстанс — тоже схлопывается в placeholder (инвариант B2).
   *
   * Примечание по 'static': замораживается весь поддерев инстанса как есть; вложенные
   * linked-блоки внутри также теряют связь (поведение «отделить блок целиком»).
   */
  applyLinkedDecisions(
    structure: any,
    decisions: Record<string, LinkedDecision>
  ): { structure: any; libraryWrites: Array<{ blockId: string; structure: any }> } {
    const libraryWrites: Array<{ blockId: string; structure: any }> = []

    const walk = (node: any): any => {
      if (!node) return node

      if (node.metadata?.linkedBlockId && node.id) {
        const decision = decisions[node.id]

        if (decision === 'static') {
          const metadata = { ...node.metadata }
          delete metadata.linkedBlockId
          // Содержимое замораживается как есть; дети не схлопываются.
          return { ...node, metadata }
        }

        if (decision === 'push') {
          libraryWrites.push({ blockId: node.metadata.linkedBlockId, structure: this._cleanForLibrary(node) })
          return this._collapseNodeToPlaceholder(node)
        }

        // 'revert', без решения, либо неизменённый — схлопываем в placeholder.
        return this._collapseNodeToPlaceholder(node)
      }

      let result = node
      if (Array.isArray(node.children)) {
        result = { ...result, children: node.children.map(walk) }
      }
      if (node.variations) {
        result = {
          ...result,
          variations: Object.fromEntries(
            Object.entries(node.variations).map(([bpId, variation]: [string, any]) => [
              bpId,
              Array.isArray(variation.specificChildren)
                ? { ...variation, specificChildren: variation.specificChildren.map(walk) }
                : variation,
            ])
          ),
        }
      }
      return result
    }

    return { structure: walk(structure), libraryWrites }
  }
}

export const linkedBlocksService = new LinkedBlocksService()
