// @vitest-environment jsdom
/**
 * Админка новостей: конструктор блоков, перевод с отметкой языка, редактор
 * (сохранение, публикация, ошибки сервиса), список и словари.
 *
 * Тяжёлые поля (визуальный редактор, медиатека) заменены простыми — их
 * поведение проверяют свои тесты в shared/forms; здесь важна логика новостей.
 */
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('@/shared/forms/RichTextField', () => ({
  RichTextField: ({ label, placeholder, value, onChange, readOnly }: any) => (
    <textarea aria-label={label ?? placeholder} value={value} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} />
  ),
}))
vi.mock('@/shared/forms/mediaFields', () => ({
  MediaField: ({ label, value, onChange }: any) => <input aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />,
}))
vi.mock('@/shared/forms/GallerySlidesField', () => ({
  GallerySlidesField: ({ label, value, onChange }: any) => (
    <input aria-label={label} value={(value ?? []).join(',')} onChange={(e) => onChange(e.target.value ? e.target.value.split(',') : [])} />
  ),
}))
vi.mock('../api', async () => ({
  // Настоящий клиент CMS-эндпоинта: он ходит через общий api, подменённый ниже.
  newsCmsApi: (await vi.importActual<typeof import('../api')>('../api')).newsCmsApi,
  newsApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    publish: vi.fn(),
    unpublish: vi.fn(),
    archive: vi.fn(),
    listDictionary: vi.fn(),
    createDictionary: vi.fn(),
    updateDictionary: vi.fn(),
    removeDictionary: vi.fn(),
  },
}))

import { ApiError } from '@/shared/api/http'
import { newsApi } from '../api'
import type { NewsDetail, NewsDraft, NewsListItem, NewsSection } from '../types'
import { draftOf } from '../newsForm'
import { SectionsEditor } from './SectionsEditor'
import { NewsTranslationForm } from './NewsTranslationForm'
import { NewsEditor } from './NewsEditor'
import { NewsList } from './NewsList'
import { DictionariesPanel } from './DictionariesPanel'

const api = vi.mocked(newsApi)
const S1 = '11111111-1111-4111-8111-111111111111'

function detail(overrides: Partial<NewsDetail> = {}): NewsDetail {
  return {
    id: 'n1',
    slug: 'vaucher',
    slugLocked: false,
    status: 'draft',
    publishedAt: null,
    categoryKey: null,
    tagKeys: [],
    title: 'Ваучер Makro',
    lead: 'Анонс',
    cover: null,
    hero: [],
    sections: [{ id: S1, type: 'text', html: '<p>Текст</p>', media: [], side: 'right' }],
    publishOn: [],
    translations: { uz: { title: '', lead: '', sections: {} }, en: { title: '', lead: '', sections: {} } },
    locales: { uz: { enabled: false, missing: ['title', 'lead', 'section:1'] }, en: { enabled: false, missing: ['title', 'lead', 'section:1'] } },
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  api.listDictionary.mockImplementation(async (kind) =>
    kind === 'categories'
      ? [{ key: 'promo', nameRu: 'Акции', nameUz: '', nameEn: '', order: 0, hidden: false }]
      : [
          { key: 'mortgage', nameRu: 'Ипотека', nameUz: '', nameEn: '', order: 0, hidden: false },
          { key: 'old', nameRu: 'Старый', nameUz: '', nameEn: '', order: 1, hidden: true },
        ]
  )
})
afterEach(cleanup)

// --- Конструктор блоков ---

function SectionsHarness({ initial = [] as NewsSection[] }) {
  const [sections, setSections] = useState<NewsSection[]>(initial)
  return (
    <>
      <SectionsEditor value={sections} onChange={setSections} />
      <output data-testid="state">{JSON.stringify(sections.map((s) => [s.type, s.html, s.side, s.media]))}</output>
    </>
  )
}
const state = () => JSON.parse(screen.getByTestId('state').textContent || '[]')

