import {
  DATA_SOURCE_RUNTIME,
  getDataSourceDescriptor,
  isClientRuntimeType,
  resolveLoadStrategy,
} from '../services/dataSourceRuntime'
import { secureDataSourceService, FetchConfig } from '../services/SecureDataSourceService'

describe('dataSourceRuntime descriptor', () => {
  it('помечает 3 целевых типа как доступные и не-техдолг', () => {
    for (const type of ['feed', 'database', 'form-data'] as const) {
      const d = getDataSourceDescriptor(type)
      expect(d.status).not.toBe('techdebt')
      expect(d.availableInBindings).toBe(true)
    }
  })

  it('feed и database исполняются на сервере, form-data — в браузере', () => {
    expect(getDataSourceDescriptor('feed').execution).toBe('server-fetch')
    expect(getDataSourceDescriptor('database').execution).toBe('server-fetch')
    expect(getDataSourceDescriptor('form-data').execution).toBe('client-runtime')
  })

  it('form-data недоступен в коллекциях (server-side генерация), но доступен в привязках', () => {
    const d = getDataSourceDescriptor('form-data')
    expect(d.availableInCollections).toBe(false)
    expect(d.availableInBindings).toBe(true)
  })

  it('помечает нерабочие типы как techdebt', () => {
    for (const type of ['websocket', 'mock', 'rest']) {
      expect(getDataSourceDescriptor(type).status).toBe('techdebt')
    }
  })

  it('external и computed доведены до beta (рабочие)', () => {
    expect(getDataSourceDescriptor('external').status).toBe('beta')
    expect(getDataSourceDescriptor('computed').status).toBe('beta')
  })

  it('неизвестный тип → fail-safe techdebt дескриптор', () => {
    expect(getDataSourceDescriptor('nonexistent-xyz').status).toBe('techdebt')
  })

  it('isClientRuntimeType покрывает form-data и page-variable', () => {
    expect(isClientRuntimeType('form-data')).toBe(true)
    expect(isClientRuntimeType('page-variable')).toBe(true)
    expect(isClientRuntimeType('rest-api')).toBe(false)
    expect(isClientRuntimeType('database')).toBe(false)
  })

  it('каждый тип из реестра имеет согласованный дескриптор', () => {
    for (const [type, d] of Object.entries(DATA_SOURCE_RUNTIME)) {
      expect(['server-fetch', 'client-runtime', 'inline']).toContain(d.execution)
      expect(['stable', 'beta', 'techdebt']).toContain(d.status)
      expect(typeof d.availableInCollections).toBe('boolean')
      expect(typeof d.availableInBindings).toBe('boolean')
      expect(type.length).toBeGreaterThan(0)
    }
  })
})

describe('resolveLoadStrategy (feed polling)', () => {
  it('feed с polling → interval + loadInterval из config', () => {
    const r = resolveLoadStrategy('feed', { pollingEnabled: true, pollingInterval: 120 })
    expect(r).toEqual({ loadStrategy: 'interval', loadInterval: 120 })
  })

  it('feed без polling → pageLoad', () => {
    expect(resolveLoadStrategy('feed', { pollingEnabled: false, pollingInterval: 120 }))
      .toEqual({ loadStrategy: 'pageLoad' })
    expect(resolveLoadStrategy('feed', {})).toEqual({ loadStrategy: 'pageLoad' })
  })

  it('feed с нулевым/некорректным интервалом → pageLoad', () => {
    expect(resolveLoadStrategy('feed', { pollingEnabled: true, pollingInterval: 0 }))
      .toEqual({ loadStrategy: 'pageLoad' })
    expect(resolveLoadStrategy('feed', { pollingEnabled: true }))
      .toEqual({ loadStrategy: 'pageLoad' })
  })

  it('polling только для feed — rest-api игнорирует polling-поля', () => {
    expect(resolveLoadStrategy('rest-api', { pollingEnabled: true, pollingInterval: 60 }))
      .toEqual({ loadStrategy: 'pageLoad' })
  })

  it('фолбэк на колонки сущности, если config пуст', () => {
    const r = resolveLoadStrategy('feed', undefined, { pollingEnabled: true, pollingInterval: 300 })
    expect(r).toEqual({ loadStrategy: 'interval', loadInterval: 300 })
  })

  it('config имеет приоритет над колонками', () => {
    const r = resolveLoadStrategy('feed', { pollingEnabled: true, pollingInterval: 30 }, { pollingEnabled: false, pollingInterval: 999 })
    expect(r).toEqual({ loadStrategy: 'interval', loadInterval: 30 })
  })
})

describe('SecureDataSourceService: client-runtime типы не фетчатся', () => {
  it('form-data возвращает пустой маркер без сети', async () => {
    const config: FetchConfig = { type: 'form-data' }
    const result = await secureDataSourceService.fetchData(config)
    expect(result.success).toBe(true)
    expect(result.data).toEqual([])
    expect(result.metadata?.headers['x-data-source-type']).toBe('form-data')
    expect(result.metadata?.responseTime).toBe(0)
  })

  it('page-variable возвращает пустой маркер без сети', async () => {
    const config: FetchConfig = { type: 'page-variable' }
    const result = await secureDataSourceService.fetchData(config)
    expect(result.success).toBe(true)
    expect(result.data).toEqual([])
    expect(result.metadata?.headers['x-data-source-type']).toBe('page-variable')
  })
})
