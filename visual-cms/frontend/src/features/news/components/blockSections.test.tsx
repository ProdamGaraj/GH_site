// @vitest-environment jsdom
/**
 * Секция «Блок из библиотеки» в редакторе новости: выбор блока → диалог якорей
 * (данные / похоже на интерфейс; переписать или копия) → форма значений →
 * перевод текстов значений.
 */
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

vi.mock('@/shared/forms/RichTextField', () => ({
  RichTextField: ({ label, placeholder, value, onChange, readOnly }: any) => (
    <textarea aria-label={label ?? placeholder} value={value} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} />
  ),
}))
vi.mock('@/shared/forms/mediaFields', () => ({
  MediaField: ({ label, value, onChange }: any) => <input aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />,
}))
vi.mock('@/shared/forms/GallerySlidesField', () => ({ GallerySlidesField: () => null }))
vi.mock('@/features/editor/components/BlockPicker', () => ({
  BlockPicker: ({ isOpen, onPick }: any) =>
    isOpen ? (
      <button type="button" onClick={() => onPick({ block: { id: 'b-promo', name: 'Promo' }, mode: 'linked' })}>
        выбрать Promo
      </button>
    ) : null,
}))
const cms = vi.hoisted(() => ({ dataAnchors: vi.fn(), makeDataBlock: vi.fn() }))
vi.mock('../api', () => ({ newsCmsApi: cms, newsApi: {} }))

import type { BlockAnchorInfo, DataAnchor, NewsDraft, NewsSection } from '../types'
import { missingTranslation, newBlockSection, orphanValueKeys, translatableValue } from '../newsForm'
import { SectionsEditor } from './SectionsEditor'
import { NewsTranslationForm } from './NewsTranslationForm'
import { forgetBlockAnchors } from './useBlockAnchors'

const anchors: DataAnchor[] = [
  { nodeId: 'n1', key: 'title', label: 'Заголовок', kind: 'text', sample: 'Рассрочка 0%' },
  { nodeId: 'n2', key: 'body', label: 'Текст', kind: 'richtext', sample: '<p>Без переплат</p>' },
  { nodeId: 'n3', key: 'photo', label: 'Фото', kind: 'image', sample: '/media/p.jpg' },
  { nodeId: 'n4', key: 'cta', label: 'Кнопка', kind: 'link', sample: { href: '/apply', text: 'Подать заявку' } },
]

const empty = { pages: [], blocks: [], projects: [], news: [], unchecked: [] }
const raw = (over: Partial<BlockAnchorInfo> = {}): BlockAnchorInfo => ({
  block: { id: 'b-promo', name: 'Promo' },
  anchors: [],
  candidates: [
    { nodeId: 'n1', kind: 'text', label: 'Заголовок · «Рассрочка 0%»', sample: 'Рассрочка 0%', suggested: true },
    { nodeId: 'n5', kind: 'text', label: 'Подпись · «↗»', sample: '↗', suggested: false, noiseReason: 'символ или стрелка' },
  ],
  usage: empty,
  actions: ['rewrite', 'copy'],
  ...over,
})

function Harness({ initial = [] as NewsSection[] }) {
  const [sections, setSections] = useState<NewsSection[]>(initial)
  return (
    <>
      <SectionsEditor value={sections} onChange={setSections} />
      <pre data-testid="state">{JSON.stringify(sections)}</pre>
    </>
  )
}
const state = (): NewsSection[] => JSON.parse(screen.getByTestId('state').textContent || '[]')

