/**
 * Единый реестр поведения типов DataSource (источник правды для бэкенда).
 *
 * До этого тип источника жил в трёх несогласованных местах (frontend union,
 * Zod-enum, FetchConfig union), и тип, заявленный в UI, мог молча падать на
 * бэкенде. Этот дескриптор описывает, КАК и ГДЕ исполняется каждый тип, и
 * используется для маршрутизации запросов и для UI-доступности.
 *
 * execution:
 *  - 'server-fetch'   — данные получает бэкенд (HTTP, GraphQL, SQL).
 *  - 'client-runtime' — данные резолвятся в браузере посетителя (form-data,
 *                       page-variable). Бэкенд возвращает пустой маркер.
 *  - 'inline'         — данные лежат прямо в config (static) и не требуют сети.
 *
 * status:
 *  - 'stable' / 'beta' — тип можно создавать и использовать.
 *  - 'techdebt'        — тип объявлен, но не доведён до рабочего состояния;
 *                        в UI он заблокирован с пометкой «в разработке».
 */

export type DataSourceExecution = 'server-fetch' | 'client-runtime' | 'inline'
export type DataSourceStability = 'stable' | 'beta' | 'techdebt'

export interface DataSourceRuntimeDescriptor {
  execution: DataSourceExecution
  availableInCollections: boolean
  availableInBindings: boolean
  status: DataSourceStability
}

export const DATA_SOURCE_RUNTIME: Record<string, DataSourceRuntimeDescriptor> = {
  // === Рабочие типы ===
  'rest-api': { execution: 'server-fetch', availableInCollections: true, availableInBindings: true, status: 'stable' },
  'feed': { execution: 'server-fetch', availableInCollections: true, availableInBindings: true, status: 'stable' },
  'static': { execution: 'inline', availableInCollections: true, availableInBindings: true, status: 'stable' },
  'graphql': { execution: 'server-fetch', availableInCollections: true, availableInBindings: true, status: 'stable' },
  'database': { execution: 'server-fetch', availableInCollections: true, availableInBindings: true, status: 'beta' },
  'form-data': { execution: 'client-runtime', availableInCollections: false, availableInBindings: true, status: 'beta' },
  // Создаётся не визардом, а через page-variables, но фетчится по той же client-runtime модели.
  'page-variable': { execution: 'client-runtime', availableInCollections: false, availableInBindings: true, status: 'stable' },

  // === Рабочие типы (продолжение) ===
  'external': { execution: 'server-fetch', availableInCollections: true, availableInBindings: true, status: 'beta' },
  'computed': { execution: 'server-fetch', availableInCollections: true, availableInBindings: true, status: 'beta' },

  // === Техдолг: объявлены, но не доведены до рабочего состояния ===
  'websocket': { execution: 'server-fetch', availableInCollections: false, availableInBindings: true, status: 'techdebt' },
  'mock': { execution: 'inline', availableInCollections: true, availableInBindings: true, status: 'techdebt' },
  'rest': { execution: 'server-fetch', availableInCollections: true, availableInBindings: true, status: 'techdebt' },
}

/**
 * Дескриптор по умолчанию для неизвестного типа — fail-safe (server-fetch, techdebt).
 */
const DEFAULT_DESCRIPTOR: DataSourceRuntimeDescriptor = {
  execution: 'server-fetch',
  availableInCollections: true,
  availableInBindings: true,
  status: 'techdebt',
}

export function getDataSourceDescriptor(type: string): DataSourceRuntimeDescriptor {
  return DATA_SOURCE_RUNTIME[type] ?? DEFAULT_DESCRIPTOR
}

/**
 * Тип резолвится в браузере (form-data, page-variable) — бэкенд не фетчит его,
 * а возвращает пустой маркер, чтобы preview/редактор не падали.
 */
export function isClientRuntimeType(type: string): boolean {
  return getDataSourceDescriptor(type).execution === 'client-runtime'
}

export interface LoadStrategyResolution {
  loadStrategy: 'pageLoad' | 'interval'
  loadInterval?: number
}

/**
 * Определяет стратегию загрузки источника на опубликованной странице.
 * Feed с включённым polling и положительным интервалом → клиентский авто-refresh
 * ('interval'); остальные → разовая загрузка при открытии страницы ('pageLoad').
 *
 * Значения берутся из config (его пишет визард), с фолбэком на колонки сущности.
 */
export function resolveLoadStrategy(
  type: string,
  config?: Record<string, unknown>,
  columns?: { pollingEnabled?: boolean; pollingInterval?: number }
): LoadStrategyResolution {
  const pollingEnabled = (config?.pollingEnabled ?? columns?.pollingEnabled) as boolean | undefined
  const pollingInterval = (config?.pollingInterval ?? columns?.pollingInterval) as number | undefined
  if (type === 'feed' && pollingEnabled && typeof pollingInterval === 'number' && pollingInterval > 0) {
    return { loadStrategy: 'interval', loadInterval: pollingInterval }
  }
  return { loadStrategy: 'pageLoad' }
}
