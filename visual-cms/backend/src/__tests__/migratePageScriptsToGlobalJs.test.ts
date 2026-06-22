/**
 * Тесты чистой функции свёртки legacy PageScript[] → globalJs.
 * Раннер (DB) не трогаем — проверяем только трансформацию и идемпотентность.
 */
import { foldLegacyScriptsIntoGlobalJs } from '../scripts/migrate-page-scripts-to-globaljs'

describe('foldLegacyScriptsIntoGlobalJs', () => {
  it('переносит включённые скрипты с кодом', () => {
    const result = foldLegacyScriptsIntoGlobalJs(
      [
        { name: 'A', code: 'a()', enabled: true },
        { name: 'B', code: 'b()', enabled: true },
      ],
      undefined,
    )
    expect(result).toContain('a()')
    expect(result).toContain('b()')
    expect(result).toContain('(migrated from page scripts)')
  })

  it('пропускает выключенные и пустые', () => {
    const result = foldLegacyScriptsIntoGlobalJs(
      [
        { name: 'off', code: 'x()', enabled: false },
        { name: 'empty', code: '   ', enabled: true },
      ],
      undefined,
    )
    expect(result).toBeNull()
  })

  it('дописывает к существующему globalJs', () => {
    const result = foldLegacyScriptsIntoGlobalJs(
      [{ name: 'A', code: 'a()', enabled: true }],
      'existing()',
    )
    expect(result).toContain('existing()')
    expect(result).toContain('a()')
    expect(result!.indexOf('existing()')).toBeLessThan(result!.indexOf('a()'))
  })

  it('идемпотентность: повторный перенос не дублирует', () => {
    const already = 'existing()\n\n/* A (migrated from page scripts) */\na()'
    const result = foldLegacyScriptsIntoGlobalJs(
      [{ name: 'A', code: 'a()', enabled: true }],
      already,
    )
    expect(result).toBeNull()
  })

  it('пустой/отсутствующий список → null', () => {
    expect(foldLegacyScriptsIntoGlobalJs(undefined, undefined)).toBeNull()
    expect(foldLegacyScriptsIntoGlobalJs([], 'x()')).toBeNull()
  })

  it('enabled по умолчанию (undefined) считается включённым', () => {
    const result = foldLegacyScriptsIntoGlobalJs([{ name: 'A', code: 'a()' }], undefined)
    expect(result).toContain('a()')
  })
})
