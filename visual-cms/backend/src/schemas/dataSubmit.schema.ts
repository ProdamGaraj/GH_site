import { z } from 'zod'
import { PUBLIC_SUBMIT_MAX_BYTES, PUBLIC_SUBMIT_MAX_FIELDS } from '../services/requests/RequestPipeline'

const triggerEnum = z.enum(['form_submit', 'button_click', 'input_change', 'input_blur', 'interval', 'custom_event', 'api_call'])

const str = (max: number) => z.string().max(max)

/** Значения формы с сайта: число полей и размер ограничены. */
const formData = z
  .record(z.unknown())
  .refine((data) => Object.keys(data).length <= PUBLIC_SUBMIT_MAX_FIELDS, {
    message: `Не больше ${PUBLIC_SUBMIT_MAX_FIELDS} полей`,
  })
  .refine((data) => Buffer.byteLength(JSON.stringify(data), 'utf8') <= PUBLIC_SUBMIT_MAX_BYTES, {
    message: `Данные больше ${PUBLIC_SUBMIT_MAX_BYTES} байт`,
  })

/** Страница и визит — то, что рантайм знает о посетителе ({{page.*}}, {{visitor.*}}). */
const pageSchema = z.object({ path: str(500).optional(), lang: str(10).optional(), title: str(300).optional() }).strict()
const visitorSchema = z
  .object({
    referrer: str(500).optional(),
    utm: z
      .object({
        source: str(200).optional(),
        medium: str(200).optional(),
        campaign: str(200).optional(),
        content: str(200).optional(),
        term: str(200).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

// POST /api/data/submit (боевые сайты, без логина).
// Только id сохранённой привязки и значения. strict(): адрес, источник,
// маппинг, метод из браузера не принимаются вовсе (400), а не молча
// отбрасываются — так ошибка интеграции видна сразу.
export const publicSubmitSchema = z
  .object({
    outputBindingId: z.string().uuid(),
    data: formData,
    trigger: triggerEnum.optional(),
    page: pageSchema.optional(),
    visitor: visitorSchema.optional(),
  })
  .strict()

// POST /api/data/requests/preview|test (редактор, с сессией): несохранённая
// спецификация запроса + примерные значения. Глубокую проверку спецификации
// делает коннектор (ответ — список ошибок, а не 400).
export const requestEditorSchema = z.object({
  dataSourceId: z.string().uuid(),
  request: z.object({ version: z.number(), connector: z.string() }).passthrough(),
  data: formData.optional(),
  page: pageSchema.optional(),
  visitor: visitorSchema.optional(),
})
