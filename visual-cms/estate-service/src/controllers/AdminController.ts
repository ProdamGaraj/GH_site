import { Request, Response } from 'express'
import { In, EntityManager } from 'typeorm'
import { AppDataSource } from '../config/database'
import { Complex } from '../models/Complex'
import { House } from '../models/House'
import { Apartment } from '../models/Apartment'
import { EstateTranslation } from '../models/EstateTranslation'
import { PlanType } from '../models/PlanType'
import { PlaceType } from '../models/PlaceType'
import { logger } from '../services/Logger'
import { buildComplexAdmin, buildTranslationRows, TranslationsByLocale } from '../services/adminSerialize'
import { distinctValues, PlanTypeRow, TrRow } from '../services/i18n'
import { previewPlanGrouping } from '../services/planGroupingPreview'
import { isShownPlanType } from '../services/planGrouping'
import { MAP_ICONS, iconSvg } from '../services/mapIcons'
import { missingPlaceTypes } from '../services/projectMap'

/**
 * Admin CRUD для Complex/House/Apartment + переводы (uz/en).
 *
 * Payload create/update = базовые поля (ru) + необязательный `translations`
 * ({uz:{field:value}, en:{...}}). База пишется в колонки, переводы — оверлеем в
 * estate_translations (на update: delete+insert для сущности). Чтение админки
 * отдаёт сырую базу + переводы по языку (не наложенные).
 */
export class AdminController {
  // --- Переводы: заменяем все оверрайды сущности на присланные ---
  private static async writeTranslations(
    m: EntityManager,
    entityType: string,
    entityId: string,
    translations: TranslationsByLocale | undefined
  ): Promise<void> {
    await m.getRepository(EstateTranslation).delete({ entityType, entityId })
    const rows = buildTranslationRows(entityType, entityId, translations)
    if (rows.length > 0) {
      await m.getRepository(EstateTranslation).save(rows.map((r) => m.getRepository(EstateTranslation).create(r)))
    }
  }

  /** Места ссылаются только на существующие типы — иначе 400 со списком чужих ключей. */
  private static async assertPlaceTypes(m: EntityManager, places: unknown): Promise<void> {
    if (!Array.isArray(places) || places.length === 0) return
    const known = await m.getRepository(PlaceType).find({ select: ['key'] })
    const missing = missingPlaceTypes(places as Array<{ type: string }>, known.map((t) => t.key))
    if (missing.length > 0) throw Object.assign(new Error('unknown place types'), { status: 400, types: missing })
  }

  private static unknownTypesResponse(res: Response, err: any): boolean {
    if (err?.status !== 400 || !err.types) return false
    res.status(400).json({ error: 'Неизвестный тип места', types: err.types })
    return true
  }

  // ================= Complex =================
  static async listComplexes(_req: Request, res: Response): Promise<void> {
    try {
      const complexes = await AppDataSource.getRepository(Complex).find({ order: { order: 'ASC' } })
      res.json(
        complexes.map((c) => ({
          id: c.id,
          slug: c.slug,
          name: c.name,
          className: c.className,
          status: c.status,
          order: c.order,
          // Без этого поля в списке не видно, какие проекты вообще участвуют
          // в синхронизации с CRM, — а пустое значение её молча отключает.
          externalHouseId: c.externalHouseId ?? null,
        }))
      )
    } catch (err) {
      logger.error('admin.listComplexes failed', err instanceof Error ? err : undefined)
      res.status(500).json({ error: 'Internal error' })
    }
  }

  static async getComplex(req: Request, res: Response): Promise<void> {
    try {
      const complex = await AppDataSource.getRepository(Complex).findOne({ where: { id: req.params.id } })
      if (!complex) {
        res.status(404).json({ error: 'Complex not found' })
        return
      }
      const houses = await AppDataSource.getRepository(House).find({
        where: { complexId: complex.id },
        order: { order: 'ASC' },
      })
      const houseIds = houses.map((h) => h.id)
      const apartments =
        houseIds.length > 0
          ? await AppDataSource.getRepository(Apartment).find({
              where: { houseId: In(houseIds) },
              order: { order: 'ASC' },
            })
          : []
      const entityIds = [complex.id, ...houseIds, ...apartments.map((a) => a.id)]
      const translations = (await AppDataSource.getRepository(EstateTranslation).find({
        where: { entityId: In(entityIds) },
      })) as unknown as TrRow[]

      // Виды из окна, которые реально есть на витрине: по ним админка строит
      // форму перевода (словарь windowViewLabels на вкладках uz/en).
      const planTypes =
        houseIds.length > 0
          ? await AppDataSource.getRepository(PlanType).find({ where: { houseId: In(houseIds) } })
          : []
      const windowViews = distinctValues(
        planTypes
          .filter(isShownPlanType)
          .flatMap((p) => (Array.isArray(p.windowViews) ? p.windowViews : [])),
        (view) => view
      ).sort((a, b) => a.localeCompare(b, 'ru'))

      res.json({
        ...buildComplexAdmin(complex as any, houses as any, apartments as any, translations),
        windowViews,
      })
    } catch (err) {
      logger.error('admin.getComplex failed', err instanceof Error ? err : undefined)
      res.status(500).json({ error: 'Internal error' })
    }
  }

