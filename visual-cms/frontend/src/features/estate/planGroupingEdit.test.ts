import { describe, it, expect } from 'vitest'
import {
  emptyDraft,
  normalizeTolerance,
  toDraft,
  toPayload,
  sameConfig,
  setTolerance,
  mergeCards,
  separatePlan,
  restorePlan,
  ungroupCard,
  dropNames,
  formatAreaRange,
  formatNumberRange,
  roomsLabel,
  MAX_AREA_TOLERANCE,
} from './planGroupingEdit'

/** Каждое имя упоминается в настройке не больше одного раза. */
function mentions(draft: ReturnType<typeof emptyDraft>): string[] {
  return [...draft.groups.flatMap((g) => g.plans), ...draft.keepSeparate]
}

describe('normalizeTolerance', () => {
  it('округляет до сотых', () => {
    expect(normalizeTolerance(0.1 + 0.2)).toBe(0.3)
    expect(normalizeTolerance(0.014)).toBe(0.01)
  })

  it('понимает запятую из поля ввода', () => {
    expect(normalizeTolerance('0,25')).toBe(0.25)
  })

  it('мусор, пусто и отрицательное — ноль', () => {
    for (const bad of [undefined, null, '', 'abc', -1, NaN, Infinity]) {
      expect(normalizeTolerance(bad)).toBe(0)
    }
  })

  it('не выше серверного максимума', () => {
    expect(normalizeTolerance(999)).toBe(MAX_AREA_TOLERANCE)
  })
})

describe('toDraft', () => {
  it('null и {} — пустой черновик', () => {
    expect(toDraft(null)).toEqual(emptyDraft())
    expect(toDraft({})).toEqual(emptyDraft())
  })

  it('имя в двух группах остаётся только в первой', () => {
    const draft = toDraft({ groups: [{ plans: ['a', 'b'] }, { plans: ['b', 'c', 'd'] }] })
    expect(draft.groups).toEqual([{ plans: ['a', 'b'] }, { plans: ['c', 'd'] }])
  })

  it('группа, в которой после чистки осталось одно имя, отбрасывается', () => {
    const draft = toDraft({ groups: [{ plans: ['a', 'b'] }, { plans: ['b', 'c'] }] })
    expect(draft.groups).toEqual([{ plans: ['a', 'b'] }])
  })

  it('ручная группа важнее keepSeparate — как и на сервере', () => {
    const draft = toDraft({ groups: [{ plans: ['a', 'b'] }], keepSeparate: ['b', 'c'] })
    expect(draft.keepSeparate).toEqual(['c'])
  })

  it('повторы и пустые имена убираются', () => {
    const draft = toDraft({ groups: [{ plans: ['a', ' a ', '', 'b'] }], keepSeparate: ['c', 'c'] })
    expect(draft).toEqual({ areaTolerance: 0, groups: [{ plans: ['a', 'b'] }], keepSeparate: ['c'] })
  })
})

describe('toPayload', () => {
  it('настройка по умолчанию уходит как null', () => {
    expect(toPayload(emptyDraft())).toBeNull()
  })

  it('непустая — объектом', () => {
    expect(toPayload(setTolerance(emptyDraft(), 0.01))).toEqual({
      areaTolerance: 0.01,
      groups: [],
      keepSeparate: [],
    })
  })
})

describe('sameConfig', () => {
  it('null и пустой объект — одно и то же', () => {
    expect(sameConfig(null, {})).toBe(true)
    expect(sameConfig(null, emptyDraft())).toBe(true)
  })

  it('разный допуск — изменения есть', () => {
    expect(sameConfig({ areaTolerance: 0.01 }, { areaTolerance: 0.02 })).toBe(false)
  })
})

