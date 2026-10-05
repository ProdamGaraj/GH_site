import { DataSource } from 'typeorm'
import { News } from '../models/News'
import { NewsCategory, NewsTag } from '../models/NewsDictionary'
import { NewsDeployment } from '../models/NewsDeployment'
import { NewsTranslation } from '../models/NewsTranslation'

/**
 * Отдельная БД `news` (изоляция от visual_cms). synchronize:false — схема
 * применяется идемпотентными SQL-миграциями (migrations/runner.ts), как в
 * estate-service.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  entities: [News, NewsCategory, NewsTag, NewsTranslation, NewsDeployment],
  migrations: [],
  subscribers: [],
})
