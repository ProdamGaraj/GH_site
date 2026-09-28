// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within, act } from '@testing-library/react'

vi.mock('@/shared/api', () => ({
  pagePublishDataApi: { get: vi.fn(), update: vi.fn(), preview: vi.fn() },
  fetchDataSourceOptions: vi.fn(),
}))

import { fetchDataSourceOptions, pagePublishDataApi } from '@/shared/api'
import { PagePublishData } from './PagePublishData'

const DS = '1ddf808d-77ee-4f07-aed7-0c21c82d1356'
const saved = [{ name: 'complexes', dataSourceId: DS, arrayPath: 'items' }]

async function mount(publishData = saved) {
  vi.mocked(pagePublishDataApi.get).mockResolvedValue({ publishData })
  render(<PagePublishData pageId="p1" />)
  // Загрузка — один Promise.all: после него строки и список источников на месте.
  await waitFor(() => expect(fetchDataSourceOptions).toHaveBeenCalled())
  await act(async () => undefined)
}

const saveButton = () => screen.getByRole('button', { name: /Сохранить|Сохранено|Сохранение/ })

describe('PagePublishData', () => {
  beforeEach(() => {
    vi.mocked(fetchDataSourceOptions).mockReset().mockResolvedValue([{ id: DS, name: 'Estate — Каталог' }])
    vi.mocked(pagePublishDataApi.update).mockReset().mockResolvedValue({ publishData: saved })
    vi.mocked(pagePublishDataApi.preview).mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('показывает сохранённые данные страницы', async () => {
    await mount()
    expect(await screen.findByDisplayValue('complexes')).toBeTruthy()
    expect((screen.getByLabelText('Источник') as HTMLSelectElement).value).toBe(DS)
    expect(screen.getByDisplayValue('items')).toBeTruthy()
  })

  it('добавление строки и сохранение: на сервер уходит очищенный список', async () => {
    await mount([])
    fireEvent.click(screen.getByRole('button', { name: /Добавить данные/ }))
    fireEvent.change(screen.getByLabelText('Имя'), { target: { value: ' complexes ' } })
    fireEvent.change(screen.getByLabelText('Источник'), { target: { value: DS } })
    fireEvent.change(screen.getByLabelText('Путь к данным'), { target: { value: 'items' } })
    fireEvent.click(saveButton())
    await waitFor(() => expect(pagePublishDataApi.update).toHaveBeenCalledWith('p1', saved))
  })

  it('ошибка в строке блокирует сохранение и видна рядом со строкой', async () => {
    await mount([])
    fireEvent.click(screen.getByRole('button', { name: /Добавить данные/ }))
    fireEvent.change(screen.getByLabelText('Имя'), { target: { value: 'my-data' } })
    const row = screen.getByTestId('publish-data-row')
    expect(within(row).getByText('Имя — латиница, цифры и _, с буквы')).toBeTruthy()
    expect((saveButton() as HTMLButtonElement).disabled).toBe(true)
  })

  it('удаление строки и сохранение пустого списка', async () => {
    await mount()
    await screen.findByDisplayValue('complexes')
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))
    expect(screen.queryByTestId('publish-data-row')).toBeNull()
    fireEvent.click(saveButton())
    await waitFor(() => expect(pagePublishDataApi.update).toHaveBeenCalledWith('p1', []))
  })

  it('проверка: число элементов и первый элемент; ошибка источника — у своих данных', async () => {
    vi.mocked(pagePublishDataApi.preview).mockResolvedValue([
      { name: 'complexes', count: 5, sample: { slug: 'assalom-dostlik' } },
      { name: 'news', count: null, sample: null, error: 'Данные страницы «news»: timeout' },
    ])
    await mount()
    fireEvent.click(screen.getByRole('button', { name: /Проверить/ }))
    const box = await screen.findByTestId('publish-data-preview')
    expect(within(box).getByText('элементов: 5')).toBeTruthy()
    expect(within(box).getByText(/"slug": "assalom-dostlik"/)).toBeTruthy()
    expect(within(box).getByText(/timeout/)).toBeTruthy()
  })

  it('ошибка сохранения видна пользователю', async () => {
    vi.mocked(pagePublishDataApi.update).mockRejectedValue(new Error('Имена данных не должны повторяться'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await mount()
    await screen.findByDisplayValue('complexes')
    fireEvent.click(saveButton())
    expect(await screen.findByText('Имена данных не должны повторяться')).toBeTruthy()
  })
})
