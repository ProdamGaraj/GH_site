/**
 * Сервис для работы со связанными блоками
 * Обновляет блоки с linkedBlockId на актуальные версии из библиотеки
 */

import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'

const blockRepository = AppDataSource.getRepository(Block)

export class LinkedBlocksService {
  /**
   * Обновляет структуру, заменяя блоки с linkedBlockId на актуальные из библиотеки
   */
  async updateLinkedBlocks(structure: any): Promise<any> {
    if (!structure) return structure

    // Если у узла есть linkedBlockId, загружаем актуальную структуру из библиотеки
    if (structure.metadata?.linkedBlockId) {
      try {
        const block = await blockRepository.findOne({
          where: { id: structure.metadata.linkedBlockId }
        })
        
        if (block && block.structure) {
          // Заменяем структуру на актуальную из блока, сохраняя только linkedBlockId в metadata
          return {
            ...block.structure,
            metadata: {
              ...block.structure.metadata,
              linkedBlockId: structure.metadata.linkedBlockId
            }
          }
        }
      } catch (error) {
        console.error(`Failed to load linked block ${structure.metadata.linkedBlockId}:`, error)
      }
    }

    // Рекурсивно обрабатываем дочерние элементы
    if (structure.children && Array.isArray(structure.children)) {
      structure.children = await Promise.all(
        structure.children.map((child: any) => this.updateLinkedBlocks(child))
      )
    }

    return structure
  }
}

export const linkedBlocksService = new LinkedBlocksService()