describe('SectionsEditor', () => {
  it('добавление блоков всех типов; у блоков с медиа — поле фото или слайдов и сторона', () => {
    render(<SectionsHarness />)
    expect(screen.getByText(/Блоков пока нет/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Текст$/ }))
    fireEvent.click(screen.getByRole('button', { name: /Фото \+ текст/ }))
    fireEvent.click(screen.getByRole('button', { name: /Слайдер \+ текст/ }))
    expect(state().map((s: unknown[]) => s[0])).toEqual(['text', 'photoText', 'sliderText'])
    const [text, photo, slider] = screen.getAllByTestId('news-section')
    expect(within(text).queryByLabelText('Фото')).toBeNull()
    expect(within(text).queryByRole('group')).toBeNull()
    expect(within(photo).getByLabelText('Фото')).toBeTruthy()
    expect(within(slider).getByLabelText('Слайды')).toBeTruthy()
  })

  it('фото, сторона и текст блока попадают в данные', () => {
    render(<SectionsHarness />)
    fireEvent.click(screen.getByRole('button', { name: /Фото \+ текст/ }))
    const block = screen.getByTestId('news-section')
    fireEvent.change(within(block).getByLabelText('Фото'), { target: { value: '/media/p.webp' } })
    fireEvent.click(within(block).getByRole('button', { name: 'Медиа слева' }))
    fireEvent.change(within(block).getByLabelText('Текст блока'), { target: { value: '<p>Привет</p>' } })
    expect(state()).toEqual([['photoText', '<p>Привет</p>', 'left', ['/media/p.webp']]])
  })

  it('порядок: выше/ниже; крайние кнопки неактивны; удаление после подтверждения', () => {
    render(<SectionsHarness />)
    fireEvent.click(screen.getByRole('button', { name: /Текст$/ }))
    fireEvent.click(screen.getByRole('button', { name: /Фото \+ текст/ }))
    expect((screen.getByRole('button', { name: 'Блок 1 выше' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Блок 2 ниже' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Блок 2 выше' }))
    expect(state().map((s: unknown[]) => s[0])).toEqual(['photoText', 'text'])
    fireEvent.click(screen.getByRole('button', { name: 'Удалить блок 1' }))
    expect(state().map((s: unknown[]) => s[0])).toEqual(['text'])
  })

  it('смена типа блока', () => {
    render(<SectionsHarness />)
    fireEvent.click(screen.getByRole('button', { name: /Текст$/ }))
    fireEvent.change(screen.getByLabelText('Тип блока 1'), { target: { value: 'sliderText' } })
    expect(state()[0][0]).toBe('sliderText')
  })
})

// --- Перевод ---

function TranslationHarness({ initial }: { initial: NewsDraft }) {
  const [draft, setDraft] = useState(initial)
  return (
    <>
      <NewsTranslationForm draft={draft} locale="uz" onChange={setDraft} />
      <output data-testid="draft">{JSON.stringify({ publishOn: draft.publishOn, uz: draft.translations.uz })}</output>
    </>
  )
}
const draftState = () => JSON.parse(screen.getByTestId('draft').textContent || '{}')
const publishBox = () => screen.getByRole('checkbox', { name: /Публиковать на UZ/ }) as HTMLInputElement

