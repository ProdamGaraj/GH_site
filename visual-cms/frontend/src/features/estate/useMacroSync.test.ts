import { describe, it, expect, vi } from 'vitest'

// Чистая функция: клиент API здесь не нужен.
vi.mock('./macroSyncApi', () => ({ macroSyncApi: {} }))

import { runFinished } from './useMacroSync'
import type { MacroSyncState } from './macroSync'

const state = (over: Partial<MacroSyncState> = {}): MacroSyncState =>
  ({ configured: true, missing: [], running: false, resumable: null, runs: [], ...over }) as MacroSyncState
const withRun = (id: string, running = false) => state({ running, runs: [{ id } as any] })

describe('runFinished — когда обновлять данные после синхронизации', () => {
  it('шёл и перестал — закончился', () => {
    expect(runFinished(withRun('r2'), true, null)).toBe(true)
  })

  it('ещё идёт — нет', () => {
    expect(runFinished(withRun('r2', true), true, null)).toBe(false)
  })

  it('короткий прогон: не видели идущим, но в журнале новый прогон — закончился', () => {
    expect(runFinished(withRun('r2'), false, { at: 0, previousRunId: 'r1' })).toBe(true)
  })

  it('нажали, а нового прогона в журнале ещё нет — не закончился', () => {
    expect(runFinished(withRun('r1'), false, { at: 0, previousRunId: 'r1' })).toBe(false)
    expect(runFinished(state(), false, { at: 0, previousRunId: null })).toBe(false)
  })

  it('просто открыли страницу — не повод обновлять', () => {
    expect(runFinished(withRun('r1'), false, null)).toBe(false)
  })
})
