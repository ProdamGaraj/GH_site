import { Request, Response } from 'express'
import { EntityManager } from 'typeorm'
import { AppDataSource } from '../config/database'
import { Complex } from '../models/Complex'
import { House } from '../models/House'
import { Apartment } from '../models/Apartment'
import { PlanType } from '../models/PlanType'
import { logger } from '../services/Logger'
import {
  diffApartments,
  diffPlanTypes,
  findDanglingSignatures,
  summarize,
  STATUS_GONE,
  type ApartmentInput,
  type PlanTypeInput,
  type ExistingRow,
} from '../services/houseSync'
import type { SyncHouseBody } from '../schemas/sync.schema'

/**
 * Приём выгрузки одного дома из MacroCRM.
 *
 * Одним запросом и одной транзакцией: 339 квартир поштучными вызовами админ-API
 * заняли бы минуты и оставили бы базу в полусостоянии при обрыве на середине.
 *
 * Ничего не удаляет. Квартиры, пропавшие из выдачи, получают статус; типы
 * планировок без квартир остаются с нулевым счётчиком. Причина одна: переводы
 * в estate_translations привязаны к id, и пересоздание строк осиротило бы их.
 */
export class SyncController {
  /**
   * Что уже известно о квартирах дома: когда их меняли в CRM и когда мы
   * последний раз ходили за планировкой.
   *
   * Синк живёт в backend CMS и без этого ответа не может отобрать, кого
   * опрашивать: пришлось бы каждый прогон обходить все 339 квартир заново.
   */
  static async houseState(req: Request, res: Response): Promise<void> {
    const externalHouseId = Number(req.params.externalHouseId)
    if (!Number.isInteger(externalHouseId) || externalHouseId <= 0) {
      res.status(400).json({ error: 'externalHouseId должен быть положительным числом' })
      return
    }

    try {
      const house = await AppDataSource.getRepository(House).findOne({
        where: { externalId: externalHouseId },
      })
      // Дома ещё нет — это первый прогон, а не ошибка.
      if (!house) {
        res.json({ externalHouseId, known: [] })
        return
      }

      const apartments = await AppDataSource.getRepository(Apartment).find({
        where: { houseId: house.id },
        select: ['externalId', 'dateModified', 'planProbedAt'],
      })

      res.json({
        externalHouseId,
        known: apartments
          .filter((a) => a.externalId !== null)
          .map((a) => ({
            externalId: a.externalId,
            dateModified: a.dateModified ? a.dateModified.toISOString() : null,
            probedAt: a.planProbedAt ? a.planProbedAt.toISOString() : null,
          })),
      })
    } catch (err) {
      logger.error('House state failed', err instanceof Error ? err : undefined)
      res.status(500).json({ error: 'Failed to read house state' })
    }
  }

  static async syncHouse(req: Request, res: Response): Promise<void> {
    const body = req.body as SyncHouseBody

    const dangling = findDanglingSignatures(
      body.apartments as ApartmentInput[],
      body.planTypes as PlanTypeInput[]
    )
    if (dangling.length > 0) {
      res.status(400).json({
        error: 'Квартиры ссылаются на неприсланные типы планировок',
        signatures: dangling,
      })
      return
    }

    try {
      const summary = await AppDataSource.transaction(async (m) =>
        SyncController.apply(m, body)
      )
      logger.info('House synced', { externalHouseId: body.externalHouseId, ...summary })
      res.json(summary)
    } catch (err) {
      if (err instanceof ComplexNotFound) {
        res.status(404).json({ error: err.message })
        return
      }
      logger.error('House sync failed', err instanceof Error ? err : undefined)
      res.status(500).json({ error: 'Sync failed' })
    }
  }

  private static async apply(m: EntityManager, body: SyncHouseBody) {
    const complex = await m.getRepository(Complex).findOne({
      where: { externalHouseId: body.externalHouseId },
    })
    if (!complex) {
      throw new ComplexNotFound(
        `Нет проекта с externalHouseId ${body.externalHouseId}. ` +
          'Проект заводится вручную — синк создаёт только квартиры и планировки.'
      )
    }

    const house = await SyncController.ensureHouse(m, complex, body)

    const plans = await SyncController.applyPlanTypes(m, complex, house, body)
    const apartmentsDiff = await SyncController.applyApartments(
      m,
      house,
      body,
      plans.idBySignature
    )

    return summarize(apartmentsDiff, plans.diff)
  }

