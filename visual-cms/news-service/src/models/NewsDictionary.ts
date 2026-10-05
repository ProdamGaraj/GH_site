import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

/**
 * Словари новостей: рубрики (бейдж карточки — «Новости», «Акции») и теги.
 *
 * Ключ неизменен — на него ссылаются новости. Переводы — колонками, как у
 * типов мест в estate-service: словарь маленький, overlay-таблица не нужна.
 * Пустой перевод — фолбэк на ru. Используемая запись не удаляется, а
 * прячется флагом `hidden`: из фильтров ленты уходит, у новостей остаётся.
 */
abstract class NewsDictionaryEntry {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  key!: string

  @Column({ type: 'varchar', length: 80 })
  nameRu!: string

  @Column({ type: 'varchar', length: 80, default: '' })
  nameUz!: string

  @Column({ type: 'varchar', length: 80, default: '' })
  nameEn!: string

  @Column({ type: 'int', default: 0 })
  order!: number

  @Column({ type: 'boolean', default: false })
  hidden!: boolean

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date
}

@Entity('news_categories')
export class NewsCategory extends NewsDictionaryEntry {}

@Entity('news_tags')
export class NewsTag extends NewsDictionaryEntry {}
