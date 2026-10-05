import express from 'express'
import request from 'supertest'
import { requireWriteToken } from '../middleware/writeAuth'

function app() {
  const a = express()
  a.post('/w', requireWriteToken, (_req, res) => {
    res.json({ ok: true })
  })
  return a
}

const saved = process.env.NEWS_WRITE_TOKEN
afterEach(() => {
  process.env.NEWS_WRITE_TOKEN = saved
})

describe('requireWriteToken', () => {
  it('токен не задан — записи запрещены целиком (fail-closed)', async () => {
    process.env.NEWS_WRITE_TOKEN = ''
    const res = await request(app()).post('/w').set('X-News-Token', 'anything')
    expect(res.status).toBe(403)
  })

  it('нет или неверный заголовок — 401', async () => {
    process.env.NEWS_WRITE_TOKEN = 'secret-token'
    expect((await request(app()).post('/w')).status).toBe(401)
    expect((await request(app()).post('/w').set('X-News-Token', 'secret-tokeN')).status).toBe(401)
    expect((await request(app()).post('/w').set('X-News-Token', 'secret')).status).toBe(401)
  })

  it('верный токен — пропускает', async () => {
    process.env.NEWS_WRITE_TOKEN = 'secret-token'
    const res = await request(app()).post('/w').set('X-News-Token', 'secret-token')
    expect(res.status).toBe(200)
  })
})
