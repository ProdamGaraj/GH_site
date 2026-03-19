import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm'
import { Page } from './Page'

export interface NavigationItem {
  id: string
  label: string
  pageId?: string
  url?: string
  openInNewTab?: boolean
  children?: NavigationItem[]
}

export interface SiteSettings {
  // Navigation menu
  navigation?: NavigationItem[]

  // SEO defaults
  defaultTitle?: string
  defaultDescription?: string
  defaultKeywords?: string[]
  ogImage?: string
  favicon?: string

  // Branding
  siteName?: string
  logo?: string

  // Analytics
  googleAnalyticsId?: string
  googleTagManagerId?: string
  metaPixelId?: string
  yandexMetrikaId?: string

  // Custom code injection
  customHeadHtml?: string
  customBodyEndHtml?: string

  // Company info (reusable across pages)
  companyName?: string
  phone?: string
  email?: string
  address?: string

  // Design tokens
  primaryFont?: string
  secondaryFont?: string
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string

  // Default language code (e.g. 'ru')
  defaultLanguage?: string
}

@Entity('sites')
export class Site {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  name!: string

  @Column({ unique: true })
  slug!: string

  @Column({ nullable: true })
  description?: string

  /**
   * Routing mode determines how this site is accessed on the same IP:
   * - subdomain: premium.goldenhouse.com (best for independent SEO)
   * - path-prefix: goldenhouse.com/premium/ (shared domain authority)
   * - custom-domain: separate domain pointing to same IP
   */
  @Column({ default: 'path-prefix' })
  routingMode!: 'subdomain' | 'path-prefix' | 'custom-domain'

  /**
   * For subdomain mode: the subdomain part (e.g. "premium" → premium.example.com)
   * For custom-domain: full domain (e.g. "premium-houses.com")
   * For path-prefix: prefix path (e.g. "/premium")
   * Falls back to slug if not specified.
   */
  @Column({ nullable: true })
  hostname?: string

  @Column('jsonb', { nullable: true, default: {} })
  settings!: SiteSettings

  @Column({ default: 'draft' })
  status!: 'draft' | 'active' | 'archived'

  @Column({ default: false })
  isDefault!: boolean

  @Column({ nullable: true })
  homepageId?: string

  @OneToMany(() => Page, page => page.site)
  pages?: Page[]

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