describe('NewsTranslationForm', () => {
  it('пока перевод неполный — отметить язык нельзя, видно чего не хватает', () => {
    render(<TranslationHarness initial={draftOf(detail())} />)
    expect(publishBox().disabled).toBe(true)
    expect(screen.getByTestId('news-missing').textContent).toMatch(/заголовок, анонс, блок 1/)
  })

  it('перевели всё — отметка доступна и ставится', () => {
    render(<TranslationHarness initial={draftOf(detail())} />)
    fireEvent.change(screen.getByLabelText('Заголовок'), { target: { value: 'Makro vaucheri' } })
    fireEvent.change(screen.getByLabelText('Анонс'), { target: { value: 'Anons' } })
    fireEvent.change(screen.getByLabelText('Блок 1 · UZ'), { target: { value: '<p>Matn</p>' } })
    expect(screen.getByText('Перевод полный.')).toBeTruthy()
    fireEvent.click(publishBox())
    expect(draftState()).toEqual({ publishOn: ['uz'], uz: { title: 'Makro vaucheri', lead: 'Anons', sections: { [S1]: '<p>Matn</p>' }, blocks: {} } })
  })

  it('отметка уже стоит, а перевод неполный — предупреждение, снять отметку можно', () => {
    render(<TranslationHarness initial={{ ...draftOf(detail()), publishOn: ['uz'] }} />)
    expect(publishBox().checked).toBe(true)
    expect(publishBox().disabled).toBe(false)
    expect(screen.getByTestId('news-missing').textContent).toMatch(/на UZ новости не будет/)
    fireEvent.click(publishBox())
    expect(draftState().publishOn).toEqual([])
  })

  it('оригинал RU рядом с переводом — только для чтения; блок без текста переводить не нужно', () => {
    const news = detail({
      sections: [
        { id: S1, type: 'text', html: '<p>Текст</p>', media: [], side: 'right' },
        { id: '22222222-2222-4222-8222-222222222222', type: 'photoText', html: '', media: ['/a.webp'], side: 'left' },
      ],
    })
    render(<TranslationHarness initial={draftOf(news)} />)
    expect((screen.getByLabelText('Блок 1 · Текст · RU') as HTMLTextAreaElement).readOnly).toBe(true)
    expect(screen.getAllByTestId('news-section-translation')).toHaveLength(1)
    expect(screen.getByText(/Блок 2 \(Фото \+ текст\) без текста/)).toBeTruthy()
  })
})

// --- Редактор ---

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={['/news/n1']}>
      <Routes>
        <Route path="/news/:id" element={<NewsEditor />} />
        <Route path="/news" element={<div>список новостей</div>} />
      </Routes>
    </MemoryRouter>
  )
}
const saveButton = () => screen.getByRole('button', { name: /Сохранить/ }) as HTMLButtonElement

describe('NewsEditor', () => {
  it('сохранение: кнопка активна только при правках, в сервис уходит черновик', async () => {
    api.get.mockResolvedValue(detail())
    api.update.mockImplementation(async (_id, body) => detail({ ...body }))
    renderEditor()
    await screen.findByDisplayValue('Ваучер Makro')
    expect(saveButton().disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Заголовок'), { target: { value: 'Новый заголовок' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ипотека' }))
    fireEvent.change(screen.getByLabelText('Рубрика (бейдж)'), { target: { value: 'promo' } })
    expect(saveButton().disabled).toBe(false)
    fireEvent.click(saveButton())

    await screen.findByText('Сохранено')
    expect(api.update).toHaveBeenCalledWith('n1', expect.objectContaining({ title: 'Новый заголовок', tagKeys: ['mortgage'], categoryKey: 'promo' }))
    expect(saveButton().disabled).toBe(true)
  })

  it('скрытый тег не предлагается, если его нет у новости', async () => {
    api.get.mockResolvedValue(detail())
    renderEditor()
    await screen.findByDisplayValue('Ваучер Makro')
    expect(screen.queryByRole('button', { name: 'Старый' })).toBeNull()
  })

  it('публикация с несохранёнными правками: сначала сохранение, потом публикация', async () => {
    api.get.mockResolvedValue(detail())
    api.update.mockImplementation(async (_id, body) => detail({ ...body }))
    api.publish.mockResolvedValue(detail({ status: 'published', slugLocked: true, publishedAt: '2026-10-05T09:00:00Z' }))
    renderEditor()
    await screen.findByDisplayValue('Ваучер Makro')
    fireEvent.change(screen.getByLabelText(/^Анонс/), { target: { value: 'Новый анонс' } })
    fireEvent.click(screen.getByRole('button', { name: /Опубликовать/ }))

    await screen.findByText(/появится на сайте после передеплоя/)
    expect(api.update.mock.invocationCallOrder[0]).toBeLessThan(api.publish.mock.invocationCallOrder[0])
    expect((screen.getByLabelText('Адрес новости') as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByRole('button', { name: /Снять/ })).toBeTruthy()
  })

  it('сервис отказал из-за неполного перевода — понятное сообщение', async () => {
    api.get.mockResolvedValue(detail())
    api.update.mockRejectedValue(
      new ApiError('Язык можно отметить только при полном переводе', 400, { details: { missing: { uz: ['title', 'section:1'] } } })
    )
    renderEditor()
    await screen.findByDisplayValue('Ваучер Makro')
    fireEvent.change(screen.getByLabelText('Заголовок'), { target: { value: 'x' } })
    fireEvent.click(saveButton())
    expect((await screen.findByRole('alert')).textContent).toMatch(/UZ: заголовок, блок 1/)
  })

  it('вкладка UZ — форма перевода; адрес зафиксирован после публикации', async () => {
    api.get.mockResolvedValue(detail({ status: 'published', slugLocked: true }))
    renderEditor()
    await screen.findByDisplayValue('Ваучер Makro')
    expect((screen.getByLabelText('Адрес новости') as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /UZ/ }))
    expect(screen.getByRole('checkbox', { name: /Публиковать на UZ/ })).toBeTruthy()
  })

  it('удаление — после подтверждения, возврат к списку', async () => {
    api.get.mockResolvedValue(detail())
    api.remove.mockResolvedValue(undefined)
    renderEditor()
    await screen.findByDisplayValue('Ваучер Makro')
    fireEvent.click(screen.getByRole('button', { name: 'Удалить новость' }))
    await screen.findByText('список новостей')
    expect(api.remove).toHaveBeenCalledWith('n1')
  })
})

