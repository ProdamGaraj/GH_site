/**
 * Приём заявок с сайта и доставка в MacroCRM.
 *
 * Порядок важен:
 *   1. проверка (ловушка для ботов, телефон, повтор той же заявки — см.
 *      repeatQuery);
 *   2. контекст из каталога (дома проекта, планировка) — сбой не мешает заявке;
 *   3. запись в таблицу leads со статусом pending;
 *   4. ответ браузеру — не дожидаясь CRM (она может отвечать десятки секунд);
 *   5. доставка в CRM: sent или failed с текстом ошибки.
 *
 * Неотправленные (failed и зависшие pending) переотправляет retryUnsent —
 * его зовёт scripts/retry-leads.ts.
 *
 * Зависимости приходят снаружи: в тестах — подделки, в бою — createLeadService().
 */
import type { LeadInput } from '../../schemas/lead.schema'
import type { Lead, LeadKind, LeadStatus } from '../../models/Lead'
import {
  buildMacroLead,
  EMPTY_CONTEXT,
  normalizePhone,
  type LeadContext,
  type LeadCrmConfig,
  type LeadRequestMeta,
} from './leadPayload'

/** Повтор той же заявки (двойной клик, «не отправилось?») в пределах окна — не новая заявка. */
export const DUPLICATE_WINDOW_MS = 2 * 60 * 1000
/**
 * Заявка по той же планировке с того же телефона — повтор целые сутки:
 * второй раз из того же окна её не отправить. Другая планировка (даже очень
 * похожая — у каждой карточки свой id) — новая заявка.
 */
export const PLAN_REPEAT_WINDOW_MS = 24 * 60 * 60 * 1000
/** pending старше этого считается зависшим (процесс умер до отправки). */
export const STALE_PENDING_MS = 5 * 60 * 1000
const MAX_ERROR_LENGTH = 1000

/**
 * Что считать повтором. С `planId` — та же планировка на любой странице
 * (ru/uz/en-версии одной страницы проекта — одна планировка); без него — та же
 * страница.
 */
export interface RepeatQuery {
  phone: string
  kind: LeadKind
  since: Date
  pagePath: string
  planId: string | null
}

export interface LeadStore {
  findRecent(query: RepeatQuery): Promise<Lead | null>
  create(data: Partial<Lead>): Promise<Lead>
  update(id: string, patch: Partial<Lead>): Promise<void>
  /** failed любого возраста и pending старше `stalePendingBefore`, старые первыми. */
  findUnsent(stalePendingBefore: Date, limit: number): Promise<Lead[]>
}

export type ContextLoader = (pagePath: string, planTypeId: string | null) => Promise<LeadContext>
/** Отправка тела в CRM; возвращает ответ CRM. */
export type CrmSender = (payload: Record<string, unknown>) => Promise<unknown>

export interface LeadServiceDeps {
  store: LeadStore
  loadContext: ContextLoader
  /** null — CRM не настроена (нет MACRO_TOKEN): заявки копятся как failed. */
  sendToCrm: CrmSender | null
  config: LeadCrmConfig
  now?: () => Date
  log?: (level: 'info' | 'warn' | 'error', message: string) => void
}

export class LeadValidationError extends Error {
  constructor(readonly field: string, message: string) {
    super(message)
    this.name = 'LeadValidationError'
  }
}

export type SubmitOutcome =
  | { status: 'accepted'; id: string; delivery: Promise<LeadStatus> }
  | { status: 'duplicate'; id: string }
  /** Сработала ловушка: боту отвечаем успехом, ничего не сохраняя. */
  | { status: 'ignored' }

/** id заявки в CRM из ответа: { data: { id } } или { id }. */
export function crmIdOf(response: unknown): string | null {
  const r = response as { id?: unknown; data?: { id?: unknown } } | null
  const id = r?.data?.id ?? r?.id
  return typeof id === 'number' || (typeof id === 'string' && id.trim()) ? String(id) : null
}

function errorText(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err)
  return text.slice(0, MAX_ERROR_LENGTH)
}

export class LeadService {
  private readonly now: () => Date
  private readonly log: NonNullable<LeadServiceDeps['log']>

  constructor(private readonly deps: LeadServiceDeps) {
    this.now = deps.now ?? (() => new Date())
    this.log = deps.log ?? (() => undefined)
  }

