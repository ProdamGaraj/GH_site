import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { Page } from './Page'
import type { DeviceCategory } from './AnalyticsEvent'

/**
 * Сессия посетителя сайта — агрегированные данные по визиту
 */
@Entity('analytics_sessions')
@Index(['pageId', 'startedAt'])
@Index(['visitorId'])
@Index(['startedAt'])
@Index(['pageId', 'bounced'])
export class AnalyticsSession {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 64, unique: true })
  sessionId: string

  @Column({ type: 'varchar', length: 64 })
  visitorId: string

  // ─── Связь со страницей входа ────────────────────────────────

  @Column({ type: 'uuid', nullable: true })
  pageId: string | null

  @ManyToOne(() => Page, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'pageId' })
  page: Page | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  entryPageSlug: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  exitPageSlug: string | null

  // ─── Метрики сессии ──────────────────────────────────────────

  @Column({ type: 'int', default: 0 })
  duration: number                  // Общая длительность сессии (мс)

  @Column({ type: 'int', default: 1 })
  pagesViewed: number               // Количество просмотренных страниц

  @Column({ type: 'int', default: 0 })
  eventsCount: number               // Количество событий за сессию

  @Column({ type: 'boolean', default: true })
  bounced: boolean                   // Bounce: только 1 pageview, < 10с

  @Column({ type: 'float', default: 0 })
  maxScrollDepth: number             // Максимальная глубина скролла (0-100%)

  @Column({ type: 'int', default: 0 })
  totalRequestsSent: number          // Кол-во отправленных запросов

  @Column({ type: 'int', default: 0 })
  totalRequestsReceived: number      // Кол-во полученных ответов

  @Column({ type: 'float', nullable: true })
  avgResponseTime: number | null     // Среднее время отклика (мс)

  @Column({ type: 'int', default: 0 })
  formSubmissions: number            // Кол-во отправленных форм

  @Column({ type: 'int', default: 0 })
  clicksCount: number                // Кол-во кликов

  @Column({ type: 'int', default: 0 })
  errorsCount: number                // Кол-во JS ошибок

  // ─── Источник трафика ────────────────────────────────────────

  @Column({ type: 'varchar', length: 500, nullable: true })
  referrer: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  utmSource: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  utmMedium: string | null

  @Column({ type: 'varchar', length: 100, nullable: true })
  utmCampaign: string | null

  @Column({ type: 'varchar', length: 100, nullable: true })
  utmContent: string | null

  @Column({ type: 'varchar', length: 100, nullable: true })
  utmTerm: string | null

  // ─── Устройство / браузер ────────────────────────────────────

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  browser: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  os: string | null

  @Column({ type: 'varchar', length: 10, nullable: true })
  device: DeviceCategory | null

  @Column({ type: 'int', nullable: true })
  screenWidth: number | null

  @Column({ type: 'int', nullable: true })
  screenHeight: number | null

  // ─── Геолокация ──────────────────────────────────────────────

  @Column({ type: 'varchar', length: 50, nullable: true })
  ip: string | null

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string | null

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null

  // ─── Web Vitals (средние за сессию) ──────────────────────────

  @Column({ type: 'float', nullable: true })
  lcp: number | null

  @Column({ type: 'float', nullable: true })
  fcp: number | null

  @Column({ type: 'float', nullable: true })
  cls: number | null

  @Column({ type: 'float', nullable: true })
  ttfb: number | null

  // ─── Block-level analytics ───────────────────────────────────

  @Column({ type: 'jsonb', nullable: true })
  blockEngagement: {
    blockId: string
    blockType: string
    viewDuration: number        // мс
    clicks: number
    visible: boolean            // был ли блок виден
    scrolledPast: boolean       // пролистал ли пользователь мимо
  }[] | null

  @CreateDateColumn()
  startedAt: Date

  @UpdateDateColumn()
  endedAt: Date
}
