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
        // лубокая копия
        let result = JSON.parse(JSON.stringify(libraryStructure))
        // екурсивно обрабатываем вложенные linkedBlockId
        result = this._applyLinkedBlocks(result, blockMap, processingIds)
        return {
          ...result,
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
   * Синхронизирует изменения linked блоков со страницы в библиотеку.
   * Batch-подход: собирает все linked блоки, загружает одним запросом, сохраняет массово.
   */
  async syncLinkedBlocksToLibrary(structure: any): Promise<void> {
    if (!structure) return

    // Шаг 1: собрать все linked узлы и их структуры
    const linkedNodes = new Map<string, any>() // linkedId -> structure for library
    this._collectLinkedNodes(structure, linkedNodes)

    if (linkedNodes.size === 0) return

    // Шаг 2: загрузить все блоки одним запросом
    const blocks = await blockRepository.find({
      where: { id: In(Array.from(linkedNodes.keys())) }
    })

    // Шаг 3: обновить структуры и сохранить массово
    const toSave: Block[] = []
    for (const block of blocks) {
      const nodeStructure = linkedNodes.get(block.id)
      if (nodeStructure) {
        const structureForLibrary = JSON.parse(JSON.stringify(nodeStructure))
        if (structureForLibrary.metadata) {
          delete structureForLibrary.metadata.linkedBlockId
          delete structureForLibrary.metadata.styleOverrides
        }
        block.structure = structureForLibrary
        toSave.push(block)
      }
    }

    if (toSave.length > 0) {
      await blockRepository.save(toSave)
    }
  }

  /** Рекурсивно собирает linked узлы: linkedId -> структура для библиотеки */
  private _collectLinkedNodes(node: any, result: Map<string, any>): void {
    if (!node) return
    if (node.metadata?.linkedBlockId) {
      // Не синхронизируем placeholder'ы (ноды без children) обратно в библиотеку —
      // это пустые заглушки, которые заполняются из библиотеки при деплое
      const hasContent = Array.isArray(node.children) && node.children.length > 0
      if (hasContent) {
        result.set(node.metadata.linkedBlockId, node)
      }
    }
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        this._collectLinkedNodes(child, result)
      }
    }
    // Traverse viewport-specific children (responsive variations)
    if (node.variations) {
      for (const variation of Object.values(node.variations) as any[]) {
        if (variation.specificChildren && Array.isArray(variation.specificChildren)) {
          for (const child of variation.specificChildren) {
            this._collectLinkedNodes(child, result)
          }
        }
      }
    }
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

  /** Рекурсивно заменяет linked block с указанным linkedBlockId на новую структуру */
  private _replaceLinkedBlock(node: any, blockId: string, newStructure: any): any {
    if (!node) return node

    if (node.metadata?.linkedBlockId === blockId) {
      const result = JSON.parse(JSON.stringify(newStructure))
      return {
        ...result,
        id: node.id,
        metadata: {
          ...result.metadata,
          linkedBlockId: blockId,
        },
      }
    }

    if (node.children && Array.isArray(node.children)) {
      node.children = node.children.map((child: any) => this._replaceLinkedBlock(child, blockId, newStructure))
    }

    if (node.variations) {
      for (const [bpId, variation] of Object.entries(node.variations) as [string, any][]) {
        if (variation.specificChildren && Array.isArray(variation.specificChildren)) {
          node.variations[bpId] = {
            ...variation,
            specificChildren: variation.specificChildren.map(
              (child: any) => this._replaceLinkedBlock(child, blockId, newStructure)
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
}

export const linkedBlocksService = new LinkedBlocksService()