  static async createComplex(req: Request, res: Response): Promise<void> {
    try {
      const { translations, ...base } = req.body as any
      const created = await AppDataSource.transaction(async (m) => {
        const repo = m.getRepository(Complex)
        const existing = await repo.findOne({ where: { slug: base.slug } })
        if (existing) throw Object.assign(new Error('slug already exists'), { status: 409 })
        await AdminController.assertPlaceTypes(m, base.places)
        const complex: Complex = await repo.save(repo.create(base as Complex))
        await AdminController.writeTranslations(m, 'complex', complex.id, translations)
        return complex
      })
      res.status(201).json({ id: created.id, slug: created.slug })
    } catch (err: any) {
      if (AdminController.unknownTypesResponse(res, err)) return
      if (err?.status === 409) {
        res.status(409).json({ error: 'Complex with this slug already exists' })
        return
      }
      logger.error('admin.createComplex failed', err instanceof Error ? err : undefined)
      res.status(500).json({ error: 'Internal error' })
    }
  }

  static async updateComplex(req: Request, res: Response): Promise<void> {
    try {
      const { translations, ...base } = req.body as any
      const ok = await AppDataSource.transaction(async (m) => {
        const repo = m.getRepository(Complex)
        const complex = await repo.findOne({ where: { id: req.params.id } })
        if (!complex) return false
        if (base.slug && base.slug !== complex.slug) {
          const clash = await repo.findOne({ where: { slug: base.slug } })
          if (clash) throw Object.assign(new Error('slug clash'), { status: 409 })
        }
        await AdminController.assertPlaceTypes(m, base.places)
        Object.assign(complex, base)
        await repo.save(complex)
        if (translations !== undefined) {
          await AdminController.writeTranslations(m, 'complex', complex.id, translations)
        }
        return true
      })
      if (!ok) {
        res.status(404).json({ error: 'Complex not found' })
        return
      }
      res.json({ ok: true })
    } catch (err: any) {
      if (AdminController.unknownTypesResponse(res, err)) return
      if (err?.status === 409) {
        res.status(409).json({ error: 'Another complex uses this slug' })
        return
      }
      logger.error('admin.updateComplex failed', err instanceof Error ? err : undefined)
      res.status(500).json({ error: 'Internal error' })
    }
  }

  /**
   * POST /complexes/:id/plan-groups/preview — во что превратится каталог
   * планировок при черновике настройки. Ничего не сохраняет: сохранение идёт
   * обычным PUT /complexes/:id с полем planGrouping.
   */
  static async previewPlanGroups(req: Request, res: Response): Promise<void> {
    try {
      const complex = await AppDataSource.getRepository(Complex).findOne({ where: { id: req.params.id } })
      if (!complex) {
        res.status(404).json({ error: 'Complex not found' })
        return
      }
      const houses = await AppDataSource.getRepository(House).find({ where: { complexId: complex.id } })
      const houseIds = houses.map((h) => h.id)
      const planTypes =
        houseIds.length > 0
          ? await AppDataSource.getRepository(PlanType).find({
              where: { houseId: In(houseIds) },
              order: { order: 'ASC' },
            })
          : []
      const houseNames = new Map(houses.map((h) => [h.id, h.name]))
      res.json(
        previewPlanGrouping(planTypes as unknown as PlanTypeRow[], req.body.planGrouping, houseNames)
      )
    } catch (err) {
      logger.error('admin.previewPlanGroups failed', err instanceof Error ? err : undefined)
      res.status(500).json({ error: 'Internal error' })
    }
  }

