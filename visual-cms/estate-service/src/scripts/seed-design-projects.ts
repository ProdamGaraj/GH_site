/**
 * Seed проектов из дизайна: O'zMakon Business, Assalom Do'stlik, Harizma, O'zMakon.
 *
 * Идемпотентно по slug: сносит прежний ЖК (дома и квартиры уходят по FK CASCADE)
 * вместе с его переводами и создаёт заново. Данные — в design-projects.data.ts.
 * После записи печатает список пропусков (GAPS), чтобы было видно, что
 * дозаполнить руками.
 *
 * Запуск: npm run seed:design
 *
 * Заменяет seed-dostlik для slug assalom-dostlik: здесь тот же контент плюс
 * поля секций (aboutTitle/hallTitle/hallText/address/locationTitle/
 * locationLabels), которых в старом сиде нет.
 */
import 'dotenv/config'
import { In } from 'typeorm'
import { AppDataSource } from '../config/database'
import { runSafeMigrations } from '../migrations/runner'
import { Complex } from '../models/Complex'
import { House } from '../models/House'
import { Apartment } from '../models/Apartment'
import { EstateTranslation } from '../models/EstateTranslation'
import { logger } from '../services/Logger'
import { COMPLEXES, GAPS, ComplexSeed } from './design-projects.data'

/** Удаляет ЖК со slug вместе с переводами всех его сущностей. */
async function removeExisting(m: typeof AppDataSource.manager, slug: string): Promise<void> {
  const prev = await m.getRepository(Complex).findOne({
    where: { slug },
    relations: { houses: { apartments: true } },
  })
  if (!prev) return
  const ids = [
    prev.id,
    ...prev.houses.map((h) => h.id),
    ...prev.houses.flatMap((h) => h.apartments.map((a) => a.id)),
  ]
  await m.getRepository(EstateTranslation).delete({ entityId: In(ids) })
  await m.getRepository(Complex).delete({ id: prev.id })
}

async function insertComplex(m: typeof AppDataSource.manager, seed: ComplexSeed): Promise<void> {
  const { houses, ...complexFields } = seed
  const complex = await m.getRepository(Complex).save(
    m.getRepository(Complex).create(complexFields)
  )

  for (const houseSeed of houses) {
    const { apartments, ...houseFields } = houseSeed
    const house = await m.getRepository(House).save(
      m.getRepository(House).create({ ...houseFields, complexId: complex.id })
    )
    for (const apt of apartments) {
      await m.getRepository(Apartment).save(
        m.getRepository(Apartment).create({ ...apt, houseId: house.id, status: 'available' })
      )
    }
  }
}

async function seed(): Promise<void> {
  await AppDataSource.initialize()
  await runSafeMigrations(AppDataSource)

  await AppDataSource.transaction(async (m) => {
    for (const complexSeed of COMPLEXES) {
      await removeExisting(m, complexSeed.slug)
      await insertComplex(m, complexSeed)
      const apartments = complexSeed.houses.reduce((n, h) => n + h.apartments.length, 0)
      logger.info(`Seeded ${complexSeed.slug}`, {
        houses: complexSeed.houses.length,
        apartments,
      })
    }
  })

  logger.warn(`Пропуски в исходных данных: ${GAPS.length}`)
  for (const gap of GAPS) {
    logger.warn(`  [${gap.slug}] ${gap.field} — ${gap.reason}`)
  }

  await AppDataSource.destroy()
}

seed().catch((err) => {
  logger.error('seed-design-projects failed', err instanceof Error ? err : undefined)
  process.exit(1)
})
