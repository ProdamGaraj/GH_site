/**
 * Триггер OUTPUT-привязки для рантайма сайта (DataBindingGenerator).
 *
 * Редактор сохраняет короткие имена ('submit', 'click', …), старые записи —
 * длинные ('formSubmit', 'buttonClick', …). Раньше деплой понимал только
 * 'formSubmit', всё остальное становилось 'click'.
 */
export type RuntimeOutputTrigger = 'submit' | 'click' | 'change' | 'blur' | 'interval' | 'custom'

const TRIGGERS: Record<string, RuntimeOutputTrigger> = {
  submit: 'submit',
  formSubmit: 'submit',
  click: 'click',
  buttonClick: 'click',
  change: 'change',
  inputChange: 'change',
  blur: 'blur',
  inputBlur: 'blur',
  onBlur: 'blur',
  interval: 'interval',
  onInterval: 'interval',
  custom: 'custom',
  customEvent: 'custom',
}

/** Неизвестное или пустое — 'submit' (отправка формы — основной случай). */
export function runtimeOutputTrigger(trigger: unknown): RuntimeOutputTrigger {
  return (typeof trigger === 'string' && TRIGGERS[trigger]) || 'submit'
}

/** Действие после ответа в рантайме сайта (DataBindingGenerator handleSuccessAction/handleErrorAction). */
export interface RuntimeAction {
  action: 'message' | 'redirect' | 'reset' | 'hide'
  value?: string
}

const SUCCESS_ACTIONS: Record<string, RuntimeAction['action']> = {
  showMessage: 'message',
  redirect: 'redirect',
  resetForm: 'reset',
  hideBlock: 'hide',
}

/**
 * «Действия» привязки → рантайм. Редактор хранит объект
 * { action, message, redirectUrl }; старые записи — массив [{ type, config }].
 * Раньше деплой понимал только массив, и сообщения редактора не доходили до сайта.
 */
export function runtimeSuccessAction(onSuccess: unknown): RuntimeAction | undefined {
  const raw = Array.isArray(onSuccess) ? onSuccess[0] : onSuccess
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as { action?: string; type?: string; message?: string; redirectUrl?: string; config?: { message?: string; url?: string } }
  const action = SUCCESS_ACTIONS[r.action ?? r.type ?? '']
  if (!action) return undefined
  const value = action === 'redirect' ? (r.redirectUrl ?? r.config?.url) : (r.message ?? r.config?.message)
  return value ? { action, value } : { action }
}

export function runtimeErrorAction(onError: unknown): RuntimeAction | undefined {
  if (!onError || typeof onError !== 'object') return undefined
  const r = onError as { action?: string; message?: string; showMessage?: string }
  const value = r.message ?? r.showMessage
  return value ? { action: 'message', value } : { action: 'message' }
}
