import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

/**
 * Overlay-перевод новости: строка (newsId, locale, field). Поля — реестр
 * NEWS_TR_FIELDS (services/news.ts): title, lead — строки, sections — json
 * `{ "<id секции>": { "html": "..." } }`. Пустое значение = нет перевода.
 */
@Entity('news_translations')
export class NewsTranslation {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  newsId!: string

  @Column({ type: 'varchar', length: 10 })
  locale!: string

  @Column({ type: 'varchar', length: 60 })
  field!: string

  @Column({ type: 'text', default: '' })
  value!: string

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date
}
