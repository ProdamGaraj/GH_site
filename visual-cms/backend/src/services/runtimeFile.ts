/**
 * Рантаймы страниц, которые лежат обычными JS-файлами в runtime/ (карта
 * проекта, лента новостей), а не строками в TS: их удобно править и
 * тестировать. Файл читается с диска один раз и вставляется в <script>.
 *
 * В проде файлы лежат рядом со скомпилированным кодом — их копирует
 * Dockerfile.prod (tsc переносит только .ts).
 */
import * as fs from 'fs'
import * as path from 'path'

const cache = new Map<string, string>()

export function runtimeSource(fileName: string): string {
  const cached = cache.get(fileName)
  if (cached !== undefined) return cached
  const file = path.join(__dirname, 'runtime', fileName)
  const text = fs.readFileSync(file, 'utf8')
  // Файл вставляется внутрь <script>: такая строка закрыла бы тег раньше времени.
  if (/<\/script/i.test(text)) throw new Error(`${file}: внутри встречается </script>`)
  cache.set(fileName, text)
  return text
}

export function runtimeScript(fileName: string): string {
  return `<script>\n${runtimeSource(fileName)}\n</script>`
}
