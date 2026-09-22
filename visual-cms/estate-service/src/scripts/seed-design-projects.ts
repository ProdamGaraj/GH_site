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
import { COMPLEX_TR_FIELDS } from '../services/i18n'

/**
 * Квартиры, пришедшие из CRM: у них проставлен externalId.
 *
 * Пересоздание комплекса уносит их по FK CASCADE вместе с типами планировок, а
 * восстановить можно только полным синком — сотни вызовов getFlatPlans под
 * лимитом в 100 запросов в минуту плюс повторный перенос чертежей.
 */
export function syncedApartments(prev: {
  houses?: Array<{ apartments?: Array<{ externalId?: number | null }> }>
}): number {
  return (prev.houses ?? []).reduce(
    (n, h) =>
      n + (h.apartments ?? []).filter((a) => a.externalId !== null && a.externalId !== undefined).length,
    0
  )
}

export class SeedGuardError extends Error {}

/**
 * Пересоздавать ли проект.
 *
 * Отказ — когда у проекта есть хоть одна квартира из CRM и не передан
 * `--force`. Вынесено отдельно от базы, чтобы решение проверялось тестом:
 * именно оно отделяет безопасный прогон от потери синхронизации.
 */
export function refuseReseedReason(
  slug: string,
  prev: Parameters<typeof syncedApartments>[0],
  force: boolean
): string | null {
  const synced = syncedApartments(prev)
  if (synced === 0 || force) return null
  return (
    `«${slug}»: ${synced} квартир(ы) из CRM будут удалены вместе с комплексом. ` +
    'Для правки текстов используйте update-project-content.ts. ' +
    'Если пересоздание действительно нужно — запустите с --force.'
  )
}

/**
 * Удаляет ЖК со slug вместе с переводами всех его сущностей.
 *
 * Отказывается трогать проект, связанный с CRM. Сид задуман для первичной
 * заливки контента из дизайна, а на связанном проекте он молча уничтожал
 * результат синхронизации. Для правки одних лишь текстов есть
 * `update-project-content.ts`, который ничего не удаляет.
 */
async function removeExisting(
  m: typeof AppDataSource.manager,
  slug: string,
  force: boolean
): Promise<void> {
  const prev = await m.getRepository(Complex).findOne({
    where: { slug },
    relations: { houses: { apartments: true } },
  })
  if (!prev) return

  const refusal = refuseReseedReason(slug, prev, force)
  if (refusal) throw new SeedGuardError(refusal)

  const ids = [
    prev.id,
    ...prev.houses.map((h) => h.id),
    ...prev.houses.flatMap((h) => h.apartments.map((a) => a.id)),
  ]
  await m.getRepository(EstateTranslation).delete({ entityId: In(ids) })
  await m.getRepository(Complex).delete({ id: prev.id })
}

/**
 * Оверлей-переводы комплекса. jsonb-поля (stats, yardFeatures) кладём строкой
 * JSON — так их ждёт applyOverlay в services/i18n. Поля, которых нет в реестре
 * переводимых, пропускаем: иначе оверлей их всё равно не наложит.
 */
async function insertTranslations(
  m: typeof AppDataSource.manager,
  complexId: string,
  translations: ComplexSeed['translations']
): Promise<number> {
  if (!translations) return 0
  const rows: Array<Partial<EstateTranslation>> = []
  for (const [locale, fields] of Object.entries(translations)) {
    for (const [field, value] of Object.entries(fields as Record<string, unknown>)) {
      if (value === undefined || value === null || value === '') continue
      if (!COMPLEX_TR_FIELDS[field]) continue
      rows.push({
        entityType: 'complex',
        entityId: complexId,
        locale,
        field,
        value: typeof value === 'string' ? value : JSON.stringify(value),
      })
    }
  }
  if (rows.length) await m.getRepository(EstateTranslation).save(rows)
  return rows.length
}

async function insertComplex(m: typeof AppDataSource.manager, seed: ComplexSeed): Promise<void> {
  const { houses, translations, ...complexFields } = seed
  const complex = await m.getRepository(Complex).save(
    m.getRepository(Complex).create(complexFields)
  )
  const translated = await insertTranslations(m, complex.id, translations)
  if (translated) logger.info('Translations written', { slug: seed.slug, rows: translated })

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
  const force = process.argv.includes('--force')
  const only = process.argv
    .find((a) => a.startsWith('--slugs='))
    ?.slice('--slugs='.length)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const targets = COMPLEXES.filter((c) => !only || only.includes(c.slug))
  if (only) {
    const unknown = only.filter((s) => !COMPLEXES.some((c) => c.slug === s))
    if (unknown.length) throw new SeedGuardError(`Нет таких проектов: ${unknown.join(', ')}`)
  }

  await AppDataSource.initialize()
  await runSafeMigrations(AppDataSource)

  await AppDataSource.transaction(async (m) => {
    for (const complexSeed of targets) {
      await removeExisting(m, complexSeed.slug, force)
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

// Только при прямом запуске: файл экспортирует защиту от пересоздания, и
// импорт ради неё не должен дёргать базу и гасить процесс.
if (require.main === module) {
  seed().catch((err) => {
    logger.error('seed-design-projects failed', err instanceof Error ? err : undefined)
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
