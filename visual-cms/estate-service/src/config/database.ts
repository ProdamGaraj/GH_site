import { DataSource } from 'typeorm'
import { Complex } from '../models/Complex'
import { House } from '../models/House'
import { Apartment } from '../models/Apartment'
import { EstateTranslation } from '../models/EstateTranslation'

/**
 * Отдельная БД `estate` (изоляция от visual_cms). synchronize:false —
 * схема применяется идемпотентными SQL-миграциями (migrations/runner.ts),
 * как в основном backend.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  entities: [Complex, House, Apartment, EstateTranslation],
  migrations: [],
  subscribers: [],
})
