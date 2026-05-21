# Миграция выражений Data Binding (B1 фаза 2)

> Дата: 20 мая 2026
> Контекст: [KNOWN_ISSUES.md](../KNOWN_ISSUES.md) — B1 (фазы 1+2.A+2.B+2.C
> закрыты).

## Зачем

Раньше `mapping.transform` и `computedFields[].expression` исполнялись через
node `vm` — это **не является security-песочницей** (тривиальный escape →
RCE в backend-процессе). Закрытие этого класса риска требует отказа от
произвольного JS в пользу безопасных декларативных трансформаций и
выражений через `expr-eval`.

С фазы 2.C (cutover, 20 мая 2026) **vm-путь полностью удалён**: backend
исполняет только `expr-eval`-совместимые выражения и built-in трансформации.
Любое выражение, не парсящееся как expr-eval (метод-вызовы `.toUpperCase()`,
шаблонные литералы, `await`, statements), отклоняется с
`Transform error: ...` / `UnsafeExpressionError`. Старая переменная
окружения `ALLOW_USER_JS` больше не имеет эффекта.

## Что поддерживается без JS

### Built-in трансформации (`mapping.transform`)

Указываются как имя/префикс в поле `transform` маппинга:

| Имя | Поведение |
|---|---|
| `uppercase` / `lowercase` / `trim` | строковые преобразования |
| `number` / `boolean` / `string` / `json` | приведение типа |
| `round` / `floor` / `ceil` / `length` | числовые |
| `template:Привет, {{value}}!` | подстановка `{{value}}` в шаблон |
| `replace:from\|to` | замена всех вхождений подстроки |
| `truncate:N` | обрезать до N символов (с `…`) |
| `slice:S\|E` | срез `[S, E)` (E опционален) |

### Выражения через `expr-eval` (`expression`, и `transform` если не built-in)

Поддерживается:

- Арифметика, сравнения, тернарный оператор `a ? b : c`.
- Member access по точке: `item.user.name`, `$page.lang`.
- Переменные sandbox: `value`, `item`, `index`, `items`, `$page` (= pageData).
- Функции из контекста: `$var("name")`, `$data("alias")`.
- Helper-функции:
  `upper`, `lower`, `trim`, `concat`, `len`, `slice`, `replace`,
  `round`, `floor`, `ceil`, `parseInt`, `parseFloat`,
  `default(a, b)` (b если a пусто/null), `if(cond, a, b)`.
- Префикс `return ` срезается автоматически для совместимости с прежним стилем.

**НЕ поддерживается** (и не будет): `await`/Promise, statements (`if/for/while`),
методы строк/массивов (`.toUpperCase()`, `.length`, `.map()` — используйте
helper'ы), объектные/массивные литералы, `new`, `eval`, `Function`,
шаблонные литералы (используйте `concat(...)`).

## Миграционные паттерны

### Метод-вызовы строк → helper-функции

| Было (JS) | Стало (expr-eval) |
|---|---|
| `value.toUpperCase()` | `upper(value)` |
| `value.toLowerCase()` | `lower(value)` |
| `value.trim()` | `trim(value)` |
| `value.length` | `len(value)` |
| `value.slice(0, 5)` | `slice(value, 0, 5)` |
| `value.replace("x", "Y")` | `replace(value, "x", "Y")` |
| `` `Hi ${name}` `` | `concat("Hi ", name)` |

### Числовые

| Было | Стало |
|---|---|
| `Math.round(x)` | `round(x)` |
| `Math.floor(x)` | `floor(x)` |
| `parseInt(s, 10)` | `parseInt(s)` |
| `Number(s)` | built-in `transform: 'number'` или арифметика `s * 1` |

### Длина массива / число элементов

| Было | Стало |
|---|---|
| `arr.length` | `len(arr)` |
| `$data("x").length` | `len($data("x"))` |

### Шаблоны / форматирование

| Было | Стало |
|---|---|
| `` `${a} ${b}` `` | `concat(a, " ", b)` |
| `value + " ₽"` | `concat(value, " ₽")` или built-in `template:{{value}} ₽` |

### Условные значения

| Было | Стало |
|---|---|
| `value \|\| "по умолчанию"` | `default(value, "по умолчанию")` |
| `cond ? a : b` | `cond ? a : b` (тернарник поддерживается) |
| `if (cond) return a; else return b;` | `if(cond, a, b)` |

### Async-выражения (`isAsync: true`)

Прежний путь через `await fetch(...)` в expression — **не имеет безопасного
эквивалента** через `expr-eval`. Миграция:

1. Вынести получение данных в **`additionalDataSources`** конфигурации биндинга
   (см. `DataBindingFullConfig.additionalSources`) + объединить через
   `DataJoinService`.
2. После join вычисляемое поле становится синхронным — используйте
   `expr-eval` или built-in.

После join вычисляемое поле становится синхронным — пишется в expression
как обычное безопасное выражение.

## История фаз

- **2.A** (2026-05-20) — добавлен `safeExpression` + `ALLOW_USER_JS` флаг как
  переходный режим: новые выражения через `expr-eval`, legacy через vm под
  флагом с deprecation-warning.
- **2.B** (2026-05-20) — миграционный гайд (этот документ) + обновление
  placeholder'ов фронтенд-редакторов на expr-eval-friendly примеры.
- **2.C** (2026-05-20) — **cutover**: после проверки данных (`SELECT … FROM
  data_bindings`) на отсутствие реальных JS-выражений в backend-полях,
  vm-путь, флаг `ALLOW_USER_JS`, helper'ы `runSync`/`runAsync`/`safeGlobals`/
  `createSandbox` и `import vm` удалены окончательно. RCE-класс закрыт.

См. [KNOWN_ISSUES.md](../KNOWN_ISSUES.md), B1.
