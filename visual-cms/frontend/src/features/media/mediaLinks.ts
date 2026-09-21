import type { FolderSelection } from './MediaFolderTree'

/**
 * Ссылки на папку медиатеки и ширина колонки дерева.
 *
 * Обе задачи — про адрес и про раскладку — вынесены из компонента: логика
 * разбора адреса и ограничения ширины проверяется тестами, а компонент
 * остаётся отрисовкой.
 */

/** Имя параметра адреса, в котором едет выбранная папка. */
export const FOLDER_PARAM = 'folder'

/** Значение параметра для корня: файлы без папки. */
export const ROOT_VALUE = 'root'

/**
 * Папка из строки запроса.
 *
 * Отсутствие параметра — это «Все файлы», а не корень: в медиатеке это разные
 * представления, и путать их нельзя.
 */
export function readFolderFromSearch(search: string): FolderSelection {
  const value = new URLSearchParams(search).get(FOLDER_PARAM)
  if (!value) return null
  return value === ROOT_VALUE ? 'root' : value
}

/** Проставляет (или убирает) параметр папки в готовом наборе параметров. */
export function applyFolderToParams(
  params: URLSearchParams,
  folder: FolderSelection
): URLSearchParams {
  const next = new URLSearchParams(params)
  // «Все файлы» — состояние по умолчанию, и в адресе ему делать нечего:
  // ссылка должна быть короткой и читаемой.
  if (folder === null) next.delete(FOLDER_PARAM)
  else next.set(FOLDER_PARAM, folder === 'root' ? ROOT_VALUE : folder)
  return next
}

/**
 * Абсолютная ссылка на папку — та, что уходит коллеге.
 *
 * Строится от текущего адреса, а не собирается из кусков: панель живёт под
 * префиксом /visual_cms/, и повторять это знание здесь значило бы завести
 * второй источник правды о том, где смонтировано приложение.
 *
 * Прочие параметры адреса сохраняются: если человек делится ссылкой, находясь
 * в фильтре, фильтр логично оставить.
 */
export function buildFolderLink(href: string, folder: FolderSelection): string {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    // Неразбираемый адрес — отдаём как есть: лучше бесполезная ссылка,
    // чем исключение в обработчике клика.
    return href
  }
  url.search = applyFolderToParams(url.searchParams, folder).toString()
  url.hash = ''
  return url.toString()
}
