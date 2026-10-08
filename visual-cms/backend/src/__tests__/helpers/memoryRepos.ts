/**
 * Таблицы в памяти для тестов сервисов поверх TypeORM-репозиториев.
 *
 * Умеют ровно то, что зовут TranslationService, LinkedBlocksService и скрипт
 * переноса переводов: find/findOne по равенству и In(), select, create, save
 * и insert (одной строкой и пачкой), delete по условию и запросы createQueryBuilder
 * «DISTINCT locale» и «structure::text LIKE». Всё прочее — ошибка: тест не
 * должен молча проходить на неподдержанном запросе.
 */
import { randomUUID } from 'crypto'
import { FindOperator } from 'typeorm'

export type Row = Record<string, any>

function matches(row: Row, where: Row | undefined): boolean {
  if (!where) return true
  return Object.entries(where).every(([key, cond]) => {
    if (cond instanceof FindOperator) {
      if (cond.type === 'in') return (cond.value as unknown[]).includes(row[key])
      throw new Error(`memoryRepos: оператор ${cond.type} не поддержан`)
    }
    return row[key] === cond
  })
}

function project(row: Row, select: Row | undefined): Row {
  if (!select) return { ...row }
  const out: Row = {}
  for (const [k, on] of Object.entries(select)) if (on) out[k] = row[k]
  return out
}

export class MemoryRepo {
  rows: Row[] = []

  constructor(private readonly name: string, initial: Row[] = []) {
    this.seed(initial)
  }

  /** Заменяет содержимое таблицы; строкам без id выдаёт id, как база. */
  seed(rows: Row[]): void {
    this.rows = rows.map((r) => ({ ...r, id: r.id ?? randomUUID() }))
  }

  async find(opts: { where?: Row; select?: Row } = {}): Promise<Row[]> {
    return this.rows.filter((r) => matches(r, opts.where)).map((r) => project(r, opts.select))
  }

  async findOne(opts: { where?: Row }): Promise<Row | null> {
    const row = this.rows.find((r) => matches(r, opts.where))
    return row ? { ...row } : null
  }

  create(data: Row): Row {
    return { ...data }
  }

  async save(input: Row | Row[]): Promise<any> {
    const list = Array.isArray(input) ? input : [input]
    const out = list.map((data) => {
      const id = data.id ?? randomUUID()
      const idx = this.rows.findIndex((r) => r.id === id)
      const row = { ...(idx === -1 ? {} : this.rows[idx]), ...data, id }
      if (idx === -1) this.rows.push(row)
      else this.rows[idx] = row
      return { ...row }
    })
    return Array.isArray(input) ? out : out[0]
  }

  async insert(input: Row | Row[]): Promise<{ identifiers: Array<{ id: string }> }> {
    const list = Array.isArray(input) ? input : [input]
    const ids = list.map((data) => {
      const row = { ...data, id: data.id ?? randomUUID() }
      this.rows.push(row)
      return { id: row.id }
    })
    return { identifiers: ids }
  }

  async delete(where: Row): Promise<{ affected: number }> {
    const before = this.rows.length
    this.rows = this.rows.filter((r) => !matches(r, where))
    return { affected: before - this.rows.length }
  }

  async update(where: Row | string, patch: Row): Promise<{ affected: number }> {
    const cond = typeof where === 'string' ? { id: where } : where
    let affected = 0
    for (const r of this.rows) if (matches(r, cond)) (Object.assign(r, patch), affected++)
    return { affected }
  }

  /** Запросы, которые строят сервисы: DISTINCT locale по странице и LIKE по структуре. */
  createQueryBuilder(_alias: string) {
    const clauses: Array<{ sql: string; params: Row }> = []
    let selectSql = ''
    const qb: any = {
      select: (sql: string) => ((selectSql = sql), qb),
      where: (sql: string, params: Row = {}) => (clauses.push({ sql, params }), qb),
      andWhere: (sql: string, params: Row = {}) => (clauses.push({ sql, params }), qb),
      getRawMany: async () => {
        let rows = this.rows
        for (const { sql, params } of clauses) {
          if (/\.pageId = :pageId/.test(sql)) rows = rows.filter((r) => r.pageId === params.pageId)
          else if (/\.locale <> :all/.test(sql)) rows = rows.filter((r) => r.locale !== params.all)
          else if (/structure::text LIKE :id/.test(sql)) {
            const needle = String(params.id).replace(/%/g, '')
            rows = rows.filter((r) => JSON.stringify(r.structure ?? null).includes(needle))
          } else throw new Error(`memoryRepos(${this.name}): условие не поддержано: ${sql}`)
        }
        if (/DISTINCT t\.locale/.test(selectSql)) return [...new Set(rows.map((r) => r.locale))].map((locale) => ({ locale }))
        if (/p\.id/.test(selectSql)) return rows.map((r) => ({ id: r.id }))
        throw new Error(`memoryRepos(${this.name}): select не поддержан: ${selectSql}`)
      },
    }
    return qb
  }
}
