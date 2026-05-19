/**
 * Характеризационные (golden) тесты для DataTransformService.
 *
 * Цель: зафиксировать поведение ДВУХ движков исполнения user-кода до их
 * слияния (B1 фаза 1), чтобы консолидация не изменила семантику:
 *  - engine1: executeTransform / executeAsyncComputed
 *    (applyMapping, applyComputedFields, applyFieldMappingsToPayload)
 *  - engine2: executeComputedField / executeComputedFieldAsync
 *    (addComputedFields, addComputedFieldsAsync) — API $var/$data/$page
 *
 * Часть тестов (async) описывает КОРРЕКТНОЕ поведение после фикса багов
 * экранирования `\${}` (до фикса — падают/возвращают null).
 */
import { dataTransformService } from '../services/DataTransformService'

describe('DataTransformService — engine1 (sync, golden)', () => {
  it('applyMapping: JS-transform получает value и возвращает результат', () => {
    const out = dataTransformService.applyMapping(
      { price: 10 },
      [{ id: 'm1', sourceField: 'price', targetProperty: 'doubled', transform: 'return value * 2' }] as any
    )
    expect(out.doubled).toBe(20)
  })

  it('applyMapping: built-in transform uppercase (без vm)', () => {
    const out = dataTransformService.applyMapping(
      { name: 'ab' },
      [{ id: 'm1', sourceField: 'name', targetProperty: 'up', transform: 'uppercase' }] as any
    )
    expect(out.up).toBe('AB')
  })

  it('applyMapping: fallbackValue при пустом значении', () => {
    const out = dataTransformService.applyMapping(
      { a: '' },
      [{ id: 'm1', sourceField: 'a', targetProperty: 'x', fallbackValue: 'def' }] as any
    )
    expect(out.x).toBe('def')
  })

  it('applyComputedFields: sync-выражение видит value', async () => {
    const out = await dataTransformService.applyComputedFields(
      { a: 2, b: 3 },
      [{ name: 'sum', expression: 'return value.a + value.b' }] as any
    )
    expect(out.sum).toBe(5)
  })

  it('applyFieldMappingsToPayload: transform применяется к полю формы', async () => {
    const out = await dataTransformService.applyFieldMappingsToPayload(
      { n: '  hi  ' },
      [{ id: 'm1', sourceField: 'n', targetProperty: 'name', transform: 'return value.trim()' }] as any
    )
    expect(out.name).toBe('hi')
  })
})

describe('DataTransformService — engine2 (sync, golden)', () => {
  it('addComputedFields: expression видит item, $var, $data, $page', () => {
    const out = dataTransformService.addComputedFields(
      [{ p: 10 }],
      [
        { name: 'withVar', expression: 'return item.p + $var("bonus")' },
        { name: 'withData', expression: 'return $data("extra").length' },
        { name: 'withPage', expression: 'return $page.lang' },
      ] as any,
      { variables: { bonus: 5 }, dataSources: { extra: [1, 2] }, pageData: { lang: 'ru' } }
    ) as any[]
    expect(out[0].withVar).toBe(15)
    expect(out[0].withData).toBe(2)
    expect(out[0].withPage).toBe('ru')
  })

  it('addComputedFields: ошибка в выражении → поле null, не падает', () => {
    const out = dataTransformService.addComputedFields(
      [{ p: 1 }],
      [{ name: 'bad', expression: 'return notDefinedXyz.foo' }] as any
    ) as any[]
    expect(out[0].bad).toBeNull()
  })
})

describe('DataTransformService — async (корректность после фикса \\${} )', () => {
  it('applyComputedFields: async-поле возвращает результат (engine1)', async () => {
    const out = await dataTransformService.applyComputedFields(
      { a: 2 },
      [{ name: 'ax', isAsync: true, expression: 'return await Promise.resolve(item.a * 10)' }] as any
    )
    expect(out.ax).toBe(20)
  })

  it('addComputedFieldsAsync: async-поле возвращает результат (engine2)', async () => {
    const out = (await dataTransformService.addComputedFieldsAsync(
      [{ p: 3 }],
      [{ name: 'q', isAsync: true, expression: 'return await Promise.resolve(item.p + 1)' }] as any
    )) as any[]
    expect(out[0].q).toBe(4)
  })
})
