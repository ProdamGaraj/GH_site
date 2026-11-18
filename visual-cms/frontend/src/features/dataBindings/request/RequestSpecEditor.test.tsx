// @vitest-environment jsdom
/**
 * Редактор запроса привязки: метод/путь/query/тело, вставка ссылок из
 * подсказки, превью и тест через сервер, неподдерживаемый тип источника,
 * вкладка «Ответ».
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import { useState, type ComponentProps } from 'react'
import { RequestSpecEditor } from './RequestSpecEditor'
import { ResponseSpecEditor } from './ResponseSpecEditor'
import { defaultRequestSpec } from './requestModel'
import type { RequestSpec } from '@/shared/types/requestSpec'

afterEach(cleanup)

const SOURCE = '22222222-2222-4222-8222-222222222222'

/** Подделка вызовов сервера: тесты задают ответы как есть. */
type FakeApi = { preview: (...args: unknown[]) => unknown; test: (...args: unknown[]) => unknown }

function Harness({ initial = defaultRequestSpec(), sourceType = 'rest-api', api, onSpec }: {
  initial?: RequestSpec
  sourceType?: string
  api?: FakeApi
  onSpec?: (spec: RequestSpec) => void
}) {
  const [spec, setSpec] = useState(initial)
  return (
    <RequestSpecEditor
      value={spec}
      onChange={(next) => {
        setSpec(next)
        onSpec?.(next)
      }}
      dataSourceId={SOURCE}
      sourceType={sourceType}
      baseUrl="https://api.example.com/v2"
      formFieldNames={['name', 'phone']}
      api={(api ?? { preview: vi.fn(), test: vi.fn() }) as unknown as ComponentProps<typeof RequestSpecEditor>['api']}
    />
  )
}

