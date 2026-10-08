/**
 * Блок данных из библиотечного блока: что можно сделать (use / copy / rewrite)
 * по тому, где блок используется; переписать — с копией и чисткой переводов
 * заменённых полей; копия — новые id узлов, переводы статики под новыми id,
 * исходный блок не тронут.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { MemoryRepo } from './helpers/memoryRepos'

const BACKUPS = fs.mkdtempSync(path.join(os.tmpdir(), 'anchors-'))
process.env.BACKUP_DIR = BACKUPS
process.env.NEWS_SERVICE_URL = 'http://news-service:5200'
process.env.NEWS_WRITE_TOKEN = 'secret'

const repos: Record<string, MemoryRepo> = {
  Block: new MemoryRepo('blocks'),
  BlockTranslation: new MemoryRepo('block_translations'),
  Page: new MemoryRepo('pages'),
}
jest.mock('../config/database', () => ({
  AppDataSource: {
    getRepository: (e: { name: string }) => repos[e.name],
    transaction: async (cb: (m: unknown) => unknown) => cb({ getRepository: (e: { name: string }) => repos[e.name] }),
  },
}))
jest.mock('../services/CacheService', () => ({ cacheService: { invalidateByTag: jest.fn(async () => undefined) } }))

import { blockDataAnchorsService } from '../services/BlockDataAnchorsService'
import { anchorActions } from '../services/blockDataUsage'

const PROMO = '00000000-0000-4000-8000-0000000000aa'
const promo = {
  id: PROMO,
  name: 'Promo',
  type: 'section',
  isReusable: true,
  tags: [],
  structure: {
    id: 'root',
    tagName: 'section',
    elementType: 'container',
    children: [
      { id: 'title', tagName: 'h2', elementType: 'text', content: 'Рассрочка 0%' },
      { id: 'note', tagName: 'p', elementType: 'text', content: 'Подробности в офисе продаж' },
      { id: 'arrow', tagName: 'span', elementType: 'text', content: '↗' },
    ],
  },
}

let estateItems: unknown[]
let newsItems: Array<{ id: string; title: string }>
let fetchSpy: jest.SpyInstance

beforeEach(() => {
  repos.Block.seed([JSON.parse(JSON.stringify(promo))])
  repos.BlockTranslation.seed([
    { blockId: PROMO, nodeId: 'title', field: 'content', locale: 'uz', value: 'Muddatli toʼlov 0%', status: 'draft' },
    { blockId: PROMO, nodeId: 'note', field: 'content', locale: 'uz', value: 'Tafsilotlar savdo ofisida', status: 'draft' },
  ])
  repos.Page.seed([])
  estateItems = []
  newsItems = []
  fetchSpy = jest.spyOn(global, 'fetch').mockImplementation((async (url: string) => {
    const body = String(url).includes('estate') ? { items: estateItems } : { items: newsItems }
    return { ok: true, status: 200, json: async () => body } as Response
  }) as never)
})
afterEach(() => fetchSpy.mockRestore())
afterAll(() => fs.rmSync(BACKUPS, { recursive: true, force: true }))

const picks = [{ nodeId: 'title', kind: 'text' as const, label: 'Заголовок' }]

describe('anchorActions', () => {
  const empty = { pages: [], blocks: [], projects: [], news: [], unchecked: [] }
  it('якоря есть — использовать (или копия по желанию)', () => {
    expect(anchorActions(true, { ...empty, pages: [{ id: 'p', name: 'p', slug: 'p' }] })).toEqual(['use', 'copy'])
  })
  it('без якорей, нигде не показывается (или только в новостях) — переписать или копия', () => {
    expect(anchorActions(false, empty)).toEqual(['rewrite', 'copy'])
    expect(anchorActions(false, { ...empty, news: [{ id: 'n', title: 'n' }] })).toEqual(['rewrite', 'copy'])
  })
  it('без якорей, стоит на странице, в другом блоке или слайдом проекта — только копия', () => {
    expect(anchorActions(false, { ...empty, pages: [{ id: 'p', name: 'p', slug: 'p' }] })).toEqual(['copy'])
    expect(anchorActions(false, { ...empty, blocks: [{ id: 'b', name: 'b' }] })).toEqual(['copy'])
    expect(anchorActions(false, { ...empty, projects: ['harizma'] })).toEqual(['copy'])
  })
  it('проверить не удалось — только копия: переписывать вслепую нельзя', () => {
    expect(anchorActions(false, { ...empty, unchecked: ['estate-service'] })).toEqual(['copy'])
  })
})

describe('info', () => {
  it('кандидаты, использование (страница, блок, проект, новости), действия', async () => {
    repos.Page.seed([{ id: 'pg', name: 'Главная', slug: 'main', structure: { id: 'r', children: [{ id: 'x', metadata: { linkedBlockId: PROMO }, children: [] }] } }])
    repos.Block.rows.push({ id: 'outer', name: 'Обёртка', structure: { id: 'o', children: [{ id: 'y', metadata: { linkedBlockId: PROMO } }] } })
    estateItems = [{ slug: 'harizma', heroSlides: [{ url: `block:${PROMO}` }] }, { slug: 'ozmahal', heroSlides: [] }]
    newsItems = [{ id: 'n1', title: 'Новость' }]
    const info = await blockDataAnchorsService.info(PROMO)
    expect(info.anchors).toEqual([])
    expect(info.candidates.map((c) => [c.nodeId, c.suggested])).toEqual([
      ['title', true],
      ['note', true],
      ['arrow', false],
    ])
    expect(info.usage).toMatchObject({ pages: [{ slug: 'main' }], blocks: [{ name: 'Обёртка' }], projects: ['harizma'], news: [{ id: 'n1' }], unchecked: [] })
    expect(info.actions).toEqual(['copy'])
  })

  it('сервис ЖК не ответил — «не удалось проверить», переписать нельзя', async () => {
    fetchSpy.mockImplementation((async (url: string) => (String(url).includes('estate') ? { ok: false, status: 502 } : { ok: true, json: async () => ({ items: [] }) })) as never)
    const info = await blockDataAnchorsService.info(PROMO)
    expect(info.usage.unchecked).toEqual(['estate-service (слайды проектов)'])
    expect(info.actions).toEqual(['copy'])
  })
})

describe('makeDataBlock: rewrite', () => {
  it('нигде не используется — блок переписан, копия прежней структуры в файле, переводы заменённого поля удалены', async () => {
    const r = await blockDataAnchorsService.makeDataBlock(PROMO, 'rewrite', picks)
    expect(r.blockId).toBe(PROMO)
    const saved = repos.Block.rows.find((b) => b.id === PROMO)!
    expect(saved.structure.children[0].content).toBe('{{$.zagolovok}}')
    expect(saved.structure.children[1].content).toBe('Подробности в офисе продаж')
    expect(repos.BlockTranslation.rows.map((t) => t.nodeId)).toEqual(['note'])
    expect(JSON.parse(fs.readFileSync(r.backup!, 'utf-8')).structure.children[0].content).toBe('Рассрочка 0%')
  })

  it('блок стоит на странице — переписать нельзя, блок не тронут', async () => {
    repos.Page.seed([{ id: 'pg', name: 'Главная', slug: 'main', structure: { id: 'r', children: [{ id: 'x', metadata: { linkedBlockId: PROMO } }] } }])
    await expect(blockDataAnchorsService.makeDataBlock(PROMO, 'rewrite', picks)).rejects.toThrow(/только создать копию/)
    expect(repos.Block.rows[0].structure.children[0].content).toBe('Рассрочка 0%')
  })
})

describe('makeDataBlock: copy', () => {
  it('новый блок с новыми id и якорями; исходный не тронут; переводы статики — под новыми id', async () => {
    repos.Page.seed([{ id: 'pg', name: 'Главная', slug: 'main', structure: { id: 'r', children: [{ id: 'x', metadata: { linkedBlockId: PROMO } }] } }])
    const r = await blockDataAnchorsService.makeDataBlock(PROMO, 'copy', picks)
    expect(r.blockId).not.toBe(PROMO)
    expect(r.name).toBe('Promo — для новостей')
    const copy = repos.Block.rows.find((b) => b.id === r.blockId)!
    expect(copy.isReusable).toBe(true)
    const [title, note] = copy.structure.children
    expect(title.content).toBe('{{$.zagolovok}}')
    expect([copy.structure.id, title.id, note.id]).not.toContain('title')
    expect(note.id).not.toBe('note')
    expect(repos.Block.rows.find((b) => b.id === PROMO)!.structure.children[0].content).toBe('Рассрочка 0%')
    // Перевод неизменённого абзаца — у копии под новым id; заменённого заголовка — нет.
    const copied = repos.BlockTranslation.rows.filter((t) => t.blockId === r.blockId)
    expect(copied).toEqual([expect.objectContaining({ nodeId: note.id, value: 'Tafsilotlar savdo ofisida', locale: 'uz' })])
    expect(repos.BlockTranslation.rows.filter((t) => t.blockId === PROMO)).toHaveLength(2)
  })

  it('своё имя копии; неизвестный узел — ошибка', async () => {
    const r = await blockDataAnchorsService.makeDataBlock(PROMO, 'copy', picks, 'Акция — новости')
    expect(r.name).toBe('Акция — новости')
    await expect(blockDataAnchorsService.makeDataBlock(PROMO, 'copy', [{ nodeId: 'nope', kind: 'text', label: 'x' }])).rejects.toThrow(/нет в блоке/)
  })
})

describe('копия блока данных и лёгкий режим', () => {
  it('копия блока, у которого уже есть якоря, — без выбора: якоря как были, новые id', async () => {
    await blockDataAnchorsService.makeDataBlock(PROMO, 'rewrite', picks)
    const r = await blockDataAnchorsService.makeDataBlock(PROMO, 'copy', [])
    expect(r.blockId).not.toBe(PROMO)
    expect(r.anchors.map((a) => a.key)).toEqual(['zagolovok'])
    expect(r.anchors[0].nodeId).not.toBe('title')
  })

  it('без якорей и без выбора — ошибка', async () => {
    await expect(blockDataAnchorsService.makeDataBlock(PROMO, 'copy', [])).rejects.toThrow(/ни одного якоря/)
  })

  it('info без использования — сервисы не опрашиваются', async () => {
    const info = await blockDataAnchorsService.info(PROMO, false)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(info.candidates.length).toBeGreaterThan(0)
  })
})

describe('lostAnchorsInNews', () => {
  it('пропавший якорь, который используют новости, — ключ и новости; без пропаж — пусто', async () => {
    const before = { id: 'r', children: [{ id: 't', content: '{{$.title}}', metadata: { dataAnchor: { key: 'title', label: 'T', kind: 'text', sample: '' } } }] }
    newsItems = [{ id: 'n1', title: 'Новость' }]
    expect(await blockDataAnchorsService.lostAnchorsInNews(PROMO, before, { id: 'r', children: [] })).toEqual({ keys: ['title'], news: [{ id: 'n1', title: 'Новость' }] })
    expect(await blockDataAnchorsService.lostAnchorsInNews(PROMO, before, before)).toEqual({ keys: [], news: [] })
  })
})
