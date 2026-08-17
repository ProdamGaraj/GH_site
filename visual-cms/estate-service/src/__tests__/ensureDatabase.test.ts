import { parseTargetDb } from '../config/ensureDatabase'

describe('parseTargetDb', () => {
  it('extracts db name from a valid url', () => {
    expect(parseTargetDb('postgresql://u:p@postgres:5432/estate')).toBe('estate')
    expect(parseTargetDb('postgres://u:p@host:5432/visual_cms')).toBe('visual_cms')
  })

  it('throws when url missing', () => {
    expect(() => parseTargetDb(undefined)).toThrow(/not set/)
    expect(() => parseTargetDb('')).toThrow(/not set/)
  })

  it('throws when no database name', () => {
    expect(() => parseTargetDb('postgresql://u:p@postgres:5432/')).toThrow(/no database name/)
  })

  it('rejects unsafe identifiers (DDL injection guard)', () => {
    expect(() => parseTargetDb('postgresql://u:p@h:5432/estate;DROP')).toThrow(/Unsafe/)
    expect(() => parseTargetDb('postgresql://u:p@h:5432/"evil"')).toThrow(/Unsafe/)
    expect(() => parseTargetDb('postgresql://u:p@h:5432/1bad')).toThrow(/Unsafe/)
  })
})
