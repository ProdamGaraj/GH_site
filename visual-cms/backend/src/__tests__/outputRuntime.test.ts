/**
 * Триггер OUTPUT-привязки для рантайма сайта: короткие имена редактора и
 * старые длинные имена записей.
 */
import { runtimeErrorAction, runtimeOutputTrigger, runtimeSuccessAction } from '../services/requests/outputRuntime'

describe('runtimeOutputTrigger', () => {
  it.each([
    ['submit', 'submit'],
    ['formSubmit', 'submit'],
    ['click', 'click'],
    ['buttonClick', 'click'],
    ['change', 'change'],
    ['inputChange', 'change'],
    ['blur', 'blur'],
    ['onBlur', 'blur'],
    ['interval', 'interval'],
    ['onInterval', 'interval'],
    ['custom', 'custom'],
    ['customEvent', 'custom'],
  ])('%s → %s', (stored, runtime) => {
    expect(runtimeOutputTrigger(stored)).toBe(runtime)
  })

  it('пусто / неизвестно — submit', () => {
    expect(runtimeOutputTrigger(undefined)).toBe('submit')
    expect(runtimeOutputTrigger('pageUnload')).toBe('submit')
    expect(runtimeOutputTrigger(5)).toBe('submit')
  })
})

describe('runtimeSuccessAction / runtimeErrorAction — «Действия» редактора доходят до сайта', () => {
  it.each([
    [{ action: 'showMessage', message: 'Спасибо!' }, { action: 'message', value: 'Спасибо!' }],
    [{ action: 'redirect', redirectUrl: '/thanks' }, { action: 'redirect', value: '/thanks' }],
    [{ action: 'resetForm' }, { action: 'reset' }],
    [{ action: 'hideBlock' }, { action: 'hide' }],
    [[{ type: 'showMessage', config: { message: 'Старый формат' } }], { action: 'message', value: 'Старый формат' }],
    [[{ type: 'redirect', config: { url: '/old' } }], { action: 'redirect', value: '/old' }],
  ])('%j → %j', (stored, runtime) => {
    expect(runtimeSuccessAction(stored)).toEqual(runtime)
  })

  it.each([undefined, null, { action: 'none' }, { action: 'custom', callback: 'x()' }, { action: 'refreshData' }, []])(
    'без действия: %j',
    (stored) => {
      expect(runtimeSuccessAction(stored)).toBeUndefined()
    },
  )

  it('ошибка: текст редактора или старое showMessage; без текста — сообщение сервера', () => {
    expect(runtimeErrorAction({ action: 'showError', message: 'Не получилось' })).toEqual({ action: 'message', value: 'Не получилось' })
    expect(runtimeErrorAction({ showMessage: 'Старое' })).toEqual({ action: 'message', value: 'Старое' })
    expect(runtimeErrorAction({ action: 'showError' })).toEqual({ action: 'message' })
    expect(runtimeErrorAction(undefined)).toBeUndefined()
  })
})
