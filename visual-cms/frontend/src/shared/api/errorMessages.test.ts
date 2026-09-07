/**
 * Сообщения о сбоях запроса. Регрессия, ради которой они появились: nginx
 * отдаёт 502 с HTML, тело не парсится как JSON, и пользователь на форме логина
 * видел «Network error» при полностью рабочей сети.
 */
import { describe, it, expect } from 'vitest'
import {
  describeHttpFailure,
  describeNetworkFailure,
  NETWORK_FAILURE_STATUS,
} from './errorMessages'

describe('describeHttpFailure', () => {
  it('502/503/504 называют причину — бэкенд не отвечает', () => {
    for (const status of [502, 503, 504]) {
      const msg = describeHttpFailure(status)
      expect(msg).toContain(String(status))
      expect(msg).toMatch(/не отвечает/)
      expect(msg).toMatch(/бэкенд/)
    }
  })

  it('ни одно описание не выдаёт ответ сервера за сетевую ошибку', () => {
    for (const status of [401, 403, 404, 413, 429, 500, 502, 503, 504, 418]) {
      expect(describeHttpFailure(status)).not.toMatch(/Не удалось связаться/)
    }
  })

  it('401 говорит про сессию, а не про сеть', () => {
    expect(describeHttpFailure(401)).toMatch(/сесси|вход/i)
  })

  it('429 подсказывает подождать', () => {
    expect(describeHttpFailure(429)).toMatch(/запросов/)
  })

  it('неизвестный статус не теряется — попадает в текст', () => {
    expect(describeHttpFailure(418)).toContain('418')
  })

  it('любой статус даёт непустое сообщение', () => {
    for (const status of [400, 401, 403, 404, 409, 413, 422, 429, 500, 502, 599]) {
      expect(describeHttpFailure(status).length).toBeGreaterThan(10)
    }
  })
})

describe('describeNetworkFailure', () => {
  it('называет сетевой ошибкой только несостоявшийся запрос', () => {
    expect(describeNetworkFailure(new TypeError('Failed to fetch')))
      .toMatch(/Не удалось связаться с сервером/)
  })

  it('сохраняет исходную причину для диагностики', () => {
    expect(describeNetworkFailure(new TypeError('Failed to fetch'))).toContain('Failed to fetch')
  })

  it('не падает на не-Error значении', () => {
    expect(describeNetworkFailure('нечто')).toMatch(/Не удалось связаться/)
    expect(describeNetworkFailure(undefined)).toMatch(/Не удалось связаться/)
  })
})

describe('NETWORK_FAILURE_STATUS', () => {
  it('нулевой — не пересекается с реальными HTTP-статусами', () => {
    expect(NETWORK_FAILURE_STATUS).toBe(0)
  })
})