// --- Список ---

function listItem(overrides: Partial<NewsListItem>): NewsListItem {
  return {
    id: 'x',
    slug: 'x',
    status: 'draft',
    title: 'X',
    publishedAt: null,
    categoryKey: null,
    tagKeys: [],
    hero: [],
    updatedAt: '2026-10-01T00:00:00Z',
    locales: { uz: { enabled: false, missing: [] }, en: { enabled: false, missing: [] } },
    ...overrides,
  }
}

describe('NewsList', () => {
  const items = [
    listItem({ id: 'a', title: 'Ипотека от банка', status: 'published', locales: { uz: { enabled: true, missing: [] }, en: { enabled: true, missing: ['section:2'] } } }),
    listItem({ id: 'b', title: 'Черновик о рассрочке' }),
    listItem({ id: 'c', title: 'Старая акция', status: 'archived' }),
  ]

  function renderList() {
    return render(
      <MemoryRouter initialEntries={['/news']}>
        <Routes>
          <Route path="/news" element={<NewsList />} />
          <Route path="/news/:id" element={<div>редактор новости</div>} />
        </Routes>
      </MemoryRouter>
    )
  }

  it('строки с языками: опубликована / отмечена, но неполная / выключена', async () => {
    api.list.mockResolvedValue(items)
    renderList()
    const rows = await screen.findAllByTestId('news-row')
    expect(rows).toHaveLength(3)
    expect(within(rows[0]).getByTestId('locale-uz').dataset.state).toBe('ready')
    expect(within(rows[0]).getByTestId('locale-en').dataset.state).toBe('broken')
    expect(within(rows[0]).getByTestId('locale-en').title).toMatch(/блок 2/)
    expect(within(rows[1]).getByTestId('locale-uz').dataset.state).toBe('off')
  })

  it('фильтр по статусу и поиск по заголовку', async () => {
    api.list.mockResolvedValue(items)
    renderList()
    await screen.findAllByTestId('news-row')
    fireEvent.click(screen.getByRole('button', { name: 'Архив' }))
    expect(screen.getAllByTestId('news-row').map((r) => r.textContent)).toEqual([expect.stringContaining('Старая акция')])
    fireEvent.click(screen.getByRole('button', { name: 'Все' }))
    fireEvent.change(screen.getByLabelText('Поиск по заголовку'), { target: { value: 'рассроч' } })
    expect(screen.getAllByTestId('news-row')).toHaveLength(1)
  })

  it('создание — по заголовку, сразу в редактор', async () => {
    api.list.mockResolvedValue([])
    api.create.mockResolvedValue(detail({ id: 'new' }))
    renderList()
    await screen.findByText(/Новостей пока нет/)
    fireEvent.change(screen.getByLabelText('Заголовок новой новости'), { target: { value: '  Новая  ' } })
    fireEvent.click(screen.getByRole('button', { name: /Создать/ }))
    await screen.findByText('редактор новости')
    expect(api.create).toHaveBeenCalledWith({ title: 'Новая' })
  })
})

// --- Рубрики и теги ---

