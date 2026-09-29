import { Request, Response } from 'express'
import { EntityManager, IsNull, Not } from 'typeorm'
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
   * Что уже известно о доме: квартиры и собранные ранее типы планировок.
   *
   * Синк живёт в backend CMS и без этого ответа не может ни отобрать, кого
   * опрашивать, ни собрать полную картину. Второе важнее первого: опрос
   * инкрементальный, и прогон, знающий только свежеопрошенные квартиры,
   * отправит остальные без планировки — то есть сотрёт работу предыдущего.
   * Поэтому отдаём и подпись типа у каждой квартиры, и сами типы целиком.
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
        res.json({ externalHouseId, known: [], planTypes: [] })
        return
      }

      const apartments = await AppDataSource.getRepository(Apartment).find({
        where: { houseId: house.id },
        select: ['externalId', 'dateModified', 'planProbedAt', 'planTypeId', 'planMissing'],
      })
      const planTypes = await AppDataSource.getRepository(PlanType).find({
        where: { houseId: house.id },
      })
      const signatureById = new Map(planTypes.map((p) => [p.id, p.signature]))

      res.json({
        externalHouseId,
        known: apartments
          .filter((a) => a.externalId !== null)
          .map((a) => ({
            externalId: a.externalId,
            dateModified: a.dateModified ? a.dateModified.toISOString() : null,
            probedAt: a.planProbedAt ? a.planProbedAt.toISOString() : null,
            // По этой подписи синк восстановит привязку квартиры, которую
            // в текущем прогоне не опрашивал.
            planSignature: a.planTypeId ? signatureById.get(a.planTypeId) ?? null : null,
            // Без привязки, но с этим признаком — чертежа в CRM нет, и ходить
            // за ним снова незачем.
            planMissing: a.planMissing === true,
          })),
        // Картинки здесь уже наши, перенесённые в медиатеку: повторно
        // импортировать их не нужно и нельзя.
        planTypes: planTypes.map((p) => ({
          signature: p.signature,
          planName: p.planName,
          images: Array.isArray(p.images) ? p.images : [],
          panoUrl: p.panoUrl,
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
      if (err instanceof HouseNotFound) {
        res.status(404).json({ error: err.message })
        return
      }
      logger.error('House sync failed', err instanceof Error ? err : undefined)
      res.status(500).json({ error: 'Sync failed' })
    }
  }

  /**
   * GET /api/admin/sync/houses — дома, связанные с MacroCRM: их и
   * синхронизируем. Все проекты, в том числе снятые с сайта: данные
   * готовятся заранее, до публикации.
   */
  static async syncableHouses(_req: Request, res: Response): Promise<void> {
    try {
      const houses = await AppDataSource.getRepository(House).find({
        where: { externalId: Not(IsNull()) },
        relations: { complex: true },
        order: { order: 'ASC' },
      })
      res.json(
        houses.map((h) => ({
          externalHouseId: h.externalId,
          houseId: h.id,
          name: h.name,
          complexSlug: h.complex?.slug ?? '',
        }))
      )
    } catch (err) {
      logger.error('Syncable houses failed', err instanceof Error ? err : undefined)
      res.status(500).json({ error: 'Failed to list houses' })
    }
  }

  private static async apply(m: EntityManager, body: SyncHouseBody) {
    const house = await m.getRepository(House).findOne({
      where: { externalId: body.externalHouseId },
      relations: { complex: true },
    })
    if (!house || !house.complex) {
      throw new HouseNotFound(
        `Нет дома с ID ${body.externalHouseId} из MacroCRM. ` +
          'Дом заводится в проекте вручную — синк только наполняет его квартирами и планировками.'
      )
    }
    const complex = house.complex
    await SyncController.updateHouseFromCrm(m, house, body)

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
   * Сведения о доме из CRM. Название — только в пустое: ручное не перетираем.
   * Этажность и срок сдачи — из CRM (ручной срок живёт в `deadline` отдельно
   * и главнее на сайте). Срок пишем, только если CRM про дом спрашивали.
   */
  private static async updateHouseFromCrm(m: EntityManager, house: House, body: SyncHouseBody): Promise<void> {
    if (body.house.name && !house.name) house.name = body.house.name
    if (body.house.floorsCount) house.floors = String(body.house.floorsCount)
    if (body.house.inServiceYear !== undefined) {
      house.crmServiceYear = body.house.inServiceYear ?? null
      house.crmServiceMonth = body.house.inServiceMonth ?? null
    }
    await m.getRepository(House).save(house)
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
      // planProbedAt и planMissing пишем только когда синк действительно ходил
      // за планировкой: прогон, который её не опрашивал, про неё ничего не знает.
      ...(input.planProbed ? { planProbedAt: now, planMissing: input.planMissing } : {}),
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

class HouseNotFound extends Error {}
