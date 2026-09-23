/**
 * Общее для раннеров миграций данных: разбор флагов и резервные копии.
 *
 * Раннер только читает, делает копию и пишет; само преобразование — в
 * отдельном чистом модуле под тестами.
 */
import * as fs from 'fs'
import * as path from 'path'

/** Значение флага `--name=value`; undefined, если флага нет. */
export function flag(name: string, argv: string[] = process.argv): string | undefined {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}

export function hasFlag(name: string, argv: string[] = process.argv): boolean {
  return argv.includes(`--${name}`)
}

/**
 * Копия данных ДО записи. Дамп базы делается отдельно, но точечный откат
 * одной строки из файла быстрее и не трогает остальные таблицы.
 */
export function writeBackup(outDir: string, name: string, data: unknown): string {
  fs.mkdirSync(outDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const file = path.join(outDir, `${name}-${stamp}.json`)
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
  return file
}
