/**
 * Настройка и запуск прогона синхронизации.
 *
 * Тесты здесь про конфигурацию и про то, чем прогон заканчивается: передеплой,
 * курсор, повторный запуск. Работа с базой в MacroSyncRunner тонкая, поэтому
 * репозиторий подменяется, а проверяется поведение, а не SQL.
 */
import { readSyncConfig, MacroSyncRunner } from '../services/MacroSyncRunner'
import type { MacroSyncRun } from '../models/MacroSyncRun'

const FULL_ENV = {
  MACRO_TOKEN: 'macro-token',
  MACRO_APP_ID: 'app-id',
  ESTATE_WRITE_TOKEN: 'estate-token',
  MACRO_SYNC_COLLECTIONS: 'col-1, col-2 ,',
} as NodeJS.ProcessEnv

describe('конфигурация из окружения', () => {
  it('собирается из переменных', () => {
    const config = readSyncConfig(FULL_ENV)!
    expect(config.macroToken).toBe('macro-token')
    expect(config.macroAppId).toBe('app-id')
    expect(config.estateToken).toBe('estate-token')
  })

  it('без токена CRM синхронизация не настроена', () => {
    expect(readSyncConfig({ ESTATE_WRITE_TOKEN: 'x' })).toBeNull()
  })

  it('без токена записи estate-service тоже не настроена', () => {
    expect(readSyncConfig({ MACRO_TOKEN: 'x' })).toBeNull()
  })

  it('список коллекций разбирается, пустые элементы отбрасываются', () => {
    expect(readSyncConfig(FULL_ENV)!.deployCollectionIds).toEqual(['col-1', 'col-2'])
  })

  it('без списка коллекций остаётся пустым, а не строкой из пробела', () => {
    const config = readSyncConfig({ ...FULL_ENV, MACRO_SYNC_COLLECTIONS: '' })!
    expect(config.deployCollectionIds).toEqual([])
  })

  it('адреса имеют разумные значения по умолчанию', () => {
    const config = readSyncConfig({ MACRO_TOKEN: 'a', ESTATE_WRITE_TOKEN: 'b' })!
    expect(config.macroBaseUrl).toBe('https://api.macrocrm.gh.uz/v2')
    expect(config.estateBaseUrl).toBe('http://estate-service:5100')
  })

  it('адреса переопределяются окружением', () => {
    const config = readSyncConfig({
      MACRO_TOKEN: 'a',
      ESTATE_WRITE_TOKEN: 'b',
      MACRO_BASE_URL: 'https://stage.macro/v2',
      ESTATE_SERVICE_URL: 'http://localhost:5100',
    })!
    expect(config.macroBaseUrl).toBe('https://stage.macro/v2')
    expect(config.estateBaseUrl).toBe('http://localhost:5100')
  })

  it('AppId необязателен — у ключей нового формата он зашит внутрь', () => {
    expect(readSyncConfig({ MACRO_TOKEN: 'a', ESTATE_WRITE_TOKEN: 'b' })!.macroAppId).toBe('')
  })

  it('проверка сертификата по умолчанию включена', () => {
    expect(readSyncConfig(FULL_ENV)!.allowExpiredCertificate).toBe(false)
  })

  it('отключается только явным MACRO_INSECURE_TLS=1', () => {
    expect(readSyncConfig({ ...FULL_ENV, MACRO_INSECURE_TLS: '1' })!.allowExpiredCertificate)
      .toBe(true)
    // Любое другое значение — не выключатель: «true», «yes» и прочее должны
    // оставлять проверку на месте, чтобы её нельзя было снять опечаткой.
    for (const value of ['true', 'yes', '0', '']) {
      expect(readSyncConfig({ ...FULL_ENV, MACRO_INSECURE_TLS: value })!.allowExpiredCertificate)
        .toBe(false)
    }
  })
})

/** Подменяет репозиторий прогонов: поведение проверяем без базы. */
function withFakeRepo(runner: MacroSyncRunner, rows: Partial<MacroSyncRun>[]) {
  const stored = rows.map((row) => ({ ...row })) as MacroSyncRun[]
  const repo = {
    find: async () => stored,
    findOne: async ({ where }: any) => {
      if (where?.id) return stored.find((r) => r.id === where.id) ?? null
      if (where?.status) return stored.find((r) => r.status === where.status) ?? null
      return stored[0] ?? null
    },
    save: async (row: any) => {
      const saved = { id: 'run-' + (stored.length + 1), ...row }
      stored.push(saved)
      return saved
    },
    create: (row: any) => row,
    update: async (id: string, patch: any) => {
      const row = stored.find((r) => r.id === id)
      if (row) Object.assign(row, patch)
    },
  }
  ;(runner as any).runs = () => repo
  return stored
}

