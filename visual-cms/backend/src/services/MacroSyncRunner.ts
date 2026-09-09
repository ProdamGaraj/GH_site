/**
 * Запуск синхронизации с MacroCRM: журнал, возобновление, передеплой.
 *
 * Оркестратор (MacroSyncService) умеет обойти дома и выгрузить данные, но не
 * знает ни про базу CMS, ни про то, что после успешного прогона страницы надо
 * пересобрать. Это знание здесь.
 *
 * Про передеплой отдельно. Страницы проектов статические, собираются на
 * деплое коллекции. Синк без передеплоя обновит базу, а на сайте останется
 * прошлая выдача — ловушка, в которую попадаешь на второй день: «синк
 * отработал, а на сайте старое». Поэтому успешный прогон заканчивается
 * вызовом deployCollection.
 */

import { AppDataSource } from '../config/database'
import { MacroSyncRun, type MacroSyncCursor } from '../models/MacroSyncRun'
import { MacroSellClient } from './MacroSellClient'
import { MacroHttp } from './MacroHttp'
import { EstateSyncApi } from './EstateSyncApi'
import { PlanImageImporter } from './PlanImageImporter'
import { MacroSyncService, summarizeRun, type HouseSyncOutcome } from './MacroSyncService'
import { logger } from './Logger'

export interface MacroSyncConfig {
  macroBaseUrl: string
  macroToken: string
  macroAppId: string
  estateBaseUrl: string
  estateToken: string
  /** Коллекции, которые пересобрать после успешного прогона. */
  deployCollectionIds: string[]
  /** Куда складывать картинки планировок в медиатеке. */
  mediaSiteId?: string | null
  mediaFolderId?: string | null
}

export interface StartOptions {
  /** manual — кнопка, schedule — расписание. */
  trigger?: string
  /** Дома, которые синхронизировать. По умолчанию — все сопоставленные с CRM. */
  externalHouseIds?: number[]
  /** Продолжить прерванный прогон вместо нового. */
  resumeRunId?: string
}

/** Как часто курсор сбрасывается в базу: каждые N опрошенных квартир. */
const CURSOR_FLUSH_EVERY = 10

/** Насколько старый прогон ещё имеет смысл продолжать. */
const RESUMABLE_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Читает конфигурацию из окружения.
 *
 * Токен MacroCRM и токен записи estate-service — секреты, и место им в env,
 * а не в теле запроса: иначе они лягут в лог доступа и в историю браузера.
 */
