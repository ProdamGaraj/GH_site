/**
 * Боевые зависимости LeadService: база, каталог, CRM, настройки из окружения.
 *
 * Окружение:
 *   MACRO_BASE_URL, MACRO_TOKEN, MACRO_APP_ID — те же, что у синхронизации;
 *   MACRO_LEAD_ACTION      — `action` заявки, по умолчанию buy;
 *   MACRO_LEAD_CATEGORY    — `category` заявок о квартирах, по умолчанию flat;
 *   MACRO_LEAD_CHANNEL_ID  — id рекламного канала «Сайт» в CRM (необязательно);
 *   ESTATE_SERVICE_URL     — каталог, по умолчанию http://estate-service:5100.
 */
import { LessThan, type Repository } from 'typeorm'
import { AppDataSource } from '../../config/database'
import { Lead } from '../../models/Lead'
import { MacroHttp } from '../MacroHttp'
import type { LeadContext, LeadCrmConfig } from './leadPayload'
import { LeadService, type ContextLoader, type CrmSender, type LeadServiceDeps, type LeadStore } from './LeadService'

export const DEFAULT_LEAD_ACTION = 'buy'
export const DEFAULT_LEAD_CATEGORY = 'flat'
export const MACRO_LEAD_PATH = '/estateBuy/create'
/** Каталог отвечает из своей базы за миллисекунды; дольше — не ждём, заявка важнее. */
const CONTEXT_TIMEOUT_MS = 3000

type Env = Record<string, string | undefined>

export function leadCrmConfigFromEnv(env: Env): LeadCrmConfig {
  const channel = Number(env.MACRO_LEAD_CHANNEL_ID)
  return {
    action: (env.MACRO_LEAD_ACTION || '').trim() || DEFAULT_LEAD_ACTION,
    category: (env.MACRO_LEAD_CATEGORY || '').trim() || DEFAULT_LEAD_CATEGORY,
    advertisingChannelId: Number.isInteger(channel) && channel > 0 ? channel : null,
  }
}

export function typeormLeadStore(repo: Repository<Lead>): LeadStore {
  return {
    findRecent: ({ phone, kind, since, pagePath, planId }) => {
      const qb = repo
        .createQueryBuilder('lead')
        .where('lead.phone = :phone', { phone })
        .andWhere('lead.kind = :kind', { kind })
        .andWhere('lead.createdAt >= :since', { since })
      // id планировки лежит в исходной заявке (input.plan.id) — без отдельной колонки.
      if (planId) qb.andWhere(`lead.input -> 'plan' ->> 'id' = :planId`, { planId })
      else qb.andWhere('lead.pagePath = :pagePath', { pagePath })
      return qb.orderBy('lead.createdAt', 'DESC').getOne()
    },
    create: (data) => repo.save(repo.create(data)),
    update: async (id, patch) => {
      await repo.update({ id }, patch as Parameters<typeof repo.update>[1])
    },
    findUnsent: (stalePendingBefore, limit) =>
      repo.find({
        where: [
          { status: 'failed' },
          { status: 'pending', createdAt: LessThan(stalePendingBefore) },
        ],
        order: { createdAt: 'ASC' },
        take: limit,
      }),
  }
}

function isContext(value: unknown): value is LeadContext {
  const v = value as LeadContext | null
  return !!v && Array.isArray(v.houseExternalIds) && 'complex' in v && 'plan' in v
}

export function estateContextLoader(baseUrl: string, fetchImpl: typeof fetch = fetch): ContextLoader {
  const base = baseUrl.replace(/\/+$/, '')
  return async (pagePath, planTypeId) => {
    const params = new URLSearchParams({ path: pagePath })
    if (planTypeId) params.set('planType', planTypeId)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), CONTEXT_TIMEOUT_MS)
    try {
      const res = await fetchImpl(`${base}/api/lead-context?${params}`, { signal: controller.signal })
      if (!res.ok) throw new Error(`estate-service ответил ${res.status}`)
      const json = await res.json()
      if (!isContext(json)) throw new Error('estate-service: неожиданный ответ')
      return json
    } finally {
      clearTimeout(timer)
    }
  }
}

/** Отправка в CRM; null, если токена нет — тогда заявки копятся как failed. */
export function macroLeadSender(env: Env, fetchImpl?: typeof fetch): CrmSender | null {
  const token = (env.MACRO_TOKEN || '').trim()
  const baseUrl = (env.MACRO_BASE_URL || '').trim()
  if (!token || !baseUrl) return null
  const http = new MacroHttp({
    baseUrl,
    token,
    appId: env.MACRO_APP_ID,
    timeoutMs: 20000,
    // Создание заявки: 5xx не повторяем — запись могла создаться (задвоили бы).
    retryServerErrors: false,
    maxRetries: 2,
    retryBackoffMs: 2000,
    fetchImpl,
  })
  return (payload) => http.post<unknown>(MACRO_LEAD_PATH, payload)
}

/** Сервис заявок на боевых зависимостях — для роута и скрипта переотправки. */
export function createLeadService(env: Env, log: LeadServiceDeps['log']): LeadService {
  const sendToCrm = macroLeadSender(env)
  if (!sendToCrm) log?.('warn', 'Заявки с сайта: MACRO_TOKEN/MACRO_BASE_URL не заданы — заявки сохраняются, но в CRM не уходят')
  return new LeadService({
    store: typeormLeadStore(AppDataSource.getRepository(Lead)),
    loadContext: estateContextLoader(env.ESTATE_SERVICE_URL || 'http://estate-service:5100'),
    sendToCrm,
    config: leadCrmConfigFromEnv(env),
    log,
  })
}
