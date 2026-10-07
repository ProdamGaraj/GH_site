// @vitest-environment jsdom
/**
 * Панель переводов: непереведённое подсвечено и посчитано (из-за него версия
 * языка закрыта noindex), «один текст для всех языков» на каждой строке,
 * перевод блока помечен как общий для его страниц.
 *
 * Настоящий стор (переводы + редактор), замокан только API.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import type { TranslationOverview } from '@/shared/types/translation'

const overview: TranslationOverview = {
  locale: 'uz',
  total: 4,
  missing: 2,
  entries: [
    { nodeId: 'title', field: 'content', value: 'Заголовок', owner: { kind: 'page' }, same: false, sameByDefault: false, missing: true },
    { nodeId: 'phone', field: 'content', value: '+998 78 150-11-11', owner: { kind: 'page' }, same: false, sameByDefault: false, missing: true },
    {
      nodeId: 'nav-link',
      field: 'content',
      value: 'Главная',
      translation: 'Bosh sahifa',
      owner: { kind: 'block', blockId: 'nav', blockName: 'Navigation', pageCount: 9 },
      same: false,
      sameByDefault: false,
      missing: false,
    },
    { nodeId: 'nav-link', field: 'href', value: '/', owner: { kind: 'block', blockId: 'nav', blockName: 'Navigation', pageCount: 9 }, same: true, sameByDefault: true, missing: false },
  ],
}

const translationApi = vi.hoisted(() => ({
  getTranslatableContent: vi.fn(),
  getPageTranslations: vi.fn(),
  getTranslationMap: vi.fn(),
  getProgress: vi.fn(),
  getOverview: vi.fn(),
  setSameMark: vi.fn(),
  upsertOne: vi.fn(),
  bulkUpsert: vi.fn(),
}))
vi.mock('@/shared/api/translationApi', () => ({
  translationApi,
  languageApi: {
    getAll: vi.fn(async () => [
      { id: '1', code: 'ru', name: 'Russian', nativeName: 'Русский', isDefault: true, isActive: true },
      { id: '2', code: 'uz', name: 'Uzbek', nativeName: 'Oʻzbekcha', isDefault: false, isActive: true },
    ]),
  },
}))
vi.mock('@/shared/api', () => ({ pageApi: { getById: vi.fn(async () => ({ siteId: 's1' })) } }))

import translationsReducer from './translationsSlice'
import editorReducer from '@/features/editor/editorSlice'
import { TranslationPanel } from './TranslationPanel'

function mount() {
  const store = configureStore({ reducer: { translations: translationsReducer, editor: editorReducer } })
  render(
    <Provider store={store}>
      <TranslationPanel pageId="p1" />
    </Provider>
  )
}

beforeEach(() => {
  translationApi.getTranslatableContent.mockResolvedValue(overview.entries.map(({ nodeId, field, value }) => ({ nodeId, field, value })))
  translationApi.getPageTranslations.mockResolvedValue([])
  translationApi.getTranslationMap.mockResolvedValue({ 'nav-link': { content: 'Bosh sahifa' } })
  translationApi.getProgress.mockResolvedValue([{ locale: 'uz', total: 4, translated: 2, percentage: 50, byStatus: { draft: 2, review: 0, approved: 0, published: 0 } }])
  translationApi.getOverview.mockResolvedValue(overview)
  translationApi.setSameMark.mockResolvedValue(undefined)
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const rows = () => screen.getAllByTestId('translation-row')
const rowOf = (text: string) => rows().find((r) => within(r).queryByText(text))!

describe('TranslationPanel', () => {
  it('считает непереведённое и предупреждает про noindex', async () => {
    mount()
    const summary = await screen.findByText(/Не хватает переводов: 2/)
    expect(summary.textContent).toMatch(/noindex/)
  })

  it('непереведённые строки помечены; переведённые — нет', async () => {
    mount()
    await screen.findByText(/Не хватает переводов/)
    expect(rowOf('Заголовок').getAttribute('data-missing')).toBe('true')
    expect(within(rowOf('Заголовок')).getByText('не переведено')).toBeTruthy()
    expect(rowOf('Главная').getAttribute('data-missing')).toBe('false')
  })

  it('фильтр «Непереведённые» оставляет только их', async () => {
    mount()
    await screen.findByText(/Не хватает переводов/)
    fireEvent.click(screen.getByRole('button', { name: /Непереведённые \(2\)/ }))
    expect(rows().map((r) => r.getAttribute('data-missing'))).toEqual(['true', 'true'])
  })

  it('перевод блока помечен: меняется на всех его страницах', async () => {
    mount()
    const label = await screen.findByTestId('translation-block-owner')
    expect(label.textContent).toContain('«Navigation»')
    expect(label.textContent).toContain('(9)')
  })

  it('«Один для всех языков»: включение пишет same, обзор и прогресс перечитываются', async () => {
    mount()
    await screen.findByText(/Не хватает переводов/)
    fireEvent.click(within(rowOf('+998 78 150-11-11')).getByRole('checkbox'))
    await waitFor(() => expect(translationApi.setSameMark).toHaveBeenCalledWith('p1', 'phone', 'content', 'same'))
    await waitFor(() => expect(translationApi.getOverview.mock.calls.length).toBeGreaterThan(1))
    expect(translationApi.getProgress.mock.calls.length).toBeGreaterThan(1)
  })

  it('поле с «один для всех» — вместо ввода подпись «текст оригинала»', async () => {
    translationApi.getOverview.mockResolvedValue({
      ...overview,
      missing: 1,
      entries: overview.entries.map((e) => (e.nodeId === 'phone' ? { ...e, same: true, mark: 'same' as const, missing: false } : e)),
    })
    mount()
    await screen.findByText(/Не хватает переводов: 1/)
    const phone = rowOf('+998 78 150-11-11')
    expect(within(phone).getByText('На всех языках — текст оригинала')).toBeTruthy()
    expect(within(phone).queryByPlaceholderText('Введите перевод...')).toBeNull()
  })

  it('всё переведено — «Переведено полностью»', async () => {
    translationApi.getOverview.mockResolvedValue({ ...overview, missing: 0, entries: overview.entries.map((e) => ({ ...e, missing: false })) })
    mount()
    expect(await screen.findByText('Переведено полностью')).toBeTruthy()
  })
})
