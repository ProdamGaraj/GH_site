/**
 * Тело заявки для MacroCRM: что и откуда попадает в estateBuy/create.
 *
 * Главные правила: `phone` не шлём никогда (вместе с `phones` — 400), поля
 * без значения в тело не попадают, интерес к недвижимости — из каталога.
 */
import {
  buildJourneyText,
  buildMacroLead,
  buildMessage,
  EMPTY_CONTEXT,
  formatDuration,
  formatNumber,
  formatRange,
  NAMELESS,
  normalizeEmail,
  normalizePhone,
  type LeadContext,
  type LeadCrmConfig,
} from '../services/leads/leadPayload'
import { leadInputSchema, type LeadInput } from '../schemas/lead.schema'

const config: LeadCrmConfig = { action: 'buy', category: 'flat', advertisingChannelId: null }
const meta = { ip: '203.0.113.10', userAgent: 'Mozilla/5.0 Test', domain: 'gh.uz' }

function input(over: Partial<LeadInput> = {}): LeadInput {
  return leadInputSchema.parse({
    kind: 'callback',
    name: 'Иван',
    phone: '+998 90 123 45 67',
    page: { path: '/ru/', title: 'Golden House', lang: 'ru' },
    consent: true,
    ...over,
  })
}

const project: LeadContext = {
  complex: { slug: 'assalom-dostlik', name: "Assalom Do'stlik" },
  houseExternalIds: [11, 12],
  plan: null,
}

const withPlan: LeadContext = {
  ...project,
  plan: {
    id: 'p1',
    planName: '13',
    rooms: 2,
    isStudio: false,
    area: { min: 54.6, max: 56.1 },
    price: { min: 650000000, max: 700000000 },
    floors: [2, 5, 9],
    houseExternalIds: [11],
    onSaleExternalIds: [501],
  },
}

describe('normalizePhone', () => {
  it.each([
    ['+998 (90) 123-45-67', '+998901234567'],
    ['90 123 45 67', '+998901234567'],
    ['00998901234567', '+998901234567'],
    ['+7 (999) 123-45-67', '+79991234567'],
  ])('%s → %s', (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected)
  })

  it.each([['12345'], [''], ['abc'], ['1234567890123456'], [null], [undefined]])('не телефон: %s', (raw) => {
    expect(normalizePhone(raw as string)).toBeNull()
  })
})

describe('normalizeEmail', () => {
  it('принимает адрес и отбрасывает мусор', () => {
    expect(normalizeEmail(' a@b.uz ')).toBe('a@b.uz')
    expect(normalizeEmail('not-an-email')).toBeNull()
    expect(normalizeEmail(undefined)).toBeNull()
  })
})

describe('форматирование для менеджера', () => {
  it('числа с разрядами, диапазоны, длительность', () => {
    expect(formatNumber(650000000)).toBe('650 000 000')
    expect(formatNumber(54.6)).toBe('54.6')
    expect(formatRange({ min: 54.6, max: 54.6 }, 'м²')).toBe('54.6 м²')
    expect(formatRange({ min: 1000, max: 25000 })).toBe('1 000–25 000')
    expect(formatRange(null)).toBe('')
    expect(formatDuration(45)).toBe('45 с')
    expect(formatDuration(180)).toBe('3 мин')
    expect(formatDuration(200)).toBe('3 мин 20 с')
    expect(formatDuration(3900)).toBe('1 ч 5 мин')
    expect(formatDuration(undefined)).toBe('0 с')
  })
})

describe('buildMessage', () => {
  it('обратный звонок: вид заявки, поля формы и вопрос клиента', () => {
    const msg = buildMessage(input({ fields: { object: 'Офис' }, message: 'Есть ли рассрочка?' }), EMPTY_CONTEXT)
    expect(msg).toBe('Обратный звонок\nТип объекта: Офис\nВопрос клиента: Есть ли рассрочка?')
  })

  it('проект: имя проекта из каталога, поле project с тем же именем не дублируется', () => {
    const msg = buildMessage(input({ kind: 'project', fields: { project: "Assalom Do'stlik" } }), project)
    expect(msg).toBe("Заявка со страницы проекта\nПроект: Assalom Do'stlik")
  })

  it('планировка из каталога: площадь, этажи, срок, цены, сколько свободно', () => {
    const msg = buildMessage(
      input({ kind: 'plan', plan: { title: '2-комн. 54.6 м²', deadline: '4 кв. 2026' } }),
      withPlan
    )
    expect(msg.split('\n')).toEqual([
      'Консультация по планировке: 2-комн. 54.6 м²',
      "Проект: Assalom Do'stlik",
      'Планировка в CRM: 13',
      'Площадь: 54.6–56.1 м²',
      'Этажи: 2–9',
      'Срок сдачи: 4 кв. 2026',
      'Цена свободных: 650 000 000–700 000 000 сум',
      'Свободных квартир: 1',
    ])
  })

  it('планировка не найдена в каталоге — по снимку карточки', () => {
    const msg = buildMessage(
      input({ kind: 'plan', plan: { title: 'Студия 24 м²', project: 'Harizma', floors: 'этажи 3–7' } }),
      EMPTY_CONTEXT
    )
    expect(msg).toBe('Консультация по планировке: Студия 24 м²\nПроект: Harizma\nэтажи 3–7')
  })
})

