/**
 * B1 фаза 2.C — анализ совместимости DataBinding-записей с expr-eval.
 *
 * Проходит по всем `data_bindings` в БД, для каждой строки `transform`/
 * `expression` пробует:
 *   1) распознать как built-in (`uppercase`, `template:...`, `replace:a|b`, …);
 *   2) иначе вычислить через `evaluateSafeExpression` (expr-eval + helpers).
 *
 * Если ни 1, ни 2 не срабатывают — запись пометится как несовместимая
 * (потребуется legacy `vm`-путь, т.е. `ALLOW_USER_JS=true`). Скрипт пишет
 * JSON-отчёт со списком несовместимых выражений и их положением внутри
 * binding.config — этого достаточно, чтобы либо мигрировать вручную по
 * `docs/data-binding-migration.md`, либо сгенерировать SQL-миграцию.
 *
 * Запуск:
 *   cd backend
 *   npx ts-node src/scripts/check-databindings-for-js.ts
 * Опционально:
 *   npx ts-node src/scripts/check-databindings-for-js.ts --json > report.json
 */

import 'dotenv/config'
import { AppDataSource } from '../config/database'
import { DataBinding } from '../models/DataBinding'
import { evaluateSafeExpression } from '../services/safeExpression'

// Built-in трансформации, известные `applyBuiltInTransform`.
const BUILTIN_NAMES = new Set([
  'uppercase',
  'lowercase',
  'trim',
  'number',
  'round',
  'floor',
  'ceil',
  'length',
  'json',
  'boolean',
  'string',
])
const BUILTIN_PREFIXES = ['template:', 'replace:', 'truncate:', 'slice:']

function isBuiltInName(code: string): boolean {
  const c = (code || '').trim()
  if (!c) return true // пусто — нечего исполнять
  if (BUILTIN_NAMES.has(c)) return true
  return BUILTIN_PREFIXES.some((p) => c.startsWith(p))
}

function tryExprEval(code: string): { ok: true } | { ok: false; reason: string } {
  if (!code || !code.trim()) return { ok: true }
  try {
    evaluateSafeExpression(
      code,
      { value: null, item: {}, index: 0, items: [], variables: {}, pageData: {}, $page: {} },
      { $var: () => null, $data: () => [] }
    )
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: (err as Error).message }
  }
}

interface Finding {
  bindingId: string
  blockId: string
  pageId: string | null
  bindingType: string
  location: string
  code: string
  reason: string
}

interface Report {
  totalBindings: number
  scannedExpressions: number
  compatibleBuiltIn: number
  compatibleExprEval: number
  incompatible: number
  findings: Finding[]
}

function check(
  code: unknown,
  binding: DataBinding,
  location: string,
  acc: { findings: Finding[]; builtIn: number; exprEval: number; scanned: number }
): void {
  if (typeof code !== 'string') return
  acc.scanned++
  if (isBuiltInName(code)) {
    acc.builtIn++
    return
  }
  const r = tryExprEval(code)
  if (r.ok) {
    acc.exprEval++
    return
  }
  acc.findings.push({
    bindingId: binding.id,
    blockId: binding.blockId,
    pageId: binding.pageId,
    bindingType: binding.bindingType,
    location,
    code,
    reason: r.reason,
  })
}

async function main(): Promise<void> {
  const jsonOnly = process.argv.includes('--json')

  // Pre-condition: DATABASE_URL обязательна. На Windows PowerShell:
  //   $env:DATABASE_URL='postgres://user:pass@host:5432/db'; npx ts-node ...
  // Либо положить её в `backend/.env`.
  if (!process.env.DATABASE_URL) {
    /* eslint-disable no-console */
    console.error('DATABASE_URL не задана. Варианты:')
    console.error('  1) PowerShell:  $env:DATABASE_URL=\'postgres://USER:PASS@HOST:5432/DB\'; npx ts-node src/scripts/check-databindings-for-js.ts')
    console.error('  2) bash/zsh:    DATABASE_URL=postgres://USER:PASS@HOST:5432/DB npx ts-node src/scripts/check-databindings-for-js.ts')
    console.error('  3) Положить DATABASE_URL=... в backend/.env')
    /* eslint-enable no-console */
    process.exit(2)
  }

  await AppDataSource.initialize()

  const repo = AppDataSource.getRepository(DataBinding)
  const all = await repo.find()
  const acc = { findings: [] as Finding[], builtIn: 0, exprEval: 0, scanned: 0 }

  for (const b of all) {
    const cfg = (b.config || {}) as Record<string, any>

    // INPUT: fieldMappings[].transform
    const inputMaps = cfg?.inputConfig?.fieldMappings
    if (Array.isArray(inputMaps)) {
      inputMaps.forEach((m: any, i: number) =>
        check(m?.transform, b, `inputConfig.fieldMappings[${i}].transform`, acc)
      )
    }

    // OUTPUT: payloadMappings[].transform
    const outMaps = cfg?.outputConfig?.payloadMappings
    if (Array.isArray(outMaps)) {
      outMaps.forEach((m: any, i: number) =>
        check(m?.transform, b, `outputConfig.payloadMappings[${i}].transform`, acc)
      )
    }

    // computedFields[].expression
    const computed = cfg?.computedFields
    if (Array.isArray(computed)) {
      computed.forEach((f: any, i: number) =>
        check(f?.expression, b, `computedFields[${i}](${f?.name ?? '?'}).expression`, acc)
      )
    }
  }

  const report: Report = {
    totalBindings: all.length,
    scannedExpressions: acc.scanned,
    compatibleBuiltIn: acc.builtIn,
    compatibleExprEval: acc.exprEval,
    incompatible: acc.findings.length,
    findings: acc.findings,
  }

  if (jsonOnly) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
  } else {
    /* eslint-disable no-console */
    console.log('=== DataBinding compatibility report ===')
    console.log(`Total bindings:           ${report.totalBindings}`)
    console.log(`Scanned expressions:      ${report.scannedExpressions}`)
    console.log(`  ↳ built-in:             ${report.compatibleBuiltIn}`)
    console.log(`  ↳ expr-eval compatible: ${report.compatibleExprEval}`)
    console.log(`  ↳ INCOMPATIBLE (need migration): ${report.incompatible}`)
    if (report.findings.length > 0) {
      console.log('\n--- INCOMPATIBLE FINDINGS ---')
      for (const f of report.findings) {
        console.log(
          `[${f.bindingType}] binding=${f.bindingId} block=${f.blockId} page=${f.pageId ?? '-'} ${f.location}`
        )
        console.log(`  code:   ${f.code}`)
        console.log(`  reason: ${f.reason}`)
      }
      console.log('\nFor JSON output run with: --json')
    } else {
      console.log('\nNo incompatible expressions found — ready for B1 phase 2.C cutover.')
    }
    /* eslint-enable no-console */
  }

  await AppDataSource.destroy()
  process.exit(report.incompatible > 0 ? 1 : 0)
}

main().catch((err) => {
  /* eslint-disable-next-line no-console */
  console.error('check-databindings-for-js failed:', err)
  process.exit(2)
})
