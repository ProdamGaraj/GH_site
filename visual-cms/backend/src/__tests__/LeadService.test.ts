/**
 * Приём заявки: сначала база, потом CRM; лид не теряется ни при сбое
 * каталога, ни при сбое CRM, повтор той же заявки не плодит дублей.
 */
import {
  LeadService,
  LeadValidationError,
  crmIdOf,
  DUPLICATE_WINDOW_MS,
  PLAN_REPEAT_WINDOW_MS,
  STALE_PENDING_MS,
  type LeadStore,
} from '../services/leads/LeadService'
import { EMPTY_CONTEXT, type LeadContext } from '../services/leads/leadPayload'
import { leadInputSchema, type LeadInput } from '../schemas/lead.schema'
import type { Lead } from '../models/Lead'

const NOW = new Date('2026-11-17T10:00:00Z')

/** Хранилище в памяти с той же семантикой, что у TypeORM-версии. */
function memoryStore() {
  const rows: Lead[] = []
  let seq = 0
  const store: LeadStore = {
    async findRecent({ phone, kind, since, pagePath, planId }) {
      const hits = rows.filter(
        (r) =>
          r.phone === phone &&
          r.kind === kind &&
          r.createdAt >= since &&
          (planId ? (r.input as { plan?: { id?: string } }).plan?.id === planId : r.pagePath === pagePath)
      )
      return hits[hits.length - 1] ?? null
    },
    async create(data) {
      const row = { ...data, id: `lead-${++seq}`, createdAt: new Date(NOW), attempts: data.attempts ?? 0 } as Lead
      rows.push(row)
      return { ...row }
    },
    async update(id, patch) {
      const row = rows.find((r) => r.id === id)
      if (row) Object.assign(row, patch)
    },
    async findUnsent(before, limit) {
      return rows
        .filter((r) => r.status === 'failed' || (r.status === 'pending' && r.createdAt < before))
        .slice(0, limit)
        .map((r) => ({ ...r }))
    },
  }
  return { store, rows }
}

function input(over: Partial<LeadInput> = {}): LeadInput {
  return leadInputSchema.parse({
    kind: 'project',
    name: 'Иван',
    phone: '90 123 45 67',
    page: { path: '/ru/complex/assalom-dostlik/', lang: 'ru' },
    consent: true,
    ...over,
  })
}

const ctx: LeadContext = { complex: { slug: 'assalom-dostlik', name: 'Dostlik' }, houseExternalIds: [11], plan: null }
const meta = { ip: '1.2.3.4', userAgent: 'UA', domain: 'gh.uz' }

function setup(over: Partial<ConstructorParameters<typeof LeadService>[0]> = {}) {
  const { store, rows } = memoryStore()
  const sendToCrm = jest.fn(async () => ({ data: { id: 777 } }))
  const loadContext = jest.fn(async () => ctx)
  const logs: string[] = []
  const service = new LeadService({
    store,
    loadContext,
    sendToCrm,
    config: { action: 'buy', category: 'flat' },
    now: () => new Date(NOW),
    log: (level, message) => logs.push(`${level}: ${message}`),
    ...over,
  })
  return { service, rows, sendToCrm, loadContext, logs }
}

