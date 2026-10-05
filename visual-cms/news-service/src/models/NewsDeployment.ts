import { Entity, PrimaryColumn, Column } from 'typeorm'

/**
 * Новость выкачена на сайт на языке `locale`. Пишет CMS после деплоя
 * коллекции новостей (POST /api/admin/deployed); публичная лента отдаёт
 * только выкаченное, чтобы карточка не вела на ещё не созданную страницу.
 */
@Entity('news_deployments')
export class NewsDeployment {
  @PrimaryColumn({ type: 'uuid' })
  newsId!: string

  @PrimaryColumn({ type: 'varchar', length: 10 })
  locale!: string

  @Column({ type: 'timestamptz', default: () => 'now()' })
  deployedAt!: Date
}
