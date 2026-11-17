import { Request, Response } from 'express'
import { In } from 'typeorm'
import { AppDataSource } from '../config/database'
import { Complex } from '../models/Complex'
import { House } from '../models/House'
import { Apartment } from '../models/Apartment'
import { PlanType } from '../models/PlanType'
import { logger } from '../services/Logger'
import type { PlanTypeRow } from '../services/i18n'
import { buildLeadContext, complexForPath, EMPTY_LEAD_CONTEXT } from '../services/leadContext'

/** Длина пути и id в запросе — защита от мусора, а не бизнес-правило. */
const MAX_PATH = 500
const MAX_ID = 64

/**
 * GET /api/lead-context?path=<адрес страницы>&planType=<id карточки>
 *
 * Зовёт бэкенд CMS при приёме заявки с сайта (services/leads). Проект без
 * совпадения по адресу — пустой контекст, а не 404: заявка с главной тоже
 * заявка, просто без интереса к проекту.
 */
export class LeadContextController {
  static async context(req: Request, res: Response): Promise<void> {
    try {
      const path = String(req.query.path ?? '').slice(0, MAX_PATH)
      const planTypeId = String(req.query.planType ?? '').slice(0, MAX_ID).trim()

      const complexes = await AppDataSource.getRepository(Complex).find({
        where: { showOnSite: true },
        select: { id: true, slug: true, name: true, planGrouping: true },
      })
      const complex = complexForPath(path, complexes)
      if (!complex) {
        res.json(EMPTY_LEAD_CONTEXT)
        return
      }

      const houses = await AppDataSource.getRepository(House).find({ where: { complexId: complex.id } })
      const houseIds = houses.map((h) => h.id)
      const [planTypes, apartments] = houseIds.length
        ? await Promise.all([
            AppDataSource.getRepository(PlanType).find({ where: { houseId: In(houseIds) } }),
            AppDataSource.getRepository(Apartment).find({
              where: { houseId: In(houseIds) },
              select: { houseId: true, planTypeId: true, externalId: true, status: true, price: true },
            }),
          ])
        : [[], []]

      res.json(
        buildLeadContext(complex, houses, planTypes as unknown as PlanTypeRow[], apartments, planTypeId || null)
      )
    } catch (err) {
      logger.error('lead-context failed', err instanceof Error ? err : undefined)
      res.status(500).json({ error: 'Internal error' })
    }
  }
}
