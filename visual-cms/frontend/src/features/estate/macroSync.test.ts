import { describe, it, expect } from 'vitest'
import {
  canStart,
  isStarting,
  showsRunning,
  PENDING_TIMEOUT_MS,
  PENDING_POLL_MS,
  pollInterval,
  POLL_INTERVAL_MS,
  RETRY_INTERVAL_MS,
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
    imagesDownloaded: 17,
    imagesReused: 170,
    imagesFailed: 0,
    imagesMoved: 0,
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
    expect(text).toContain('запросов 354')
  })

  it('картинки считаются все, а новые — уточнением', () => {
    // «Картинок 17» читается как «картинок мало», хотя 170 просто уже лежали
    // в медиатеке с прошлого прогона.
    expect(summarize(run())).toContain('картинок 187 (новых 17)')
  })

  it('когда качать было нечего, скобок нет', () => {
    const text = summarize(run({ imagesDownloaded: 0, imagesReused: 187 }))
    expect(text).toContain('картинок 187')
    expect(text).not.toContain('новых')
  })

  it('первый прогон показывает просто число', () => {
    const text = summarize(run({ imagesDownloaded: 187, imagesReused: 0 }))
    expect(text).toContain('картинок 187')
    expect(text).not.toContain('новых')
  })

  it('перекладывание по папкам видно в строке', () => {
    // Импортёр его считал, но до панели число не доезжало: отличить «не
    // переложилось» от «переложилось молча» было нечем.
    expect(summarize(run({ imagesMoved: 187 }))).toContain('разложено по папкам 187')
  })

  it('непереносившиеся картинки видно — иначе ракурсы пропадут молча', () => {
    expect(summarize(run({ imagesFailed: 4 }))).toContain('не перенеслось 4')
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
    const text = summarize(
      run({ plansProbed: 0, imagesDownloaded: 0, imagesReused: 0, apiCalls: 0 })
    )
    expect(text).toBe('336 квартир, 105 планировок')
  })
})

describe('опрос журнала', () => {
  it('идёт прогон — опрашиваем', () => {
    expect(shouldPoll(state({ running: true }))).toBe(true)
  })

  it('не идёт — не опрашиваем: состояние меняется только по кнопке', () => {
    expect(shouldPoll(state())).toBe(false)
  })

  it('состояние не загрузилось — повторяем', () => {
    // Бэкенд мог перезапускаться и отдать 502. Без повтора панель осталась бы
    // с ошибкой навсегда, пока не перезагрузят вкладку.
    expect(shouldPoll(null)).toBe(true)
  })

  it('повтор после сбоя реже, чем слежение за прогоном', () => {
    expect(pollInterval(null)).toBe(RETRY_INTERVAL_MS)
    expect(pollInterval(state({ running: true }))).toBe(POLL_INTERVAL_MS)
    expect(RETRY_INTERVAL_MS).toBeGreaterThan(POLL_INTERVAL_MS)
  })
})

describe('запуск до подтверждения сервером', () => {
  /**
   * Бэкенд отвечает 202 сразу, а строку прогона создаёт в фоне. Первый запрос
   * статуса после нажатия успевал прийти раньше и возвращал running: false —
   * панель считала, что ничего не идёт, и переставала опрашивать. Кнопка
   * оживала только после перезагрузки страницы.
   */
  const NOW = 1_000_000
  const pending = { at: NOW, previousRunId: 'r-old' }
  const withRuns = (ids: string[], running = false) =>
    state({ running, runs: ids.map((id) => ({ ...run(), id })) })

  it('сразу после нажатия панель показывает «идёт»', () => {
    expect(isStarting(pending, withRuns(['r-old']), NOW + 200)).toBe(true)
    expect(showsRunning(withRuns(['r-old']), true)).toBe(true)
    expect(startLabel(withRuns(['r-old']), true)).toMatch(/идёт/)
  })

  it('без нажатия ничего не выдумываем', () => {
    expect(isStarting(null, withRuns(['r-old']), NOW)).toBe(false)
  })

  it('сервер подтвердил флагом running — ожидание снимается', () => {
    expect(isStarting(pending, withRuns(['r-old'], true), NOW + 200)).toBe(false)
  })

  it('короткий прогон успел закончиться — новый id в журнале тоже подтверждение', () => {
    // Иначе панель ждала бы running, которого уже не будет.
    expect(isStarting(pending, withRuns(['r-new', 'r-old']), NOW + 200)).toBe(false)
  })

  it('терпение не бесконечно — иначе спиннер завис бы навсегда', () => {
    expect(isStarting(pending, withRuns(['r-old']), NOW + PENDING_TIMEOUT_MS)).toBe(false)
  })

  it('пока ждём — кнопка недоступна и объясняет почему', () => {
    expect(canStart(withRuns(['r-old']), false, true)).toBe(false)
    expect(whyDisabled(withRuns(['r-old']), false, true)).toMatch(/запускается/i)
  })

  it('пока ждём — опрашиваем, и чаще обычного', () => {
    expect(shouldPoll(withRuns(['r-old']), true)).toBe(true)
    expect(pollInterval(withRuns(['r-old']), true)).toBe(PENDING_POLL_MS)
    expect(PENDING_POLL_MS).toBeLessThan(pollInterval(state({ running: true })))
  })

  it('первый пустой журнал тоже подтверждается появлением прогона', () => {
    const fresh = { at: NOW, previousRunId: null }
    expect(isStarting(fresh, state({ runs: [] }), NOW + 200)).toBe(true)
    expect(isStarting(fresh, withRuns(['r-new']), NOW + 200)).toBe(false)
  })
})
