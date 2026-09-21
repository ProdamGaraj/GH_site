import { describe, it, expect } from 'vitest'
import {
  readPageSize,
  countPages,
  clampPage,
  pageAfterSizeChange,
  PAGE_SIZE_OPTIONS,
  PAGE_SIZE_DEFAULT,
} from './pageSize'

describe('сохранённый размер страницы', () => {
  it('читается, когда это один из вариантов', () => {
    expect(readPageSize('48')).toBe(48)
  })

  it('пустое хранилище даёт умолчание', () => {
    expect(readPageSize(null)).toBe(PAGE_SIZE_DEFAULT)
    expect(readPageSize('')).toBe(PAGE_SIZE_DEFAULT)
  })

  it('значение не из списка отвергается', () => {
    // Произвольное число из хранилища (чужая версия, ручная правка) рассыпало
    // бы раскладку сетки.
    expect(readPageSize('37')).toBe(PAGE_SIZE_DEFAULT)
    expect(readPageSize('-5')).toBe(PAGE_SIZE_DEFAULT)
    expect(readPageSize('много')).toBe(PAGE_SIZE_DEFAULT)
  })

  it('все объявленные варианты принимаются', () => {
    for (const size of PAGE_SIZE_OPTIONS) expect(readPageSize(String(size))).toBe(size)
  })
})

describe('число страниц', () => {
  it('считается с округлением вверх', () => {
    expect(countPages(25, 12)).toBe(3)
    expect(countPages(24, 12)).toBe(2)
  })

  it('пустая выдача — одна пустая страница, а не ноль', () => {
    expect(countPages(0, 12)).toBe(1)
  })

  it('мусор не даёт «0 страниц» и деления на ноль', () => {
    expect(countPages(NaN, 12)).toBe(1)
    expect(countPages(100, 0)).toBe(1)
  })
})

describe('номер страницы в границах', () => {
  it('за концом прижимается к последней', () => {
    // После смены фильтра выдача укорачивается, и текущая страница может
    // оказаться за концом.
    expect(clampPage(7, 3)).toBe(3)
  })

  it('меньше первой не бывает', () => {
    expect(clampPage(0, 5)).toBe(1)
    expect(clampPage(-3, 5)).toBe(1)
  })

  it('мусор даёт первую', () => {
    expect(clampPage(NaN, 5)).toBe(1)
  })
})

describe('смена размера страницы', () => {
  it('держит человека на том же месте выдачи', () => {
    // При 12 на странице третья начинается с 25-го файла; при 48 тот же файл
    // лежит на первой.
    expect(pageAfterSizeChange(3, 12, 48)).toBe(1)
  })

  it('при уменьшении размера номер растёт', () => {
    // 25-й файл при 12 на странице — это третья страница.
    expect(pageAfterSizeChange(1, 48, 12)).toBe(1)
    expect(pageAfterSizeChange(2, 48, 12)).toBe(5)
  })

  it('первая страница остаётся первой при любом размере', () => {
    for (const size of PAGE_SIZE_OPTIONS) expect(pageAfterSizeChange(1, 12, size)).toBe(1)
  })

  it('тот же размер номер не двигает', () => {
    expect(pageAfterSizeChange(4, 24, 24)).toBe(4)
  })

  it('мусорный размер не роняет расчёт', () => {
    expect(pageAfterSizeChange(3, 12, 0)).toBe(1)
    expect(pageAfterSizeChange(3, 12, NaN)).toBe(1)
  })
})