describe('buildJourneyText', () => {
  it('страница, источник, визиты, страницы со временем, планировки, фильтры', () => {
    const text = buildJourneyText(
      input({
        form: 'Обратный звонок',
        utm: { source: 'yandex', medium: 'cpc', campaign: 'spring' },
        filters: { Комнаты: '2, 3', Площадь: 'от 50 до 70' },
        journey: {
          firstSeen: '2026-11-10',
          visits: 3,
          pages: [
            { path: '/ru/', title: 'Главная', seconds: 80 },
            { path: '/ru/complex/assalom-dostlik/', title: "Assalom Do'stlik", seconds: 300 },
          ],
          plans: [{ title: '2-комн. 54.6 м²', project: "Assalom Do'stlik" }],
        },
      })
    )
    expect(text.split('\n')).toEqual([
      'Заявка с сайта: Обратный звонок',
      'Страница: Golden House (/ru/), язык ru',
      'Источник: yandex / cpc / spring',
      'Визитов на сайт: 3, первый — 2026-11-10',
      'Смотрел страницы:',
      '• Главная — 1 мин 20 с',
      "• Assalom Do'stlik — 5 мин",
      'Открывал планировки:',
      "• 2-комн. 54.6 м², Assalom Do'stlik",
      'Фильтры планировок: Комнаты: 2, 3; Площадь: от 50 до 70',
    ])
  })

  it('без меток — переход с внешнего сайта или прямой заход', () => {
    expect(buildJourneyText(input({ journey: { referrer: 'https://www.google.com/search?q=gh' } }))).toContain(
      'Источник: переход с www.google.com'
    )
    expect(buildJourneyText(input({ journey: { visits: 1 } }))).toContain('Источник: прямой заход')
  })

  it('без пути (localStorage недоступен) — только форма и страница', () => {
    expect(buildJourneyText(input())).toBe('Заявка с сайта: Обратный звонок\nСтраница: Golden House (/ru/), язык ru')
  })

  it('длинный путь обрезается до последних 15 страниц', () => {
    const pages = Array.from({ length: 30 }, (_, i) => ({ path: `/p${i}`, title: `P${i}`, seconds: 1 }))
    const text = buildJourneyText(input({ journey: { pages } }))
    expect(text).not.toContain('• P14 —')
    expect(text).toContain('• P15 —')
    expect(text).toContain('• P29 —')
  })
})

