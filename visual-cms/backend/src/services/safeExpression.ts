/**
 * Safe expression evaluator на основе `expr-eval`.
 *
 * Цель: исполнять пользовательские выражения трансформаций/computed-полей
 * БЕЗ node `vm` (который не является security-песочницей и подвержен RCE).
 *
 * Поддерживается:
 *  - арифметика, сравнения, тернарник `a ? b : c`
 *  - переменные из sandbox (value/item/index/items/variables/pageData/dataSources)
 *  - доступ по точке: `item.field.sub`
 *  - регистрируемые helper-функции вместо метод-вызовов
 *    (`trim(s)`, `upper(s)`, `lower(s)`, `len(x)`, `slice(s, a, b)`,
 *     `replace(s, from, to)`, `concat(...)`, `default(a, b)`, `if(c, a, b)`,
 *     `round(x)`, `floor(x)`, `ceil(x)`, `parseInt(s)`, `parseFloat(s)`)
 *  - helper-функции `$var(name)`, `$data(alias)`, `$page` (как переменная-объект)
 *
 * НЕ поддерживается (намеренно):
 *  - `await`/async (async-вычисления через `expr-eval` не делаются)
 *  - statements (if/for/while)
 *  - объектные/массивные литералы
 *  - `new`, `delete`, `eval`, `Function`
 *  - произвольные глобали (Date/JSON/Math доступны через helper'ы)
 *
 * Если выражение начинается с `return ` — префикс срезается (легаси-совместимость
 * с JS-стилем `return value * 2`).
 */

import { Parser } from 'expr-eval'

export class UnsafeExpressionError extends Error {
  constructor(public readonly expression: string, cause?: unknown) {
    super(
      `Expression cannot be safely evaluated: ${truncate(expression, 120)}` +
        (cause instanceof Error ? ` (${cause.message})` : '')
    )
    this.name = 'UnsafeExpressionError'
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

/** Helper'ы, регистрируемые в expr-eval Parser. Покрывают типичные операции,
 *  которые в JS делались через методы строк/массивов. */
function buildHelpers(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    // Строки
    upper: (s: unknown) => String(s ?? '').toUpperCase(),
    lower: (s: unknown) => String(s ?? '').toLowerCase(),
    trim: (s: unknown) => String(s ?? '').trim(),
    slice: (s: unknown, a: number, b?: number) => String(s ?? '').slice(a, b),
    replace: (s: unknown, from: unknown, to: unknown) =>
      String(s ?? '').split(String(from)).join(String(to)),
    concat: (...args: unknown[]) => args.map((a) => String(a ?? '')).join(''),
    // Длина строки/массива
    len: (x: unknown) => {
      if (Array.isArray(x)) return x.length
      if (x == null) return 0
      return String(x).length
    },
    // Числа
    round: (x: unknown) => Math.round(Number(x)),
    floor: (x: unknown) => Math.floor(Number(x)),
    ceil: (x: unknown) => Math.ceil(Number(x)),
    parseInt: (s: unknown) => parseInt(String(s ?? ''), 10),
    parseFloat: (s: unknown) => parseFloat(String(s ?? '')),
    // Условные
    default: (a: unknown, b: unknown) => (a == null || a === '' ? b : a),
    if: (cond: unknown, a: unknown, b: unknown) => (cond ? a : b),
    ...extra,
  }
}

/** Срезает префикс `return ` и хвостовую `;` (легаси-совместимость с JS). */
export function stripReturn(code: string): string {
  let s = code.trim()
  if (s.startsWith('return ') || s.startsWith('return\t')) {
    s = s.slice('return '.length).trim()
  } else if (s === 'return') {
    s = ''
  }
  if (s.endsWith(';')) s = s.slice(0, -1).trim()
  return s
}

/**
 * Безопасно вычисляет выражение в sandbox-окружении.
 *
 * @param expression  выражение (JS-подобное, синхронное; `return ...` допустим)
 * @param sandbox     переменные/значения, доступные в выражении
 * @param extraHelpers дополнительные helper-функции (например, `$var`, `$data`)
 * @throws UnsafeExpressionError если выражение не парсится или не вычисляется
 */
export function evaluateSafeExpression(
  expression: string,
  sandbox: Record<string, unknown>,
  extraHelpers: Record<string, unknown> = {}
): unknown {
  const code = stripReturn(expression)
  if (!code) {
    throw new UnsafeExpressionError(expression, new Error('empty expression'))
  }

  const parser = new Parser()
  let parsed
  try {
    parsed = parser.parse(code)
  } catch (err) {
    throw new UnsafeExpressionError(expression, err)
  }

  const scope: Record<string, unknown> = {
    ...buildHelpers(extraHelpers),
    ...sandbox,
  }

  try {
    // expr-eval типизирует Value узко; наш sandbox — Record<string, unknown>.
    // Это безопасное приведение: expr-eval сам валидирует доступ к идентификаторам.
    return parsed.evaluate(scope as never)
  } catch (err) {
    throw new UnsafeExpressionError(expression, err)
  }
}

/**
 * Проверяет, разрешено ли исполнение legacy JS через node `vm`.
 * По умолчанию — НЕТ (закрытие RCE-класса).
 *
 * Для обратной совместимости поведения существующих DataBinding-записей
 * можно включить через переменную окружения `ALLOW_USER_JS=true`. В этом
 * случае при попытке исполнения логгер пишет deprecation-warning.
 */
export function isLegacyJsAllowed(): boolean {
  return process.env.ALLOW_USER_JS === 'true'
}
