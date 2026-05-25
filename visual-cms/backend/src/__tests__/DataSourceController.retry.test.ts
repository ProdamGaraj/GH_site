/**
 * Ретрай теста подключения на транзиентных сетевых ошибках (EAI_AGAIN и т.п.).
 */

jest.mock('../config/database', () => ({
  AppDataSource: { getRepository: () => ({ findOne: jest.fn(), update: jest.fn() }) },
}))

import { DataSourceController } from '../controllers/DataSourceController'

describe('DataSourceController — ретрай теста подключения', () => {
  let controller: DataSourceController

  beforeEach(() => {
    controller = new DataSourceController()
  })

  describe('isTransientTestError', () => {
    const check = (r: any) => (controller as any).isTransientTestError(r)

    it('true для транзиентных сетевых ошибок', () => {
      for (const msg of ['fetch failed: EAI_AGAIN', 'ETIMEDOUT', 'socket ECONNRESET', 'ENETUNREACH', 'request timeout']) {
        expect(check({ success: false, error: { message: msg } })).toBe(true)
      }
    })

    it('false для устойчивых ошибок и успеха', () => {
      expect(check({ success: true })).toBe(false)
      expect(check({ success: false, error: { message: 'fetch failed: CERT_HAS_EXPIRED' } })).toBe(false)
      expect(check({ success: false, error: { message: 'connect ECONNREFUSED' } })).toBe(false)
      expect(check({ success: false, error: { message: 'HTTP 404 Not Found' } })).toBe(false)
      expect(check({ success: false })).toBe(false)
    })
  })

  describe('performConnectionTestWithRetry', () => {
    const transient = { success: false, message: 'fetch failed: EAI_AGAIN', error: { message: 'fetch failed: EAI_AGAIN' } }

    it('повторяет при транзиентной ошибке и возвращает успех со второй попытки', async () => {
      const spy = jest.fn()
        .mockResolvedValueOnce(transient)
        .mockResolvedValueOnce({ success: true, message: 'Connection successful' })
      ;(controller as any).performConnectionTest = spy

      const result = await (controller as any).performConnectionTestWithRetry('rest-api', {}, undefined)
      expect(result.success).toBe(true)
      expect(spy).toHaveBeenCalledTimes(2)
    })

    it('делает максимум 3 попытки при стойко транзиентной ошибке', async () => {
      const spy = jest.fn().mockResolvedValue(transient)
      ;(controller as any).performConnectionTest = spy

      const result = await (controller as any).performConnectionTestWithRetry('rest-api', {}, undefined)
      expect(result.success).toBe(false)
      expect(spy).toHaveBeenCalledTimes(3)
    })

    it('НЕ повторяет при устойчивой ошибке (CERT_HAS_EXPIRED)', async () => {
      const spy = jest.fn().mockResolvedValue({
        success: false, message: 'fetch failed: CERT_HAS_EXPIRED', error: { message: 'fetch failed: CERT_HAS_EXPIRED' },
      })
      ;(controller as any).performConnectionTest = spy

      const result = await (controller as any).performConnectionTestWithRetry('rest-api', {}, undefined)
      expect(result.success).toBe(false)
      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('НЕ повторяет при успехе с первой попытки', async () => {
      const spy = jest.fn().mockResolvedValue({ success: true, message: 'Connection successful' })
      ;(controller as any).performConnectionTest = spy

      await (controller as any).performConnectionTestWithRetry('rest-api', {}, undefined)
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })
})