  async submit(input: LeadInput, meta: LeadRequestMeta): Promise<SubmitOutcome> {
    if (input.hp) {
      this.log('warn', `Заявка отброшена ловушкой для ботов (ip ${meta.ip ?? '?'})`)
      return { status: 'ignored' }
    }

    const phone = normalizePhone(input.phone)
    if (!phone) throw new LeadValidationError('phone', 'Некорректный номер телефона')

    const pagePath = input.page.path
    const recent = await this.deps.store.findRecent(this.repeatQuery(input, phone))
    if (recent) return { status: 'duplicate', id: recent.id }

    const ctx = await this.context(input)
    const payload = buildMacroLead(input, phone, ctx, meta, this.deps.config)

    const lead = await this.deps.store.create({
      kind: input.kind,
      status: 'pending',
      name: (input.name || '').slice(0, 200),
      phone,
      pagePath: pagePath.slice(0, 500),
      lang: (input.page.lang || '').slice(0, 10),
      input: input as unknown as Record<string, unknown>,
      payload,
      ip: meta.ip ? meta.ip.slice(0, 64) : null,
      userAgent: meta.userAgent ? meta.userAgent.slice(0, 500) : null,
      attempts: 0,
    })

    return { status: 'accepted', id: lead.id, delivery: this.deliver(lead) }
  }

  /** Отправляет заявку в CRM и записывает итог. Не бросает: итог — в базе и в ответе. */
  async deliver(lead: Lead): Promise<LeadStatus> {
    const attempts = (lead.attempts || 0) + 1
    if (!this.deps.sendToCrm) {
      await this.safeUpdate(lead.id, { status: 'failed', attempts, error: 'CRM не настроена: нет MACRO_TOKEN' })
      return 'failed'
    }
    try {
      const response = await this.deps.sendToCrm(lead.payload)
      await this.safeUpdate(lead.id, {
        status: 'sent',
        attempts,
        error: null,
        crmId: crmIdOf(response),
        crmResponse: response ?? null,
        sentAt: this.now(),
      })
      this.log('info', `Заявка ${lead.id} отправлена в CRM`)
      return 'sent'
    } catch (err) {
      this.log('error', `Заявка ${lead.id} не ушла в CRM: ${errorText(err)}`)
      await this.safeUpdate(lead.id, { status: 'failed', attempts, error: errorText(err) })
      return 'failed'
    }
  }

  /** Переотправка неотправленных. Возвращает, сколько заявок пробовали отправить. */
  async retryUnsent(limit = 50): Promise<{ tried: number; sent: number }> {
    const stalePendingBefore = new Date(this.now().getTime() - STALE_PENDING_MS)
    const leads = await this.deps.store.findUnsent(stalePendingBefore, limit)
    let sent = 0
    // По одной: у CRM лимит запросов, а темп держит транспорт.
    for (const lead of leads) {
      if ((await this.deliver(lead)) === 'sent') sent++
    }
    return { tried: leads.length, sent }
  }

  /** Повтор: та же планировка за сутки или та же форма страницы за 2 минуты. */
  private repeatQuery(input: LeadInput, phone: string): RepeatQuery {
    const planId = input.kind === 'plan' ? (input.plan?.id || '').trim() || null : null
    const window = planId ? PLAN_REPEAT_WINDOW_MS : DUPLICATE_WINDOW_MS
    return {
      phone,
      kind: input.kind,
      since: new Date(this.now().getTime() - window),
      pagePath: input.page.path,
      planId,
    }
  }

  private async context(input: LeadInput): Promise<LeadContext> {
    const planTypeId = input.kind === 'plan' ? input.plan?.id || null : null
    try {
      return await this.deps.loadContext(input.page.path, planTypeId)
    } catch (err) {
      // Каталог недоступен — заявка всё равно важнее: уйдёт без интереса к домам.
      this.log('warn', `Контекст заявки не получен (${input.page.path}): ${errorText(err)}`)
      return EMPTY_CONTEXT
    }
  }

  private async safeUpdate(id: string, patch: Partial<Lead>): Promise<void> {
    try {
      await this.deps.store.update(id, patch)
    } catch (err) {
      this.log('error', `Не удалось записать итог заявки ${id}: ${errorText(err)}`)
    }
  }
}
