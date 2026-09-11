import { describe, it, expect } from 'vitest'
import {
  canStart,
  whyDisabled,
  startLabel,
  formatDuration,
  formatTime,
  formatDate,
  summarize,
  shouldPoll,
  type MacroSyncRun,
  type MacroSyncState,
} from './macroSync'

function run(over: Partial<MacroSyncRun> = {}): MacroSyncRun {
  return {
    id: 'r1',
    houseIds: [5139395, 5622025],
    status: 'ok',
    trigger: 'manual',
    apartmentsSeen: 336,
    plansProbed: 336,
    planTypesUpserted: 105,
    imagesDownloaded: 187,
    apiCalls: 354,
    error: null,
    startedAt: '2026-09-11T10:00:00.000Z',
    finishedAt: '2026-09-11T10:04:12.000Z',
    ...over,
  }
}

function state(over: Partial<MacroSyncState> = {}): MacroSyncState {
  return { configured: true, missing: [], running: false, resumable: null, runs: [], ...over }
}

describe('доступность кнопки', () => {
  it('настроено и не идёт — можно запускать', () => {
    expect(canStart(state(), false)).toBe(true)
  })

  it('пока состояние не загружено — нельзя', () => {
    expect(canStart(null, false)).toBe(false)
    expect(whyDisabled(null, false)).toMatch(/Проверяем/)
  })

  it('без токенов кнопка не работает и называет, чего не хватает', () => {
    const s = state({ configured: false, missing: ['MACRO_TOKEN', 'ESTATE_WRITE_TOKEN'] })
    expect(canStart(s, false)).toBe(false)
    expect(whyDisabled(s, false)).toContain('MACRO_TOKEN')
    expect(whyDisabled(s, false)).toContain('ESTATE_WRITE_TOKEN')
  })

  it('не настроено без списка переменных — всё равно объясняет', () => {
    expect(whyDisabled(state({ configured: false }), false)).toMatch(/не настроена/)
  })

  it('идущий прогон блокирует повторный запуск', () => {
    // Два прогона поделили бы лимит 100 запросов в минуту пополам.
    const s = state({ running: true })
    expect(canStart(s, false)).toBe(false)
    expect(whyDisabled(s, false)).toMatch(/уже идёт/)
  })

  it('во время отправки запроса кнопка недоступна', () => {
    expect(canStart(state(), true)).toBe(false)
    expect(whyDisabled(state(), true)).toMatch(/Запускается/)
  })

  it('доступная кнопка причины не показывает', () => {
    expect(whyDisabled(state(), false)).toBe('')
  })
})

describe('подпись кнопки', () => {
  it('обычный запуск', () => {
    expect(startLabel(state())).toBe('Синхронизировать')
  })

  it('прерванный прогон предлагается продолжить, а не начать заново', () => {
    expect(startLabel(state({ resumable: 'r1' }))).toMatch(/Продолжить/)
  })

  it('идущий прогон виден по подписи', () => {
    expect(startLabel(state({ running: true, resumable: 'r1' }))).toMatch(/идёт/)
  })
})

describe('длительность', () => {
  it('минуты и секунды', () => {
    expect(formatDuration(run())).toBe('4 мин 12 с')
  })

  it('меньше минуты — только секунды', () => {
    expect(formatDuration(run({ finishedAt: '2026-09-11T10:00:07.000Z' }))).toBe('7 с')
  })

  it('незавершённый прогон длительности не имеет', () => {
    expect(formatDuration(run({ finishedAt: null }))).toBe('')
  })

  it('битые даты не дают отрицательного времени', () => {
    expect(formatDuration(run({ finishedAt: '2026-01-01T00:00:00.000Z' }))).toBe('')
    expect(formatDuration(run({ finishedAt: 'вчера' }))).toBe('')
  })
})

describe('дата и время', () => {
  it('битая дата не ломает строку', () => {
    expect(formatTime('не дата')).toBe('—')
    expect(formatDate('не дата')).toBe('—')
  })

  it('время и дата разбираются', () => {
    // Часовой пояс машины неизвестен, поэтому проверяем форму, а не значение.
    expect(formatTime('2026-09-11T10:00:00.000Z')).toMatch(/^\d{2}:\d{2}$/)
    expect(formatDate('2026-09-11T10:00:00.000Z')).toMatch(/^\d{2}\.\d{2}$/)
  })
})

describe('итог прогона', () => {
  it('успешный показывает счётчики', () => {
    const text = summarize(run())
    expect(text).toContain('336 квартир')
    expect(text).toContain('105 планировок')
    expect(text).toContain('картинок 187')
    expect(text).toContain('запросов 354')
  })

  it('упавший показывает причину, а не нули', () => {
    const text = summarize(run({ status: 'failed', apartmentsSeen: 0, planTypesUpserted: 0, error: 'MacroCRM 401' }))
    expect(text).toBe('MacroCRM 401')
  })

  it('упавший без текста ошибки всё равно что-то говорит', () => {
    expect(summarize(run({ status: 'failed', error: null }))).toMatch(/не удался/)
  })

  it('частичный показывает и счётчики, и причину', () => {
    const text = summarize(run({ status: 'partial', error: '5622025: таймаут' }))
    expect(text).toContain('336 квартир')
    expect(text).toContain('таймаут')
  })

  it('успешный прогон с примечанием показывает и его', () => {
    // Прогон, который ничего не сделал, но назвался успешным, однажды уже
    // спрятал причину — счётчики есть, объяснения нет.
    const text = summarize(run({ status: 'ok', error: 'нечего синхронизировать' }))
    expect(text).toContain('нечего синхронизировать')
  })

  it('нулевые счётчики в строку не лезут', () => {
    const text = summarize(run({ plansProbed: 0, imagesDownloaded: 0, apiCalls: 0 }))
    expect(text).toBe('336 квартир, 105 планировок')
  })
})

describe('опрос журнала', () => {
  it('идёт прогон — опрашиваем', () => {
    expect(shouldPoll(state({ running: true }))).toBe(true)
  })

  it('не идёт — не опрашиваем: состояние меняется только по кнопке', () => {
    expect(shouldPoll(state())).toBe(false)
    expect(shouldPoll(null)).toBe(false)
  })
})
