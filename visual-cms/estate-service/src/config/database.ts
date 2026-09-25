import { DataSource } from 'typeorm'
import { Complex } from '../models/Complex'
import { House } from '../models/House'
import { Apartment } from '../models/Apartment'
import { PlanType } from '../models/PlanType'
import { EstateTranslation } from '../models/EstateTranslation'
import { PlaceType } from '../models/PlaceType'

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
  entities: [Complex, House, Apartment, PlanType, EstateTranslation, PlaceType],
  migrations: [],
  subscribers: [],
})
