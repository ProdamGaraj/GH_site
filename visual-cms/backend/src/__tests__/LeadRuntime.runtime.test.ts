/**
 * @jest-environment jsdom
 *
 * Рантайм заявок в браузере: какие формы считаются заявками, что уходит в
 * POST /api/leads, путь клиента по сайту и поведение при ошибках и в превью.
 */
import { CONTACT_KEY, generateLeadRuntime, JOURNEY_KEY, leadLabels } from '../services/LeadRuntime'

type FetchMock = jest.Mock<Promise<{ ok: boolean; status: number }>, [string, RequestInit]>

let fetchMock: FetchMock

function run(lang = 'ru', live = true): void {
  const out = generateLeadRuntime(lang, live)
  const script = out.slice(out.indexOf('<script>') + 8, out.lastIndexOf('</script>'))
  // eslint-disable-next-line no-new-func
  new Function(script)()
}

function mount(body: string, { lang = 'ru', live = true } = {}): void {
  document.documentElement.setAttribute('lang', lang)
  document.body.innerHTML = body
  run(lang, live)
}

/** Дать отработать цепочке промисов fetch → then. */
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

function sent(): Record<string, any> {
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/leads')
  expect(init.method).toBe('POST')
  return JSON.parse(String(init.body))
}

const statusOf = (form: Element) => (form.querySelector('.gh-lead-status') as HTMLElement).textContent
const journey = () => JSON.parse(localStorage.getItem(JOURNEY_KEY) || '{}')

const CALLBACK = `
  <form class="lead-form">
    <input name="name" type="text">
    <input name="phone" type="tel">
    <button type="submit" class="submit">Получить консультацию</button>
  </form>`

function fill(form: HTMLFormElement, values: Record<string, string>): void {
  for (const [name, value] of Object.entries(values)) {
    ;(form.querySelector(`[name="${name}"]`) as HTMLInputElement).value = value
  }
}

function click(el: Element): MouseEvent {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true })
  el.dispatchEvent(event)
  return event
}

/**
 * Обработчики, повешенные рантаймом на document/window. На странице рантайм
 * один, а в тестах его запускают заново — без снятия старые экземпляры
 * ловили бы клики следующих тестов.
 */
const added: Array<[EventTarget, string, EventListenerOrEventListenerObject, unknown]> = []
const originalAdd = EventTarget.prototype.addEventListener

beforeAll(() => {
  EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, listener: any, options?: any) {
    if (this === document || this === window) added.push([this, type, listener, options])
    return originalAdd.call(this, type, listener, options)
  }
})

afterAll(() => {
  EventTarget.prototype.addEventListener = originalAdd
})

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date('2026-11-17T10:00:00Z'))
  localStorage.clear()
  delete (window as any).__ghLeads
  delete (window as any).ghPlanModal
  ;(window as any).dataLayer = []
  fetchMock = jest.fn(async (_url: string, _init: RequestInit) => ({ ok: true, status: 201 })) as FetchMock
  ;(window as any).fetch = fetchMock
  window.history.replaceState({}, '', '/ru/')
})

afterEach(() => {
  jest.useRealTimers()
  document.body.innerHTML = ''
  for (const [target, type, listener, options] of added.splice(0)) {
    target.removeEventListener(type, listener, options as boolean | EventListenerOptions | undefined)
  }
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
})

