/**
 * Оркестратор синхронизации с MacroCRM.
 *
 * Порядок на один дом:
 *   1. estateHouses/list      — этажность (иначе этаж покажется «12», а не «12/15»)
 *   2. estateSell/list        — квартиры в продаже, курсорная пагинация
 *   3. отбор на опрос         — новые и изменившиеся, остальные пропускаем
 *   4. getFlatPlans           — по вызову на отобранную квартиру
 *   5. перенос картинок       — из подписанных ссылок CRM в медиатеку
 *   6. группировка            — квартиры сводятся в типы планировок
 *   7. выгрузка               — один запрос в estate-service, одна транзакция
 *
 * Первый прогон дорогой: 339 квартир двух домов дают столько же вызовов
 * getFlatPlans и около четырёх минут при 90 запросах в минуту. Второй прогон
 * без изменений в CRM не стоит ни одного вызова планировок — за это отвечает
 * отбор на шаге 3.
 *
 * Возобновление: опрошенные квартиры пишутся в курсор прогона, и повторный
 * запуск после рестарта продолжает с того же места, а не съедает лимит заново.
 */

import { MacroSellClient, type MacroHouse, type MacroFlatPlan } from './MacroSellClient'
import { mapApartments, type ApartmentPayload } from './MacroEstateMapper'
import {
  groupPlanTypes,
  selectProbeTargets,
  type PlanProbe,
  type PlanTypePayload,
} from './PlanTypeGrouper'
import { PlanImageImporter } from './PlanImageImporter'
import type { EstateSyncApi, KnownApartment, SyncHouseResult } from './EstateSyncApi'
import { logger } from './Logger'

export interface HouseSyncOutcome {
  externalHouseId: number
  apartments: number
  planTypes: number
  probed: number
  skippedProbes: number
  imagesDownloaded: number
  unassigned: number
  result: SyncHouseResult | null
  error: string | null
}

export interface MacroSyncOptions {
  client: MacroSellClient
  estate: EstateSyncApi
  /** Куда складывать картинки планировок. */
  importer?: PlanImageImporter
  /** Уже опрошенные в прерванном прогоне — не опрашиваем повторно. */
  alreadyProbed?: Set<number>
  /** Вызывается после каждой опрошенной квартиры: сюда пишется курсор. */
  onProbe?: (externalId: number) => void | Promise<void>
}

export class MacroSyncService {
  private readonly client: MacroSellClient
  private readonly estate: EstateSyncApi
  private readonly importer: PlanImageImporter
  private readonly alreadyProbed: Set<number>
  private readonly onProbe?: (externalId: number) => void | Promise<void>

  constructor(opts: MacroSyncOptions) {
    this.client = opts.client
    this.estate = opts.estate
    this.importer = opts.importer ?? new PlanImageImporter()
    this.alreadyProbed = opts.alreadyProbed ?? new Set()
    this.onProbe = opts.onProbe
  }

  get apiCalls(): number {
    return this.client.calls
  }

  /**
   * Синхронизирует перечисленные дома.
   *
   * Сбой на одном доме не отменяет остальные: у двух проектов независимые
   * страницы, и уронить оба из-за одного — хуже, чем синхронизировать один.
   */
  async syncHouses(externalHouseIds: number[]): Promise<HouseSyncOutcome[]> {
    const outcomes: HouseSyncOutcome[] = []
    for (const externalHouseId of externalHouseIds) {
      try {
        outcomes.push(await this.syncHouse(externalHouseId))
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error(`Синхронизация дома ${externalHouseId} не удалась: ${message}`)
        outcomes.push({
          externalHouseId,
          apartments: 0,
          planTypes: 0,
          probed: 0,
          skippedProbes: 0,
          imagesDownloaded: 0,
          unassigned: 0,
          result: null,
          error: message,
        })
      }
    }
    return outcomes
  }

  async syncHouse(externalHouseId: number): Promise<HouseSyncOutcome> {
    const house = await this.fetchHouse(externalHouseId)

    const raw = await this.client.listApartments({ houseIds: [externalHouseId] })
    const { apartments, skipped } = mapApartments(raw, {
      floorsCount: house?.floorsCount ?? null,
    })
    if (skipped.length > 0) {
      logger.warn(`Дом ${externalHouseId}: пропущено объектов ${skipped.length}`)
    }

    const known = await this.estate.getHouseState(externalHouseId)
    const probes = await this.probePlans(apartments, known)

    const { planTypes, unassigned } = groupPlanTypes(apartments, probes.results)
    const withImages = await this.importImages(planTypes)

    const result = await this.estate.syncHouse({
      externalHouseId,
      house: {
        name: house?.name ?? '',
        floorsCount: house?.floorsCount ?? null,
        address: house?.address ?? '',
      },
      planTypes: withImages.map((planType) => ({
        signature: planType.signature,
        planName: planType.planName,
        images: planType.images,
        panoUrl: planType.panoUrl,
        rooms: planType.rooms,
        isStudio: planType.isStudio,
        areaMin: planType.areaMin,
        areaMax: planType.areaMax,
        priceMin: planType.priceMin,
        priceMax: planType.priceMax,
        apartmentsCount: planType.apartmentsCount,
        floors: planType.floors,
        entrances: planType.entrances,
        windowViews: planType.windowViews,
        order: planType.order,
      })),
      apartments: this.toApartmentPayloads(apartments, withImages, probes.probedIds),
    })

    return {
      externalHouseId,
      apartments: apartments.length,
      planTypes: withImages.length,
      probed: probes.probedIds.size,
      skippedProbes: apartments.length - probes.targets,
      imagesDownloaded: this.importer.getStats().downloaded,
      unassigned: unassigned.length,
      result,
      error: null,
    }
  }