  static async deleteComplex(req: Request, res: Response): Promise<void> {
    try {
      const done = await AppDataSource.transaction(async (m) => {
        const complex = await m.getRepository(Complex).findOne({
          where: { id: req.params.id },
          relations: { houses: { apartments: true } },
        })
        if (!complex) return false
        const ids = [
          complex.id,
          ...complex.houses.map((h) => h.id),
          ...complex.houses.flatMap((h) => h.apartments.map((a) => a.id)),
        ]
        await m.getRepository(EstateTranslation).delete({ entityId: In(ids) })
        await m.getRepository(Complex).delete({ id: complex.id }) // FK cascade
        return true
      })
      if (!done) {
        res.status(404).json({ error: 'Complex not found' })
        return
      }
      res.json({ ok: true })
    } catch (err) {
      logger.error('admin.deleteComplex failed', err instanceof Error ? err : undefined)
      res.status(500).json({ error: 'Internal error' })
    }
  }

  // ================= House =================
  static async createHouse(req: Request, res: Response): Promise<void> {
    try {
      const complexId = req.params.complexId
      const { translations, ...base } = req.body as any
      const created = await AppDataSource.transaction(async (m) => {
        const complex = await m.getRepository(Complex).findOne({ where: { id: complexId } })
        if (!complex) throw Object.assign(new Error('no complex'), { status: 404 })
        const repo = m.getRepository(House)
        const house: House = await repo.save(repo.create({ ...base, complexId } as House))
        await AdminController.writeTranslations(m, 'house', house.id, translations)
        return house
      })
      res.status(201).json({ id: created.id })
    } catch (err: any) {
      if (err?.status === 404) {
        res.status(404).json({ error: 'Complex not found' })
        return
      }
      logger.error('admin.createHouse failed', err instanceof Error ? err : undefined)
      res.status(500).json({ error: 'Internal error' })
    }
  }

  static async updateHouse(req: Request, res: Response): Promise<void> {
    try {
      const { translations, ...base } = req.body as any
      const ok = await AppDataSource.transaction(async (m) => {
        const repo = m.getRepository(House)
        const house = await repo.findOne({ where: { id: req.params.id } })
        if (!house) return false
        Object.assign(house, base)
        await repo.save(house)
        if (translations !== undefined) {
          await AdminController.writeTranslations(m, 'house', house.id, translations)
        }
        return true
      })
      if (!ok) {
        res.status(404).json({ error: 'House not found' })
        return
      }
      res.json({ ok: true })
    } catch (err) {
      logger.error('admin.updateHouse failed', err instanceof Error ? err : undefined)
      res.status(500).json({ error: 'Internal error' })
    }
  }

  static async deleteHouse(req: Request, res: Response): Promise<void> {
    try {
      const done = await AppDataSource.transaction(async (m) => {
        const house = await m.getRepository(House).findOne({
          where: { id: req.params.id },
          relations: { apartments: true },
        })
        if (!house) return false
        const ids = [house.id, ...house.apartments.map((a) => a.id)]
        await m.getRepository(EstateTranslation).delete({ entityId: In(ids) })
        await m.getRepository(House).delete({ id: house.id })
        return true
      })
      if (!done) {
        res.status(404).json({ error: 'House not found' })
        return
      }
      res.json({ ok: true })
    } catch (err) {
      logger.error('admin.deleteHouse failed', err instanceof Error ? err : undefined)
      res.status(500).json({ error: 'Internal error' })
    }
  }

  // ================= Apartment =================
  static async createApartment(req: Request, res: Response): Promise<void> {
    try {
      const houseId = req.params.houseId
      const { translations, ...base } = req.body as any
      const created = await AppDataSource.transaction(async (m) => {
        const house = await m.getRepository(House).findOne({ where: { id: houseId } })
        if (!house) throw Object.assign(new Error('no house'), { status: 404 })
        const repo = m.getRepository(Apartment)
        const apt: Apartment = await repo.save(repo.create({ ...base, houseId } as Apartment))
        await AdminController.writeTranslations(m, 'apartment', apt.id, translations)
        return apt
      })
      res.status(201).json({ id: created.id })
    } catch (err: any) {
      if (err?.status === 404) {
        res.status(404).json({ error: 'House not found' })
        return
      }
      logger.error('admin.createApartment failed', err instanceof Error ? err : undefined)
      res.status(500).json({ error: 'Internal error' })
    }
  }

