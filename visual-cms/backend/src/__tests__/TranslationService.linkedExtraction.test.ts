/**
 * Выдача контента на перевод должна видеть linked-блоки.
 *
 * В сырой `page.structure` у подключённого блока `children` пуст — содержимое
 * подставляется только на деплое. Пока выдача читала сырую структуру, на
 * перевод не попадало ни слова из шапки, подвала и любой секции-блока: у
 * страницы-шаблона проекта это весь её контент. При этом применение переводов
 * идёт по `nodeId` и такие строки принимает, то есть перевести их было нечем
 * исключительно из-за выдачи.
 */
import { extractTranslatableFields, dedupeEntries, TranslationEntry } from '../services/TranslationService'

/** Страница в том виде, в каком она лежит в базе: у linked-блока детей нет. */
const rawPage = {
  id: 'page-root',
  children: [
    { id: 'nav-slot', metadata: { linkedBlockId: 'block-nav' }, children: [] },
    { id: 'own-heading', content: 'Собственный заголовок страницы' },
    { id: 'choice-slot', metadata: { linkedBlockId: 'block-choice' }, children: [] },
  ],
}

/** Та же страница после разворота — так её видит деплой. */
const expandedPage = {
  id: 'page-root',
  children: [
    {
      id: 'nav-slot',
      metadata: { linkedBlockId: 'block-nav' },
      children: [
        { id: 'nav-home', content: 'Главная' },
        { id: 'nav-book', content: 'Оставить заявку', attributes: { 'aria-label': 'Форма заявки' } },
      ],
    },
    { id: 'own-heading', content: 'Собственный заголовок страницы' },
    {
      id: 'choice-slot',
      metadata: { linkedBlockId: 'block-choice' },
      children: [{ id: 'choice-title', content: 'Выбрать' }],
    },
  ],
}

const texts = (entries: TranslationEntry[]) => entries.filter((e) => e.field === 'content').map((e) => e.value)

describe('extractTranslatableFields на сырой и развёрнутой странице', () => {
  it('сырая структура отдаёт только собственный текст страницы — блоки не видны', () => {
    expect(texts(extractTranslatableFields(rawPage))).toEqual(['Собственный заголовок страницы'])
  })

  it('развёрнутая отдаёт и текст блоков — именно его и надо переводить', () => {
    expect(texts(extractTranslatableFields(expandedPage))).toEqual([
      'Главная',
      'Оставить заявку',
      'Собственный заголовок страницы',
      'Выбрать',
    ])
  })

  it('переводимые атрибуты внутри блока тоже попадают в выдачу', () => {
    const entries = extractTranslatableFields(expandedPage)
    expect(entries).toContainEqual({ nodeId: 'nav-book', field: 'aria-label', value: 'Форма заявки' })
  })

  it('идентификаторы узлов блока сохраняются — по ним перевод и применяется', () => {
    const ids = extractTranslatableFields(expandedPage).map((e) => e.nodeId)
    expect(ids).toContain('nav-home')
    expect(ids).toContain('choice-title')
  })
})

describe('dedupeEntries', () => {
  it('один блок, подключённый дважды, не задваивает строки', () => {
    const twice = [...extractTranslatableFields(expandedPage), ...extractTranslatableFields(expandedPage)]
    expect(twice.length).toBe(extractTranslatableFields(expandedPage).length * 2)
    expect(dedupeEntries(twice)).toEqual(extractTranslatableFields(expandedPage))
  })

  it('одинаковый nodeId с разными полями остаётся двумя строками', () => {
    const entries: TranslationEntry[] = [
      { nodeId: 'n1', field: 'content', value: 'Текст' },
      { nodeId: 'n1', field: 'aria-label', value: 'Метка' },
    ]
    expect(dedupeEntries(entries)).toHaveLength(2)
  })

  it('побеждает первое вхождение', () => {
    const entries: TranslationEntry[] = [
      { nodeId: 'n1', field: 'content', value: 'Первое' },
      { nodeId: 'n1', field: 'content', value: 'Второе' },
    ]
    expect(dedupeEntries(entries)).toEqual([{ nodeId: 'n1', field: 'content', value: 'Первое' }])
  })

  it('пустой вход — пустой выход', () => {
    expect(dedupeEntries([])).toEqual([])
  })
})
