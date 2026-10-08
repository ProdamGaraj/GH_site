/**
 * Рантаймы-файлы (services/runtime/*.js): читаются с диска и перечитываются,
 * когда файл меняется, — правка .js на dev-стенде без перезапуска бэкенда
 * попадает в следующий деплой.
 */
const disk = { mtime: 1, text: 'console.log(1)', reads: 0 }
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  statSync: () => ({ mtimeMs: disk.mtime }),
  readFileSync: () => {
    disk.reads++
    return disk.text
  },
}))

import { runtimeScript, runtimeSource } from '../services/runtimeFile'

describe('runtimeSource', () => {
  let mtime = 1
  let text = ''
  const sync = () => {
    disk.mtime = mtime
    disk.text = text
  }

  beforeEach(() => {
    disk.reads = 0
  })

  it('файл не менялся — читается один раз', () => {
    mtime = 100
    text = 'v1()'
    sync()
    expect(runtimeSource('zz-test.js')).toBe('v1()')
    expect(runtimeSource('zz-test.js')).toBe('v1()')
    expect(disk.reads).toBe(1)
  })

  it('файл изменился — перечитывается', () => {
    mtime = 200
    text = 'v2()'
    sync()
    expect(runtimeSource('zz-test.js')).toBe('v2()')
    expect(disk.reads).toBe(1)
  })

  it('</script> внутри файла — ошибка (закрыл бы тег раньше времени)', () => {
    mtime = 300
    text = 'var s = "</script>"'
    sync()
    expect(() => runtimeSource('zz-test.js')).toThrow(/<\/script>/)
  })

  it('runtimeScript — в теге <script>', () => {
    mtime = 400
    text = 'go()'
    sync()
    expect(runtimeScript('zz-test.js')).toBe('<script>\ngo()\n</script>')
  })
})
