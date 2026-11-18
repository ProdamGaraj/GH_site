/**
 * Боевые зависимости RequestPipeline: привязки и журнал отправок в базе,
 * расшифровка авторизации источника, реестр коннекторов.
 */
import type { Repository } from 'typeorm'
import { AppDataSource } from '../../config/database'
import { DataBinding } from '../../models/DataBinding'
import { DataSubmission, type SubmissionMethod } from '../../models/DataSubmission'
import { CredentialsManager } from '../CredentialsManager'
import type { AuthConfig } from '../SecureDataSourceService'
import { defaultConnectorRegistry } from './connectors/registry'
import { RequestPipeline, type RequestPipelineDeps, type SubmissionFinish, type SubmissionStart } from './RequestPipeline'

/** IP для журнала без последнего октета (IPv4) / с первыми 4 группами (IPv6). */
export function anonymizeIp(ip: string): string {
  if (!ip) return ''
  if (ip.includes('.')) {
    const parts = ip.split('.')
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0`
  }
  if (ip.includes(':')) return ip.split(':').slice(0, 4).join(':') + '::'
  return ip
}

export function typeormSubmissionLog(
  repo: Repository<DataSubmission>,
): Pick<RequestPipelineDeps, 'startSubmission' | 'finishSubmission'> {
  return {
    startSubmission: async (fields: SubmissionStart) => {
      const row = repo.create({
        dataSourceId: fields.dataSourceId,
        outputBindingId: fields.outputBindingId,
        pageId: fields.pageId,
        blockId: fields.blockId,
        method: fields.method as SubmissionMethod,
        endpoint: fields.endpoint,
        trigger: fields.trigger,
        status: 'pending',
        fieldsCount: fields.fieldNames.length,
        fieldNames: fields.fieldNames,
        anonymizedIp: anonymizeIp(fields.ip),
        userAgent: fields.userAgent.slice(0, 200),
        referrer: fields.referrer?.slice(0, 500),
        sessionId: fields.sessionId?.slice(0, 100),
        isRetry: false,
        attemptNumber: 1,
      })
      const saved = await repo.save(row)
      return saved.id
    },
    finishSubmission: async (id: string, result: SubmissionFinish) => {
      await repo.update(id, {
        status: result.status,
        responseStatusCode: result.responseStatusCode,
        durationMs: result.durationMs,
        errorCode: result.errorCode ?? null,
        errorMessage: result.errorMessage ?? null,
      })
    },
  }
}

export function createRequestPipeline(log?: RequestPipelineDeps['log']): RequestPipeline {
  const bindings = AppDataSource.getRepository(DataBinding)
  return new RequestPipeline({
    loadBinding: (id) => bindings.findOne({ where: { id }, relations: ['dataSource'] }),
    decryptAuth: async (authConfig) =>
      (await CredentialsManager.decryptAuthConfig(authConfig)) as unknown as AuthConfig,
    connectors: defaultConnectorRegistry(),
    ...typeormSubmissionLog(AppDataSource.getRepository(DataSubmission)),
    log,
  })
}
