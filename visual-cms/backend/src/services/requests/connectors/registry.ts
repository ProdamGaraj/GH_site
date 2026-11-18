/**
 * Реестр коннекторов: тип источника → коннектор. Новый тип связи (GraphQL,
 * SQL, …) = новый коннектор в этом списке; конвейер не меняется.
 */
import { secureDataSourceService } from '../../SecureDataSourceService'
import { createRestConnector } from './rest'
import type { Connector } from './types'

export class ConnectorRegistry {
  private readonly byType = new Map<string, Connector>()

  constructor(connectors: Connector[]) {
    for (const connector of connectors) {
      for (const type of connector.sourceTypes) this.byType.set(type, connector)
    }
  }

  /** Коннектор для типа источника; null — отправка для этого типа не поддерживается. */
  forSourceType(type: string): Connector | null {
    return this.byType.get(type) ?? null
  }

  sourceTypes(): string[] {
    return [...this.byType.keys()]
  }
}

/** Боевой реестр. Без повторов внутри клиента: повтор решает конвейер (и позже очередь). */
export function defaultConnectorRegistry(): ConnectorRegistry {
  return new ConnectorRegistry([
    createRestConnector((config, auth) => secureDataSourceService.fetchData(config, auth, { enabled: false })),
  ])
}
