/**
 * Клиент MacroCRM для квартир и планировок.
 *
 * Три метода, которые нужны синку:
 *   estateHouses/list      — дома по houseIds (этажность, имя, ЖК)
 *   estateSell/list        — объекты продажи, курсорная пагинация по 100
 *   estateSell/getFlatPlans — планировка ОДНОЙ квартиры за вызов
 *
 * Последний и есть узкое место: массового варианта у Macro нет, поэтому первый
 * обход дома стоит столько вызовов, сколько в нём квартир. Для двух наших домов
 * это 339 вызовов, около четырёх минут при 90 запросах в минуту. Дальше
 * повторно опрашиваются только новые и изменившиеся — см. dateModified.
 *
 * Важно про id: у нас «комплекс» на сайте соответствует ДОМУ в CRM, поэтому
 * квартиры запрашиваются через houseIds. Через complexIds приехал бы весь ЖК
 * вместе с соседними корпусами.
 */

import { MacroHttp, type MacroHttpOptions } from './MacroHttp'
import type { MacroSellItem } from './MacroEstateMapper'

/** Дом из estateHouses/list. Описаны только читаемые поля. */
export interface MacroHouse {
  id: number
  complexId: number | null
  name: string
  floorsCount: number | null
  address: string
  description: string
}

/** Файл планировки. */
export interface MacroPlanFile {
  title: string
  url: string
  thumbUrl: string
}

/** Ответ getFlatPlans по одной квартире. */
export interface MacroFlatPlan {
  estateId: number
  planName: string
  files: MacroPlanFile[]
}

/** Статус «Свободно» — единственный, при котором квартира в продаже. */
export const STATUS_ON_SALE = 20

export interface ListApartmentsParams {
  houseIds: number[]
  /** По умолчанию только жилые: гаражи и коммерция в карточки квартир не идут. */
  categories?: string[]
  /** По умолчанию только «Свободно». Пустой массив — без фильтра по статусу. */
  statuses?: number[]
  /** Курсор для продолжения прерванного обхода. */
  from?: number | null
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function intOrNull(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

export class MacroSellClient {
  private readonly http: MacroHttp

  constructor(opts: MacroHttpOptions | MacroHttp) {
    this.http = opts instanceof MacroHttp ? opts : new MacroHttp(opts)
  }

  /** Сколько запросов ушло в API за время жизни клиента. */
  get calls(): number {
    return this.http.calls
  }

  /**
   * Дома по внешним id. Нужны ради floorsCount: без этажности этаж квартиры
   * показывается как «12» вместо «12/15».
   */
  async listHouses(houseIds: number[]): Promise<MacroHouse[]> {
    if (houseIds.length === 0) return []
    const raw = await this.http.postAll<Record<string, unknown>>(
      '/estateHouses/list',
      { houseIds }
    )
    const out: MacroHouse[] = []
    for (const item of raw) {
      const id = intOrNull(item.id)
      if (id === null) continue
      out.push({
        id,
        complexId: intOrNull(item.complexId),
        name: str(item.name),
        floorsCount: intOrNull(item.floorsCount),
        address: str(item.address),
        description: str(item.description),
      })
    }
    return out
  }

  /**
   * Объекты продажи по домам. Проходит пагинацию до конца.
   *
   * includeMaxDiscountPrice запрашивается всегда: без него в ответе нет
   * цены со скидкой, а именно она показывается на карточке.
   */
  async listApartments(params: ListApartmentsParams): Promise<MacroSellItem[]> {
    if (params.houseIds.length === 0) return []

    const body: Record<string, unknown> = {
      houseIds: params.houseIds,
      includeMaxDiscountPrice: true,
    }
    const categories = params.categories ?? ['flat']
    if (categories.length > 0) body.categories = categories

    const statuses = params.statuses ?? [STATUS_ON_SALE]
    if (statuses.length > 0) body.statuses = statuses

    return this.http.postAll<MacroSellItem>('/estateSell/list', body, params.from)
  }

  /**
   * Планировка одной квартиры.
   *
   * null означает «в CRM планировки нет» — это нормальное состояние, а не сбой:
   * такие квартиры просто не попадут ни в один тип. Сетевые ошибки при этом
   * пробрасываются: молча потерять половину планировок из-за 500-х нельзя.
   */
  async getFlatPlan(estateId: number): Promise<MacroFlatPlan | null> {
    const json = await this.http.post<{ data?: Record<string, unknown> | null }>(
      '/estateSell/getFlatPlans',
      { estateId }
    )
    const data = json?.data
    if (!data || typeof data !== 'object') return null

    const files: MacroPlanFile[] = []
    if (Array.isArray(data.files)) {
      for (const file of data.files) {
        const url = str((file as Record<string, unknown>)?.url)
        if (!url) continue
        files.push({
          title: str((file as Record<string, unknown>).title),
          url,
          thumbUrl: str((file as Record<string, unknown>).thumbUrl),
        })
      }
    }

    const planName = str(data.planName)
    // Ни имени, ни файлов — показывать нечего и группировать не по чему.
    if (!planName && files.length === 0) return null

    return { estateId: intOrNull(data.estateId) ?? estateId, planName, files }
  }
}
