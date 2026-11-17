import { z } from 'zod'

/**
 * Заявка с сайта — то, что присылает браузер (рантайм services/LeadRuntime.ts).
 *
 * Эндпоинт публичный, поэтому каждая строка и каждый список ограничены по
 * длине: схема — первая линия защиты от мусора, а не только от опечаток.
 * Лишние поля отбрасываются (strip), пустые строки считаются отсутствием.
 */

const str = (max: number) => z.string().trim().max(max)
const optStr = (max: number) => str(max).optional()
const count = z.number().int().min(0).max(1_000_000).optional()
const num = z.number().finite().min(0).max(1e12).optional()

export const leadKindSchema = z.enum(['callback', 'project', 'plan'])

const pageSchema = z.object({
  path: str(500),
  title: optStr(300),
  lang: optStr(10),
  referrer: optStr(500),
})

/** Снимок карточки планировки на момент заявки — запасной, если каталог её не нашёл. */
const planSnapshotSchema = z.object({
  id: optStr(64),
  title: optStr(200),
  project: optStr(200),
  floors: optStr(100),
  deadline: optStr(100),
  rooms: count,
  areaMin: num,
  areaMax: num,
})

const journeyPageSchema = z.object({
  path: str(500),
  title: optStr(300),
  seconds: count,
})

const journeyPlanSchema = z.object({
  title: optStr(200),
  project: optStr(200),
})

const journeySchema = z.object({
  firstSeen: optStr(40),
  visits: count,
  referrer: optStr(500),
  pages: z.array(journeyPageSchema).max(30).optional(),
  plans: z.array(journeyPlanSchema).max(20).optional(),
})

const utmSchema = z.object({
  source: optStr(100),
  medium: optStr(100),
  campaign: optStr(200),
  content: optStr(200),
  term: optStr(200),
})

export const leadInputSchema = z.object({
  kind: leadKindSchema,
  name: optStr(100),
  phone: str(40).min(1, 'Укажите телефон'),
  email: optStr(200),
  /** Вопрос клиента (textarea формы контактов). */
  message: optStr(1000),
  /** Прочие поля формы (тип объекта, проект) — имя → значение. */
  fields: z.record(str(200)).refine((r) => Object.keys(r).length <= 10, 'Слишком много полей').optional(),
  /** Название формы для менеджера («Обратный звонок», «Консультация»). */
  form: optStr(100),
  page: pageSchema,
  plan: planSnapshotSchema.optional(),
  /** Фильтры планировок, уже человекочитаемые: «Комнаты» → «2, 3». */
  filters: z.record(str(200)).refine((r) => Object.keys(r).length <= 10, 'Слишком много фильтров').optional(),
  journey: journeySchema.optional(),
  utm: utmSchema.optional(),
  consent: z.boolean().optional(),
  /** Поле-ловушка для ботов: у человека пустое. */
  hp: optStr(200),
})

export type LeadInput = z.infer<typeof leadInputSchema>
