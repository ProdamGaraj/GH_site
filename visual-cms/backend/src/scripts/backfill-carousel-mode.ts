/**
 * Phase 5 — Backfill data-carousel-mode для всех страниц.
 *
 * Сканирует все Page'ы, для каждого узла с data-carousel="true" определяет
 * режим (по наличию активного repeater-binding'а на этом узле или его track-е)
 * и проставляет data-carousel-mode="static" | "repeat".
 *
 * Не трогает узлы, у которых атрибут уже стоит — это позволяет вручную
 * переключить режим в редакторе и быть уверенным, что миграция не откатит.
 *
 * Идемпотентен: повторный запуск не делает изменений на уже обработанных страницах.
 *
 * Run:
 *   docker exec visual-cms-backend-1 npx ts-node src/scripts/backfill-carousel-mode.ts
 *   # dry-run (без записи в БД):
 *   docker exec visual-cms-backend-1 npx ts-node src/scripts/backfill-carousel-mode.ts --dry-run
 */
import 'reflect-metadata'
import { AppDataSource } from '../config/database'
import { Page } from '../models/Page'
import { DataBinding } from '../models/DataBinding'

const CAROUSEL_ROOT_ATTR = 'data-carousel'
const CAROUSEL_TRACK_ATTR = 'data-carousel-track'
const CAROUSEL_MODE_ATTR = 'data-carousel-mode'

interface AnyNode {
  id?: string
  attributes?: Record<string, string>
  children?: AnyNode[]
  variations?: Record<
    string,
    { specificChildren?: AnyNode[]; inheritedOverrides?: Record<string, unknown> }
  >
}

function findTrackNode(node: AnyNode | null | undefined): AnyNode | null {
  if (!node) return null
  if (node.attributes?.[CAROUSEL_TRACK_ATTR] === 'true') return node
  for (const child of node.children || []) {
    const found = findTrackNode(child)
    if (found) return found
  }
  return null
}

function isRepeaterBinding(b: DataBinding, candidateIds: Set<string>): boolean {
  if (b.isActive === false) return false
  // Backend BindingType = 'input' | 'output'. Репитер всегда input.
  if (b.bindingType !== 'input') return false
  if (!candidateIds.has(b.blockId)) return false
  const cfg = (b.config ?? {}) as { inputConfig?: { mode?: string } }
  return cfg.inputConfig?.mode === 'repeater'
}

function detectMode(carouselRoot: AnyNode, bindings: DataBinding[]): 'static' | 'repeat' {
  const ids = new Set<string>()
  if (carouselRoot.id) ids.add(carouselRoot.id)
  const track = findTrackNode(carouselRoot)
  if (track?.id) ids.add(track.id)
  return bindings.some((b) => isRepeaterBinding(b, ids)) ? 'repeat' : 'static'
}

interface NodeUpdate {
  pageId: string
  pageName: string
  nodeId: string
  fromMode: string | null
  toMode: 'static' | 'repeat'
}

/**
 * Обходит всё дерево + variations.specificChildren и применяет visit для каждой ноды.
 */
function walk(node: AnyNode, visit: (n: AnyNode) => void): void {
  visit(node)
  for (const child of node.children || []) walk(child, visit)
  if (node.variations) {
    for (const variation of Object.values(node.variations)) {
      for (const child of variation.specificChildren || []) walk(child, visit)
    }
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const initDb = !AppDataSource.isInitialized
  if (initDb) await AppDataSource.initialize()

  const pageRepo = AppDataSource.getRepository(Page)
  const bindingRepo = AppDataSource.getRepository(DataBinding)

  const pages = await pageRepo.find()
  console.log(`[backfill] Loaded ${pages.length} pages`)

  const updates: NodeUpdate[] = []
  let pagesUpdated = 0

  for (const page of pages) {
    if (!page.structure) continue

    // Грузим bindings для этой страницы только если нашли карусель — экономим запросы.
    let bindings: DataBinding[] | null = null
    let pageChanged = false

    walk(page.structure as AnyNode, (n) => {
      if (n.attributes?.[CAROUSEL_ROOT_ATTR] !== 'true') return

      // Уже есть валидный mode — пропускаем (ручная настройка имеет приоритет).
      const existing = n.attributes?.[CAROUSEL_MODE_ATTR]
      if (existing === 'static' || existing === 'repeat') return

      if (bindings === null) {
        // lazy-load bindings один раз на страницу
        bindings = []
      }
    })

    // Если есть хоть одна карусель без режима — грузим bindings.
    if (bindings !== null) {
      bindings = await bindingRepo.find({ where: { pageId: page.id } })
    }

    walk(page.structure as AnyNode, (n) => {
      if (n.attributes?.[CAROUSEL_ROOT_ATTR] !== 'true') return
      const existing = n.attributes?.[CAROUSEL_MODE_ATTR] ?? null
      if (existing === 'static' || existing === 'repeat') return

      const mode = detectMode(n, bindings ?? [])
      if (!n.attributes) n.attributes = {}
      n.attributes[CAROUSEL_MODE_ATTR] = mode
      pageChanged = true
      updates.push({
        pageId: page.id,
        pageName: page.name || '(no name)',
        nodeId: n.id ?? '(no-id)',
        fromMode: existing,
        toMode: mode,
      })
    })

    if (pageChanged && !dryRun) {
      await pageRepo.save(page)
      pagesUpdated++
    } else if (pageChanged) {
      pagesUpdated++
    }
  }

  console.log('\n[backfill] Summary:')
  console.log(`  Pages scanned:  ${pages.length}`)
  console.log(`  Pages affected: ${pagesUpdated}`)
  console.log(`  Carousels set:  ${updates.length}`)
  if (updates.length > 0) {
    console.log('\n  Details:')
    updates.forEach((u) => {
      console.log(
        `    [${u.pageId}] "${u.pageName}" node=${u.nodeId}: ${u.fromMode ?? '<none>'} → ${u.toMode}`
      )
    })
  }
  if (dryRun) console.log('\n[backfill] DRY RUN — no changes were saved.')

  if (initDb) await AppDataSource.destroy()
}

main().catch((err) => {
  console.error('[backfill] FAILED:', err)
  process.exit(1)
})
