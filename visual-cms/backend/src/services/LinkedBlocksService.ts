/**
 * Сервис для работы со связанными блоками
 * Обновляет блоки с linkedBlockId на актуальные версии из библиотеки
 * Двусторонняя синхронизация: библиотека <-> страницы
 */

import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'

const blockRepository = AppDataSource.getRepository(Block)

export class LinkedBlocksService {
  /**
   * Обновляет структуру, заменяя блоки с linkedBlockId на актуальные из библиотеки
   * НЕ сохраняет локальные стили - всегда берёт из библиотеки
   */
  async updateLinkedBlocks(structure: any): Promise<any> {
    const processingIds = new Set<string>()
    return this._updateLinkedBlocksInternal(structure, processingIds)
  }

  private async _updateLinkedBlocksInternal(
    structure: any, 
    processingIds: Set<string>
  ): Promise<any> {
    if (!structure) return structure

    // Если у узла есть linkedBlockId, загружаем актуальную структуру из библиотеки
    if (structure.metadata?.linkedBlockId) {
      const linkedId = structure.metadata.linkedBlockId
      
      // Защита от бесконечной рекурсии
      if (processingIds.has(linkedId)) {
        console.warn(`[LinkedBlocks] Circular reference detected for ${linkedId}, skipping`)
        return structure
      }
      
      processingIds.add(linkedId)
      
      try {
        const block = await blockRepository.findOne({
          where: { id: linkedId }
        })
        
        if (block && block.structure) {
          console.log(`[LinkedBlocks] Loaded library block ${linkedId}`)
          
          // Берём структуру из библиотеки (глубокая копия)
          let libraryStructure = JSON.parse(JSON.stringify(block.structure))
          
          // Рекурсивно обрабатываем вложенные linkedBlockId
          libraryStructure = await this._updateLinkedBlocksInternal(libraryStructure, processingIds)
          
          // Сохраняем только linkedBlockId в metadata
          return {
            ...libraryStructure,
            metadata: {
              ...libraryStructure.metadata,
              linkedBlockId: linkedId
            }
          }
        }
      } catch (error) {
        console.error(`Failed to load linked block ${linkedId}:`, error)
      }
    }

    // Рекурсивно обрабатываем дочерние элементы
    if (structure.children && Array.isArray(structure.children)) {
      structure.children = await Promise.all(
        structure.children.map((child: any) => this._updateLinkedBlocksInternal(child, processingIds))
      )
    }

    return structure
  }

  /**
   * Синхронизирует изменения linked блоков со страницы в библиотеку
   * Вызывается при сохранении страницы
   */
  async syncLinkedBlocksToLibrary(structure: any): Promise<void> {
    if (!structure) return

    // Если у блока есть linkedBlockId, сохраняем его структуру в библиотеку
    if (structure.metadata?.linkedBlockId) {
      const linkedId = structure.metadata.linkedBlockId
      
      try {
        const block = await blockRepository.findOne({ where: { id: linkedId } })
        
        if (block) {
          // Создаём копию структуры для сохранения в библиотеку
          const structureForLibrary = JSON.parse(JSON.stringify(structure))
          
          // Убираем linkedBlockId из сохраняемой структуры (он есть на уровне страницы)
          if (structureForLibrary.metadata) {
            delete structureForLibrary.metadata.linkedBlockId
            delete structureForLibrary.metadata.styleOverrides
          }
          
          // Обновляем блок в библиотеке
          block.structure = structureForLibrary
          await blockRepository.save(block)
          
          console.log(`[LinkedBlocks] Synced changes to library block ${linkedId}`)
        }
      } catch (error) {
        console.error(`Failed to sync linked block ${linkedId}:`, error)
      }
    }

    // Рекурсивно для детей (ищем другие linked блоки)
    if (structure.children && Array.isArray(structure.children)) {
      for (const child of structure.children) {
        await this.syncLinkedBlocksToLibrary(child)
      }
    }
  }
}

export const linkedBlocksService = new LinkedBlocksService()
