/**
 * Переотправка заявок с сайта, не дошедших до MacroCRM.
 *
 * Берёт заявки со статусом failed и зависшие pending (старше 5 минут: процесс
 * упал до отправки) и шлёт в CRM то же тело, что было собрано при приёме.
 *
 * Запуск на сервере:
 *   docker compose exec -T backend npx ts-node src/scripts/retry-leads.ts --dry-run
 *   docker compose exec -T backend npx ts-node src/scripts/retry-leads.ts
 *
 * Флаги:
 *   --dry-run      показать, что ушло бы, ничего не отправлять
 *   --limit=<n>    сколько заявок за запуск (по умолчанию 50)
 *
 * ВНИМАНИЕ: если CRM ответила 5xx или не ответила вовсе, заявка могла в ней
 * всё-таки создаться. Перед переотправкой таких (текст ошибки — в выводе
 * --dry-run) стоит проверить CRM по телефону, иначе заявка задвоится.
 */
import 'reflect-metadata'
import { LessThan } from 'typeorm'
import { AppDataSource } from '../config/database'
import { Lead } from '../models/Lead'
import { STALE_PENDING_MS } from '../services/leads/LeadService'
import { createLeadService, macroLeadSender, typeormLeadStore } from '../services/leads/leadDeps'
import { flag, hasFlag } from './migrationIo'

async function main(): Promise<void> {
  const limit = Math.max(1, Number(flag('limit')) || 50)
  await AppDataSource.initialize()
  try {
    const repo = AppDataSource.getRepository(Lead)
    const store = typeormLeadStore(repo)

    if (hasFlag('dry-run')) {
      const unsent = await store.findUnsent(new Date(Date.now() - STALE_PENDING_MS), limit)
      console.log(`Неотправленных заявок: ${unsent.length}`)
      for (const lead of unsent) {
        console.log(
          `  ${lead.createdAt.toISOString()} ${lead.status} ${lead.kind} ${lead.phone} ${lead.pagePath}` +
            ` попыток ${lead.attempts}${lead.error ? ` — ${lead.error}` : ''}`
        )
      }
      const stuck = await repo.count({ where: { status: 'pending', createdAt: LessThan(new Date(Date.now() - STALE_PENDING_MS)) } })
      if (stuck) console.log(`Из них зависших pending: ${stuck}`)
      console.log('--dry-run: ничего не отправлено.')
      return
    }

    if (!macroLeadSender(process.env)) throw new Error('MACRO_TOKEN или MACRO_BASE_URL не заданы — отправлять некуда')
    const service = createLeadService(process.env, (level, message) => console.log(`[${level}] ${message}`))
    const { tried, sent } = await service.retryUnsent(limit)
    console.log(`Переотправлено: ${sent} из ${tried}.`)
  } finally {
    await AppDataSource.destroy()
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
