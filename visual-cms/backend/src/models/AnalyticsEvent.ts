import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { Page } from './Page'

/**
 * Тип аналитического события
 */
export type AnalyticsEventType =
  | 'pageview'          // Просмотр страницы
  | 'block_view'        // Просмотр блока (вошёл во viewport)
  | 'block_leave'       // Блок покинул viewport
  | 'click'             // Клик по элементу
  | 'scroll'            // Скролл до определённой глубины
  | 'form_start'        // Начало заполнения формы
  | 'form_submit'       // Отправка формы
  | 'request_sent'      // Исходящий запрос (fetch/xhr)
  | 'request_received'  // Ответ получен
  | 'error'             // JS ошибка
  | 'performance'       // Метрика производительности (LCP, FCP, CLS, etc.)
  | 'session_start'     // Начало сессии
  | 'session_end'       // Конец сессии
  | 'custom'            // Кастомное событие

/**
 * Категория устройства
 */
/**
 * Категория запроса
 */
export type RequestCategory = 'api' | 'preflight' | 'static' | 'analytics' | 'service'

/**
 * Категория устройства
 */
export type DeviceCategory = 'desktop' | 'tablet' | 'mobile' | 'bot' | 'unknown'

@Entity('analytics_events')
@Index(['pageId', 'createdAt'])
@Index(['sessionId', 'createdAt'])
@Index(['eventType', 'createdAt'])
@Index(['pageId', 'eventType', 'createdAt'])
@Index(['visitorId'])
export class AnalyticsEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string

  // ─── Связь со страницей ──────────────────────────────────────

  @Column({ type: 'uuid', nullable: true })
  pageId: string | null

  @ManyToOne(() => Page, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'pageId' })
  page: Page | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  pageSlug: string | null

  // ─── Идентификация посетителя ────────────────────────────────

  @Column({ type: 'varchar', length: 64 })
  sessionId: string

  @Column({ type: 'varchar', length: 64 })
  visitorId: string

  // ─── Событие ─────────────────────────────────────────────────

  @Column({ type: 'varchar', length: 30 })
  eventType: AnalyticsEventType

  @Column({ type: 'varchar', length: 200, nullable: true })
  eventTarget: string | null // CSS-селектор или ID блока

  @Column({ type: 'varchar', length: 500, nullable: true })
  url: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  referrer: string | null

  // ─── Блок-уровневая аналитика ────────────────────────────────

  @Column({ type: 'varchar', length: 100, nullable: true })
  blockId: string | null       // ID CMS-блока

  @Column({ type: 'varchar', length: 200, nullable: true })
  blockType: string | null     // Тип блока (hero, gallery, form, etc.)

  @Column({ type: 'int', nullable: true })
  blockViewDuration: number | null  // Время просмотра блока (мс)

  // ─── Метрики производительности ──────────────────────────────

  @Column({ type: 'int', nullable: true })
  responseTime: number | null       // Время ответа запроса (мс)

  @Column({ type: 'int', nullable: true })
  pageLoadTime: number | null       // Время загрузки страницы (мс)

  @Column({ type: 'float', nullable: true })
  scrollDepth: number | null        // Глубина скролла (0-100%)

  // ─── Web Vitals ──────────────────────────────────────────────

  @Column({ type: 'float', nullable: true })
  lcp: number | null                // Largest Contentful Paint (мс)

  @Column({ type: 'float', nullable: true })
  fcp: number | null                // First Contentful Paint (мс)

  @Column({ type: 'float', nullable: true })
  cls: number | null                // Cumulative Layout Shift

  @Column({ type: 'float', nullable: true })
  fid: number | null                // First Input Delay (мс)

  @Column({ type: 'float', nullable: true })
  ttfb: number | null               // Time to First Byte (мс)

  @Column({ type: 'float', nullable: true })
  inp: number | null                // Interaction to Next Paint (мс)

  // ─── Информация о запросах ───────────────────────────────────

  @Column({ type: 'varchar', length: 500, nullable: true })
  requestUrl: string | null

  @Column({ type: 'varchar', length: 10, nullable: true })
  requestMethod: string | null      // GET, POST, etc.

  @Column({ type: 'varchar', length: 20, nullable: true })
  requestCategory: RequestCategory | null  // api, preflight, static, analytics, service

  @Column({ type: 'int', nullable: true })
  requestStatus: number | null      // HTTP status code

  @Column({ type: 'int', nullable: true })
  requestSize: number | null        // Размер запроса (bytes)

  @Column({ type: 'int', nullable: true })
  responseSize: number | null       // Размер ответа (bytes)

  // ─── Устройство / браузер ────────────────────────────────────

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  browser: string | null

  @Column({ type: 'varchar', length: 30, nullable: true })
  browserVersion: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  os: string | null

  @Column({ type: 'varchar', length: 10, nullable: true })
  device: DeviceCategory | null

  @Column({ type: 'int', nullable: true })
  screenWidth: number | null

  @Column({ type: 'int', nullable: true })
  screenHeight: number | null

  // ─── Геолокация (по IP) ──────────────────────────────────────

  @Column({ type: 'varchar', length: 50, nullable: true })
  ip: string | null                 // Анонимизированный IP

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string | null

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null

  // ─── Дополнительные данные ───────────────────────────────────

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null

  @CreateDateColumn()
  createdAt: Date
}
