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
      result.set(node.metadata.linkedBlockId, node)
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
   * Ищет все использования блока на страницах и внутри других блоков.
   * Возвращает массив { type, id, name, nodePath? }
   */
  async findBlockUsages(blockId: string): Promise<Array<{
    type: 'page' | 'block'
    id: string
    name: string
    nodePath?: string
  }>> {
    const usages: Array<{ type: 'page' | 'block'; id: string; name: string; nodePath?: string }> = []

    // 1. Поиск в страницах
    const pages = await pageRepository.find({ select: ['id', 'name', 'structure'] })
    for (const page of pages) {
      if (!page.structure) continue
      const paths = this._findLinkedBlockPaths(page.structure, blockId, '')
      for (const path of paths) {
        usages.push({ type: 'page', id: page.id, name: page.name, nodePath: path })
      }
    }

    // 2. Поиск в других блоках библиотеки (вложенные linked блоки)
    const blocks = await blockRepository.find({ select: ['id', 'name', 'structure'] })
    for (const block of blocks) {
      if (block.id === blockId) continue // Не считаем себя
      if (!block.structure) continue
      const paths = this._findLinkedBlockPaths(block.structure, blockId, '')
      for (const path of paths) {
        usages.push({ type: 'block', id: block.id, name: block.name, nodePath: path })
      }
    }

    return usages
  }

  /**
   * Ищет все использования блока на всех страницах и в других блоках (bulk).
   * Возвращает Map<blockId, usages[]>
   */
  async findAllBlockUsages(): Promise<Map<string, Array<{
    type: 'page' | 'block'
    id: string
    name: string
  }>>> {
    const result = new Map<string, Array<{ type: 'page' | 'block'; id: string; name: string }>>()

    // Собираем linkedBlockId из всех страниц
    const pages = await pageRepository.find({ select: ['id', 'name', 'structure'] })
    for (const page of pages) {
      if (!page.structure) continue
      const linkedIds = new Set<string>()
      this._collectLinkedIds(page.structure, linkedIds)
      for (const bid of linkedIds) {
        if (!result.has(bid)) result.set(bid, [])
        result.get(bid)!.push({ type: 'page', id: page.id, name: page.name })
      }
    }

    // Собираем linkedBlockId из всех блоков
    const blocks = await blockRepository.find({ select: ['id', 'name', 'structure'] })
    for (const block of blocks) {
      if (!block.structure) continue
      const linkedIds = new Set<string>()
      this._collectLinkedIds(block.structure, linkedIds)
      for (const bid of linkedIds) {
        if (bid === block.id) continue // Не считаем себя
        if (!result.has(bid)) result.set(bid, [])
        result.get(bid)!.push({ type: 'block', id: block.id, name: block.name })
      }
    }

    return result
  }

  /** Рекурсивно находит пути до узлов с заданным linkedBlockId */
  private _findLinkedBlockPaths(node: any, blockId: string, currentPath: string): string[] {
    if (!node) return []
    const paths: string[] = []
    const nodeName = node.metadata?.name || node.id || '?'
    const path = currentPath ? `${currentPath} > ${nodeName}` : nodeName

    if (node.metadata?.linkedBlockId === blockId) {
      paths.push(path)
    }

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        paths.push(...this._findLinkedBlockPaths(child, blockId, path))
      }
    }

    return paths
  }

  /**
   * Синхронизирует обновлённый блок на все страницы, где он используется.
   * Вызывается из BlockController.update при сохранении блока.
   */
  async syncBlockToAllPages(blockId: string, newStructure: any): Promise<{
    updatedPages: string[]
    errors: string[]
  }> {
    const updatedPages: string[] = []
    const errors: string[] = []

    const pages = await pageRepository.find()
    for (const page of pages) {
      if (!page.structure) continue

      // Проверяем, есть ли этот блок на странице
      const hasBlock = this._hasLinkedBlockId(page.structure, blockId)
      if (!hasBlock) continue

      try {
        // Заменяем все вхождения блока в структуре страницы
        page.structure = this._replaceLinkedBlock(page.structure, blockId, newStructure)
        page.version += 1
        await pageRepository.save(page)
        updatedPages.push(page.name || page.id)
      } catch (err: any) {
        errors.push(`Page ${page.name}: ${err.message}`)
      }
    }

    return { updatedPages, errors }
  }

  /** Проверяет, содержит ли дерево узел с данным linkedBlockId */
  private _hasLinkedBlockId(node: any, blockId: string): boolean {
    if (!node) return false
    if (node.metadata?.linkedBlockId === blockId) return true
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        if (this._hasLinkedBlockId(child, blockId)) return true
      }
    }
    return false
  }

  /** Рекурсивно заменяет linked-блок новой структурой, сохраняя id и linkedBlockId */
  private _replaceLinkedBlock(node: any, blockId: string, newStructure: any): any {
    if (!node) return node

    if (node.metadata?.linkedBlockId === blockId) {
      // Глубокая копия новой структуры
      const replacement = JSON.parse(JSON.stringify(newStructure))
      return {
        ...replacement,
        id: node.id, // Сохраняем оригинальный id на странице
        metadata: {
          ...replacement.metadata,
          linkedBlockId: blockId, // Сохраняем связь с библиотекой
        },
      }
    }

    // Рекурсивно обрабатываем детей
    if (node.children && Array.isArray(node.children)) {
      node.children = node.children.map(
        (child: any) => this._replaceLinkedBlock(child, blockId, newStructure)
      )
    }

    return node
  }
}

export const linkedBlocksService = new LinkedBlocksService()
