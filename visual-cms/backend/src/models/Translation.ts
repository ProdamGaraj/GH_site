import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'
import { Page } from './Page'
import { Language } from './Language'

/**
 * Stores translations for individual fields of BlockNode elements within a page.
 * 
 * Translation approach: overlay model.
 * The default language content lives in the BlockNode tree (page.structure).
 * Translations are stored as overrides keyed by (pageId, locale, nodeId, field).
 * 
 * Translatable fields:
 * - content: text content of elements (headings, paragraphs, buttons, etc.)
 * - src: image/video source URL (allows different media per language)
 * - alt: image alt text
 * - href: link URL
 * - placeholder: input placeholder text
 * - title: element title attribute
 * - poster: video poster image
 * - aria-label: accessibility label
 * - meta:title: page meta title
 * - meta:description: page meta description
 * - meta:ogImage: page og:image
 */
@Entity('translations')
@Index(['pageId', 'locale'], {})
@Index(['pageId', 'locale', 'nodeId'], {})
export class Translation {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  /** Page this translation belongs to */
  @ManyToOne(() => Page, { onDelete: 'CASCADE' })
  page!: Page

  @Column({ type: 'uuid' })
  pageId!: string

  /** Language code (e.g. 'en', 'ru', 'kz') */
  @Column({ length: 10 })
  locale!: string

  /** BlockNode ID within the page structure (or '__page__' for page-level meta) */
  @Column({ length: 255 })
  nodeId!: string

  /** 
   * Field being translated:
   * - 'content' for text content
   * - 'src', 'alt', 'href', 'placeholder', 'title', 'poster' for attributes
   * - 'meta:title', 'meta:description', 'meta:ogImage' for page metadata
   */
  @Column({ length: 50 })
  field!: string

  /** Translated value */
  @Column({ type: 'text' })
  value!: string

  /** Translation status for workflow tracking */
  @Column({ length: 20, default: 'draft' })
  status!: 'draft' | 'review' | 'approved' | 'published'

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