  /** Сведения о доме. Их отсутствие не повод срывать синк — этаж покажем без «из». */
  private async fetchHouse(externalHouseId: number): Promise<MacroHouse | null> {
    try {
      const houses = await this.client.listHouses([externalHouseId])
      return houses.find((h) => h.id === externalHouseId) ?? null
    } catch (err) {
      logger.warn(`Не удалось получить дом ${externalHouseId}: ${String(err)}`)
      return null
    }
  }

  /**
   * Опрашивает планировки отобранных квартир.
   *
   * Сбой на одной квартире не срывает обход: сотни вызовов подряд, и падать
   * целиком из-за одного 500-го значило бы никогда не досчитать первый прогон.
   */
  private async probePlans(
    apartments: ApartmentPayload[],
    known: KnownApartment[]
  ): Promise<{ results: PlanProbe[]; probedIds: Set<number>; targets: number }> {
    const targets = selectProbeTargets(apartments, known).filter(
      (apartment) => !this.alreadyProbed.has(apartment.externalId)
    )

    const results: PlanProbe[] = []
    const probedIds = new Set<number>()

    for (const apartment of targets) {
      try {
        const plan = await this.client.getFlatPlan(apartment.externalId)
        results.push({ estateId: apartment.externalId, plan })
      } catch (err) {
        logger.warn(`Планировка ${apartment.externalId} не отдалась: ${String(err)}`)
        results.push({ estateId: apartment.externalId, plan: null })
      }
      probedIds.add(apartment.externalId)
      if (this.onProbe) await this.onProbe(apartment.externalId)
    }

    return { results, probedIds, targets: targets.length }
  }

  /**
   * Переносит картинки типов в медиатеку.
   *
   * Тип без единой перенесённой картинки остаётся: у него есть имя, площадь и
   * квартиры, и показать карточку без чертежа лучше, чем потерять планировку
   * из выдачи целиком.
   */
  private async importImages(planTypes: PlanTypePayload[]): Promise<PlanTypePayload[]> {
    const out: PlanTypePayload[] = []
    for (const planType of planTypes) {
      const images = await this.importer.importFiles(planType.images)
      out.push({ ...planType, images })
    }
    return out
  }

  /**
   * Квартиры в форме estate-service.
   *
   * planProbed отмечается только у тех, кого опрашивали в этом прогоне: иначе
   * отметка о прошлом опросе затрётся, и следующий прогон пойдёт по кругу.
   */
  private toApartmentPayloads(
    apartments: ApartmentPayload[],
    planTypes: PlanTypePayload[],
    probedIds: Set<number>
  ) {
    const signatureByApartment = new Map<number, string>()
    for (const planType of planTypes) {
      for (const externalId of planType.apartmentExternalIds) {
        signatureByApartment.set(externalId, planType.signature)
      }
    }

    return apartments.map((apartment) => ({
      externalId: apartment.externalId,
      rooms: apartment.rooms,
      areaM2: apartment.areaM2,
      price: apartment.price,
      oldPrice: apartment.oldPrice,
      entrance: apartment.entrance,
      floorNumber: apartment.floorNumber,
      floor: apartment.floor,
      number: apartment.number,
      isStudio: apartment.isStudio,
      windowView: apartment.windowView,
      status: apartment.status,
      dateModified: apartment.dateModified,
      planSignature: signatureByApartment.get(apartment.externalId) ?? null,
      planProbed: probedIds.has(apartment.externalId),
    }))
  }
}

/**
 * Плоская сводка по всем домам — то, что пишется в журнал прогона.
 *
 * Прогон считается успешным, только если ни один дом не упал: «частично» и
 * «успешно» на кнопке в интерфейсе должны различаться, иначе половина
 * несинхронизированных квартир останется незамеченной.
 */
export function summarizeRun(outcomes: HouseSyncOutcome[]) {
  const failed = outcomes.filter((o) => o.error !== null)
  return {
    status: failed.length === 0 ? 'ok' : failed.length === outcomes.length ? 'failed' : 'partial',
    apartmentsSeen: outcomes.reduce((n, o) => n + o.apartments, 0),
    plansProbed: outcomes.reduce((n, o) => n + o.probed, 0),
    planTypesUpserted: outcomes.reduce((n, o) => n + o.planTypes, 0),
    imagesDownloaded: outcomes.reduce((n, o) => n + o.imagesDownloaded, 0),
    error: failed.length > 0 ? failed.map((o) => `${o.externalHouseId}: ${o.error}`).join('; ') : null,
  } as const
}
