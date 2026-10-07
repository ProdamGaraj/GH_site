import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'
import { Block } from './Block'

/**
 * Перевод поля узла библиотечного блока — общий для всех страниц, где блок
 * подключён (и для слайдов-блоков из данных коллекции).
 *
 * Пара к Translation (переводы собственных узлов страницы): поля те же, вместо
 * pageId — blockId. Кому принадлежит узел, решает translationOwnership.ts;
 * чтение и запись маршрутизирует TranslationService.
 *
 * locale '*' — отметка «один текст для всех языков» (value 'same' | 'translate').
 */
@Entity('block_translations')
@Index(['blockId', 'locale'])
@Index(['blockId', 'locale', 'nodeId', 'field'], { unique: true })
export class BlockTranslation {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @ManyToOne(() => Block, { onDelete: 'CASCADE' })
  block!: Block

  @Column({ type: 'uuid' })
  blockId!: string

  @Column({ length: 10 })
  locale!: string

  @Column({ length: 255 })
  nodeId!: string

  @Column({ length: 50 })
  field!: string

  @Column({ type: 'text' })
  value!: string

  @Column({ length: 20, default: 'draft' })
  status!: 'draft' | 'review' | 'approved' | 'published'

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