describe('DictionariesPanel', () => {
  it('новая рубрика: ключ латиницей, название обязательно', async () => {
    api.createDictionary.mockResolvedValue({ key: 'news', nameRu: 'Новости', nameUz: '', nameEn: '', order: 1, hidden: false })
    render(<DictionariesPanel />)
    const [categoriesTable] = await screen.findAllByRole('table')
    await within(categoriesTable).findByText('promo')
    const newRow = within(categoriesTable).getByTestId('dict-new-row')
    const add = within(newRow).getByRole('button', { name: 'Добавить' }) as HTMLButtonElement
    fireEvent.change(within(newRow).getByLabelText('Ключ'), { target: { value: 'Новости' } })
    fireEvent.change(within(newRow).getByLabelText('Название RU'), { target: { value: 'Новости' } })
    expect(add.disabled).toBe(true) // кириллица в ключе
    fireEvent.change(within(newRow).getByLabelText('Ключ'), { target: { value: 'news' } })
    expect(add.disabled).toBe(false)
    fireEvent.click(add)
    await waitFor(() => expect(api.createDictionary).toHaveBeenCalledWith('categories', expect.objectContaining({ key: 'news', nameRu: 'Новости' })))
  })

  it('удалить используемый тег нельзя — сообщение сервиса', async () => {
    api.removeDictionary.mockRejectedValue(new ApiError('Тег используется в новостях (3) — скройте вместо удаления', 409))
    render(<DictionariesPanel />)
    const tables = await screen.findAllByRole('table')
    const tagsTable = tables[1]
    await within(tagsTable).findByText('mortgage')
    fireEvent.click(within(within(tagsTable).getAllByTestId('dict-row')[0]).getByRole('button', { name: 'Удалить' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/скройте вместо удаления/)
  })

  it('правка существующей: ключ не меняется, сохраняются только поля', async () => {
    api.updateDictionary.mockResolvedValue({ key: 'promo', nameRu: 'Акции', nameUz: 'Aksiyalar', nameEn: '', order: 0, hidden: false })
    render(<DictionariesPanel />)
    const [categoriesTable] = await screen.findAllByRole('table')
    const row = (await within(categoriesTable).findAllByTestId('dict-row'))[0]
    fireEvent.change(within(row).getByLabelText('Название UZ'), { target: { value: 'Aksiyalar' } })
    fireEvent.click(within(row).getByRole('button', { name: 'Сохранить' }))
    await waitFor(() =>
      expect(api.updateDictionary).toHaveBeenCalledWith('categories', 'promo', { nameRu: 'Акции', nameUz: 'Aksiyalar', nameEn: '', order: 0, hidden: false })
    )
  })
})

// --- Страницы новостей (коллекция) ---

vi.mock('@/shared/api', () => ({
  siteApi: { getAll: vi.fn(async () => [{ id: 'site-1', name: 'Golden House' }]) },
  pageApi: {
    getAll: vi.fn(async () => [
      { id: 'p-news', name: 'News', slug: 'news' },
      { id: 'p-tpl', name: 'Новость (шаблон)', slug: 'news-template' },
    ]),
  },
  api: { post: vi.fn(async () => ({ dataSourceId: 'ds', collectionId: 'col-1', created: { dataSource: true, collection: true } })) },
}))

describe('«Страницы новостей»', () => {
  it('шаблон «Новость» выбран сам; создание — эндпоинт provision-news с /news', async () => {
    const { api: cms } = await import('@/shared/api')
    api.list.mockResolvedValue([])
    render(
      <MemoryRouter>
        <NewsList />
      </MemoryRouter>
    )
    fireEvent.click(await screen.findByRole('button', { name: /Страницы новостей/ }))
    await waitFor(() => expect((screen.getByDisplayValue('Новость (шаблон) (/news-template)') as HTMLSelectElement)).toBeTruthy())
    expect(screen.getByDisplayValue('/news')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Создать связку' }))
    await screen.findByText('Коллекция создана')
    expect(vi.mocked(cms.post)).toHaveBeenCalledWith('/collections/provision-news', { siteId: 'site-1', templatePageId: 'p-tpl', basePath: '/news' })
  })
})