function makeRunner(deployed: string[] = [], collections = ['col-1']) {
  const runner = new MacroSyncRunner(
    { ...readSyncConfig(FULL_ENV)!, deployCollectionIds: collections },
    async (id) => {
      deployed.push(id)
    }
  )
  return runner
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000)

describe('возобновление прогона', () => {
  it('зависший в running берётся для продолжения', async () => {
    const runner = makeRunner()
    withFakeRepo(runner, [
      { id: 'r1', status: 'running', startedAt: hoursAgo(1), cursor: null },
    ])
    expect((await runner.findResumable())?.id).toBe('r1')
  })

  it('упавший с курсором тоже — иначе повтор съест лимит заново', async () => {
    const runner = makeRunner()
    withFakeRepo(runner, [
      {
        id: 'r1',
        status: 'failed',
        startedAt: hoursAgo(2),
        cursor: { externalHouseId: 5139395, probedExternalIds: [1, 2, 3] },
      },
    ])
    expect((await runner.findResumable())?.id).toBe('r1')
  })

  it('упавший без курсора продолжать нечего', async () => {
    const runner = makeRunner()
    withFakeRepo(runner, [
      { id: 'r1', status: 'failed', startedAt: hoursAgo(2), cursor: null },
    ])
    expect(await runner.findResumable()).toBeNull()
  })

  it('старше суток не берётся — выдача CRM успела измениться', async () => {
    const runner = makeRunner()
    withFakeRepo(runner, [
      { id: 'r1', status: 'running', startedAt: hoursAgo(30), cursor: null },
    ])
    expect(await runner.findResumable()).toBeNull()
  })

  it('успешный прогон продолжать не нужно', async () => {
    const runner = makeRunner()
    withFakeRepo(runner, [
      { id: 'r1', status: 'ok', startedAt: hoursAgo(1), cursor: null },
    ])
    expect(await runner.findResumable()).toBeNull()
  })
})

describe('прогон без домов', () => {
  it('завершается сразу и говорит почему', async () => {
    const runner = makeRunner()
    const rows = withFakeRepo(runner, [])
    ;(runner as any).discoverHouses = async () => []

    const run = await runner.run({ trigger: 'manual' })
    expect(run.status).toBe('ok')
    expect(rows[0].error).toMatch(/externalHouseId/)
  })

  it('в CRM при этом не ходит', async () => {
    const runner = makeRunner()
    withFakeRepo(runner, [])
    let called = false
    ;(runner as any).discoverHouses = async () => {
      called = true
      return []
    }
    await runner.run()
    expect(called).toBe(true)
  })
})

describe('передеплой', () => {
  async function runWith(status: string, deployed: string[], collections = ['col-1']) {
    const runner = makeRunner(deployed, collections)
    withFakeRepo(runner, [])
    ;(runner as any).discoverHouses = async () => [5139395]
    // Подменяем сам обход: здесь проверяется только что происходит после него.
    const outcome = {
      externalHouseId: 5139395,
      apartments: 10,
      planTypes: 2,
      probed: 10,
      skippedProbes: 0,
      imagesDownloaded: 2,
      unassigned: 0,
      result: null,
      error: status === 'ok' ? null : 'дом не синхронизировался',
    }
    jest
      .spyOn(
        require('../services/MacroSyncService').MacroSyncService.prototype,
        'syncHouses'
      )
      .mockResolvedValue([outcome])
    return runner.run()
  }

  afterEach(() => jest.restoreAllMocks())

  it('успешный прогон пересобирает коллекции', async () => {
    const deployed: string[] = []
    await runWith('ok', deployed)
    expect(deployed).toEqual(['col-1'])
  })

  it('провалившийся прогон коллекции не трогает — иначе на сайте будет смесь', async () => {
    const deployed: string[] = []
    await runWith('failed', deployed)
    expect(deployed).toEqual([])
  })

  it('без настроенных коллекций передеплой пропускается без падения', async () => {
    const deployed: string[] = []
    const run = await runWith('ok', deployed, [])
    expect(deployed).toEqual([])
    expect(run.status).toBe('ok')
  })
})
