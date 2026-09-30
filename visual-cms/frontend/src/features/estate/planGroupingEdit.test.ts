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
  setGroupHidden,
  setOverrideField,
  setBadges,
  resetToCrm,
  forgetOverride,
  hasCrmOverride,
  overrideProblems,
  parseArea,
  parseNumberList,
  parseBadges,
  formatNumberList,
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
    expect(draft).toEqual({ areaTolerance: 0, groups: [{ plans: ['a', 'b'] }], keepSeparate: ['c'], hidden: [], overrides: {} })
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
      hidden: [],
      overrides: {},
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
    expect(draft).toEqual({ areaTolerance: 0, groups: [{ plans: ['b', 'c'] }], keepSeparate: [], hidden: [], overrides: {} })
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

describe('скрытие групп', () => {
  it('скрыть — все планировки группы; вернуть — снять со всех', () => {
    let draft = setGroupHidden(emptyDraft(), ['b', 'a'], true)
    expect(draft.hidden).toEqual(['a', 'b'])
    draft = setGroupHidden(draft, ['c'], true)
    expect(draft.hidden).toEqual(['a', 'b', 'c'])
    draft = setGroupHidden(draft, ['a', 'b'], false)
    expect(draft.hidden).toEqual(['c'])
  })

  it('объединение и отделение карточек скрытие не трогают', () => {
    const draft = setGroupHidden(emptyDraft(), ['a'], true)
    expect(mergeCards(draft, [['a'], ['b']]).hidden).toEqual(['a'])
    expect(separatePlan(draft, 'a').hidden).toEqual(['a'])
  })

  it('пропавшие имена уходят и из скрытых', () => {
    expect(dropNames(setGroupHidden(emptyDraft(), ['a', 'b'], true), ['a']).hidden).toEqual(['b'])
  })
})

describe('ручные данные групп', () => {
  it('поле ставится и снимается (undefined — вернуть CRM); пустая правка удаляется', () => {
    let draft = setOverrideField(emptyDraft(), 'A', 'areaMin', 54.5)
    draft = setOverrideField(draft, 'A', 'floors', [16, 2, 2])
    expect(draft.overrides).toEqual({ A: { areaMin: 54.5, floors: [2, 16] } })
    draft = setOverrideField(draft, 'A', 'areaMin', undefined)
    draft = setOverrideField(draft, 'A', 'floors', undefined)
    expect(draft.overrides).toEqual({})
  })

  it('бейджи по языкам; пустой список убирает язык', () => {
    let draft = setBadges(emptyDraft(), 'A', 'ru', ['Акция', ' Акция ', ''])
    draft = setBadges(draft, 'A', 'uz', ['Aksiya'])
    expect(draft.overrides.A.badges).toEqual({ ru: ['Акция'], uz: ['Aksiya'] })
    draft = setBadges(draft, 'A', 'uz', [])
    expect(draft.overrides.A.badges).toEqual({ ru: ['Акция'] })
  })

  it('«Подставить значения из CRM» снимает поля CRM, бейджи оставляет', () => {
    let draft = setOverrideField(emptyDraft(), 'A', 'areaMin', 1)
    draft = setOverrideField(draft, 'A', 'entrances', [1, 3])
    draft = setBadges(draft, 'A', 'ru', ['Акция'])
    expect(hasCrmOverride(draft.overrides.A)).toBe(true)
    draft = resetToCrm(draft, 'A')
    expect(draft.overrides).toEqual({ A: { badges: { ru: ['Акция'] } } })
    expect(hasCrmOverride(draft.overrides.A)).toBe(false)
    // Без бейджей правка исчезает целиком.
    expect(resetToCrm(setOverrideField(emptyDraft(), 'B', 'areaMax', 5), 'B').overrides).toEqual({})
  })

  it('«забыть» — правка целиком', () => {
    const draft = setBadges(setOverrideField(emptyDraft(), 'B', 'areaMin', 1), 'B', 'ru', ['x'])
    expect(forgetOverride(draft, 'B').overrides).toEqual({})
  })

  it('правка идёт за планировкой: объединение её не стирает, пропажа имени — стирает', () => {
    const draft = setOverrideField(emptyDraft(), 'A', 'areaMin', 1)
    expect(mergeCards(draft, [['A'], ['B']]).overrides).toEqual({ A: { areaMin: 1 } })
    expect(dropNames(draft, ['A']).overrides).toEqual({})
  })

  it('черновики с правками сравниваются по сути, не по порядку ключей', () => {
    const a = setOverrideField(setOverrideField(emptyDraft(), 'B', 'areaMin', 1), 'A', 'areaMin', 2)
    const b = setOverrideField(setOverrideField(emptyDraft(), 'A', 'areaMin', 2), 'B', 'areaMin', 1)
    expect(sameConfig(a, b)).toBe(true)
    expect(toPayload(a)).toEqual(toPayload(b))
  })

  it('только скрытие или только правка — не «настройка по умолчанию»', () => {
    expect(toPayload(setGroupHidden(emptyDraft(), ['a'], true))).not.toBeNull()
    expect(toPayload(setOverrideField(emptyDraft(), 'A', 'areaMin', 1))).not.toBeNull()
  })

  it('«от» больше «до» — ошибка группы, как на сервере', () => {
    let draft = setOverrideField(emptyDraft(), 'B', 'areaMin', 60)
    draft = setOverrideField(draft, 'B', 'areaMax', 55)
    draft = setOverrideField(draft, 'C', 'areaMin', 10)
    expect(overrideProblems(draft)).toEqual({ B: 'Площадь «от» больше площади «до»' })
  })

  it('цена из правки старой версии в черновик не попадает — на сайте цен нет', () => {
    const draft = toDraft({
      overrides: {
        A: { priceMin: 450, priceMax: 700, entrances: [1] } as any,
        B: { priceMin: 1 } as any,
      },
    })
    expect(draft.overrides).toEqual({ A: { entrances: [1] } })
    expect(JSON.stringify(toPayload(draft))).not.toMatch(/price/)
  })
})