  static async updateApartment(req: Request, res: Response): Promise<void> {
    try {
      const { translations, ...base } = req.body as any
      const ok = await AppDataSource.transaction(async (m) => {
        const repo = m.getRepository(Apartment)
        const apt = await repo.findOne({ where: { id: req.params.id } })
        if (!apt) return false
        Object.assign(apt, base)
        await repo.save(apt)
        if (translations !== undefined) {
          await AdminController.writeTranslations(m, 'apartment', apt.id, translations)
        }
        return true
      })
      if (!ok) {
        res.status(404).json({ error: 'Apartment not found' })
        return
      }
      res.json({ ok: true })
    } catch (err) {
      logger.error('admin.updateApartment failed', err instanceof Error ? err : undefined)
      res.status(500).json({ error: 'Internal error' })
    }
  }

  static async deleteApartment(req: Request, res: Response): Promise<void> {
    try {
      const done = await AppDataSource.transaction(async (m) => {
        const apt = await m.getRepository(Apartment).findOne({ where: { id: req.params.id } })
        if (!apt) return false
        await m.getRepository(EstateTranslation).delete({ entityType: 'apartment', entityId: apt.id })
        await m.getRepository(Apartment).delete({ id: apt.id })
        return true
      })
      if (!done) {
        res.status(404).json({ error: 'Apartment not found' })
        return
      }
      res.json({ ok: true })
    } catch (err) {
      logger.error('admin.deleteApartment failed', err instanceof Error ? err : undefined)
      res.status(500).json({ error: 'Internal error' })
    }
  }

  // ================= Типы мест на карте =================
  static async listPlaceTypes(_req: Request, res: Response): Promise<void> {
    try {
      const types = await AppDataSource.getRepository(PlaceType).find({ order: { order: 'ASC', key: 'ASC' } })
      res.json(types)
    } catch (err) {
      logger.error('admin.listPlaceTypes failed', err instanceof Error ? err : undefined)
      res.status(500).json({ error: 'Internal error' })
    }
  }

  static async createPlaceType(req: Request, res: Response): Promise<void> {
    try {
      const repo = AppDataSource.getRepository(PlaceType)
      if (await repo.findOne({ where: { key: req.body.key } })) {
        res.status(409).json({ error: 'Тип с таким ключом уже есть' })
        return
      }
      const saved = await repo.save(repo.create(req.body as PlaceType))
      res.status(201).json(saved)
    } catch (err) {
      logger.error('admin.createPlaceType failed', err instanceof Error ? err : undefined)
      res.status(500).json({ error: 'Internal error' })
    }
  }

  /** Ключ не меняется: на него ссылаются места у ЖК. */
  static async updatePlaceType(req: Request, res: Response): Promise<void> {
    try {
      const repo = AppDataSource.getRepository(PlaceType)
      const type = await repo.findOne({ where: { key: String(req.params.key) } })
      if (!type) {
        res.status(404).json({ error: 'Тип не найден' })
        return
      }
      Object.assign(type, req.body)
      res.json(await repo.save(type))
    } catch (err) {
      logger.error('admin.updatePlaceType failed', err instanceof Error ? err : undefined)
      res.status(500).json({ error: 'Internal error' })
    }
  }

  /**
   * Тип, которым пользуются места, не удаляется — 409 со списком ЖК. Убрать
   * его с карты, не теряя места, можно флагом hidden.
   */
  static async deletePlaceType(req: Request, res: Response): Promise<void> {
    try {
      const key = String(req.params.key)
      const users = await AppDataSource.getRepository(Complex)
        .createQueryBuilder('c')
        .select(['c.id', 'c.name'])
        .where('c.places @> CAST(:probe AS jsonb)', { probe: JSON.stringify([{ type: key }]) })
        .getMany()
      if (users.length > 0) {
        res.status(409).json({ error: 'Тип используется местами ЖК — его можно скрыть', complexes: users.map((c) => c.name) })
        return
      }
      const result = await AppDataSource.getRepository(PlaceType).delete({ key })
      if (!result.affected) {
        res.status(404).json({ error: 'Тип не найден' })
        return
      }
      res.json({ ok: true })
    } catch (err) {
      logger.error('admin.deletePlaceType failed', err instanceof Error ? err : undefined)
      res.status(500).json({ error: 'Internal error' })
    }
  }

  /** Набор иконок для выбора у типа: единственный источник — services/mapIcons.ts. */
  static listMapIcons(_req: Request, res: Response): void {
    res.json(MAP_ICONS.map((icon) => ({ key: icon.key, label: icon.label, svg: iconSvg(icon.key) })))
  }
}
