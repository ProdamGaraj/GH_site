/**
 * Предпросмотр склейки планировок для админки.
 *
 * Админка не считает группы сама: она присылает черновик настройки, а сервер
 * прогоняет его через те же `planGroups`/`mergeGroup`, что и витрина. Так
 * в редакторе видно ровно то, что окажется на сайте, и алгоритм живёт в
 * одном месте.
 *
 * Кроме групп отдаются предупреждения о настройке, которая молча не
 * сработает: ручные правки ссылаются на планировки по имени, а имена после
 * пересинка с CRM могут пропасть или совпасть в разных корпусах.
 *
 * Чистый модуль без БД.
 */

import type { PlanTypeRow } from './i18n'
import {
  PlanGroupOverride,
  PlanGroupingConfig,
  isShownPlanType,
  normalizeConfig,
  resolvePlanGroups,
} from './planGrouping'

/** Одна планировка внутри карточки. */
export interface PlanPreview {
  planName: string
  houseId: string
  houseName: string
  areaMin: number
  areaMax: number
  floors: number[]
  entrances: number[]
  apartmentsCount: number
  /** Миниатюра первого чертежа; пусто, если чертежей нет. */
  thumb: string
  /** Полноразмерный первый чертёж — открыть и сравнить. */
  image: string
  imagesCount: number
  /** Отделена вручную (`keepSeparate`). */
  separated: boolean
}

/** Данные карточки, которые можно поправить вручную. */
export interface PlanGroupValues {
  areaMin: number
  areaMax: number
  floors: number[]
  entrances: number[]
}

/** Карточка витрины: то, что покупатель увидит одной плиткой. */
export interface PlanGroupPreview {
  /** Склеена вручную из настройки, а не автоматически по площади. */
  manual: boolean
  rooms: number
  isStudio: boolean
  /** Итоговые значения карточки — с ручной правкой, как на сайте. */
  areaMin: number
  areaMax: number
  floors: number[]
  entrances: number[]
  apartmentsCount: number
  /** Значения из CRM — видно, что именно поправлено. */
  crm: PlanGroupValues
  /** Главная планировка группы: под этим именем сохранится новая правка. */
  anchor: string
  /** Скрыта с сайта. */
  hidden: boolean
  /** Применённая правка и её ключ; null — все данные из CRM. */
  overrideKey: string | null
  override: PlanGroupOverride | null
  /** Правки других планировок группы, которые не применяются. */
  ignoredOverrides: string[]
  plans: PlanPreview[]
}

export interface PlanGroupingPreview {
  /** Настройка после нормализации — то, что реально применилось. */
  config: Required<PlanGroupingConfig>
  typesCount: number
  cardsCount: number
  groups: PlanGroupPreview[]
  warnings: {
    /**
     * Имена, которые встречаются у нескольких типов. Ручная правка по такому
     * имени заденет только первый из них.
     */
    duplicateNames: string[]
    /**
     * Имена из настройки, которых нет среди показываемых типов: планировка
     * распродана или переименована в CRM. Правка по ним ничего не делает.
     */
    unknownNames: string[]
  }
}

function num(value: string | number): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function describePlan(
  row: PlanTypeRow,
  houseNames: ReadonlyMap<string, string>,
  separated: ReadonlySet<string>
): PlanPreview {
  const images = Array.isArray(row.images) ? row.images : []
  const first = images[0]
  return {
    planName: row.planName,
    houseId: row.houseId,
    houseName: houseNames.get(row.houseId) ?? '',
    areaMin: num(row.areaMin),
    areaMax: num(row.areaMax),
    floors: Array.isArray(row.floors) ? row.floors : [],
    entrances: Array.isArray(row.entrances) ? row.entrances : [],
    apartmentsCount: row.apartmentsCount || 0,
    thumb: first?.thumbUrl || first?.url || '',
    image: first?.url || '',
    imagesCount: images.length,
    separated: separated.has(row.planName),
  }
}

function duplicateNames(rows: PlanTypeRow[]): string[] {
  const seen = new Set<string>()
  const dup = new Set<string>()
  for (const row of rows) {
    if (seen.has(row.planName)) dup.add(row.planName)
    seen.add(row.planName)
  }
  return [...dup].sort()
}

function unknownNames(rows: PlanTypeRow[], config: Required<PlanGroupingConfig>): string[] {
  const known = new Set(rows.map((r) => r.planName))
  const referenced = [
    ...config.groups.flatMap((g) => g.plans),
    ...config.keepSeparate,
    ...config.hidden,
    ...Object.keys(config.overrides),
  ]
  return [...new Set(referenced.filter((name) => !known.has(name)))].sort()
}

function values(row: PlanTypeRow): PlanGroupValues {
  return {
    areaMin: num(row.areaMin),
    areaMax: num(row.areaMax),
    floors: Array.isArray(row.floors) ? row.floors : [],
    entrances: Array.isArray(row.entrances) ? row.entrances : [],
  }
}

/**
 * Собирает предпросмотр по всем типам ЖК.
 *
 * `rows` — все типы, в том числе без квартир: фильтр витрины применяется
 * здесь, тем же предикатом, что и на сайте. У распроданного проекта сайт
 * показывает и типы без квартир — предпросмотр тоже (`soldOut`).
 */
export function previewPlanGrouping(
  rows: PlanTypeRow[],
  config: PlanGroupingConfig | null | undefined,
  houseNames: ReadonlyMap<string, string> = new Map(),
  options: { soldOut?: boolean } = {}
): PlanGroupingPreview {
  const shown = options.soldOut ? rows : rows.filter(isShownPlanType)
  const cfg = normalizeConfig(config)
  const separated = new Set(cfg.keepSeparate)

  const groups = resolvePlanGroups(shown, cfg).map((resolved): PlanGroupPreview => {
    const { group, merged } = resolved
    // Внутри карточки — по площади: так соседние варианты стоят рядом и
    // разницу между ними видно сразу.
    const plans = [...group.rows]
      .sort((a, b) => num(a.areaMin) - num(b.areaMin) || a.order - b.order)
      .map((row) => describePlan(row, houseNames, separated))
    return {
      manual: group.manual,
      rooms: merged.rooms,
      isStudio: merged.isStudio,
      ...values(merged),
      apartmentsCount: merged.apartmentsCount || 0,
      crm: values(resolved.crm),
      anchor: resolved.anchor,
      hidden: resolved.hidden,
      overrideKey: resolved.overrideKey,
      override: resolved.override,
      ignoredOverrides: resolved.ignoredOverrides,
      plans,
    }
  })

  return {
    config: cfg,
    typesCount: shown.length,
    cardsCount: groups.length,
    groups,
    warnings: {
      duplicateNames: duplicateNames(shown),
      unknownNames: unknownNames(shown, cfg),
    },
  }
}
