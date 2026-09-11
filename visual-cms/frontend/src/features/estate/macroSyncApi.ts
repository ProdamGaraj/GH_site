import { api } from '@/shared/api'
import type { MacroSyncRun, MacroSyncState } from './macroSync'

/**
 * Клиент синхронизации с MacroCRM.
 *
 * Ходит в бэкенд CMS (/api/macro-sync), а не в estate-service: синк выполняется
 * там, где живут токен CRM, журнал прогонов и публикация страниц.
 */
export const macroSyncApi = {
  status: () => api.get<MacroSyncState>('/macro-sync/status'),

  /**
   * Запускает прогон и сразу возвращается.
   *
   * Полный обход двух домов — это 336 запросов планировок под лимитом
   * 100 в минуту, порядка четырёх минут. Держать соединение открытым всё это
   * время значит поймать таймаут прокси, поэтому бэкенд отвечает 202, а ход
   * дела смотрится опросом статуса.
   */
  start: (options: { resume?: boolean } = {}) =>
    api.post<{ started: boolean; resumedFrom: string | null }>('/macro-sync/run', {
      trigger: 'manual',
      resume: options.resume === true,
    }),

  run: (id: string) => api.get<MacroSyncRun>(`/macro-sync/runs/${id}`),
}
