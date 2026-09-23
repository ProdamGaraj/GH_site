/**
 * Предпросмотр склейки типов планировок.
 *
 * Показывает, во что превратится каталог при заданном допуске, НИЧЕГО не
 * меняя. Нужен, потому что подобрать допуск «на глаз» нельзя: у Doʼstlik
 * зеркальные варианты совпадают по площади до сотой, а у ozmakon-business
 * расходятся на десятые, и одно значение на все проекты не подходит.
 *
 * Запуск:
 *   npx ts-node src/scripts/preview-plan-groups.ts --slug=assalom-dostlik
 *   npx ts-node src/scripts/preview-plan-groups.ts --slug=ozmakon-business --tolerance=0.3
 *   npx ts-node src/scripts/preview-plan-groups.ts --slug=ozmakon-business --sweep
 *
 * Флаги:
 *   --slug=<slug>        проект (обязателен)
 *   --tolerance=<м²>     допуск; по умолчанию берётся из настройки ЖК
 *   --sweep              таблица «допуск → сколько карточек» вместо состава
 *   --all                показывать и группы из одной планировки
 *
 * Применить подобранное значение:
 *   PUT /api/admin/complexes/:id  { "planGrouping": { "areaTolerance": 0.3 } }
 */
import 'dotenv/config'
import { AppDataSource } from '../config/database'
import { Complex } from '../models/Complex'
import { PlanType } from '../models/PlanType'
import { House } from '../models/House'
import { In } from 'typeorm'
import { planGroups, normalizeConfig, PlanGroupingConfig } from '../services/planGrouping'
import type { PlanTypeRow } from '../services/i18n'

/** Значения допуска для режима --sweep. */
const SWEEP = [0, 0.05, 0.1, 0.25, 0.5, 1, 2]

function flag(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}

function fmtArea(min: number, max: number): string {
  const a = Number(min).toFixed(2)
  const b = Number(max).toFixed(2)
  return a === b ? `${a}` : `${a}–${b}`
}

function fmtRange(values: number[]): string {
  if (!values.length) return '—'
  const min = Math.min(...values)
  const max = Math.max(...values)
  return min === max ? `${min}` : `${min}–${max}`
}

async function main(): Promise<void> {
  const slug = flag('slug')
  if (!slug) throw new Error('Укажите --slug=<проект>')
  const sweep = process.argv.includes('--sweep')
  const showSingles = process.argv.includes('--all')
  const toleranceArg = flag('tolerance')

  await AppDataSource.initialize()
  try {
    const complex = await AppDataSource.getRepository(Complex).findOne({ where: { slug } })
    if (!complex) throw new Error(`Проект «${slug}» не найден`)

    const houses = await AppDataSource.getRepository(House).find({ where: { complexId: complex.id } })
    const houseIds = houses.map((h) => h.id)
    const rows = houseIds.length
      ? await AppDataSource.getRepository(PlanType).find({
          where: { houseId: In(houseIds) },
          order: { order: 'ASC' },
        })
      : []
    const shown = (rows as unknown as PlanTypeRow[]).filter((p) => p.apartmentsCount > 0)

    const saved = (complex.planGrouping || null) as PlanGroupingConfig | null
    console.log(`Проект: ${complex.name} (${slug})`)
    console.log(`Типов планировок с квартирами: ${shown.length}`)
    console.log(`Настройка в базе: ${saved ? JSON.stringify(saved) : 'нет (только точные совпадения)'}`)

    if (sweep) {
      console.log('\nдопуск, м²   карточек   склеено')
      for (const t of SWEEP) {
        const groups = planGroups(shown, { ...saved, areaTolerance: t })
        console.log(
          `${String(t).padEnd(12)} ${String(groups.length).padEnd(10)} ${shown.length - groups.length}`
        )
      }
      console.log('\nВыберите значение и примените его в planGrouping.areaTolerance.')
      return
    }

    const config: PlanGroupingConfig = toleranceArg
      ? { ...saved, areaTolerance: Number(toleranceArg) }
      : saved || {}
    const cfg = normalizeConfig(config)
    const groups = planGroups(shown, config)

    console.log(`Допуск: ${cfg.areaTolerance} м²`)
    console.log(`Карточек после склейки: ${groups.length} (было ${shown.length})\n`)

    for (const group of groups) {
      if (group.rows.length < 2 && !showSingles) continue
      const areaMin = Math.min(...group.rows.map((r) => Number(r.areaMin)))
      const areaMax = Math.max(...group.rows.map((r) => Number(r.areaMax)))
      const floors = [...new Set(group.rows.flatMap((r) => r.floors || []))]
      const entrances = [...new Set(group.rows.flatMap((r) => r.entrances || []))].sort((a, b) => a - b)
      const apartments = group.rows.reduce((s, r) => s + (r.apartmentsCount || 0), 0)
      const mark = group.manual ? ' [вручную]' : ''
      console.log(
        `${group.rows[0].rooms}-комн. ${fmtArea(areaMin, areaMax)} м²${mark} — ` +
          `квартир ${apartments}, этажи ${fmtRange(floors)}, подъезды ${entrances.join(', ') || '—'}`
      )
      for (const row of group.rows) {
        console.log(
          `    ${row.planName.padEnd(16)} ${fmtArea(Number(row.areaMin), Number(row.areaMax)).padStart(13)} м²  ` +
            `кв ${String(row.apartmentsCount).padStart(2)}  подъезд ${(row.entrances || []).join(',') || '—'}`
        )
      }
    }

    if (!showSingles) console.log('\n(показаны только склеенные группы; --all покажет все)')
  } finally {
    await AppDataSource.destroy()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
