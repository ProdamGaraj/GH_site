import { useEffect } from 'react'
import { getApiBaseUrl } from '@/shared/api/baseUrl'
import { apiFetch } from '@/shared/api/http'

/**
 * Инжект канонического base-CSS деплоя (reset + форм-стили) в канвас редактора.
 *
 * Источник правды — backend `StyleGenerator.getBaseCss()`, тот же CSS, что
 * инлайнится в <head> опубликованной страницы. Эндпоинт отдаёт его уже
 * заскоупленным под `.canvas-viewport`, поэтому инжект в <head> редактора не
 * задевает UI CMS. Так формы/поля/кнопки в канвасе выглядят 1:1 с деплоем
 * (раньше канвас имел лишь рукопашную копию reset без форм-стилей — она
 * дрейфила и была источником расхождения «редактор ≠ деплой»).
 */
const STYLE_ID = 'vcms-canvas-base-css'
const SCOPE = '.canvas-viewport'

// Кэш на сессию: один сетевой запрос, даже при многих ремаунтах канваса.
let cachedCss: string | null = null
let inFlight: Promise<string> | null = null

async function loadBaseCss(): Promise<string> {
  if (cachedCss != null) return cachedCss
  if (!inFlight) {
    // apiFetch: credentials: 'include' — эндпоинт под общей auth-мидлварой /api
    // (как preview POST). Голый fetch без cookie сессии → 401.
    const url = `${getApiBaseUrl()}/preview/base-css?scope=${encodeURIComponent(SCOPE)}`
    inFlight = apiFetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`base-css ${r.status}`))))
      .then((css) => {
        cachedCss = css
        return css
      })
      .catch((err) => {
        inFlight = null // разрешаем повтор при следующем маунте
        throw err
      })
  }
  return inFlight
}

export function useCanvasBaseCss(): void {
  useEffect(() => {
    if (document.getElementById(STYLE_ID)) return
    let cancelled = false
    loadBaseCss()
      .then((css) => {
        if (cancelled || document.getElementById(STYLE_ID)) return
        const style = document.createElement('style')
        style.id = STYLE_ID
        style.setAttribute('data-source', 'backend:getBaseCss')
        style.textContent = css
        document.head.appendChild(style)
      })
      .catch(() => {
        // Бэкенд недоступен — редактор и так не работает без него; канвас
        // деградирует к браузерным дефолтам. Молча, без спама в консоль.
      })
    return () => {
      cancelled = true
    }
  }, [])
}