describe('LeadService.submit', () => {
  it('пишет pending, отвечает до CRM, затем sent с id заявки в CRM', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const { service, rows, sendToCrm, loadContext } = setup({
      sendToCrm: jest.fn(async () => {
        await gate
        return { data: { id: 777 } }
      }),
    })

    const outcome = await service.submit(input(), meta)
    expect(outcome.status).toBe('accepted')
    // Ответ уже есть, а CRM ещё не ответила: заявка лежит в базе как pending.
    expect(rows[0]).toMatchObject({ status: 'pending', phone: '+998901234567', kind: 'project', lang: 'ru', ip: '1.2.3.4' })
    expect(rows[0].payload).toMatchObject({ phones: ['+998901234567'], estate_buy_housesInterest: [11] })
    expect(loadContext).toHaveBeenCalledWith('/ru/complex/assalom-dostlik/', null)

    release()
    if (outcome.status !== 'accepted') throw new Error('unreachable')
    await expect(outcome.delivery).resolves.toBe('sent')
    expect(rows[0]).toMatchObject({ status: 'sent', crmId: '777', attempts: 1, error: null, sentAt: NOW })
    expect(sendToCrm).not.toBe(undefined)
  })

  it('планировка: id карточки уходит в каталог', async () => {
    const { service, loadContext } = setup()
    await service.submit(input({ kind: 'plan', plan: { id: 'p1', title: '2-комн.' } }), meta)
    expect(loadContext).toHaveBeenCalledWith('/ru/complex/assalom-dostlik/', 'p1')
  })

  it('ловушка для ботов: успех без записи и без CRM', async () => {
    const { service, rows, sendToCrm, logs } = setup()
    await expect(service.submit(input({ hp: 'http://spam' }), meta)).resolves.toEqual({ status: 'ignored' })
    expect(rows).toHaveLength(0)
    expect(sendToCrm).not.toHaveBeenCalled()
    expect(logs[0]).toContain('ловушкой')
  })

  it('не телефон — LeadValidationError, ничего не записано', async () => {
    const { service, rows } = setup()
    await expect(service.submit(input({ phone: '12-34' }), meta)).rejects.toBeInstanceOf(LeadValidationError)
    expect(rows).toHaveLength(0)
  })

  it('повтор той же заявки в окне — тот же id, без второй записи и отправки', async () => {
    const { service, rows, sendToCrm } = setup()
    const first = await service.submit(input(), meta)
    if (first.status !== 'accepted') throw new Error('unreachable')
    await first.delivery
    const second = await service.submit(input({ phone: '+998 90 123-45-67' }), meta)
    expect(second).toEqual({ status: 'duplicate', id: first.id })
    expect(rows).toHaveLength(1)
    expect(sendToCrm).toHaveBeenCalledTimes(1)
  })

  it('другая форма (вид) или другая страница — новая заявка', async () => {
    const { service, rows } = setup()
    await service.submit(input(), meta)
    await service.submit(input({ kind: 'plan' }), meta)
    await service.submit(input({ page: { path: '/ru/' } }), meta)
    expect(rows).toHaveLength(3)
  })

  it('окно повтора — DUPLICATE_WINDOW_MS', async () => {
    const { service, rows } = setup()
    await service.submit(input(), meta)
    rows[0].createdAt = new Date(NOW.getTime() - DUPLICATE_WINDOW_MS - 1)
    await service.submit(input(), meta)
    expect(rows).toHaveLength(2)
  })

  describe('заявки по планировкам', () => {
    const plan = (id: string, path = '/ru/complex/assalom-dostlik/') =>
      input({ kind: 'plan', plan: { id, title: id }, page: { path, lang: 'ru' } })

    it('другая планировка (даже похожая) — отдельная заявка, обе уходят в CRM', async () => {
      const { service, rows, sendToCrm } = setup()
      const a = await service.submit(plan('1k-38'), meta)
      const b = await service.submit(plan('1k-39'), meta)
      expect([a.status, b.status]).toEqual(['accepted', 'accepted'])
      if (a.status !== 'accepted' || b.status !== 'accepted') throw new Error('unreachable')
      await Promise.all([a.delivery, b.delivery])
      expect(rows).toHaveLength(2)
      expect(sendToCrm).toHaveBeenCalledTimes(2)
    })

    it('та же планировка с того же телефона — повтор целые сутки, на любой языковой версии страницы', async () => {
      const { service, rows } = setup()
      const first = await service.submit(plan('1k-38'), meta)
      if (first.status !== 'accepted') throw new Error('unreachable')
      rows[0].createdAt = new Date(NOW.getTime() - PLAN_REPEAT_WINDOW_MS + 60_000)
      expect(await service.submit(plan('1k-38', '/uz/complex/assalom-dostlik/'), meta)).toEqual({
        status: 'duplicate',
        id: first.id,
      })
      expect(rows).toHaveLength(1)
    })

    it('через сутки ту же планировку можно запросить снова', async () => {
      const { service, rows } = setup()
      await service.submit(plan('1k-38'), meta)
      rows[0].createdAt = new Date(NOW.getTime() - PLAN_REPEAT_WINDOW_MS - 1)
      expect((await service.submit(plan('1k-38'), meta)).status).toBe('accepted')
      expect(rows).toHaveLength(2)
    })

    it('та же планировка с другого телефона — новая заявка', async () => {
      const { service, rows } = setup()
      await service.submit(plan('1k-38'), meta)
      await service.submit(input({ kind: 'plan', plan: { id: '1k-38' }, phone: '+998 91 000 00 00' }), meta)
      expect(rows).toHaveLength(2)
    })

    it('окно без id карточки (старая разметка) — обычное правило: страница и 2 минуты', async () => {
      const { service, rows } = setup()
      await service.submit(input({ kind: 'plan' }), meta)
      expect((await service.submit(input({ kind: 'plan' }), meta)).status).toBe('duplicate')
      rows[0].createdAt = new Date(NOW.getTime() - DUPLICATE_WINDOW_MS - 1)
      expect((await service.submit(input({ kind: 'plan' }), meta)).status).toBe('accepted')
    })
  })

  it('каталог упал — заявка уходит без домов, в логе предупреждение', async () => {
    const { service, rows, logs } = setup({ loadContext: jest.fn(async () => { throw new Error('ECONNREFUSED') }) })
    const outcome = await service.submit(input(), meta)
    expect(outcome.status).toBe('accepted')
    expect(rows[0].payload).not.toHaveProperty('estate_buy_housesInterest')
    expect(logs.some((l) => l.startsWith('warn:') && l.includes('ECONNREFUSED'))).toBe(true)
  })

  it('CRM отказала — failed с текстом ошибки, заявка в базе осталась', async () => {
    const { service, rows } = setup({ sendToCrm: jest.fn(async () => { throw new Error('MacroCRM 400 /estateBuy/create: bad') }) })
    const outcome = await service.submit(input(), meta)
    if (outcome.status !== 'accepted') throw new Error('unreachable')
    await expect(outcome.delivery).resolves.toBe('failed')
    expect(rows[0]).toMatchObject({ status: 'failed', attempts: 1, error: 'MacroCRM 400 /estateBuy/create: bad' })
  })

  it('CRM не настроена — failed с понятной причиной', async () => {
    const { service, rows } = setup({ sendToCrm: null })
    const outcome = await service.submit(input(), meta)
    if (outcome.status !== 'accepted') throw new Error('unreachable')
    await outcome.delivery
    expect(rows[0]).toMatchObject({ status: 'failed', error: expect.stringContaining('MACRO_TOKEN') })
  })

  it('сбой записи итога не роняет доставку', async () => {
    const { service } = setup()
    const brokenStore: LeadStore = {
      findRecent: async () => null,
      create: async (d) => ({ ...d, id: 'x' }) as Lead,
      update: async () => { throw new Error('db down') },
      findUnsent: async () => [],
    }
    const s = new LeadService({ ...(service as any).deps, store: brokenStore })
    const outcome = await s.submit(input(), meta)
    if (outcome.status !== 'accepted') throw new Error('unreachable')
    await expect(outcome.delivery).resolves.toBe('sent')
  })
})

