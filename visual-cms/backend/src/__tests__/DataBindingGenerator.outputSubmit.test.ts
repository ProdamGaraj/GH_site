/**
 * @jest-environment jsdom
 *
 * Отправка формы OUTPUT-привязкой на сайте: всегда на наш /api/data/submit —
 * id привязки, значения полей, страница и визит. Адрес, метод и состав
 * запроса задаёт сервер; ответ — статус и разрешённые поля (в переменную страницы).
 */
import { generateDataBindingRuntime, type PageDataConfig } from '../services/DataBindingGenerator'

const BINDING_ID = '11111111-1111-4111-8111-111111111111'

function config(binding: Record<string, unknown>): PageDataConfig {
  return {
    dataSources: [
      {
        alias: 'MACRO',
        dataSourceId: '22222222-2222-4222-8222-222222222222',
        endpoint: 'https://api.macrocrm.example/v2',
        loadStrategy: 'manual',
        type: 'rest-api',
      },
    ],
    bindings: [
      {
        blockId: 'el-form',
        type: 'output',
        sourceAlias: 'MACRO',
        outputConfig: {
          trigger: 'submit',
          onSuccess: { action: 'message', value: 'Спасибо!' },
          onError: { action: 'message', value: 'Ошибка' },
        },
        ...binding,
      },
    ],
    variables: [],
  } as unknown as PageDataConfig
}

const FORM = `
    <div data-element-id="el-form">
      <form>
        <input name="name" value="Иван">
        <input name="phone" value="901234567">
        <button type="submit">Отправить</button>
      </form>
    </div>`

function mount(cfg: PageDataConfig, markup = FORM): void {
  document.body.innerHTML = markup
  const html = generateDataBindingRuntime(cfg)
  const code = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'))
  // Запуск рантайма напрямую: слушатель DOMContentLoaded на document пережил
  // бы тест и сработал бы в следующем.
  let ready: (() => void) | null = null
  const spy = jest.spyOn(document, 'addEventListener').mockImplementation(((type: string, listener: () => void) => {
    if (type === 'DOMContentLoaded') ready = listener
  }) as typeof document.addEventListener)
  // eslint-disable-next-line no-new-func
  new Function(code)()
  spy.mockRestore()
  ready!()
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

let fetchMock: jest.Mock
let alertMock: jest.Mock

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined)
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
  fetchMock = jest.fn(async () => jsonResponse({ status: 'done', submissionId: 's1' }))
  ;(global as unknown as { fetch: jest.Mock }).fetch = fetchMock
  alertMock = jest.fn()
  window.alert = alertMock
})

afterEach(() => {
  jest.restoreAllMocks()
  document.body.innerHTML = ''
})

async function submitForm(): Promise<void> {
  document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await flush()
  await flush()
}

describe('OUTPUT-привязка на сайте', () => {
  it('POST /api/data/submit: id привязки, значения, триггер, страница и визит; не адрес сервиса', async () => {
    document.title = 'Главная'
    document.documentElement.lang = 'ru'
    window.history.replaceState({}, '', '/ru/?utm_source=ig&utm_campaign=autumn')
    mount(config({ bindingId: BINDING_ID }))
    await submitForm()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/data/submit')
    expect(init.method).toBe('POST') // метод привязки применяет сервер
    expect(JSON.parse(String(init.body))).toEqual({
      outputBindingId: BINDING_ID,
      data: { name: 'Иван', phone: '901234567' },
      trigger: 'form_submit',
      page: { path: '/ru/', lang: 'ru', title: 'Главная' },
      visitor: { referrer: '', utm: { source: 'ig', campaign: 'autumn' } },
    })
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('macrocrm')
  })

  it('успех — сообщение привязки, форма сброшена', async () => {
    mount(config({ bindingId: BINDING_ID }))
    const name = document.querySelector('input[name="name"]') as HTMLInputElement
    name.value = 'Пётр'
    await submitForm()
    expect(alertMock).toHaveBeenCalledWith('Спасибо!')
    expect(name.value).toBe('Иван') // reset к значению из разметки
  })

  it('ответ сервера failed — ошибка, форма не сброшена', async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ status: 'failed', error: { code: 'DELIVERY_FAILED', message: 'Не удалось' } }, false),
    )
    mount(config({ bindingId: BINDING_ID }))
    const name = document.querySelector('input[name="name"]') as HTMLInputElement
    name.value = 'Пётр'
    await submitForm()
    expect(alertMock).toHaveBeenCalledWith('Ошибка')
    expect(alertMock).not.toHaveBeenCalledWith('Спасибо!')
    expect(name.value).toBe('Пётр')
  })

  it('HTTP-привязка помечает форму — рантайм заявок её не трогает', () => {
    mount(config({ bindingId: BINDING_ID }))
    expect(document.querySelector('form')!.getAttribute('data-output-binding')).toBe(BINDING_ID)
  })

  it('разрешённые поля ответа — в переменную страницы и событие vcms:response', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ status: 'done', submissionId: 's1', data: [{ price: 100 }], variable: 'prices' }))
    const events: CustomEvent[] = []
    const onResponse = (e: Event) => events.push(e as CustomEvent)
    document.addEventListener('vcms:response', onResponse)
    mount(config({ bindingId: BINDING_ID }))
    await submitForm()
    document.removeEventListener('vcms:response', onResponse)
    expect((window as unknown as { $var: (n: string) => unknown }).$var('prices')).toEqual([{ price: 100 }])
    expect(events).toHaveLength(1)
    expect(events[0].detail).toEqual({ bindingId: BINDING_ID, blockId: 'el-form', status: 'done', data: [{ price: 100 }] })
  })

  it('старый маппинг: поле без name находится по имени элемента; ключ — имя поля-источника', async () => {
    mount(
      config({ bindingId: BINDING_ID, outputConfig: { trigger: 'submit', payloadMappings: [{ sourceField: 'email', type: 'direct' }] } }),
      `<div data-element-id="el-form"><form>
         <input name="name" value="Иван">
         <input data-element-name="Email Input" value="a@b.uz">
         <button type="submit">Ok</button>
       </form></div>`,
    )
    await submitForm()
    expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body)).data).toEqual({ name: 'Иван', email: 'a@b.uz' })
  })

  it('страница без id привязки (задеплоена до исправления) — ничего не отправляет', async () => {
    mount(config({}))
    await submitForm()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(alertMock).toHaveBeenCalledWith('Ошибка')
  })
})