  /**
   * Находит дом по внешнему id или заводит новый в этом проекте.
   *
   * У проекта может быть дом, заведённый руками до подключения CRM. Такой дом
   * подхватывается по совпадению порядка, только если он единственный и без
   * внешнего id: иначе синк создал бы дубль рядом с сидом, и на странице
   * появились бы два одинаковых корпуса.
   */
  private static async ensureHouse(
    m: EntityManager,
    complex: Complex,
    body: SyncHouseBody
  ): Promise<House> {
    const repo = m.getRepository(House)

    const byExternal = await repo.findOne({ where: { externalId: body.externalHouseId } })
    if (byExternal) {
      byExternal.externalId = body.externalHouseId
      if (body.house.name) byExternal.name = byExternal.name || body.house.name
      if (body.house.floorsCount) byExternal.floors = String(body.house.floorsCount)
      return repo.save(byExternal)
    }

    const ownHouses = await repo.find({ where: { complexId: complex.id } })
    const adoptable = ownHouses.length === 1 && !ownHouses[0].externalId ? ownHouses[0] : null
    if (adoptable) {
      adoptable.externalId = body.externalHouseId
      if (body.house.floorsCount) adoptable.floors = String(body.house.floorsCount)
      return repo.save(adoptable)
    }

    return repo.save(
      repo.create({
        complexId: complex.id,
        externalId: body.externalHouseId,
        name: body.house.name,
        floors: body.house.floorsCount ? String(body.house.floorsCount) : '',
        order: ownHouses.length,
      })
    )
  }

  private static async applyPlanTypes(
    m: EntityManager,
    complex: Complex,
    house: House,
    body: SyncHouseBody
  ) {
    const repo = m.getRepository(PlanType)
    const existing = await repo.find({ where: { houseId: house.id } })
    const rows: ExistingRow[] = existing.map((p) => ({ id: p.id, key: p.signature }))
    const diff = diffPlanTypes(rows, body.planTypes as PlanTypeInput[])

    const idBySignature = new Map<string, string>()
    for (const planType of existing) idBySignature.set(planType.signature, planType.id)

    for (const input of diff.create) {
      const saved = await repo.save(
        repo.create({ ...input, complexId: complex.id, houseId: house.id })
      )
      idBySignature.set(input.signature, saved.id)
    }

    for (const { id, input } of diff.update) {
      await repo.update(id, { ...input, complexId: complex.id, houseId: house.id })
    }

    // Тип, оставшийся без квартир: строку сохраняем ради переводов, но
    // обнуляем счётчик — читающее API такие не отдаёт.
    for (const row of diff.missing) {
      await repo.update(row.id, { apartmentsCount: 0 })
    }

    // diff возвращается вместе с картой: пересчитать его после применения
    // нельзя — созданные строки уже существуют и посчитались бы обновлёнными.
    return { idBySignature, diff }
  }

  private static async applyApartments(
    m: EntityManager,
    house: House,
    body: SyncHouseBody,
    planTypeIdBySignature: Map<string, string>
  ) {
    const repo = m.getRepository(Apartment)
    const existing = await repo.find({ where: { houseId: house.id } })
    const rows: ExistingRow[] = existing.map((a) => ({ id: a.id, key: a.externalId }))
    const diff = diffApartments(rows, body.apartments as ApartmentInput[])

    const now = new Date()
    // planProbedAt пишем только когда синк действительно ходил за планировкой:
    // иначе прогон, который её не опрашивал, затёр бы отметку и заставил
    // опрашивать заново.
    const toColumns = (input: ApartmentInput) => ({
      externalId: input.externalId,
      rooms: input.rooms,
      areaM2: input.areaM2,
      price: input.price,
      oldPrice: input.oldPrice,
      entrance: input.entrance,
      floorNumber: input.floorNumber,
      floor: input.floor,
      number: input.number,
      windowView: input.windowView,
      status: input.status,
      dateModified: input.dateModified ? new Date(input.dateModified) : null,
      ...(input.planProbed ? { planProbedAt: now } : {}),
      planTypeId: input.planSignature
        ? planTypeIdBySignature.get(input.planSignature) ?? null
        : null,
    })

    for (const input of diff.create) {
      await repo.save(repo.create({ ...toColumns(input), houseId: house.id }))
    }
    for (const { id, input } of diff.update) {
      await repo.update(id, toColumns(input))
    }
    // Пропала из выдачи — значит больше не продаётся. Строку не трогаем:
    // на ней могут висеть переводы, да и история продаж полезнее пустоты.
    for (const row of diff.missing) {
      await repo.update(row.id, { status: STATUS_GONE })
    }

    return diff
  }
}

class ComplexNotFound extends Error {}
