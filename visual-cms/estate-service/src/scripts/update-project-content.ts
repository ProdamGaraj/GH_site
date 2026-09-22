/**
 * Заливка текстов проектов из книги в существующие комплексы.
 *
 * Обновляет поля комплекса и его uz-оверлей. НИЧЕГО НЕ УДАЛЯЕТ: дома,
 * квартиры и типы планировок не затрагиваются, строка комплекса не
 * пересоздаётся, поэтому переводы домов и квартир не осиротеют.
 *
 * Этим отличается от `seed:design`, который идемпотентен через удаление
 * комплекса по slug и утащил бы за собой всю синхронизацию с CRM.
 *
 * Запуск:
 *   npx ts-node src/scripts/update-project-content.ts --dry-run
 *   npx ts-node src/scripts/update-project-content.ts --slugs=harizma,ozmahal
 *
 * Флаги:
 *   --dry-run        показать изменения и не писать
 *   --slugs=a,b      только эти слаги (по умолчанию — все из книги)
 *
 * Комплекс, которого нет в базе, пропускается с предупреждением: заводить его
 * должен сид или админка, здесь только тексты.
 */
import 'dotenv/config'
import { In } from 'typeorm'
import { AppDataSource } from '../config/database'
import { runSafeMigrations } from '../migrations/runner'
import { Complex } from '../models/Complex'
import { EstateTranslation } from '../models/EstateTranslation'
import { logger } from '../services/Logger'
import { PROJECT_CONTENT } from './design-projects.content'
import { planComplexUpdate, planTranslationRows, diffTranslations } from './projectContentUpdate'

function flag(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}

/** Короткий вид значения для журнала: абзацы в консоли нечитаемы. */
function brief(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  if (text === undefined) return 'нет'
  return text.length > 70 ? `${text.slice(0, 70)}…` : text
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')
  const only = flag('slugs')
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const slugs = Object.keys(PROJECT_CONTENT).filter((s) => !only || only.includes(s))
  if (only) {
    const unknown = only.filter((s) => !PROJECT_CONTENT[s])
    if (unknown.length) throw new Error(`Нет текстов в книге для: ${unknown.join(', ')}`)
  }

  await AppDataSource.initialize()
  await runSafeMigrations(AppDataSource)
  try {
    const complexRepo = AppDataSource.getRepository(Complex)
    const trRepo = AppDataSource.getRepository(EstateTranslation)

    const complexes = await complexRepo.find({ where: { slug: In(slugs) } })
    const bySlug = new Map(complexes.map((c) => [c.slug, c]))

    for (const slug of slugs) {
      const complex = bySlug.get(slug)
      if (!complex) {
        logger.warn(`  ! ${slug}: комплекса нет в базе — пропущен`)
        continue
      }

      const content = PROJECT_CONTENT[slug]
      const changes = planComplexUpdate(complex as unknown as Record<string, unknown>, content.ru)

      const planned = planTranslationRows(complex.id, 'uz', content.uz)
      const existing = await trRepo.find({
        where: { entityType: 'complex', entityId: complex.id, locale: 'uz' },
      })
      const trChanges = diffTranslations(planned, existing)

      console.log(`\n${slug}: полей ${changes.length}, переводов uz ${trChanges.length}`)
      for (const c of changes) console.log(`  · ${c.field}: ${brief(c.from)} → ${brief(c.to)}`)
      for (const t of trChanges) console.log(`  · uz ${t.field}: ${brief(t.value)}`)

      if (dryRun || (changes.length === 0 && trChanges.length === 0)) continue

      if (changes.length) {
        const patch: Record<string, unknown> = {}
        for (const c of changes) patch[c.field] = c.to
        await complexRepo.update({ id: complex.id }, patch)
      }
      for (const t of trChanges) {
        // Upsert по уникальному индексу (entityType, entityId, locale, field).
        await trRepo.upsert(t, ['entityType', 'entityId', 'locale', 'field'])
      }
    }

    if (dryRun) console.log('\n--dry-run: в базу ничего не записано.')
    else console.log('\nГотово. Нужен передеплой коллекции «Проекты (ЖК)».')
  } finally {
    await AppDataSource.destroy()
  }
}

main().catch((err) => {
  logger.error('update-project-content failed', err instanceof Error ? err : undefined)
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
