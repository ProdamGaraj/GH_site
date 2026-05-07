import { MacroV2Client } from '../services/MacroV2Client'

type FetchArgs = { url: string; init: RequestInit }

function makeFetch(responses: Array<{ status?: number; body: any }>) {
  const calls: FetchArgs[] = []
  const fn = (async (url: any, init: any) => {
    calls.push({ url: String(url), init })
    const r = responses.shift()
    if (!r) throw new Error('no more mocked responses')
    return {
      ok: (r.status ?? 200) >= 200 && (r.status ?? 200) < 300,
      status: r.status ?? 200,
      statusText: 'OK',
      json: async () => r.body,
      text: async () => JSON.stringify(r.body),
    } as unknown as Response
  }) as unknown as typeof fetch
  return { fn, calls }
}

describe('MacroV2Client.fetchComplexStats', () => {
  it('sends POST to /estateComplexes/listStats with bearer token and complexIds', async () => {
    const { fn, calls } = makeFetch([
      { body: { data: [{ id: 42, title: 'A', stats: { categories: { flat: { countOnSale: 1 } } } }] } },
    ])
    const c = new MacroV2Client({ baseUrl: 'https://api.x/', token: 'tok', fetchImpl: fn })
    const r = await c.fetchComplexStats([42, 43])

    expect(r).toHaveLength(1)
    expect(r[0].id).toBe(42)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://api.x/estateComplexes/listStats')
    expect(calls[0].init.method).toBe('POST')
    const headers = calls[0].init.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer tok')
    expect(headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ complexIds: [42, 43] })
  })

  it('omits complexIds in body when array is empty', async () => {
    const { fn, calls } = makeFetch([{ body: { data: [] } }])
    const c = new MacroV2Client({ baseUrl: 'https://api.x', token: 't', fetchImpl: fn })
    await c.fetchComplexStats([])
    expect(JSON.parse(String(calls[0].init.body))).toEqual({})
  })

  it('throws on non-2xx with status and body snippet', async () => {
    const { fn } = makeFetch([{ status: 401, body: { error: 'unauthorized' } }])
    const c = new MacroV2Client({ baseUrl: 'https://api.x', token: 't', fetchImpl: fn })
    await expect(c.fetchComplexStats([1])).rejects.toThrow(/MacroV2 401/)
  })

  it('skips items without a valid id', async () => {
    const { fn } = makeFetch([
      {
        body: {
          data: [
            { id: 7, stats: {} },
            { id: 'bad' },
            { /* no id */ stats: {} },
            { id: 8 },
          ],
        },
      },
    ])
    const c = new MacroV2Client({ baseUrl: 'https://api.x', token: 't', fetchImpl: fn })
    const r = await c.fetchComplexStats([1])
    expect(r.map(x => x.id)).toEqual([7, 8])
  })

  it('returns empty array when data is missing', async () => {
    const { fn } = makeFetch([{ body: {} }])
    const c = new MacroV2Client({ baseUrl: 'https://api.x', token: 't', fetchImpl: fn })
    expect(await c.fetchComplexStats([1])).toEqual([])
  })

  it('rejects construction without baseUrl/token', () => {
    expect(() => new MacroV2Client({ baseUrl: '', token: 't' })).toThrow(/baseUrl/)
    expect(() => new MacroV2Client({ baseUrl: 'x', token: '' })).toThrow(/token/)
  })
})
