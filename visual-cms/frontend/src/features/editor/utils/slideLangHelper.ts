/**
 * Языковой вариант медиа слайда repeat-карусели.
 *
 * Вариант хранится переводом страницы: nodeId="pagevar:<переменная>",
 * field="media:<_id слайда>:<поле>". Слайд адресуется постоянным _id, а не
 * номером в массиве: при номере удаление, перестановка или копирование слайда
 * молча отдавали варианты чужим слайдам. Те же ключи на бэкенде разбирает
 * TranslationService (slideKeyOf / parseVarMediaField).
 */

/** Поле перевода для языкового варианта медиа-поля слайда. */
export const slideLangField = (slideId: string, sourceField: string): string => `media:${slideId}:${sourceField}`

/**
 * Есть ли среди сохранённых слайдов такие, у которых нет _id. Панель выдаёт
 * им id при загрузке, но в базе его нет, пока слайды не сохранят — языковой
 * вариант до этого привязать не к чему.
 */
export const hasSlidesWithoutId = (raw: unknown): boolean =>
  Array.isArray(raw) &&
  raw.some((item) => {
    const id = item && typeof item === 'object' ? (item as { _id?: unknown })._id : undefined
    return typeof id !== 'string' || id === ''
  })
