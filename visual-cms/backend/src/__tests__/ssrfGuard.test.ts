import { isBlockedIp, assertUrlAllowed, safeFetch, SsrfBlockedError } from '../utils/ssrfGuard'

describe('ssrfGuard', () => {
  describe('isBlockedIp (IPv4)', () => {
    const blocked = [
      '0.0.0.0',
      '10.0.0.5',
      '127.0.0.1',
      '169.254.169.254', // cloud metadata
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '100.64.0.1', // CGNAT
      '198.18.0.1', // benchmark
      '224.0.0.1', // multicast
      '255.255.255.255',
    ]
    const allowed = [
      '8.8.8.8',
      '1.1.1.1',
      '172.15.0.1', // вне 172.16/12
      '172.32.0.1', // вне 172.16/12
      '192.169.0.1', // вне 192.168/16
      '100.63.0.1', // вне 100.64/10
      '11.0.0.1',
    ]
    it.each(blocked)('блокирует %s', (ip) => {
      expect(isBlockedIp(ip)).toBe(true)
    })
    it.each(allowed)('пропускает %s', (ip) => {
      expect(isBlockedIp(ip)).toBe(false)
    })
  })

  describe('isBlockedIp (IPv6)', () => {
    it.each(['::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', '::ffff:127.0.0.1'])(
      'блокирует %s',
      (ip) => {
        expect(isBlockedIp(ip)).toBe(true)
      }
    )
    it('пропускает публичный IPv6', () => {
      expect(isBlockedIp('2001:4860:4860::8888')).toBe(false)
    })
  })

  describe('assertUrlAllowed', () => {
    afterEach(() => {
      delete process.env.SSRF_ALLOWED_HOSTS
    })

    it.each([
      'http://127.0.0.1/',
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.1/api',
      'http://192.168.1.1/',
      'http://[::1]:8080/',
    ])('отклоняет приватный/loopback %s', async (url) => {
      await expect(assertUrlAllowed(url)).rejects.toBeInstanceOf(SsrfBlockedError)
    })

    it.each(['ftp://example.com/', 'file:///etc/passwd', 'gopher://x/'])(
      'отклоняет протокол %s',
      async (url) => {
        await expect(assertUrlAllowed(url)).rejects.toBeInstanceOf(SsrfBlockedError)
      }
    )

    it('пропускает публичный IP-литерал без DNS', async () => {
      await expect(assertUrlAllowed('http://8.8.8.8/path')).resolves.toBeUndefined()
    })

    it('пропускает хост из SSRF_ALLOWED_HOSTS без DNS-резолва', async () => {
      process.env.SSRF_ALLOWED_HOSTS = 'internal-api,trusted.local'
      // host резолвился бы с ошибкой, но allowlist срабатывает раньше
      await expect(assertUrlAllowed('http://trusted.local/data')).resolves.toBeUndefined()
    })

    it('отклоняет некорректный URL', async () => {
      await expect(assertUrlAllowed('not a url')).rejects.toBeInstanceOf(SsrfBlockedError)
    })
  })

  describe('safeFetch', () => {
    const realFetch = global.fetch

    afterEach(() => {
      global.fetch = realFetch
    })

    it('не вызывает fetch для заблокированного URL', async () => {
      const spy = jest.fn()
      global.fetch = spy as unknown as typeof fetch

      await expect(safeFetch('http://127.0.0.1/')).rejects.toBeInstanceOf(SsrfBlockedError)
      expect(spy).not.toHaveBeenCalled()
    })

    it('ре-валидирует редирект и отклоняет переход на приватный адрес', async () => {
      const spy = jest.fn(async () =>
        new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } })
      )
      global.fetch = spy as unknown as typeof fetch

      await expect(safeFetch('http://8.8.8.8/start')).rejects.toBeInstanceOf(SsrfBlockedError)
      // первый (публичный) hop — выполнен; редирект на metadata — отклонён до второго fetch
      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('возвращает успешный ответ для разрешённого URL', async () => {
      const spy = jest.fn(async () => new Response('ok', { status: 200 }))
      global.fetch = spy as unknown as typeof fetch

      const res = await safeFetch('http://8.8.8.8/data')
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('ok')
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })
})
