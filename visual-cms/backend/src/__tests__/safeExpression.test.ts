/**
 * B1 фаза 2 — safeExpression: безопасное вычисление пользовательских
 * выражений через `expr-eval` (без node `vm`/RCE).
 */
import {
  evaluateSafeExpression,
  stripReturn,
  UnsafeExpressionError,
} from '../services/safeExpression'

describe('safeExpression', () => {
  describe('stripReturn', () => {
    it.each([
      ['return value * 2', 'value * 2'],
      ['  return  x + 1 ', 'x + 1'],
      ['return value;', 'value'],
      ['value * 2', 'value * 2'],
      ['return', ''],
      ['', ''],
    ])('stripReturn(%j) === %j', (input, expected) => {
      expect(stripReturn(input)).toBe(expected)
    })
  })

  describe('evaluateSafeExpression — арифметика и переменные', () => {
    it('вычисляет арифметику с переменными', () => {
      expect(evaluateSafeExpression('value * 2', { value: 10 })).toBe(20)
    })
    it('тернарный оператор', () => {
      expect(evaluateSafeExpression('a > b ? a : b', { a: 5, b: 3 })).toBe(5)
    })
    it('member access по точке', () => {
      expect(evaluateSafeExpression('item.price', { item: { price: 99 } })).toBe(99)
    })
    it('срезает префикс `return` для совместимости с JS-стилем', () => {
      expect(evaluateSafeExpression('return value + 1', { value: 10 })).toBe(11)
    })
  })

  describe('evaluateSafeExpression — helper-функции', () => {
    it('upper / lower / trim', () => {
      expect(evaluateSafeExpression('upper(s)', { s: 'hi' })).toBe('HI')
      expect(evaluateSafeExpression('lower(s)', { s: 'HI' })).toBe('hi')
      expect(evaluateSafeExpression('trim(s)', { s: '  x  ' })).toBe('x')
    })
    it('concat / len / slice / replace', () => {
      expect(evaluateSafeExpression('concat(a, " ", b)', { a: 'Hi', b: 'there' })).toBe('Hi there')
      expect(evaluateSafeExpression('len(s)', { s: 'abc' })).toBe(3)
      expect(evaluateSafeExpression('len(arr)', { arr: [1, 2, 3, 4] })).toBe(4)
      expect(evaluateSafeExpression('slice(s, 0, 3)', { s: 'abcdef' })).toBe('abc')
      expect(evaluateSafeExpression('replace(s, "x", "Y")', { s: 'axbxc' })).toBe('aYbYc')
    })
    it('round / floor / ceil', () => {
      expect(evaluateSafeExpression('round(x)', { x: 2.5 })).toBe(3)
      expect(evaluateSafeExpression('floor(x)', { x: 2.9 })).toBe(2)
      expect(evaluateSafeExpression('ceil(x)', { x: 2.1 })).toBe(3)
    })
    it('default / if', () => {
      expect(evaluateSafeExpression('default(a, b)', { a: null, b: 'x' })).toBe('x')
      expect(evaluateSafeExpression('default(a, b)', { a: 'orig', b: 'x' })).toBe('orig')
      expect(evaluateSafeExpression('if(c, "yes", "no")', { c: true })).toBe('yes')
    })
  })

  describe('evaluateSafeExpression — extraHelpers ($var/$data)', () => {
    it('$var и $page', () => {
      const sandbox = { $page: { lang: 'ru' } }
      const helpers = { $var: (n: string) => ({ bonus: 5 } as any)[n] }
      expect(evaluateSafeExpression('item.p + $var("bonus")', { ...sandbox, item: { p: 10 } }, helpers)).toBe(15)
      expect(evaluateSafeExpression('$page.lang', sandbox, helpers)).toBe('ru')
    })
    it('$data возвращает массив, len() работает на нём', () => {
      const helpers = { $data: (a: string) => ((a === 'x' ? [1, 2, 3] : []) as unknown[]) }
      expect(evaluateSafeExpression('len($data("x"))', {}, helpers)).toBe(3)
    })
  })

  describe('UnsafeExpressionError — отклоняем небезопасный JS', () => {
    it('отклоняет вызов запрещённой глобали (eval/Function)', () => {
      // expr-eval не знает идентификатор `eval` → бросает UnsafeExpressionError
      expect(() => evaluateSafeExpression('eval("1+1")', {})).toThrow(UnsafeExpressionError)
    })
    it('отклоняет метод-вызовы строк (.toUpperCase())', () => {
      // expr-eval не парсит JS-метод-вызовы; для строк используйте helper upper(s)
      expect(() => evaluateSafeExpression('value.toUpperCase()', { value: 'x' })).toThrow(UnsafeExpressionError)
    })
    it('отклоняет пустую/невалидную строку', () => {
      expect(() => evaluateSafeExpression('', {})).toThrow(UnsafeExpressionError)
      expect(() => evaluateSafeExpression('return', {})).toThrow(UnsafeExpressionError)
      expect(() => evaluateSafeExpression('@@@', {})).toThrow(UnsafeExpressionError)
    })
    it('сообщение ошибки содержит фрагмент выражения', () => {
      try {
        evaluateSafeExpression('a + b', {})
      } catch (e) {
        expect(e).toBeInstanceOf(UnsafeExpressionError)
        expect((e as Error).message).toContain('a + b')
      }
    })
  })

})
