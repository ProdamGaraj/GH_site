/**
 * Сервис для работы со связанными блоками
 * бновляет блоки с linkedBlockId на актуальные версии из библиотеки
 * вусторонняя синхронизация: библиотека <-> страницы
 *
 * птимизация: batch-загрузка всех linked блоков одним запросом (вместо N+1)
 */

import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'
import { In } from 'typeorm'

const blockRepository = AppDataSource.getRepository(Block)

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

  /** екурсивно собирает linked узлы: linkedId -> структура для библиотеки */
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
  }
}

export const linkedBlocksService = new LinkedBlocksService()