describe('buildMacroLead', () => {
  it('обратный звонок: базовые поля, без интереса к недвижимости, без `phone`', () => {
    const body = buildMacroLead(input(), '+998901234567', EMPTY_CONTEXT, meta, config)
    expect(body).toEqual({
      name: 'Иван',
      phones: ['+998901234567'],
      message: 'Обратный звонок',
      text: expect.stringContaining('Заявка с сайта'),
      action: 'buy',
      domain: 'gh.uz',
      is_allow_personal_data: 1,
      is_allow_call: 1,
      utm: {
        channel_medium: 'website',
        channel_type: 'www',
        channel_name: 'gh.uz',
        ip: '203.0.113.10',
        user_agent: 'Mozilla/5.0 Test',
      },
    })
    expect(body).not.toHaveProperty('phone')
    expect(body).not.toHaveProperty('category')
  })

  it('форма проекта: дома проекта и категория', () => {
    const body = buildMacroLead(input({ kind: 'project' }), '+998901234567', project, meta, config)
    expect(body.estate_buy_housesInterest).toEqual([11, 12])
    expect(body.category).toBe('flat')
    expect(body).not.toHaveProperty('estate_rooms')
  })

  it('обратный звонок со страницы проекта — тоже с домами и категорией', () => {
    const body = buildMacroLead(input(), '+998901234567', project, meta, config)
    expect(body.estate_buy_housesInterest).toEqual([11, 12])
    expect(body.category).toBe('flat')
  })

  it('планировка: дома планировки, комнаты, площадь, цена, единственный объект продажи', () => {
    const body = buildMacroLead(input({ kind: 'plan', plan: { id: 'p1' } }), '+998901234567', withPlan, meta, config)
    expect(body).toMatchObject({
      category: 'flat',
      estate_buy_housesInterest: [11],
      estate_rooms: 2,
      estate_roomsTo: 2,
      estate_area_range: { min: 54.6, max: 56.1 },
      estate_price_range: { min: 650000000, max: 700000000 },
      estate_sell_id: 501,
    })
  })

  it('несколько свободных квартир — estate_sell_id не шлём (поле одно)', () => {
    const ctx: LeadContext = { ...withPlan, plan: { ...withPlan.plan!, onSaleExternalIds: [501, 502] } }
    expect(buildMacroLead(input({ kind: 'plan' }), '+998901234567', ctx, meta, config)).not.toHaveProperty('estate_sell_id')
  })

  it('без цены и площади в каталоге — диапазонов нет', () => {
    const ctx: LeadContext = { ...withPlan, plan: { ...withPlan.plan!, area: null, price: null, houseExternalIds: [] } }
    const body = buildMacroLead(input({ kind: 'plan' }), '+998901234567', ctx, meta, config)
    expect(body).not.toHaveProperty('estate_area_range')
    expect(body).not.toHaveProperty('estate_price_range')
    // У планировки домов нет — берутся дома проекта.
    expect(body.estate_buy_housesInterest).toEqual([11, 12])
  })

  it('планировки нет в каталоге — комнаты и площадь по снимку карточки', () => {
    const body = buildMacroLead(
      input({ kind: 'plan', plan: { rooms: 1, areaMin: 34.8, areaMax: 35.1 } }),
      '+998901234567',
      EMPTY_CONTEXT,
      meta,
      config
    )
    expect(body).toMatchObject({ estate_rooms: 1, estate_roomsTo: 1, estate_area_range: { min: 34.8, max: 35.1 } })
    expect(body).not.toHaveProperty('estate_price_range')
    expect(body).not.toHaveProperty('estate_sell_id')
  })

  it('UTM-метки и канал из настроек', () => {
    const body = buildMacroLead(
      input({ utm: { source: 'yandex', medium: 'cpc', campaign: 'spring', content: 'b1', term: 'квартира' } }),
      '+998901234567',
      EMPTY_CONTEXT,
      meta,
      { ...config, advertisingChannelId: 14407 }
    )
    expect(body.advertisingChannelId).toBe(14407)
    expect(body.estate_client_from).toBe(14407)
    expect(body.utm).toMatchObject({
      utm_source: 'yandex',
      utm_medium: 'cpc',
      utm_campaign: 'spring',
      utm_content: 'b1',
      utm_term: 'квартира',
    })
  })

  it('без согласия — флагов is_allow_* нет; без имени — заглушка; почта только валидная', () => {
    const body = buildMacroLead(
      input({ consent: false, name: undefined, email: 'bad' }),
      '+998901234567',
      EMPTY_CONTEXT,
      { domain: '' },
      config
    )
    expect(body.name).toBe(NAMELESS)
    expect(body).not.toHaveProperty('is_allow_personal_data')
    expect(body).not.toHaveProperty('is_allow_call')
    expect(body).not.toHaveProperty('email')
    expect(body).not.toHaveProperty('domain')
    expect(body.utm).toEqual({ channel_medium: 'website', channel_type: 'www' })
    expect(buildMacroLead(input({ email: 'a@b.uz' }), '+998901234567', EMPTY_CONTEXT, meta, config).email).toBe('a@b.uz')
  })

  it('пустые action и category из настроек — полей нет', () => {
    const body = buildMacroLead(input({ kind: 'project' }), '+998901234567', project, meta, { action: '', category: '' })
    expect(body).not.toHaveProperty('action')
    expect(body).not.toHaveProperty('category')
  })
})

describe('leadInputSchema', () => {
  it('отбрасывает лишние поля и обрезает пробелы', () => {
    const parsed = leadInputSchema.parse({
      kind: 'callback',
      phone: ' 901234567 ',
      page: { path: '/' },
      evil: 'x',
    })
    expect(parsed).not.toHaveProperty('evil')
    expect(parsed.phone).toBe('901234567')
  })

  it('отклоняет неизвестный вид, пустой телефон и слишком длинные значения', () => {
    expect(leadInputSchema.safeParse({ kind: 'spam', phone: '1', page: { path: '/' } }).success).toBe(false)
    expect(leadInputSchema.safeParse({ kind: 'callback', phone: '  ', page: { path: '/' } }).success).toBe(false)
    expect(
      leadInputSchema.safeParse({ kind: 'callback', phone: '1', page: { path: '/' }, message: 'x'.repeat(1001) }).success
    ).toBe(false)
    const fields = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`f${i}`, 'v']))
    expect(leadInputSchema.safeParse({ kind: 'callback', phone: '1', page: { path: '/' }, fields }).success).toBe(false)
  })
})
