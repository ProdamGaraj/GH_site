/**
 * Контекст заявки с сайта для CRM: что именно смотрел клиент.
 *
 * Бэкенд CMS принимает заявку и спрашивает здесь, к какому проекту и какой
 * планировке она относится. Браузеру мы эти данные не доверяем: адрес страницы
 * и id карточки — только ключи, а дома, площади, цены и id объектов продажи
 * берутся из базы каталога.
 *
 * Проект определяется по адресу страницы: сегмент пути, совпавший со slug
 * проекта (/ru/complex/assalom-dostlik/ → assalom-dostlik). Шаблон адреса у
 * коллекции может поменяться, а slug в пути останется.
 *
 * Планировка — по id карточки. Карточка на сайте — склеенная группа типов
 * (services/planGrouping.ts), её id — id главного типа группы. Ищем группу,
 * где этот тип есть, и берём дома и квартиры всех типов группы: клиенту
 * показали одну карточку на все зеркальные варианты.
 *
 * Чистый модуль без БД.
 */
import type { PlanTypeRow } from './i18n'
import { resolvePlanGroups, type PlanGroupingConfig } from './planGrouping'

/** Свободная квартира — только её можно предложить клиенту. */
export const ON_SALE_STATUS = 'available'

export interface LeadComplexRow {
  id: string
  slug: string
  name: string
  planGrouping?: PlanGroupingConfig | null
}

export interface LeadHouseRow {
  id: string
  complexId: string
  externalId: number | null
}

export interface LeadApartmentRow {
  houseId: string
  planTypeId: string | null
  externalId: number | null
  status: string
  price: string | number
}

export interface NumberRange {
  min: number
  max: number
}

export interface LeadPlanContext {
  /** id карточки (главного типа группы). */
  id: string
  planName: string
  rooms: number
  isStudio: boolean
  area: NumberRange | null
  /** Цены свободных квартир группы; нет свободных с ценой — null. */
  price: NumberRange | null
  floors: number[]
  /** id домов группы в MacroCRM. */
  houseExternalIds: number[]
  /** id свободных квартир группы в MacroCRM. */
  onSaleExternalIds: number[]
}

export interface LeadContextDTO {
  complex: { slug: string; name: string } | null
  /** id всех домов проекта в MacroCRM. */
  houseExternalIds: number[]
  plan: LeadPlanContext | null
}

export const EMPTY_LEAD_CONTEXT: LeadContextDTO = { complex: null, houseExternalIds: [], plan: null }

/** Сегменты пути страницы: без языка, .html и пустых частей. */
export function pathSegments(path: string): string[] {
  return String(path || '')
    .split(/[?#]/)[0]
    .split('/')
    .map((part) => part.replace(/\.html?$/i, '').trim().toLowerCase())
    .filter(Boolean)
}

/** Проект, чей slug встречается в пути страницы. Несколько — берём самый длинный slug. */
export function complexForPath<T extends { slug: string }>(path: string, complexes: T[]): T | null {
  const segments = new Set(pathSegments(path))
  const matches = complexes.filter((c) => c.slug && segments.has(c.slug.toLowerCase()))
  if (matches.length === 0) return null
  return matches.sort((a, b) => b.slug.length - a.slug.length)[0]
}

function uniqueIds(values: Array<number | null | undefined>): number[] {
  const out: number[] = []
  for (const value of values) {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0 && !out.includes(value)) out.push(value)
  }
  return out.sort((a, b) => a - b)
}

function toNumber(value: string | number | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function range(values: number[]): NumberRange | null {
  const positive = values.filter((v) => v > 0)
  if (positive.length === 0) return null
  return { min: Math.min(...positive), max: Math.max(...positive) }
}

/** Планировка заявки: группа, в которой есть тип `planTypeId`. */
export function buildPlanContext(
  planTypeId: string,
  complex: LeadComplexRow,
  houses: LeadHouseRow[],
  planTypes: PlanTypeRow[],
  apartments: LeadApartmentRow[]
): LeadPlanContext | null {
  if (!planTypeId) return null
  const group = resolvePlanGroups(planTypes, complex.planGrouping).find((g) =>
    g.group.rows.some((row) => row.id === planTypeId)
  )
  if (!group) return null

  const typeIds = new Set(group.group.rows.map((row) => row.id))
  const houseIds = new Set(group.group.rows.map((row) => row.houseId))
  const onSale = apartments.filter(
    (a) => a.planTypeId !== null && typeIds.has(a.planTypeId) && a.status === ON_SALE_STATUS
  )
  const merged = group.merged

  return {
    id: merged.id,
    planName: merged.planName,
    rooms: merged.rooms,
    isStudio: merged.isStudio,
    area: range([toNumber(merged.areaMin), toNumber(merged.areaMax)]),
    price: range(onSale.map((a) => toNumber(a.price))),
    floors: Array.isArray(merged.floors) ? [...merged.floors] : [],
    houseExternalIds: uniqueIds(houses.filter((h) => houseIds.has(h.id)).map((h) => h.externalId)),
    onSaleExternalIds: uniqueIds(onSale.map((a) => a.externalId)),
  }
}

/** Контекст заявки по проекту и (необязательно) карточке планировки. */
export function buildLeadContext(
  complex: LeadComplexRow | null,
  houses: LeadHouseRow[],
  planTypes: PlanTypeRow[],
  apartments: LeadApartmentRow[],
  planTypeId?: string | null
): LeadContextDTO {
  if (!complex) return EMPTY_LEAD_CONTEXT
  const own = houses.filter((h) => h.complexId === complex.id)
  const ownIds = new Set(own.map((h) => h.id))
  const ownPlans = planTypes.filter((p) => ownIds.has(p.houseId))
  const ownApartments = apartments.filter((a) => ownIds.has(a.houseId))
  return {
    complex: { slug: complex.slug, name: complex.name },
    houseExternalIds: uniqueIds(own.map((h) => h.externalId)),
    plan: planTypeId ? buildPlanContext(planTypeId, complex, own, ownPlans, ownApartments) : null,
  }
}