describe('RequestSpecEditor', () => {
  it('метод и путь; GET прячет тело', () => {
    const onSpec = vi.fn()
    render(<Harness onSpec={onSpec} />)
    fireEvent.change(screen.getByLabelText('Путь'), { target: { value: '/leads/{{form.phone}}' } })
    expect(onSpec).toHaveBeenLastCalledWith(expect.objectContaining({ rest: expect.objectContaining({ path: '/leads/{{form.phone}}' }) }))
    expect(screen.getByLabelText('Тело JSON')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Метод'), { target: { value: 'GET' } })
    expect(onSpec).toHaveBeenLastCalledWith(expect.objectContaining({ rest: expect.objectContaining({ method: 'GET', body: { format: 'none' } }) }))
    expect(screen.queryByLabelText('Тело JSON')).toBeNull()
  })

  it('query-параметры: добавить, заполнить, удалить', () => {
    const onSpec = vi.fn()
    render(<Harness onSpec={onSpec} />)
    fireEvent.click(screen.getByText('параметр'))
    fireEvent.change(screen.getByLabelText('Query-параметры: имя 1'), { target: { value: 'lang' } })
    fireEvent.change(screen.getByLabelText('Query-параметры: значение 1'), { target: { value: '{{page.lang}}' } })
    expect(onSpec.mock.lastCall![0].rest.query).toEqual([{ key: 'lang', value: '{{page.lang}}' }])
    fireEvent.click(screen.getAllByLabelText('Удалить')[0])
    expect(onSpec.mock.lastCall![0].rest.query).toEqual([])
  })

  it('тело JSON: правильный JSON сохраняется деревом, ошибка — подсказкой без сохранения', () => {
    const onSpec = vi.fn()
    render(<Harness onSpec={onSpec} />)
    const body = screen.getByLabelText('Тело JSON')
    fireEvent.change(body, { target: { value: '{"phones": ["{{form.phone | digits}}"], "n": 1}' } })
    expect(onSpec.mock.lastCall![0].rest.body).toEqual({ format: 'json', value: { phones: ['{{form.phone | digits}}'], n: 1 } })
    onSpec.mockClear()
    fireEvent.change(body, { target: { value: '{"a": ' } })
    expect(onSpec).not.toHaveBeenCalled()
    expect(document.querySelector('[data-body-error]')!.textContent).toMatch(/^JSON/)
    expect((screen.getByText('Показать запрос').closest('button') as HTMLButtonElement).disabled).toBe(true)
  })

  it('формат «Форма» — поля формы блока заготовкой', () => {
    const onSpec = vi.fn()
    render(<Harness onSpec={onSpec} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Форма' }))
    expect(onSpec.mock.lastCall![0].rest.body).toEqual({
      format: 'form-urlencoded',
      fields: [
        { key: 'name', value: '{{form.name}}' },
        { key: 'phone', value: '{{form.phone}}' },
      ],
    })
  })

  it('клик по ссылке вставляет её в поле, где стоял курсор', async () => {
    const onSpec = vi.fn()
    render(<Harness onSpec={onSpec} />)
    const path = screen.getByLabelText('Путь') as HTMLInputElement
    fireEvent.change(path, { target: { value: '/leads/' } })
    act(() => {
      path.focus()
      path.setSelectionRange(7, 7)
    })
    fireEvent.click(screen.getByRole('button', { name: 'form.phone' }))
    expect(onSpec.mock.lastCall![0].rest.path).toBe('/leads/{{form.phone}}')
  })

  it('превью: несохранённый запрос и примерные значения уходят на сервер, ответ показан', async () => {
    const api = {
      preview: vi.fn(async () => ({ issues: [], request: { connector: 'rest', method: 'POST', url: 'https://api.example.com/v2/leads', headers: { 'X-Api-Key': '••••' }, body: { format: 'json', value: { name: 'Аня' } }, timeoutMs: 15000 } })),
      test: vi.fn(),
    }
    render(<Harness api={api} />)
    fireEvent.change(screen.getByLabelText('Пример: name'), { target: { value: 'Аня' } })
    fireEvent.click(screen.getByText('Показать запрос'))
    await waitFor(() => expect(document.querySelector('[data-request-view]')).not.toBeNull())
    expect(api.preview).toHaveBeenCalledWith({ dataSourceId: SOURCE, request: defaultRequestSpec(), data: { name: 'Аня', phone: 'пример' } })
    expect(document.querySelector('[data-request-view]')!.textContent).toContain('https://api.example.com/v2/leads')
    expect(document.querySelector('[data-request-view]')!.textContent).toContain('X-Api-Key: ••••')
  })

  it('превью с ошибками спецификации — список', async () => {
    const api = { preview: vi.fn(async () => ({ issues: ['Путь: Нет данных «x»'] })), test: vi.fn() }
    render(<Harness api={api} />)
    fireEvent.click(screen.getByText('Показать запрос'))
    await waitFor(() => expect(document.querySelector('[data-request-issues]')!.textContent).toContain('Нет данных «x»'))
  })

  it('тест: статус, время, ответ сервиса и что получит страница', async () => {
    const api = {
      preview: vi.fn(),
      test: vi.fn(async () => ({
        issues: [],
        request: { connector: 'rest', method: 'POST', url: 'https://x', headers: {}, timeoutMs: 15000 },
        result: { ok: true, status: 201, data: { id: 9 }, retry: 'never', durationMs: 120 },
        pageData: { leadId: 9 },
      })),
    }
    render(<Harness api={api} />)
    fireEvent.click(screen.getByText('Отправить тест'))
    await waitFor(() => expect(document.querySelector('[data-test-result]')).not.toBeNull())
    const text = document.querySelector('[data-test-result]')!.textContent!
    expect(text).toContain('Сервис ответил: 201 · 120 мс')
    expect(text).toContain('"id": 9')
    expect(text).toContain('Странице: {"leadId":9}')
  })

  it('ошибка вызова сервера — текстом', async () => {
    const api = { preview: vi.fn(async () => { throw new Error('Сессия истекла') }), test: vi.fn() }
    render(<Harness api={api} />)
    fireEvent.click(screen.getByText('Показать запрос'))
    await waitFor(() => expect(screen.getByText('Сессия истекла')).toBeTruthy())
  })

  it('источник без коннектора — понятное сообщение вместо редактора', () => {
    render(<Harness sourceType="database" />)
    expect(document.querySelector('[data-unsupported-source]')!.textContent).toContain('«database» пока не поддерживается')
    expect(screen.queryByLabelText('Путь')).toBeNull()
  })
})

describe('ResponseSpecEditor', () => {
  function ResponseHarness({ onSpec }: { onSpec: (s: RequestSpec) => void }) {
    const [spec, setSpec] = useState(defaultRequestSpec())
    return (
      <ResponseSpecEditor
        value={spec}
        onChange={(s) => {
          setSpec(s)
          onSpec(s)
        }}
      />
    )
  }

  it('по умолчанию только статус; поля — путь, переменная, список, лимит', () => {
    const onSpec = vi.fn()
    render(<ResponseHarness onSpec={onSpec} />)
    expect(screen.getByRole('radio', { name: 'Только статус' }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('radio', { name: 'Статус и поля ответа' }))
    fireEvent.change(screen.getByLabelText('Путь к данным'), { target: { value: 'data.items' } })
    fireEvent.change(screen.getByLabelText('Переменная страницы'), { target: { value: 'prices' } })
    fireEvent.click(screen.getByText('поле'))
    fireEvent.change(screen.getByLabelText('Поле ответа 1'), { target: { value: 'price.total' } })
    fireEvent.change(screen.getByLabelText('Имя на странице 1'), { target: { value: 'price' } })
    fireEvent.change(screen.getByLabelText('Максимум элементов'), { target: { value: '20' } })
    expect(onSpec.mock.lastCall![0].response).toEqual({
      expose: 'fields',
      dataPath: 'data.items',
      variable: 'prices',
      fields: [{ from: 'price.total', to: 'price' }],
      maxItems: 20,
    })
    fireEvent.change(screen.getByLabelText('Максимум элементов'), { target: { value: '0' } })
    expect(onSpec.mock.lastCall![0].response.maxItems).toBeUndefined()
  })
})
