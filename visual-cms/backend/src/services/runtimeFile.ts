/**
 * Рантаймы страниц, которые лежат обычными JS-файлами в runtime/ (карта
 * проекта, лента новостей), а не строками в TS: их удобно править и
 * тестировать. Файл читается с диска и вставляется в <script>; перечитывается,
 * когда меняется (по времени изменения): на dev-стенде правка .js после пулла
 * не перезапускает бэкенд, и без этого деплой вшивал бы старую версию.
 *
 * В проде файлы лежат рядом со скомпилированным кодом — их копирует
 * Dockerfile.prod (tsc переносит только .ts).
 */
import * as fs from 'fs'
import * as path from 'path'

const cache = new Map<string, { mtimeMs: number; text: string }>()

export function runtimeSource(fileName: string): string {
  const file = path.join(__dirname, 'runtime', fileName)
  const { mtimeMs } = fs.statSync(file)
  const cached = cache.get(fileName)
  if (cached && cached.mtimeMs === mtimeMs) return cached.text
  const text = fs.readFileSync(file, 'utf8')
  // Файл вставляется внутрь <script>: такая строка закрыла бы тег раньше времени.
  if (/<\/script/i.test(text)) throw new Error(`${file}: внутри встречается </script>`)
  cache.set(fileName, { mtimeMs, text })
  return text
}

export function runtimeScript(fileName: string): string {
  return `<script>\n${runtimeSource(fileName)}\n</script>`
}
