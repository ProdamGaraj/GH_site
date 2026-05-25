import { describe, it, expect } from 'vitest'
import { parseMultiValue } from './MultiValueInput'

describe('parseMultiValue', () => {
  it('пустая строка → пустой массив', () => {
    expect(parseMultiValue('')).toEqual([])
  })

  it('одно значение без запятой', () => {
    expect(parseMultiValue('abc')).toEqual(['abc'])
  })

  it('висящая запятая отбрасывает пустой хвостик — корневая причина бага', () => {
    // Этот инвариант ломал контролируемый input: parse('abc,') === parse('abc'),
    // поэтому при re-render через value.join() запятая «съедалась». Local raw
    // state в компоненте именно эту коллизию и обходит.
    expect(parseMultiValue('abc,')).toEqual(['abc'])
    expect(parseMultiValue('abc')).toEqual(['abc'])
  })

  it('два значения', () => {
    expect(parseMultiValue('abc,def')).toEqual(['abc', 'def'])
    expect(parseMultiValue('abc, def')).toEqual(['abc', 'def'])
  })

  it('пробелы по краям trim-ятся, пустые между разделителями выкидываются', () => {
    expect(parseMultiValue('  a , , b ,  ')).toEqual(['a', 'b'])
  })

  it('кастомные разделители: запятая / перевод строки / точка с запятой', () => {
    expect(parseMultiValue('a,b\nc;d', /[,\n;]/)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('значения с внутренними пробелами сохраняются как один элемент', () => {
    expect(parseMultiValue('John Smith, Mary Jane')).toEqual(['John Smith', 'Mary Jane'])
  })

  it('одинокий разделитель → пустой массив (а не [\'\', \'\'])', () => {
    expect(parseMultiValue(',')).toEqual([])
    expect(parseMultiValue(', ,')).toEqual([])
  })
})