describe('ввод значений', () => {
  it('площадь: запятая, сотые', () => {
    expect(parseArea('55,3')).toEqual({ ok: true, value: 55.3 })
    expect(parseArea('40.25')).toEqual({ ok: true, value: 40.25 })
    expect(parseArea('')).toEqual({ ok: true, value: undefined })
    expect(parseArea('40.255')).toEqual({ ok: false })
    expect(parseArea('abc')).toEqual({ ok: false })
  })

  it('этажи и подъезды: диапазоны, списки, минус, повторы', () => {
    expect(parseNumberList('2–5, 7')).toEqual({ ok: true, value: [2, 3, 4, 5, 7] })
    expect(parseNumberList('2-4 3')).toEqual({ ok: true, value: [2, 3, 4] })
    expect(parseNumberList('-1, 1')).toEqual({ ok: true, value: [-1, 1] })
    expect(parseNumberList('')).toEqual({ ok: true, value: undefined })
  })

  it('недописанное и перевёрнутое — ошибка (в черновик не уходит)', () => {
    for (const bad of ['2–', '5-2', '1.5', 'a', '1-999']) expect(parseNumberList(bad)).toEqual({ ok: false })
  })

  it('бейджи через запятую', () => {
    expect(parseBadges('Акция, , Последняя планировка, Акция')).toEqual(['Акция', 'Последняя планировка'])
    expect(parseBadges('')).toEqual([])
  })

  it('вывод: списки — диапазонами', () => {
    expect(formatNumberList([7, 2, 3, 4, 5])).toBe('2–5, 7')
    expect(formatNumberList([1, 3])).toBe('1, 3')
    expect(formatNumberList([])).toBe('—')
  })

  it('разбор и вывод согласованы: вывод разбирается обратно в то же', () => {
    for (const list of [[2, 3, 4, 16], [-1, 1, 2], [5]]) {
      expect(parseNumberList(formatNumberList(list))).toEqual({ ok: true, value: list })
    }
  })
})
