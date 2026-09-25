/**
 * Вариант страницы — копия с тем же адресом: черновик, вместе с переводами,
 * привязками данных и переменными страницы.
 */
import { DataBinding } from '../models/DataBinding'
import { Page } from '../models/Page'
import { PageVariable } from '../models/PageVariable'
import { Translation } from '../models/Translation'
import { PageVariantService, copyRow, variantPageFields } from '../services/PageVariantService'

const original = {
  id: 'p1',
  name: 'Harizma',
  slug: 'harizma',
  siteId: 'site',
  site: { id: 'site' },
  groupId: 'g',
  group: { id: 'g' },
  status: 'published',
  version: 7,
  isTemplate: false,
  metadata: { title: 'Harizma', description: '', keywords: [] },
  structure: { id: 'root', children: [] },
  dataSources: { dataSources: [], variables: {}, cachePolicy: 'cache-first' },
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-02-01'),
} as unknown as Page

describe('variantPageFields', () => {
  const fields = variantPageFields(original, 1)

  it('всё содержимое оригинала, черновик, первая версия, имя с номером варианта', () => {
    expect(fields).toMatchObject({
      name: 'Harizma — вариант 2',
      slug: 'harizma',
      siteId: 'site',
      groupId: 'g',
      status: 'draft',
      version: 1,
      structure: original.structure,
      metadata: original.metadata,
      dataSources: original.dataSources,
    })
  })

  it('без id, дат и связей-объектов: у копии свои, связи — по id', () => {
    for (const key of ['id', 'createdAt', 'updatedAt', 'site', 'group']) expect(fields).not.toHaveProperty(key)
  })
})

describe('copyRow', () => {
  it('строка для новой страницы: свой pageId, без id и дат', () => {
    const row = { id: 'r1', pageId: 'p1', locale: 'uz', nodeId: 'n1', field: 'content', value: 'Salom', createdAt: 1, updatedAt: 2 }
    expect(copyRow(row, 'p2')).toEqual({ pageId: 'p2', locale: 'uz', nodeId: 'n1', field: 'content', value: 'Salom' })
  })
})

/** Менеджер транзакции с репозиториями в памяти. */
function fakeManager(rows: Map<unknown, Array<Record<string, unknown>>>) {
  const saved = new Map<unknown, Array<Record<string, unknown>>>()
  const repo = (entity: unknown) => ({
    findOne: jest.fn(async ({ where }: { where: { id: string } }) => (rows.get(entity) ?? []).find((r) => r.id === where.id) ?? null),
    find: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
      (rows.get(entity) ?? []).filter((r) => Object.entries(where).every(([k, v]) => r[k] === v))),
    create: jest.fn((data: Record<string, unknown>) => ({ ...data })),
    save: jest.fn(async (data: Record<string, unknown> | Array<Record<string, unknown>>) => {
      const list = Array.isArray(data) ? data : [data]
      saved.set(entity, [...(saved.get(entity) ?? []), ...list])
      if (entity === Page && !Array.isArray(data)) return { ...data, id: 'p-new' }
      return data
    }),
  })
  const repos = new Map<unknown, ReturnType<typeof repo>>()
  const manager = { getRepository: (entity: unknown) => repos.get(entity) ?? repos.set(entity, repo(entity)).get(entity)! }
  return { manager, saved }
}

describe('PageVariantService.createVariantIn', () => {
  const page = { id: 'p1', name: 'Harizma', slug: 'harizma', siteId: 'site', status: 'published', version: 3, structure: {}, metadata: {} }

  function setup() {
    const rows = new Map<unknown, Array<Record<string, unknown>>>([
      [Page, [page, { id: 'p0', slug: 'harizma', siteId: 'other', status: 'draft' }, { id: 'p9', slug: 'harizma', siteId: 'site', status: 'draft' }]],
      [Translation, [
        { id: 't1', pageId: 'p1', locale: 'uz', nodeId: 'n1', field: 'content', value: 'Salom' },
        { id: 't2', pageId: 'other', locale: 'uz', nodeId: 'n1', field: 'content', value: 'чужой' },
      ]],
      [DataBinding, [{ id: 'b1', pageId: 'p1', blockId: 'n2', dataSourceId: 'ds' }]],
      [PageVariable, []],
    ])
    return fakeManager(rows)
  }

  it('вариант — черновик того же адреса, номер считает только этот сайт', async () => {
    const { manager, saved } = setup()
    const variant = await new PageVariantService().createVariantIn(manager as never, 'p1')
    expect(variant?.id).toBe('p-new')
    expect(saved.get(Page)![0]).toMatchObject({ slug: 'harizma', siteId: 'site', status: 'draft', version: 1, name: 'Harizma — вариант 3' })
  })

  it('переводы и привязки копируются на вариант, чужие строки не трогаются', async () => {
    const { manager, saved } = setup()
    await new PageVariantService().createVariantIn(manager as never, 'p1')
    expect(saved.get(Translation)).toEqual([{ pageId: 'p-new', locale: 'uz', nodeId: 'n1', field: 'content', value: 'Salom' }])
    expect(saved.get(DataBinding)).toEqual([{ pageId: 'p-new', blockId: 'n2', dataSourceId: 'ds' }])
    expect(saved.has(PageVariable)).toBe(false) // пусто — нечего сохранять
  })

  it('страницы нет — null, ничего не создаётся', async () => {
    const { manager, saved } = setup()
    expect(await new PageVariantService().createVariantIn(manager as never, 'nope')).toBeNull()
    expect(saved.size).toBe(0)
  })
})
