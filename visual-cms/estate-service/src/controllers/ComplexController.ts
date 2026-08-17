import { Request, Response } from 'express'
import { In } from 'typeorm'
import { AppDataSource } from '../config/database'
import { Complex } from '../models/Complex'
import { House } from '../models/House'
import { Apartment } from '../models/Apartment'
import { EstateTranslation } from '../models/EstateTranslation'
import { logger } from '../services/Logger'
import {
  buildComplexDetail,
  buildComplexListItem,
  normalizeLocale,
  Locale,
  TrRow,
} from '../services/i18n'

/**
 * Read-API комплексов. Данные грузятся из БД, преобразование в DTO (overlay
 * языка + производные) делают чистые функции services/i18n.ts.
 */
export class ComplexController {
  /**
   * GET /api/complexes?lang=[&full=1]
   * По умолчанию — лёгкие карточки каталога. С `full=1` — массив полных
   * деталей (houses[]+apartments[]) для Collection: одна привязка на шаблон,
   * repeater по item.apartments.
   */
  static async list(req: Request, res: Response): Promise<void> {
    try {
      const locale = normalizeLocale(req.query.lang as string)
      const complexes = await AppDataSource.getRepository(Complex).find({
        order: { order: 'ASC' },
      })

      if (req.query.full === '1' || req.query.full === 'true') {
        const items = await ComplexController.buildFullItems(complexes, locale)
        res.json({ locale, items })
        return
      }

      const ids = complexes.map((c) => c.id)
      const translations =
        ids.length > 0
          ? await AppDataSource.getRepository(EstateTranslation).find({
              where: { entityType: 'complex', entityId: In(ids), locale },
            })
          : []
      const trRows = translations as unknown as TrRow[]
      const items = complexes.map((c) => buildComplexListItem(c as any, trRows, locale))
      res.json({ locale, items })
    } catch (err) {
      logger.error('complex.list failed', err instanceof Error ? err : undefined)
      res.status(500).json({ error: 'Internal error' })
    }
  }

  /** Полные детали для всех ЖК одним набором bulk-запросов (для Collection). */
  private static async buildFullItems(complexes: Complex[], locale: Locale) {
    if (complexes.length === 0) return []
    const complexIds = complexes.map((c) => c.id)
    const houses = await AppDataSource.getRepository(House).find({
      where: { complexId: In(complexIds) },
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
    const translations = (await AppDataSource.getRepository(EstateTranslation).find({
      where: { locale },
    })) as unknown as TrRow[]

    const housesByComplex = new Map<string, House[]>()
    for (const h of houses) {
      const list = housesByComplex.get(h.complexId) || []
      list.push(h)
      housesByComplex.set(h.complexId, list)
    }
    const aptsByHouse = new Map<string, Apartment[]>()
    for (const a of apartments) {
      const list = aptsByHouse.get(a.houseId) || []
      list.push(a)
      aptsByHouse.set(a.houseId, list)
    }

    return complexes.map((c) => {
      const cHouses = housesByComplex.get(c.id) || []
      const cApts = cHouses.flatMap((h) => aptsByHouse.get(h.id) || [])
      return buildComplexDetail(c as any, cHouses as any, cApts as any, translations, locale)
    })
  }

  /** GET /api/complexes/:slug?lang= — деталь ЖК с домами и квартирами. */
  static async detail(req: Request, res: Response): Promise<void> {
    try {
      const locale = normalizeLocale(req.query.lang as string)
      const slug = String(req.params.slug)

      const complex = await AppDataSource.getRepository(Complex).findOne({ where: { slug } })
      if (!complex) {
        res.status(404).json({ error: 'Complex not found', slug })
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

      // Переводы для всех сущностей этого ЖК одним запросом.
      const entityIds = [complex.id, ...houseIds, ...apartments.map((a) => a.id)]
      const translations = await AppDataSource.getRepository(EstateTranslation).find({
        where: { entityId: In(entityIds), locale },
      })

      const dto = buildComplexDetail(
        complex as any,
        houses as any,
        apartments as any,
        translations as unknown as TrRow[],
        locale
      )
      res.json(dto)
    } catch (err) {
      logger.error('complex.detail failed', err instanceof Error ? err : undefined)
      res.status(500).json({ error: 'Internal error' })
    }
  }
}