export function readSyncConfig(env: NodeJS.ProcessEnv = process.env): MacroSyncConfig | null {
  const macroToken = env.MACRO_TOKEN ?? ''
  const estateToken = env.ESTATE_WRITE_TOKEN ?? ''
  if (!macroToken || !estateToken) return null

  return {
    macroBaseUrl: env.MACRO_BASE_URL || 'https://api.macrocrm.gh.uz/v2',
    macroToken,
    macroAppId: env.MACRO_APP_ID ?? '',
    estateBaseUrl: env.ESTATE_SERVICE_URL || 'http://estate-service:5100',
    estateToken,
    deployCollectionIds: (env.MACRO_SYNC_COLLECTIONS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
    mediaSiteId: env.MACRO_SYNC_MEDIA_SITE_ID || null,
    mediaFolderId: env.MACRO_SYNC_MEDIA_FOLDER_ID || null,
  }
}

/** Развёртывание коллекции. Передаётся снаружи, чтобы не тянуть DeployService в тесты. */
export type DeployCollection = (collectionId: string) => Promise<unknown>

export class MacroSyncRunner {
  constructor(
    private readonly config: MacroSyncConfig,
    private readonly deployCollection?: DeployCollection
  ) {}

  private runs() {
    return AppDataSource.getRepository(MacroSyncRun)
  }

  /**
   * Прогон, который имеет смысл продолжить.
   *
   * Это либо зависший в running — так выглядит рестарт контейнера на середине
   * обхода, — либо упавший, но успевший что-то опросить. Курсор в обоих случаях
   * единственное, что отделяет продолжение от повторного расхода лимита.
   *
   * Старше суток не берём: за это время выдача CRM успевает измениться
   * настолько, что продолжать по старому курсору бессмысленно.
   */
  async findResumable(now: Date = new Date()): Promise<MacroSyncRun | null> {
    const since = new Date(now.getTime() - RESUMABLE_WINDOW_MS)
    const candidates = await this.runs().find({
      where: [{ status: 'running' }, { status: 'failed' }, { status: 'partial' }],
      order: { startedAt: 'DESC' },
      take: 10,
    })
    return (
      candidates.find(
        (run) =>
          run.startedAt >= since &&
          (run.status === 'running' || (run.cursor?.probedExternalIds?.length ?? 0) > 0)
      ) ?? null
    )
  }

  /**
   * Запускает прогон и дожидается конца.
   *
   * Ждать здесь, а не отвечать сразу, сознательно: полный первый обход идёт
   * минуты, и HTTP-обёртка сама решает, ждать ли её. Кнопка в интерфейсе
   * запускает без ожидания, скрипт — с ожиданием.
   */
  async run(options: StartOptions = {}): Promise<MacroSyncRun> {
    const resumed = options.resumeRunId
      ? await this.runs().findOne({ where: { id: options.resumeRunId } })
      : null

    const houseIds = options.externalHouseIds?.length
      ? options.externalHouseIds
      : resumed?.houseIds?.length
        ? resumed.houseIds
        : await this.discoverHouses()

    const run =
      resumed ??
      (await this.runs().save(
        this.runs().create({
          houseIds,
          status: 'running',
          trigger: options.trigger ?? 'manual',
          cursor: null,
        })
      ))

    if (houseIds.length === 0) {
      return this.finish(run, {
        status: 'ok',
        apartmentsSeen: 0,
        plansProbed: 0,
        planTypesUpserted: 0,
        imagesDownloaded: 0,
        error: 'Ни одного проекта с заполненным externalHouseId — синхронизировать нечего',
      })
    }

    const alreadyProbed = new Set(resumed?.cursor?.probedExternalIds ?? [])
    const probedThisRun: number[] = [...alreadyProbed]

    const http = new MacroHttp({
      baseUrl: this.config.macroBaseUrl,
      token: this.config.macroToken,
      appId: this.config.macroAppId,
    })
    const service = new MacroSyncService({
      client: new MacroSellClient(http),
      estate: this.estateApi(),
      importer: new PlanImageImporter({
        siteId: this.config.mediaSiteId,
        folderId: this.config.mediaFolderId,
      }),
      alreadyProbed,
      onProbe: async (externalId) => {
        probedThisRun.push(externalId)
        if (probedThisRun.length % CURSOR_FLUSH_EVERY === 0) {
          await this.saveCursor(run.id, {
            externalHouseId: houseIds[0],
            probedExternalIds: probedThisRun,
          })
        }
      },
    })

    let outcomes: HouseSyncOutcome[]
    try {
      outcomes = await service.syncHouses(houseIds)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`Прогон синхронизации упал: ${message}`)
      return this.finish(run, {
        status: 'failed',
        apartmentsSeen: 0,
        plansProbed: probedThisRun.length,
        planTypesUpserted: 0,
        imagesDownloaded: 0,
        error: message,
      })
    }

    const summary = summarizeRun(outcomes)
    const finished = await this.finish(run, summary, http.calls)

    // Передеплой только на полностью успешном прогоне: собрать страницы из
    // наполовину обновлённых данных — значит показать посетителю смесь.
    if (summary.status === 'ok') await this.redeploy()

    return finished
  }

  private estateApi(): EstateSyncApi {
    return new EstateSyncApi({
      baseUrl: this.config.estateBaseUrl,
      token: this.config.estateToken,
    })
  }

  /** Дома берём из estate-service: синхронизируем только сопоставленные с CRM. */
  private async discoverHouses(): Promise<number[]> {
    const complexes = await this.estateApi().listSyncableComplexes()
    return complexes
      .map((complex) => complex.externalHouseId)
      .filter((id): id is number => id !== null)
  }

  private async saveCursor(runId: string, cursor: MacroSyncCursor): Promise<void> {
    await this.runs().update(runId, { cursor })
  }

  private async finish(
    run: MacroSyncRun,
    summary: {
      status: string
      apartmentsSeen: number
      plansProbed: number
      planTypesUpserted: number
      imagesDownloaded: number
      error: string | null
    },
    apiCalls = 0
  ): Promise<MacroSyncRun> {
    await this.runs().update(run.id, {
      status: summary.status as MacroSyncRun['status'],
      apartmentsSeen: summary.apartmentsSeen,
      plansProbed: summary.plansProbed,
      planTypesUpserted: summary.planTypesUpserted,
      imagesDownloaded: summary.imagesDownloaded,
      apiCalls,
      error: summary.error,
      finishedAt: new Date(),
      // На успешном прогоне курсор снимаем — продолжать нечего. На упавшем
      // оставляем: повторный запуск продолжит обход, а не съест лимит заново.
      ...(summary.status === 'ok' ? { cursor: null } : {}),
    })
    logger.info('Прогон синхронизации завершён', {
      runId: run.id,
      status: summary.status,
      apartments: summary.apartmentsSeen,
      probed: summary.plansProbed,
      apiCalls,
    })
    return (await this.runs().findOne({ where: { id: run.id } })) ?? run
  }

  private async redeploy(): Promise<void> {
    if (!this.deployCollection || this.config.deployCollectionIds.length === 0) {
      logger.warn(
        'Передеплой пропущен: не задан MACRO_SYNC_COLLECTIONS. ' +
          'База обновлена, но страницы останутся прежними до ручной публикации.'
      )
      return
    }
    for (const collectionId of this.config.deployCollectionIds) {
      try {
        await this.deployCollection(collectionId)
        logger.info(`Коллекция ${collectionId} пересобрана после синхронизации`)
      } catch (err) {
        // Данные уже записаны, поэтому сбой публикации — не повод считать
        // прогон провалившимся: страницы соберутся следующей публикацией.
        logger.error(`Передеплой коллекции ${collectionId} не удался: ${String(err)}`)
      }
    }
  }
}