describe('оформление форм', () => {
  it('в конце формы с телефоном — статус и согласие (внутри формы: сетка секции цела), ловушка', () => {
    mount(CALLBACK)
    const form = document.querySelector('form')!
    const tail = Array.from(form.children).slice(-2)
    expect(tail[0].className).toContain('gh-lead-status')
    expect(tail[1].textContent).toBe(leadLabels('ru').consent)
    expect(form.nextElementSibling).toBeNull()
    const hp = form.querySelector('input[name="website"]') as HTMLInputElement
    expect(hp.tabIndex).toBe(-1)
    expect(hp.className).toBe('gh-lead-hp')
  })

  it('согласие на языке страницы', () => {
    mount(CALLBACK, { lang: 'uz' })
    expect(document.querySelector('.gh-lead-consent')!.textContent).toContain('rozilik')
    document.body.innerHTML = ''
    delete (window as any).__ghLeads
    mount(CALLBACK, { lang: 'en' })
    expect(document.querySelector('.gh-lead-consent')!.textContent).toContain('you agree')
  })

  it('форма без телефона (калькулятор ипотеки) — не заявка: не трогаем и не отправляем', () => {
    mount('<form><input placeholder="Стоимость"><button type="button" class="submit">Рассчитать</button></form>')
    expect(document.querySelector('.gh-lead-consent')).toBeNull()
    const event = click(document.querySelector('button')!)
    expect(event.defaultPrevented).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('форму, дорисованную скриптом, оформляет при первом фокусе', () => {
    mount('<main></main>')
    document.body.insertAdjacentHTML('beforeend', CALLBACK)
    const phone = document.querySelector('input[name="phone"]') as HTMLInputElement
    phone.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(document.querySelectorAll('.gh-lead-consent')).toHaveLength(1)
    phone.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(document.querySelectorAll('.gh-lead-consent')).toHaveLength(1)
  })

  it('повторный запуск скрипта не дублирует обработчики и строки', () => {
    mount(CALLBACK)
    run()
    expect(document.querySelectorAll('.gh-lead-consent')).toHaveLength(1)
    const form = document.querySelector('form')!
    fill(form, { phone: '901234567' })
    click(form.querySelector('button')!)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('отправка', () => {
  it('обратный звонок: вид, форма, страница, согласие; кнопка и статус', async () => {
    document.title = 'Golden House'
    mount(CALLBACK)
    const form = document.querySelector('form')!
    fill(form, { name: 'Иван', phone: '+998 90 123 45 67' })
    const event = click(form.querySelector('button')!)
    expect(event.defaultPrevented).toBe(true)

    const body = sent()
    expect(body).toMatchObject({
      kind: 'callback',
      name: 'Иван',
      phone: '+998 90 123 45 67',
      form: 'Обратный звонок',
      page: { path: '/ru/', title: 'Golden House', lang: 'ru' },
      consent: true,
      hp: '',
    })
    expect(body).not.toHaveProperty('email')
    expect(body).not.toHaveProperty('plan')
    expect(form.querySelector('button')!.textContent).toBe(leadLabels('ru').sending)

    await flush()
    expect(form.querySelector('button.submit')!.textContent).toBe('Заявка отправлена')
    expect((form.querySelector('button.submit') as HTMLButtonElement).disabled).toBe(true)
    expect(statusOf(form)).toBe(leadLabels('ru').thanks)
    // Форма сброшена, номер вернулся из памяти — скрытым, за маской.
    const phone = form.querySelector('[name="phone"]') as HTMLInputElement
    expect(phone.value).toBe('+998 90 123 45 67')
    expect(phone.classList.contains('gh-lead-field-hidden')).toBe(true)
    expect((window as any).dataLayer).toContainEqual({ event: 'lead_sent', leadKind: 'callback', page: '/ru/' })

    jest.advanceTimersByTime(4000)
    expect(form.querySelector('button.submit')!.textContent).toBe('Получить консультацию')
    expect((form.querySelector('button.submit') as HTMLButtonElement).disabled).toBe(false)
  })

  it('форма проекта: вид project и выбранный проект в полях', () => {
    mount(`
      <form class="lead-form">
        <input name="name"><input name="phone" type="tel">
        <select name="project"><option id="leadProject"> Assalom Do'stlik </option></select>
        <button type="submit">Отправить</button>
      </form>`)
    const form = document.querySelector('form')!
    fill(form, { phone: '901234567' })
    click(form.querySelector('button')!)
    expect(sent()).toMatchObject({ kind: 'project', form: 'Форма на странице проекта', fields: { project: "Assalom Do'stlik" } })
  })

  it('кнопка type="button" (форма «Коммерции») тоже отправляет; тип объекта — в полях', () => {
    mount(`
      <form class="commerce-form">
        <input name="name"><input name="phone" type="tel">
        <select name="object"><option>Офис</option></select>
        <button type="button" class="commerce-submit">Отправить</button>
      </form>`)
    fill(document.querySelector('form')!, { phone: '901234567' })
    click(document.querySelector('button')!)
    expect(sent()).toMatchObject({ kind: 'callback', form: 'Форма «Коммерция»', fields: { object: 'Офис' } })
  })

  it('форма с вопросом: message отдельно от полей', () => {
    mount(`
      <form><input name="name"><input name="phone"><textarea name="message"></textarea>
      <button type="button" class="submit">Отправить</button></form>`)
    const form = document.querySelector('form')!
    fill(form, { phone: '901234567', message: 'Есть рассрочка?' })
    click(form.querySelector('button')!)
    const body = sent()
    expect(body.message).toBe('Есть рассрочка?')
    expect(body.form).toBe('Форма с вопросом')
    expect(body.fields).toEqual({})
  })

  it('Enter в поле (submit) отправляет один раз', () => {
    mount(CALLBACK)
    const form = document.querySelector('form')!
    fill(form, { phone: '901234567' })
    const submit = new Event('submit', { bubbles: true, cancelable: true })
    form.dispatchEvent(submit)
    expect(submit.defaultPrevented).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('пока заявка в пути, повторный клик не шлёт вторую', () => {
    fetchMock.mockImplementation(() => new Promise(() => undefined))
    mount(CALLBACK)
    const form = document.querySelector('form')!
    fill(form, { phone: '901234567' })
    click(form.querySelector('button')!)
    click(form.querySelector('button')!)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('короткий телефон — без запроса, ошибка и фокус в поле', () => {
    mount(CALLBACK)
    const form = document.querySelector('form')!
    fill(form, { phone: '12-34' })
    click(form.querySelector('button')!)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(statusOf(form)).toBe(leadLabels('ru').phoneError)
    expect(document.activeElement).toBe(form.querySelector('[name="phone"]'))
  })

  it.each([
    [429, 'tooMany'],
    [400, 'phoneError'],
    [500, 'error'],
  ] as const)('ответ %i — сообщение, данные формы остаются, кнопку можно нажать снова', async (status, key) => {
    fetchMock.mockResolvedValue({ ok: false, status })
    mount(CALLBACK)
    const form = document.querySelector('form')!
    fill(form, { name: 'Иван', phone: '901234567' })
    click(form.querySelector('button')!)
    await flush()
    expect(statusOf(form)).toBe(leadLabels('ru')[key])
    expect((form.querySelector('[name="name"]') as HTMLInputElement).value).toBe('Иван')
    expect(form.querySelector('button')!.textContent).toBe('Получить консультацию')
    expect((form.querySelector('button') as HTMLButtonElement).disabled).toBe(false)
  })

  it('сеть недоступна — общее сообщение об ошибке', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    mount(CALLBACK)
    const form = document.querySelector('form')!
    fill(form, { phone: '901234567' })
    click(form.querySelector('button')!)
    await flush()
    expect(statusOf(form)).toBe(leadLabels('ru').error)
  })

  it('сброс формы стирает старый статус', async () => {
    mount(CALLBACK)
    const form = document.querySelector('form')!
    fill(form, { phone: '901234567' })
    click(form.querySelector('button')!)
    await flush()
    expect(statusOf(form)).toBe(leadLabels('ru').thanks)
    form.reset()
    expect(statusOf(form)).toBe('')
  })
})

describe('превью CMS', () => {
  it('заявка не отправляется, путь не пишется, форма говорит «предпросмотр»', () => {
    mount(CALLBACK, { live: false })
    const form = document.querySelector('form')!
    fill(form, { phone: '901234567' })
    click(form.querySelector('button')!)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(statusOf(form)).toBe(leadLabels('ru').preview)
    expect(localStorage.getItem(JOURNEY_KEY)).toBeNull()
  })
})

describe('путь клиента', () => {
  it('визит, первая дата, внешний источник и метки кампании', () => {
    Object.defineProperty(document, 'referrer', { configurable: true, value: 'https://www.google.com/search?q=gh' })
    window.history.replaceState({}, '', '/ru/?utm_source=yandex&utm_medium=cpc&utm_campaign=spring')
    document.title = 'Главная'
    mount('<main></main>')
    const j = journey()
    expect(j).toMatchObject({
      firstSeen: '2026-11-17',
      visits: 1,
      referrer: 'https://www.google.com/search?q=gh',
      utm: { source: 'yandex', medium: 'cpc', campaign: 'spring' },
    })
    expect(j.pages).toEqual([expect.objectContaining({ path: '/ru/', title: 'Главная', seconds: 0 })])
    Object.defineProperty(document, 'referrer', { configurable: true, value: '' })
  })

  it('новый визит — после 30 минут тишины; внутри визита счётчик не растёт', () => {
    mount('<main></main>')
    delete (window as any).__ghLeads
    jest.setSystemTime(new Date('2026-11-17T10:20:00Z'))
    run()
    expect(journey().visits).toBe(1)
    delete (window as any).__ghLeads
    jest.setSystemTime(new Date('2026-11-17T11:00:00Z'))
    run()
    expect(journey().visits).toBe(2)
    expect(journey().pages).toHaveLength(3)
  })

  it('время на странице — пока вкладка видна; пишется при уходе', () => {
    mount('<main></main>')
    jest.advanceTimersByTime(95_000)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(journey().pages[0].seconds).toBe(95)
    // Скрытая вкладка время не копит.
    jest.advanceTimersByTime(60_000)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
    jest.advanceTimersByTime(5_000)
    window.dispatchEvent(new Event('pagehide'))
    expect(journey().pages[0].seconds).toBe(100)
  })

  it('хранит не больше 30 страниц', () => {
    for (let i = 0; i < 35; i++) {
      delete (window as any).__ghLeads
      run()
    }
    expect(journey().pages).toHaveLength(30)
  })

  it('открытые планировки — без подряд идущих повторов', () => {
    mount(`
      <article class="apartment-card"><h3>2-комн. 54.6 м²</h3><span data-card-project>Dostlik</span></article>
      <article class="apartment-card"><h3>Студия 24 м²</h3><span data-card-project>Dostlik</span></article>`)
    const [a, b] = Array.from(document.querySelectorAll('.apartment-card'))
    click(a.querySelector('h3')!)
    click(a)
    click(b)
    expect(journey().plans).toEqual([
      { title: '2-комн. 54.6 м²', project: 'Dostlik' },
      { title: 'Студия 24 м²', project: 'Dostlik' },
    ])
  })

  it('путь уходит с заявкой (без служебных id), время текущей страницы досчитано', () => {
    mount(CALLBACK)
    jest.advanceTimersByTime(42_000)
    const form = document.querySelector('form')!
    fill(form, { phone: '901234567' })
    click(form.querySelector('button')!)
    const body = sent()
    expect(body.journey.visits).toBe(1)
    expect(body.journey.pages).toEqual([{ path: '/ru/', title: expect.any(String), seconds: 42 }])
    expect(body.journey.pages[0]).not.toHaveProperty('id')
  })

  it('старые заявки Site JS v2 (имена и телефоны) из браузера удаляются', () => {
    localStorage.setItem('goldenHouseLeads', '[{"fields":{"phone":"+998"}}]')
    mount('<main></main>')
    expect(localStorage.getItem('goldenHouseLeads')).toBeNull()
  })
})

describe('фильтры и окно планировки', () => {
  const TOOLBAR = `
    <div class="apartment-toolbar">
      <button data-filter="rooms" data-value="2" class="active">2</button>
      <button data-filter="rooms" data-value="3" class="active">3</button>
      <button data-filter="rooms" data-value="4">4</button>
      <input data-filter="areaMin" value="50"><input data-filter="areaMax" value="70">
      <input data-filter="floorMin" value=""><input data-filter="floorMax" value="9">
      <button data-filter-action="apply">Применить</button>
    </div>`

  it('фильтры страницы уходят с заявкой человекочитаемо', () => {
    mount(TOOLBAR + CALLBACK)
    const form = document.querySelector('form')!
    fill(form, { phone: '901234567' })
    click(form.querySelector('button[type="submit"]')!)
    expect(sent().filters).toEqual({ Комнаты: '2, 3', Площадь: 'от 50 до 70', Этаж: 'до 9' })
  })

  it('применённые фильтры запоминаются — уходят и с заявкой с другой страницы', () => {
    mount(TOOLBAR)
    click(document.querySelector('[data-filter-action="apply"]')!)
    expect(journey().filters).toMatchObject({ Комнаты: '2, 3' })
    document.body.innerHTML = ''
    delete (window as any).__ghLeads
    mount(CALLBACK)
    fill(document.querySelector('form')!, { phone: '901234567' })
    click(document.querySelector('form button')!)
    expect(sent().filters).toMatchObject({ Комнаты: '2, 3', Площадь: 'от 50 до 70' })
  })

  it('форма окна планировки: вид plan и снимок карточки из ghPlanModal.current()', () => {
    mount(`
      <article class="apartment-card" data-plan-type="p-uuid" data-rooms="2" data-area-min="54.6"
               data-area-max="56.1" data-deadline="4 кв. 2026">
        <h3>2-комн. 54.6 м²</h3><span data-card-project>Dostlik</span><span data-card-floors>этажи 2–9</span>
      </article>
      <div class="plan-modal-lead">
        <form class="plan-modal-lead-form" data-lead-kind="plan">
          <input name="name"><input name="phone" type="tel"><button type="submit">Отправить заявку</button>
        </form>
      </div>`)
    const card = document.querySelector('.apartment-card')
    ;(window as any).ghPlanModal = { current: () => card }
    const form = document.querySelector('form')!
    fill(form, { phone: '901234567' })
    click(form.querySelector('button')!)
    expect(sent()).toMatchObject({
      kind: 'plan',
      form: 'Окно планировки',
      plan: {
        id: 'p-uuid',
        title: '2-комн. 54.6 м²',
        project: 'Dostlik',
        floors: 'этажи 2–9',
        deadline: '4 кв. 2026',
        rooms: 2,
        areaMin: 54.6,
        areaMax: 56.1,
      },
    })
  })

  it('карточка без id и площади — снимок без пустых полей', () => {
    mount(`<article class="apartment-card"><h3>Студия</h3></article>
      <form data-lead-kind="plan"><input name="phone"><button type="submit">Отправить</button></form>`)
    ;(window as any).ghPlanModal = { current: () => document.querySelector('.apartment-card') }
    fill(document.querySelector('form')!, { phone: '901234567' })
    click(document.querySelector('form button')!)
    expect(sent().plan).toEqual({ title: 'Студия' })
  })
})

describe('память контакта', () => {
  const contact = () => JSON.parse(localStorage.getItem(CONTACT_KEY) || 'null')
  const known = (form: Element) => form.querySelector('.gh-lead-known') as HTMLElement | null
  const field = (form: Element, name: string) => form.querySelector(`[name="${name}"]`) as HTMLInputElement
  const DAY = 24 * 60 * 60 * 1000

  function remember(over: Record<string, unknown> = {}): void {
    localStorage.setItem(
      CONTACT_KEY,
      JSON.stringify({ name: 'Иван', phone: '+998 90 123 45 67', savedAt: Date.now(), plans: {}, ...over })
    )
  }

  /** Отправить заполненную форму и дождаться ответа и применения памяти. */
  async function submit(form: HTMLFormElement, values: Record<string, string> = {}): Promise<void> {
    fill(form, values)
    click(form.querySelector('button[type="submit"], button.submit')!)
    await flush()
    jest.advanceTimersByTime(0)
  }

  it('после успешной заявки: имя и телефон запомнены, поля скрыты, вместо них маска и «Изменить»', async () => {
    mount(CALLBACK)
    const form = document.querySelector('form')!
    await submit(form, { name: 'Иван', phone: '+998 90 123 45 67' })
    expect(contact()).toMatchObject({ name: 'Иван', phone: '+998 90 123 45 67', savedAt: Date.now() })
    expect(known(form)!.querySelector('.gh-lead-who')!.textContent).toBe('Иван, +998 90 *** 45 67')
    expect(known(form)!.querySelector('button')!.textContent).toBe('Изменить')
    expect(field(form, 'phone').classList.contains('gh-lead-field-hidden')).toBe(true)
    expect(field(form, 'name').classList.contains('gh-lead-field-hidden')).toBe(true)
    // Маска стоит на месте полей, а не в конце формы.
    expect(known(form)!.nextElementSibling).toBe(field(form, 'name'))
    // «Спасибо» после отправки остаётся.
    expect(statusOf(form)).toBe(leadLabels('ru').thanks)
  })

  it('следующая заявка — одним нажатием: значения уже в скрытых полях', async () => {
    remember()
    mount(CALLBACK)
    const form = document.querySelector('form')!
    expect(field(form, 'phone').value).toBe('+998 90 123 45 67')
    click(form.querySelector('button.submit')!)
    expect(sent()).toMatchObject({ name: 'Иван', phone: '+998 90 123 45 67' })
  })

  it('работает во всех формах с телефоном на странице', () => {
    remember()
    mount(`${CALLBACK}
      <form class="commerce-form"><input name="name"><input name="phone" type="tel">
        <select name="object"><option>Офис</option></select>
        <button type="button" class="commerce-submit">Отправить</button></form>
      <form class="calc"><input name="sum"><button type="button">Рассчитать</button></form>`)
    const forms = document.querySelectorAll('form')
    expect(known(forms[0])).not.toBeNull()
    expect(known(forms[1])).not.toBeNull()
    expect(known(forms[2])).toBeNull()
  })

  it('после заявки другие формы страницы сразу с контактом; форма, где уже вводят другое, не тронута', async () => {
    mount(`${CALLBACK}${CALLBACK}${CALLBACK}`)
    const [first, second, third] = Array.from(document.querySelectorAll('form'))
    fill(third, { name: 'Анна' })
    await submit(first, { name: 'Иван', phone: '901234567' })
    expect(known(second)!.textContent).toContain('Иван, +998 90 *** 45 67')
    expect(known(third)).toBeNull()
    expect(field(third, 'name').value).toBe('Анна')
  })

  it('без имени — только маска телефона; 9 цифр без кода страны — с +998', () => {
    remember({ name: '', phone: '901234567' })
    mount(CALLBACK)
    expect(document.querySelector('.gh-lead-who')!.textContent).toBe('+998 90 *** 45 67')
  })

  it('имя выводится текстом, не разметкой', () => {
    remember({ name: '<img src=x onerror=alert(1)>' })
    mount(CALLBACK)
    const who = document.querySelector('.gh-lead-who')!
    expect(who.querySelector('img')).toBeNull()
    expect(who.textContent).toContain('<img')
  })

  it('«Изменить»: поля видны с запомненными значениями, фокус в телефон, ничего не отправлено', () => {
    remember()
    mount(CALLBACK)
    const form = document.querySelector('form')!
    const event = click(form.querySelector('.gh-lead-change')!)
    expect(event.defaultPrevented).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(known(form)).toBeNull()
    expect(field(form, 'phone').classList.contains('gh-lead-field-hidden')).toBe(false)
    expect(field(form, 'phone').value).toBe('+998 90 123 45 67')
    expect(document.activeElement).toBe(field(form, 'phone'))
  })

  it('после правки и отправки запоминается новый контакт, маска возвращается', async () => {
    remember()
    mount(CALLBACK)
    const form = document.querySelector('form')!
    click(form.querySelector('.gh-lead-change')!)
    await submit(form, { name: 'Анна', phone: '+998 91 765 43 21' })
    expect(contact()).toMatchObject({ name: 'Анна', phone: '+998 91 765 43 21' })
    expect(form.querySelector('.gh-lead-who')!.textContent).toBe('Анна, +998 91 *** 43 21')
  })

  it('неудачная отправка ничего не запоминает', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 })
    mount(CALLBACK)
    await submit(document.querySelector('form')!, { name: 'Иван', phone: '901234567' })
    expect(contact()).toBeNull()
    expect(known(document.querySelector('form')!)).toBeNull()
  })

  it('через 30 дней контакт забыт; битая запись не ломает форму', () => {
    remember({ savedAt: Date.now() - 30 * DAY - 1 })
    mount(CALLBACK)
    expect(known(document.querySelector('form')!)).toBeNull()
    document.body.innerHTML = ''
    delete (window as any).__ghLeads
    localStorage.setItem(CONTACT_KEY, '{oops')
    expect(() => mount(CALLBACK)).not.toThrow()
    expect(known(document.querySelector('form')!)).toBeNull()
  })

  it('превью CMS: память не показывается', () => {
    remember()
    mount(CALLBACK, { live: false })
    expect(known(document.querySelector('form')!)).toBeNull()
    expect(field(document.querySelector('form')!, 'phone').value).toBe('')
  })

  describe('окно планировки', () => {
    const PLANS = `
      <article class="apartment-card" data-plan-type="1k-38"><h3>1-комн. 38 м²</h3></article>
      <article class="apartment-card" data-plan-type="1k-39"><h3>1-комн. 39 м²</h3></article>
      <form data-lead-kind="plan"><input name="name"><input name="phone" type="tel">
        <button type="submit">Отправить заявку</button></form>`
    let current: Element | null = null
    const cards = () => document.querySelectorAll('.apartment-card')
    /** Как ComplexOverlaysRuntime: другая планировка — форма сбрасывается. */
    function openPlan(index: number): HTMLFormElement {
      current = cards()[index]
      const form = document.querySelector('form')!
      form.reset()
      jest.advanceTimersByTime(0)
      return form
    }

    beforeEach(() => {
      current = null
      ;(window as any).ghPlanModal = { current: () => current }
    })

    it('отправленная планировка: вместо формы — «заявка отправлена», повторно не уходит', async () => {
      mount(PLANS)
      const form = openPlan(0)
      await submit(form, { name: 'Иван', phone: '901234567' })
      expect(contact().plans).toEqual({ '1k-38': Date.now() })
      expect(form.classList.contains('gh-lead-done')).toBe(true)
      expect(statusOf(form)).toBe(leadLabels('ru').planSent)

      fetchMock.mockClear()
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('другая (даже похожая) планировка — форма снова доступна, с запомненным контактом', async () => {
      mount(PLANS)
      await submit(openPlan(0), { name: 'Иван', phone: '901234567' })
      const form = openPlan(1)
      expect(form.classList.contains('gh-lead-done')).toBe(false)
      expect(statusOf(form)).toBe('')
      expect(form.querySelector('.gh-lead-who')!.textContent).toBe('Иван, +998 90 *** 45 67')
      fetchMock.mockClear()
      click(form.querySelector('button[type="submit"]')!)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      // И обратно к первой — снова «отправлена».
      expect(openPlan(0).classList.contains('gh-lead-done')).toBe(true)
    })

    it('следующая планировка, открытая сразу, — кнопка снова «Отправить заявку», не «Заявка отправлена»', async () => {
      mount(PLANS)
      await submit(openPlan(0), { phone: '901234567' })
      const button = document.querySelector('form button[type="submit"]') as HTMLButtonElement
      expect(button.textContent).toBe(leadLabels('ru').sent)
      openPlan(1)
      expect(button.textContent).toBe('Отправить заявку')
      expect(button.disabled).toBe(false)
    })

    it('таймер прошлой заявки не трогает кнопку следующей, пока та в пути', async () => {
      mount(PLANS)
      await submit(openPlan(0), { phone: '901234567' })
      fetchMock.mockImplementation(() => new Promise(() => undefined))
      const form = openPlan(1)
      click(form.querySelector('button[type="submit"]')!)
      jest.advanceTimersByTime(4000)
      expect(form.querySelector('button[type="submit"]')!.textContent).toBe(leadLabels('ru').sending)
    })

    it('ответ пришёл, когда уже открыта другая планировка: прошлая запомнена, новая форма не тронута', async () => {
      let respond!: (r: { ok: boolean; status: number }) => void
      fetchMock.mockImplementation(() => new Promise((r) => (respond = r)))
      mount(PLANS)
      const form = openPlan(0)
      fill(form, { name: 'Иван', phone: '901234567' })
      click(form.querySelector('button[type="submit"]')!)
      openPlan(1)
      fill(form, { name: 'Анна' })
      respond({ ok: true, status: 201 })
      await flush()
      jest.advanceTimersByTime(0)
      expect(contact().plans).toEqual({ '1k-38': Date.now() })
      const button = form.querySelector('button[type="submit"]') as HTMLButtonElement
      expect(button.textContent).toBe('Отправить заявку')
      expect(button.disabled).toBe(false)
      expect(statusOf(form)).toBe('')
      expect(form.classList.contains('gh-lead-done')).toBe(false)
      expect(field(form, 'name').value).toBe('Анна')
      // Введённое не прячется за маской запомненного «Ивана».
      expect(field(form, 'name').classList.contains('gh-lead-field-hidden')).toBe(false)
      expect(known(form)).toBeNull()
      expect(openPlan(0).classList.contains('gh-lead-done')).toBe(true)
    })

    it('отметка живёт сутки (как правило сервера), потом планировку можно запросить снова', () => {
      remember({ plans: { '1k-38': Date.now() - 24 * 60 * 60 * 1000 - 1, '1k-39': Date.now() - 1000 } })
      mount(PLANS)
      expect(openPlan(0).classList.contains('gh-lead-done')).toBe(false)
      expect(openPlan(1).classList.contains('gh-lead-done')).toBe(true)
    })
  })
})

describe('формы с привязкой данных', () => {
  const BINDING = '11111111-1111-4111-8111-111111111111'
  const withAttr = (attr: string) => CALLBACK.replace('<form class="lead-form">', `<form class="lead-form" ${attr}>`)

  it('HTTP-привязка (data-output-binding): форму не оформляем и заявку не шлём — её ведёт привязка', () => {
    mount(withAttr(`data-output-binding="${BINDING}"`))
    const form = document.querySelector('form')!
    expect(form.querySelector('.gh-lead-status')).toBeNull()
    expect(form.querySelector('.gh-lead-consent')).toBeNull()
    fill(form, { phone: '901234567' })
    const submit = new Event('submit', { bubbles: true, cancelable: true })
    form.dispatchEvent(submit)
    expect(submit.defaultPrevented).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