describe('mergeCards', () => {
  it('объединяет состав выбранных карточек в одну ручную группу', () => {
    const draft = mergeCards(emptyDraft(), [['a', 'b'], ['c']])
    expect(draft.groups).toEqual([{ plans: ['a', 'b', 'c'] }])
  })

  it('одна планировка — объединять нечего, черновик тот же', () => {
    const draft = emptyDraft()
    expect(mergeCards(draft, [['a']])).toBe(draft)
  })

  it('поглощает ручные группы, из которых пришли карточки', () => {
    const start = toDraft({ groups: [{ plans: ['a', 'b'] }, { plans: ['x', 'y'] }] })
    const draft = mergeCards(start, [['a', 'b'], ['c']])
    expect(draft.groups).toEqual([{ plans: ['x', 'y'] }, { plans: ['a', 'b', 'c'] }])
  })

  it('объединённые планировки перестают быть отделёнными', () => {
    const start = toDraft({ keepSeparate: ['a', 'z'] })
    const draft = mergeCards(start, [['a'], ['b']])
    expect(draft.keepSeparate).toEqual(['z'])
    expect(mentions(draft).filter((n) => n === 'a')).toHaveLength(1)
  })

  it('допуск не меняется', () => {
    const start = setTolerance(emptyDraft(), 0.25)
    expect(mergeCards(start, [['a'], ['b']]).areaTolerance).toBe(0.25)
  })
})

describe('separatePlan', () => {
  it('из автоматической карточки — в keepSeparate', () => {
    expect(separatePlan(emptyDraft(), 'a').keepSeparate).toEqual(['a'])
  })

  it('из ручной группы — уходит из группы и тоже в keepSeparate', () => {
    const start = toDraft({ groups: [{ plans: ['a', 'b', 'c'] }] })
    const draft = separatePlan(start, 'a')
    expect(draft.groups).toEqual([{ plans: ['b', 'c'] }])
    expect(draft.keepSeparate).toEqual(['a'])
  })

  it('ручная группа из двух распадается, если одну отделили', () => {
    const draft = separatePlan(toDraft({ groups: [{ plans: ['a', 'b'] }] }), 'a')
    expect(draft.groups).toEqual([])
    expect(draft.keepSeparate).toEqual(['a'])
  })

  it('повторное отделение не дублирует имя', () => {
    const draft = separatePlan(separatePlan(emptyDraft(), 'a'), 'a')
    expect(draft.keepSeparate).toEqual(['a'])
  })
})

describe('restorePlan / ungroupCard / dropNames', () => {
  const start = toDraft({ groups: [{ plans: ['a', 'b', 'c'] }], keepSeparate: ['s'] })

  it('restorePlan возвращает отделённую в автоматику', () => {
    expect(restorePlan(start, 's').keepSeparate).toEqual([])
  })

  it('ungroupCard распускает ручную группу целиком', () => {
    expect(ungroupCard(start, ['a', 'b', 'c']).groups).toEqual([])
    expect(ungroupCard(start, ['a', 'b', 'c']).keepSeparate).toEqual(['s'])
  })

  it('dropNames чистит пропавшие имена отовсюду', () => {
    const draft = dropNames(start, ['a', 's'])
    expect(draft).toEqual({ areaTolerance: 0, groups: [{ plans: ['b', 'c'] }], keepSeparate: [] })
  })

  it('исходный черновик не мутируется', () => {
    const snapshot = JSON.stringify(start)
    separatePlan(start, 'a')
    mergeCards(start, [['a'], ['s']])
    dropNames(start, ['b'])
    expect(JSON.stringify(start)).toBe(snapshot)
  })
})

describe('подписи', () => {
  it('площадь: одна или диапазон', () => {
    expect(formatAreaRange(21.08, 21.08)).toBe('21.08 м²')
    expect(formatAreaRange(39.79, 40.03)).toBe('39.79–40.03 м²')
  })

  it('этажи/подъезды: диапазон, одно значение, пусто', () => {
    expect(formatNumberRange([5, 2, 16])).toBe('2–16')
    expect(formatNumberRange([3])).toBe('3')
    expect(formatNumberRange([])).toBe('—')
  })

  it('комнатность', () => {
    expect(roomsLabel(2, false)).toBe('2-комн.')
    expect(roomsLabel(0, true)).toBe('Студия')
  })
})
