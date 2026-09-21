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
import type {
  EstateSyncApi,
  HouseState,
  KnownApartment,
  SyncHouseResult,
} from './EstateSyncApi'
import { logger } from './Logger'

/** Корневая папка медиатеки для чертежей. Внутри — по папке на проект. */
export const PLAN_FOLDER_ROOT = 'Планировки'

export interface HouseSyncOutcome {
  externalHouseId: number
  apartments: number
  planTypes: number
  probed: number
  skippedProbes: number
  /** Скачано из CRM в этом доме. */
  imagesDownloaded: number
  /** Уже лежало в медиатеке — качать не пришлось. */
  imagesReused: number
  /** Не удалось перенести: такой ракурс просто не попадёт на карточку. */
  imagesFailed: number
  /** Переложено в папку проекта. */
  imagesMoved: number
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
  /**
   * Опросить все квартиры заново, не глядя на прошлые отметки.
   *
   * Нужен для восстановления: если связи квартир с типами потерялись, отметка
   * об опросе осталась, и обычный прогон такие квартиры пропустит навсегда.
   * Стоит полного обхода, поэтому по умолчанию выключен.
   */
  forceFullProbe?: boolean
}

export class MacroSyncService {
  private readonly client: MacroSellClient
  private readonly estate: EstateSyncApi
  private readonly importer: PlanImageImporter
  private readonly alreadyProbed: Set<number>
  private readonly onProbe?: (externalId: number) => void | Promise<void>
  private readonly forceFullProbe: boolean

  constructor(opts: MacroSyncOptions) {
    this.client = opts.client
    this.estate = opts.estate
    this.importer = opts.importer ?? new PlanImageImporter()
    this.alreadyProbed = opts.alreadyProbed ?? new Set()
    this.onProbe = opts.onProbe
    this.forceFullProbe = opts.forceFullProbe === true
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
          imagesReused: 0,
          imagesFailed: 0,
          imagesMoved: 0,
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

    // Импортёр общий на весь прогон, поэтому его счётчики накопительные.
    // Берём разницу: иначе при двух домах цифры сложатся сами с собой.
    const before = this.importer.getStats()

    const state = await this.estate.getHouseState(externalHouseId)
    const probes = await this.probePlans(apartments, state.known)

    // Опрос инкрементальный, а выгрузка — полная замена. Поэтому группируем по
    // ВСЕМ квартирам: свежеопрошенные берут планировку из ответа CRM, остальные
    // — из типа, к которому уже привязаны. Иначе прогон, опросивший одну
    // квартиру, отправил бы остальные 335 без планировки и стёр бы работу
    // предыдущего прогона. Ровно это и случилось на первом боевом запуске.
    const full = this.completeProbes(apartments, state, probes.results)
    const { planTypes, unassigned } = groupPlanTypes(apartments, full.probes)
    const folderName = house?.name ?? String(externalHouseId)
    const withImages = await this.importImages(planTypes, full.reusedSignatures, folderName)

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

    const after = this.importer.getStats()

    // Одна строка, по которой видно, что вообще произошло с домом. Без неё
    // диагностика сводится к догадкам по счётчикам в панели.
    logger.info('Дом синхронизирован', {
      дом: externalHouseId,
      квартир: apartments.length,
      типов: withImages.length,
      восстановлено: full.reusedSignatures.size,
      опрошено: probes.probedIds.size,
      скачано: after.downloaded - before.downloaded,
      переложено: after.moved - before.moved,
      папка: folderName,
    })

    return {
      externalHouseId,
      apartments: apartments.length,
      planTypes: withImages.length,
      probed: probes.probedIds.size,
      skippedProbes: apartments.length - probes.targets,
      imagesDownloaded: after.downloaded - before.downloaded,
      imagesReused: after.reused - before.reused,
      imagesFailed: after.failed - before.failed,
      imagesMoved: after.moved - before.moved,
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
    // Полная пересборка игнорирует прошлые отметки, но не курсор: продолжать
    // прерванный обход надо и здесь, иначе рестарт стоит второго полного круга.
    const selected = this.forceFullProbe ? apartments : selectProbeTargets(apartments, known)
    const targets = selected.filter(
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
   * Достраивает результаты опроса до полной картины.
   *
   * Квартире, которую в этом прогоне не опрашивали, планировку берём из типа,
   * к которому она уже привязана: подпись приходит в состоянии дома, а сам тип
   * — оттуда же целиком. Тип, восстановленный из базы, помечаем: его картинки
   * уже в медиатеке, и переносить их повторно не надо.
   */
  private completeProbes(
    apartments: ApartmentPayload[],
    state: HouseState,
    probed: PlanProbe[]
  ): { probes: PlanProbe[]; reusedSignatures: Set<string> } {
    const known = new Map(state.known.map((k) => [k.externalId, k]))
    const bySignature = new Map(state.planTypes.map((p) => [p.signature, p]))
    const probedIds = new Set(probed.map((p) => p.estateId))
    const reusedSignatures = new Set<string>()

    const probes: PlanProbe[] = [...probed]
    for (const apartment of apartments) {
      if (probedIds.has(apartment.externalId)) continue

      const signature = known.get(apartment.externalId)?.planSignature
      if (!signature) continue
      const existing = bySignature.get(signature)
      if (!existing) continue

      reusedSignatures.add(signature)
      probes.push({
        estateId: apartment.externalId,
        plan: {
          estateId: apartment.externalId,
          planName: existing.planName,
          files: existing.images,
        },
      })
    }

    return { probes, reusedSignatures }
  }

  /**
   * Переносит картинки типов в медиатеку.
   *
   * Тип без единой перенесённой картинки остаётся: у него есть имя, площадь и
   * квартиры, и показать карточку без чертежа лучше, чем потерять планировку
   * из выдачи целиком.
   *
   * Типы, восстановленные из базы, пропускаем: их картинки уже наши, и
   * «перенос» означал бы скачать их из собственной медиатеки и положить туда
   * же копию — на каждом прогоне.
   */
  private async importImages(
    planTypes: PlanTypePayload[],
    reusedSignatures: Set<string>,
    projectName: string
  ): Promise<PlanTypePayload[]> {
    // Папка на проект внутри общей: иначе сотни чертежей двух домов сваливаются
    // в одну кучу, и найти нужный в медиатеке невозможно.
    const folderPath = [PLAN_FOLDER_ROOT, projectName]

    const out: PlanTypePayload[] = []
    for (const planType of planTypes) {
      if (reusedSignatures.has(planType.signature)) {
        // Тип восстановлен из базы: качать нечего, но разложить по папкам надо.
        // Первые прогоны шли без папок и свалили всё в корень медиатеки.
        await this.importer.relocate(
          planType.images.map((image) => image.url),
          folderPath
        )
        out.push(planType)
        continue
      }
      const images = await this.importer.importFiles(planType.images, folderPath)
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
    imagesReused: outcomes.reduce((n, o) => n + o.imagesReused, 0),
    imagesFailed: outcomes.reduce((n, o) => n + o.imagesFailed, 0),
    imagesMoved: outcomes.reduce((n, o) => n + o.imagesMoved, 0),
    error: failed.length > 0 ? failed.map((o) => `${o.externalHouseId}: ${o.error}`).join('; ') : null,
  } as const
}
