/**
 * Диагностика битых блоков в библиотеке (READ-ONLY, ничего не пишет).
 *
 * Ищет два класса повреждений, которые оставлял старый handleSaveAllToLibrary:
 *  - SELF_REF: structure.metadata.linkedBlockId на корне библиотечного блока
 *    (блок ссылается сам на себя или на устаревший id);
 *  - EMPTY: structure отсутствует или children пуст — блок затёрт placeholder'ом.
 *
 * Для каждого битого блока ищет кандидатов на восстановление: развёрнутые копии
 * (узел с metadata.linkedBlockId === block.id и непустыми children) в снапшотах
 * PageVersion и в текущих страницах. Показывает самые свежие кандидаты — сам
 * ремонт выполняется отдельно, после ручной проверки списка.
 *
 * Run:
 *   docker exec visual-cms-backend-1 npx ts-node src/scripts/diagnose-library-blocks.ts
 */
import 'reflect-metadata'
import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'
import { Page } from '../models/Page'
import { PageVersion } from '../models/PageVersion'

interface RepairCandidate {
  source: string // например "version v12 (auto, 2026-06-10) of page «Главная»"
  childrenCount: number
  createdAt: Date
  node: any
}

/** Ищет в дереве развёрнутый инстанс блока (linkedBlockId === blockId, children непустые). */
function findExpandedInstance(node: any, blockId: string): any | null {
  if (!node) return null
  if (
    node.metadata?.linkedBlockId === blockId &&
    Array.isArray(node.children) &&
    node.children.length > 0
  ) {
    return node
  }
  for (const child of node.children || []) {
    const found = findExpandedInstance(child, blockId)
    if (found) return found
  }
  if (node.variations) {
    for (const variation of Object.values(node.variations) as any[]) {
      for (const child of variation?.specificChildren || []) {
        const found = findExpandedInstance(child, blockId)
        if (found) return found
      }
    }
  }
  return null
}

function isEmptyStructure(structure: any): boolean {
  return !structure || !Array.isArray(structure.children) || structure.children.length === 0
}

export async function diagnoseLibraryBlocks(options: { initDb?: boolean } = {}): Promise<{
  brokenCount: number
}> {
  const initDb = options.initDb ?? true
  if (initDb) {
    await AppDataSource.initialize()
    console.log('[diagnose] DB connected\n')
  }

  const blocks = await AppDataSource.getRepository(Block).find()
  const pages = await AppDataSource.getRepository(Page).find()
  const versions = await AppDataSource.getRepository(PageVersion).find({
    order: { createdAt: 'DESC' },
  })
  const pageNames = new Map(pages.map((p) => [p.id, p.name]))

  let brokenCount = 0

  for (const block of blocks) {
    const problems: string[] = []
    const rootLinkedId = block.structure?.metadata?.linkedBlockId
    if (rootLinkedId) {
      problems.push(
        rootLinkedId === block.id
          ? 'SELF_REF: корень структуры ссылается сам на себя'
          : `SELF_REF: корень структуры ссылается на другой блок (${rootLinkedId})`
      )
    }
    if (isEmptyStructure(block.structure)) {
      problems.push('EMPTY: структура пустая (затёрта placeholder\'ом?)')
    }

    if (problems.length === 0) continue
    brokenCount++

    console.log(`✗ Блок «${block.name}» (${block.id})`)
    for (const p of problems) console.log(`    ${p}`)

    // Кандидаты на восстановление — свежие развёрнутые копии в снапшотах и страницах.
    const candidates: RepairCandidate[] = []
    for (const v of versions) {
      const node = findExpandedInstance(v.structure, block.id)
      if (node) {
        const pageName = pageNames.get(v.pageId) || v.name || v.pageId
        candidates.push({
          source: `version ${v.label || `v${v.version}`} (${v.source}, ${v.createdAt.toISOString().slice(0, 10)}) страницы «${pageName}»`,
          childrenCount: node.children.length,
          createdAt: v.createdAt,
          node,
        })
      }
    }
    for (const page of pages) {
      const node = findExpandedInstance(page.structure, block.id)
      if (node) {
        candidates.push({
          source: `текущая структура страницы «${page.name}» (${page.id})`,
          childrenCount: node.children.length,
          createdAt: page.updatedAt as any,
          node,
        })
      }
    }

    if (candidates.length === 0) {
      console.log('    Кандидатов на восстановление не найдено (нет развёрнутых копий в снапшотах)')
    } else {
      console.log(`    Кандидаты на восстановление (${candidates.length}, новые сверху, max 5):`)
      candidates
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
        .forEach((c) => console.log(`      - ${c.source} — ${c.childrenCount} children`))
    }
    console.log('')
  }

  console.log(
    brokenCount === 0
      ? '✓ Битых блоков не найдено'
      : `Итого битых блоков: ${brokenCount} из ${blocks.length}`
  )
  return { brokenCount }
}

// Запуск напрямую через ts-node
if (require.main === module) {
  diagnoseLibraryBlocks()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[diagnose] failed:', err)
      process.exit(1)
    })
}
