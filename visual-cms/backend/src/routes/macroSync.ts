/**
 * API синхронизации с MacroCRM: кнопка и журнал.
 *
 * Запуск не ждёт окончания. Первый обход дома идёт минуты — сотни вызовов
 * getFlatPlans под лимит в 100 запросов в минуту, — и держать всё это время
 * открытым HTTP-соединение значит гарантированно поймать таймаут прокси.
 * Поэтому ответ приходит сразу с id прогона, а ход дела смотрится в журнале.
 */

import { Router, Request, Response } from 'express'
import { asyncHandler } from '../middleware'
import { AppDataSource } from '../config/database'
import { MacroSyncRun } from '../models/MacroSyncRun'
import { MacroSyncRunner, readSyncConfig } from '../services/MacroSyncRunner'
import { deployService } from '../services/DeployService'
import { logger } from '../services/Logger'

const router = Router()

function runsRepo() {
  return AppDataSource.getRepository(MacroSyncRun)
}

function makeRunner(): MacroSyncRunner | null {
  const config = readSyncConfig()
  if (!config) return null
  return new MacroSyncRunner(config, (collectionId) =>
    deployService.deployCollection(collectionId)
  )
}

/**
 * GET /api/macro-sync/status — последние прогоны и что можно продолжить.
 */
router.get(
  '/status',
  asyncHandler(async (_req: Request, res: Response) => {
    const runner = makeRunner()
    const runs = await runsRepo().find({ order: { startedAt: 'DESC' }, take: 20 })

    res.json({
      configured: runner !== null,
      // Без токенов кнопка не должна выглядеть рабочей.
      missing: runner
        ? []
        : ['MACRO_TOKEN', 'ESTATE_WRITE_TOKEN'].filter((name) => !process.env[name]),
      running: runs.some((run) => run.status === 'running'),
      resumable: runner ? ((await runner.findResumable())?.id ?? null) : null,
      runs,
    })
  })
)

/**
 * POST /api/macro-sync/run — запустить прогон.
 *
 * body: { externalHouseIds?: number[], resume?: boolean, wait?: boolean }
 */
router.post(
  '/run',
  asyncHandler(async (req: Request, res: Response) => {
    const runner = makeRunner()
    if (!runner) {
      res.status(503).json({
        error: 'Синхронизация не настроена: нужны MACRO_TOKEN и ESTATE_WRITE_TOKEN',
      })
      return
    }

    // Два одновременных прогона поделили бы лимит в 100 запросов в минуту
    // пополам и оба упёрлись бы в 429.
    const active = await runsRepo().findOne({ where: { status: 'running' } })
    if (active) {
      res.status(409).json({ error: 'Прогон уже идёт', runId: active.id })
      return
    }

    const resume = req.body?.resume === true ? await runner.findResumable() : null
    const options = {
      trigger: typeof req.body?.trigger === 'string' ? req.body.trigger : 'manual',
      externalHouseIds: Array.isArray(req.body?.externalHouseIds)
        ? req.body.externalHouseIds.filter((id: unknown) => Number.isInteger(id))
        : undefined,
      resumeRunId: resume?.id,
    }

    if (req.body?.wait === true) {
      res.json(await runner.run(options))
      return
    }

    // Прогон живёт дольше запроса: отвечаем сразу, ошибки уходят в журнал.
    void runner.run(options).catch((err) => {
      logger.error(`Фоновый прогон синхронизации упал: ${String(err)}`)
    })
    res.status(202).json({ started: true, resumedFrom: resume?.id ?? null })
  })
)

/**
 * GET /api/macro-sync/runs/:id — один прогон.
 */
router.get(
  '/runs/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const run = await runsRepo().findOne({ where: { id: req.params.id } })
    if (!run) {
      res.status(404).json({ error: 'Прогон не найден' })
      return
    }
    res.json(run)
  })
)

export default router