beforeEach(() => {
  forgetBlockAnchors()
  cms.dataAnchors.mockReset()
  cms.makeDataBlock.mockReset()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('newsForm: секция-блок', () => {
  it('новая секция заполнена образцами якорей', () => {
    const s = newBlockSection('b1', anchors)
    expect(s).toMatchObject({ type: 'block', blockId: 'b1', html: '', media: [] })
    expect(s.values).toEqual({
      title: { kind: 'text', value: 'Рассрочка 0%' },
      body: { kind: 'richtext', value: '<p>Без переплат</p>' },
      photo: { kind: 'image', value: '/media/p.jpg' },
      cta: { kind: 'link', value: { href: '/apply', text: 'Подать заявку' } },
    })
  })

  it('переводимое: тексты и подпись ссылки, картинка — нет', () => {
    expect(translatableValue({ kind: 'image', value: '/x.jpg' })).toBeNull()
    expect(translatableValue({ kind: 'link', value: { href: '/a', text: 'Т' } })).toBe('Т')
  })

  it('полнота перевода и пропавшие якоря', () => {
    const section = newBlockSection('b1', anchors)
    const draft = { title: '', lead: '', sections: [section], translations: { uz: { title: '', lead: '', sections: {}, blocks: {} }, en: { title: '', lead: '', sections: {} } } } as unknown as NewsDraft
    expect(missingTranslation(draft, 'uz')).toEqual(['section:1'])
    draft.translations.uz.blocks = { [section.id]: { title: 'a', body: '<p>b</p>', cta: 'c' } }
    expect(missingTranslation(draft, 'uz')).toEqual([])
    expect(orphanValueKeys(section, anchors.slice(0, 2))).toEqual(['photo', 'cta'])
  })
})

describe('добавление блока в новость', () => {
  it('блок без якорей, нигде не используется: данные отмечены, интерфейс — нет; «переписать» → секция', async () => {
    cms.dataAnchors.mockResolvedValue(raw())
    cms.makeDataBlock.mockResolvedValue({ blockId: 'b-promo', name: 'Promo', anchors: anchors.slice(0, 1) })
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /Блок из библиотеки/ }))
    fireEvent.click(screen.getByRole('button', { name: 'выбрать Promo' }))
    const rows = await screen.findAllByTestId('anchor-candidate')
    expect(rows.map((r) => [r.getAttribute('data-suggested'), (within(r).getByRole('checkbox') as HTMLInputElement).checked])).toEqual([
      ['true', true],
      ['false', false],
    ])
    expect(screen.getByText(/Похоже на интерфейс: символ или стрелка/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Переписать этот блок' }))
    await waitFor(() => expect(cms.makeDataBlock).toHaveBeenCalledWith('b-promo', { mode: 'rewrite', picks: [{ nodeId: 'n1', kind: 'text', label: 'Заголовок · «Рассрочка 0%»' }] }))
    await waitFor(() => expect(state()).toHaveLength(1))
    expect(state()[0]).toMatchObject({ type: 'block', blockId: 'b-promo', values: { title: { kind: 'text', value: 'Рассрочка 0%' } } })
  })

  it('блок стоит на странице: предупреждение, переписать нельзя — только копия с именем', async () => {
    cms.dataAnchors.mockResolvedValue(raw({ usage: { ...empty, pages: [{ id: 'p', name: 'Главная', slug: 'main' }] }, actions: ['copy'] }))
    cms.makeDataBlock.mockResolvedValue({ blockId: 'b-copy', name: 'Promo — для новостей', anchors: anchors.slice(0, 1) })
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /Блок из библиотеки/ }))
    fireEvent.click(screen.getByRole('button', { name: 'выбрать Promo' }))
    expect((await screen.findByTestId('anchors-elsewhere')).textContent).toContain('страница «Главная» (/main)')
    expect(screen.queryByRole('button', { name: 'Переписать этот блок' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Создать копию с якорями' }))
    await waitFor(() => expect(cms.makeDataBlock).toHaveBeenCalledWith('b-promo', expect.objectContaining({ mode: 'copy', name: 'Promo — для новостей' })))
    await waitFor(() => expect(state()[0]?.blockId).toBe('b-copy'))
  })

  it('у блока уже есть якоря (стоит в других новостях) — добавляется как есть, без копии', async () => {
    cms.dataAnchors.mockResolvedValue(raw({ anchors, candidates: [], usage: { ...empty, news: [{ id: 'n', title: 'Другая' }] }, actions: ['use', 'copy'] }))
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /Блок из библиотеки/ }))
    fireEvent.click(screen.getByRole('button', { name: 'выбрать Promo' }))
    expect((await screen.findByTestId('anchors-ready')).textContent).toContain('других новостях (1)')
    fireEvent.click(screen.getByRole('button', { name: 'Добавить в новость' }))
    await waitFor(() => expect(state()[0]?.blockId).toBe('b-promo'))
    expect(cms.makeDataBlock).not.toHaveBeenCalled()
  })
})

describe('форма секции-блока', () => {
  it('поле на каждый якорь; правка пишет значение своего вида; пропавший якорь — предупреждение', async () => {
    cms.dataAnchors.mockResolvedValue(raw({ anchors: anchors.slice(0, 3), candidates: [], actions: ['use', 'copy'] }))
    const section = newBlockSection('b-promo', anchors)
    render(<Harness initial={[section]} />)
    const title = (await screen.findByLabelText('Заголовок')) as HTMLInputElement
    expect(title.value).toBe('Рассрочка 0%')
    fireEvent.change(title, { target: { value: 'Ипотека 12%' } })
    fireEvent.change(screen.getByLabelText('Фото'), { target: { value: '/media/new.jpg' } })
    expect(state()[0].values).toMatchObject({ title: { kind: 'text', value: 'Ипотека 12%' }, photo: { kind: 'image', value: '/media/new.jpg' } })
    expect(screen.getByTestId('block-orphans').textContent).toContain('cta')
    fireEvent.click(within(screen.getByTestId('block-orphans')).getByRole('button', { name: 'Убрать' }))
    expect(Object.keys(state()[0].values!)).toEqual(['title', 'body', 'photo'])
    expect(cms.dataAnchors).toHaveBeenCalledWith('b-promo', false)
  })
})

describe('перевод секции-блока', () => {
  it('поля только для текстов (картинки — общие); ввод пишет translations.uz.blocks', async () => {
    cms.dataAnchors.mockResolvedValue(raw({ anchors, candidates: [], actions: ['use', 'copy'] }))
    const section = newBlockSection('b-promo', anchors)
    const draft: NewsDraft = {
      slug: 's', categoryKey: null, tagKeys: [], title: 'Т', lead: '', cover: null, hero: [], sections: [section], publishOn: [], publishedAt: null,
      translations: { uz: { title: 'T', lead: '', sections: {}, blocks: {} }, en: { title: '', lead: '', sections: {}, blocks: {} } },
    }
    const onChange = vi.fn()
    render(<NewsTranslationForm draft={draft} locale="uz" onChange={onChange} />)
    const box = await screen.findByTestId('news-block-translation')
    await waitFor(() => expect(within(box).getByText(/«Promo»/)).toBeTruthy())
    expect(within(box).queryByLabelText(/Фото/)).toBeNull()
    fireEvent.change(within(box).getByLabelText('Заголовок · UZ'), { target: { value: 'Muddatli toʼlov' } })
    expect(onChange.mock.calls.at(-1)![0].translations.uz.blocks).toEqual({ [section.id]: { title: 'Muddatli toʼlov' } })
    expect(within(box).getByLabelText('Кнопка (подпись ссылки) · UZ')).toBeTruthy()
  })
})
