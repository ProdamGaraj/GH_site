import { Request, Response, NextFunction } from 'express'

/**
 * Защита write-эндпоинтов: заголовок `X-Estate-Token` должен совпасть с
 * `ESTATE_WRITE_TOKEN`. Чтение (GET) открыто во внутренней сети; записи идут
 * из админки CMS через прокси и несут токен.
 *
 * Токен не задан → записи полностью запрещены (fail-closed).
 * Сравнение за постоянное время (защита от timing-атак).
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function requireWriteToken(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.ESTATE_WRITE_TOKEN || ''
  if (!expected) {
    res.status(403).json({ error: 'Writes are disabled (ESTATE_WRITE_TOKEN not set)' })
    return
  }
  const provided = req.get('X-Estate-Token') || ''
  if (!provided || !safeEqual(provided, expected)) {
    res.status(401).json({ error: 'Invalid or missing X-Estate-Token' })
    return
  }
  next()
}
