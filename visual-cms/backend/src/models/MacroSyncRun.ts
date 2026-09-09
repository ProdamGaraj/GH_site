import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm'

/** running — идёт, ok — прошёл, partial — прошёл с потерями, failed — упал. */
export type MacroSyncStatus = 'running' | 'ok' | 'partial' | 'failed'

/**
 * Точка возобновления прерванного прогона.
 *
 * Полный обход планировок дома стоит вызов на квартиру: для наших двух домов
 * это 339 запросов и около четырёх минут, за которые контейнер может уехать в
 * рестарт. Без курсора следующий запуск начал бы с нуля и второй раз съел бы
 * лимит в 100 запросов в минуту.
 */
export interface MacroSyncCursor {
  /** Дом, на котором остановились. */
  externalHouseId: number
  /** Квартиры, планировки которых уже опрошены в этом прогоне. */
  probedExternalIds: number[]
}

/**
 * Журнал прогонов синхронизации с MacroCRM.
 *
 * Живёт в базе CMS, а не estate-service: синк выполняется здесь, здесь же
 * кнопка в интерфейсе и расписание. Без журнала кнопка нажимается в пустоту —
 * не видно ни что прогон идёт, ни чем кончился прошлый.
 */
@Entity('macro_sync_runs')
export class MacroSyncRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  /** Внешние id домов, которые синхронизировали в этом прогоне. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  houseIds!: number[]

  @Column({ type: 'varchar', length: 20, default: 'running' })
  status!: MacroSyncStatus

  /** Кто запустил: 'manual' — кнопка, 'schedule' — расписание. */
  @Column({ type: 'varchar', length: 20, default: 'manual' })
  trigger!: string

  @Column({ type: 'int', default: 0 })
  apartmentsSeen!: number

  @Column({ type: 'int', default: 0 })
  plansProbed!: number

  @Column({ type: 'int', default: 0 })
  planTypesUpserted!: number

  @Column({ type: 'int', default: 0 })
  imagesDownloaded!: number

  /** Запросов к MacroCRM. По этому числу видно, не упёрлись ли в лимит. */
  @Column({ type: 'int', default: 0 })
  apiCalls!: number

  @Column({ type: 'jsonb', nullable: true })
  cursor!: MacroSyncCursor | null

  /** Что пошло не так: незакрывающая проблема при partial, причина при failed. */
  @Column({ type: 'text', nullable: true })
  error!: string | null

  @Index()
  @CreateDateColumn()
  startedAt!: Date

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt!: Date | null
}