describe('LeadService.retryUnsent', () => {
  it('переотправляет failed и зависшие pending, свежие pending не трогает', async () => {
    const calls: unknown[] = []
    let fail = true
    const { service, rows } = setup({
      sendToCrm: jest.fn(async (payload) => {
        calls.push(payload)
        if (fail) throw new Error('down')
        return { id: 'abc' }
      }),
    })
    const a = await service.submit(input(), meta)
    if (a.status === 'accepted') await a.delivery
    // Зависший pending (процесс умер до отправки) и свежий pending.
    rows.push({ ...rows[0], id: 'stale', status: 'pending', createdAt: new Date(NOW.getTime() - STALE_PENDING_MS - 1) } as Lead)
    rows.push({ ...rows[0], id: 'fresh', status: 'pending', createdAt: new Date(NOW) } as Lead)

    fail = false
    calls.length = 0
    await expect(service.retryUnsent()).resolves.toEqual({ tried: 2, sent: 2 })
    expect(rows.find((r) => r.id === 'lead-1')).toMatchObject({ status: 'sent', attempts: 2, crmId: 'abc' })
    expect(rows.find((r) => r.id === 'stale')).toMatchObject({ status: 'sent' })
    expect(rows.find((r) => r.id === 'fresh')).toMatchObject({ status: 'pending' })
    // Шлётся сохранённое тело, а не собранное заново.
    expect(calls[0]).toEqual(rows[0].payload)
  })
})

describe('crmIdOf', () => {
  it('id из { data: { id } } или { id }', () => {
    expect(crmIdOf({ data: { id: 5 } })).toBe('5')
    expect(crmIdOf({ id: 'a1' })).toBe('a1')
    expect(crmIdOf({ id: '  ' })).toBeNull()
    expect(crmIdOf(null)).toBeNull()
    expect(crmIdOf('ok')).toBeNull()
  })
})

it('EMPTY_CONTEXT — без проекта, домов и планировки', () => {
  expect(EMPTY_CONTEXT).toEqual({ complex: null, houseExternalIds: [], plan: null })
})
