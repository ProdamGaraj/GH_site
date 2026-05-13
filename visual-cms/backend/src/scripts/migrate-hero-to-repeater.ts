/**
 * Phase 5e — Migrate Hero (Golden House home) to repeater + page-variable.
 *
 * Идемпотентность: если в page.variables уже есть запись с name='heroSlides' — выходим.
 *
 * Run:
 *   docker exec visual-cms-backend-1 npx ts-node src/scripts/migrate-hero-to-repeater.ts
 *   # для отката (drop binding + variable + restore)? нет — отдельный rollback не делаем,
 *   # вместо этого делаем backup структуры в page.metadata.heroBackupV1.
 */
import 'reflect-metadata'
import { randomUUID } from 'crypto'
import { AppDataSource } from '../config/database'
import { Page } from '../models/Page'
import { DataSource as DataSourceEntity } from '../models/DataSource'
import { DataBinding } from '../models/DataBinding'

const PAGE_ID = '5f597235-130e-4f57-a0ac-1eb1f77af920'
const TRACK_ID = 'gh-1776249962431-22'
const HERO_ROOT_ID = 'gh-1776249962431-29'
const DOTS_CONTAINER_ID = 'gh-1776249962431-26'
const PREV_BTN_ID = 'gh-1776249962431-27'
const NEXT_BTN_ID = 'gh-1776249962431-28'
const TEMPLATE_SLIDE_ID = 'gh-1776249962431-7'
const VARIABLE_NAME = 'heroSlides'
const DS_NAME = 'Golden House — home — heroSlides'

interface SlideData {
  id: string
  kind: 'image'
  mediaAssetId: string | null
  image: string
  title: string
  subtitle: string
  description: string
  ctaText: string
  ctaHref: string
  alignment: 'left' | 'center' | 'right'
}

function unwrapCssUrl(raw: string): string {
  if (!raw) return ''
  const m = raw.match(/^\s*url\((['"]?)(.+?)\1\)\s*$/i)
  return m ? m[2] : raw
}

function getStyle(node: any, prop: string): string {
  return (node?.styles?.properties?.[prop] || node?.style?.[prop] || '') as string
}

function setStyle(node: any, prop: string, value: string | undefined): void {
  if (!node.styles) node.styles = { properties: {} }
  if (!node.styles.properties) node.styles.properties = {}
  if (value === undefined) delete node.styles.properties[prop]
  else node.styles.properties[prop] = value
}

function setAttr(node: any, key: string, value: string): void {
  if (!node.attributes) node.attributes = {}
  node.attributes[key] = value
}

function findChildByTag(node: any, tag: string): any {
  return (node.children || []).find((c: any) => (c.tagName || c.tag) === tag)
}

function findAllByTag(node: any, tag: string): any[] {
  const out: any[] = []
  function walk(n: any) {
    if ((n.tagName || n.tag) === tag) out.push(n)
    ;(n.children || []).forEach(walk)
  }
  walk(node)
  return out
}

function extractSlide(slideNode: any): SlideData {
  const bgRaw = getStyle(slideNode, 'backgroundImage')
  const image = unwrapCssUrl(bgRaw)

  const ps = findAllByTag(slideNode, 'p')
  const h1 = findChildByTag(findAllByTag(slideNode, 'div').find((d: any) => findChildByTag(d, 'h1')) || slideNode, 'h1')
    || findAllByTag(slideNode, 'h1')[0]
  const a = findAllByTag(slideNode, 'a')[0]

  // Heuristic: первый <p> с маленьким fontSize (~13px) — subtitle, второй — description
  const sortedPs = ps.sort((x: any, y: any) => {
    const fx = parseFloat(getStyle(x, 'fontSize') || '16')
    const fy = parseFloat(getStyle(y, 'fontSize') || '16')
    return fx - fy
  })
  const subtitle = sortedPs[0]?.content || ''
  const description = sortedPs[sortedPs.length - 1]?.content || ''

  return {
    id: randomUUID(),
    kind: 'image',
    mediaAssetId: null,
    image,
    title: (h1?.content || '') as string,
    subtitle: subtitle === description ? '' : subtitle,
    description,
    ctaText: (a?.content || '') as string,
    ctaHref: (a?.attributes?.href || '') as string,
    alignment: 'center',
  }
}

function findNodeById(root: any, id: string): { parent: any; index: number; node: any } | null {
  function walk(n: any, parent: any, idx: number): any {
    if (n.id === id) return { parent, index: idx, node: n }
    const ch = n.children || []
    for (let i = 0; i < ch.length; i++) {
      const r = walk(ch[i], n, i)
      if (r) return r
    }
    return null
  }
  return walk(root, null, -1)
}

export async function migrateHeroToRepeater(
  options: { initDb?: boolean } = {}
): Promise<{ status: 'migrated' | 'already-migrated' }> {
  const initDb = options.initDb ?? true
  if (initDb) {
    await AppDataSource.initialize()
    console.log('[migrate-hero] DB connected')
  }

  const pageRepo = AppDataSource.getRepository(Page)
  const dsRepo = AppDataSource.getRepository(DataSourceEntity)
  const bindingRepo = AppDataSource.getRepository(DataBinding)

  const page = await pageRepo.findOne({ where: { id: PAGE_ID } })
  if (!page) throw new Error(`Page ${PAGE_ID} not found`)
  if (!page.structure) throw new Error('page.structure is empty')

  const existingVars = page.variables?.variables || []
  if (existingVars.some(v => v.name === VARIABLE_NAME)) {
    console.log(`[migrate-hero] Variable "${VARIABLE_NAME}" already exists — page already migrated.`)
    // Backfill: даже на уже мигрированной странице гарантируем data-carousel-variable
    // и data-carousel-mode (в первой версии миграции их не ставили).
    const heroRoot = findNodeById(page.structure, HERO_ROOT_ID)
    if (heroRoot) {
      let changed = false
      if (heroRoot.node.attributes?.['data-carousel-variable'] !== VARIABLE_NAME) {
        setAttr(heroRoot.node, 'data-carousel-variable', VARIABLE_NAME)
        changed = true
      }
      if (heroRoot.node.attributes?.['data-carousel-mode'] !== 'repeat') {
        setAttr(heroRoot.node, 'data-carousel-mode', 'repeat')
        changed = true
      }
      if (changed) {
        await pageRepo.save(page)
        console.log(`[migrate-hero] Backfilled data-carousel-variable="${VARIABLE_NAME}" + data-carousel-mode="repeat" on hero root`)
      }
    }
    if (initDb) await AppDataSource.destroy()
    return { status: 'already-migrated' }
  }

  // 1. Find track + slides
  const found = findNodeById(page.structure, TRACK_ID)
  if (!found) throw new Error(`Track node ${TRACK_ID} not found`)
  const track = found.node
  const slides: any[] = track.children || []
  if (slides.length < 1) throw new Error('No slides found in track')

  console.log(`[migrate-hero] Found ${slides.length} slides`)

  // 2. Extract slide data
  const slideData: SlideData[] = slides.map(extractSlide)
  console.log('[migrate-hero] Extracted slides:')
  slideData.forEach((s, i) => console.log(`  #${i}: title="${s.title}" image="${s.image}" cta="${s.ctaText}" -> ${s.ctaHref}`))

  // 3. Mutate template slide (first one) — keep it as repeater template
  const template = slides.find(s => s.id === TEMPLATE_SLIDE_ID) || slides[0]
  if (template.id !== TEMPLATE_SLIDE_ID) {
    console.warn(`[migrate-hero] WARN: TEMPLATE_SLIDE_ID ${TEMPLATE_SLIDE_ID} not found, using first slide ${template.id}`)
  }

  // template width: 33.33% -> 100%
  setStyle(template, 'width', '100%')
  setAttr(template, 'data-carousel-slide', 'true')

  // Tag inner elements with data-bind
  const innerPs = findAllByTag(template, 'p')
  const innerH1s = findAllByTag(template, 'h1')
  const innerAs = findAllByTag(template, 'a')

  // Sort ps by fontSize asc (subtitle тонкий, description крупнее)
  const sortedPs = innerPs.slice().sort((x: any, y: any) => {
    const fx = parseFloat(getStyle(x, 'fontSize') || '16')
    const fy = parseFloat(getStyle(y, 'fontSize') || '16')
    return fx - fy
  })
  if (sortedPs[0]) setAttr(sortedPs[0], 'data-bind', 'subtitle')
  if (sortedPs[sortedPs.length - 1] && sortedPs.length > 1) setAttr(sortedPs[sortedPs.length - 1], 'data-bind', 'description')
  if (innerH1s[0]) setAttr(innerH1s[0], 'data-bind', 'title')
  if (innerAs[0]) setAttr(innerAs[0], 'data-bind', 'cta')

  // FOUC prevention (option D): backgroundImage остаётся как есть для первого слайда (= данные slideData[0].image)
  // Уже установлен из исходного html → ничего не делаем

  // 4. Replace track children with single template
  track.children = [template]
  // track width: 300% -> 100%, убираем transform/transition (Phase 6 widget управляет)
  setStyle(track, 'width', '100%')
  setStyle(track, 'transition', undefined)
  setStyle(track, 'transform', undefined)
  setAttr(track, 'data-carousel-track', 'true')

  // 5. Mark hero root as carousel
  const heroRootFound = findNodeById(page.structure, HERO_ROOT_ID)
  if (heroRootFound) {
    setAttr(heroRootFound.node, 'data-carousel', 'true')
    setAttr(heroRootFound.node, 'data-carousel-autoplay', '5000')
    setAttr(heroRootFound.node, 'data-carousel-loop', 'true')
    // Декларируем имя page-variable, в которой лежат слайды.
    // SlidesTab в редакторе ищет именно этот атрибут, чтобы знать какую переменную править.
    setAttr(heroRootFound.node, 'data-carousel-variable', VARIABLE_NAME)
    // Декларативный режим карусели — высший приоритет для getCarouselMode().
    setAttr(heroRootFound.node, 'data-carousel-mode', 'repeat')
  } else {
    console.warn(`[migrate-hero] WARN: hero root ${HERO_ROOT_ID} not found`)
  }

  // 6. Mark dots/buttons (для будущего Phase 6 widget)
  const dotsFound = findNodeById(page.structure, DOTS_CONTAINER_ID)
  if (dotsFound) {
    setAttr(dotsFound.node, 'data-carousel-dots', 'true')
    ;(dotsFound.node.children || []).forEach((dot: any) => setAttr(dot, 'data-carousel-dot', 'true'))
  }
  const prevFound = findNodeById(page.structure, PREV_BTN_ID)
  if (prevFound) setAttr(prevFound.node, 'data-carousel-prev', 'true')
  const nextFound = findNodeById(page.structure, NEXT_BTN_ID)
  if (nextFound) setAttr(nextFound.node, 'data-carousel-next', 'true')

  // 7. Backup original structure in metadata before save
  const meta = page.metadata as any
  if (!meta.heroBackupV1) {
    meta.heroBackupV1 = {
      ts: new Date().toISOString(),
      originalSlideIds: slides.map(s => s.id),
    }
  }

  // 8. Save heroSlides into page.variables
  const newVar = {
    id: randomUUID(),
    name: VARIABLE_NAME,
    scope: 'page' as const,
    type: 'array' as const,
    defaultValue: slideData,
  }
  if (!page.variables) page.variables = { variables: [] }
  if (!page.variables.variables) page.variables.variables = []
  page.variables.variables.push(newVar)

  // 9. UPSERT DataSource
  let ds = await dsRepo.findOne({ where: { name: DS_NAME } })
  if (!ds) {
    ds = dsRepo.create({
      name: DS_NAME,
      description: 'Page-variable data source for Golden House home hero slides (auto-created by migrate-hero-to-repeater.ts)',
      type: 'page-variable',
      config: { variableName: VARIABLE_NAME },
      status: 'active',
    } as Partial<DataSourceEntity>)
    ds = await dsRepo.save(ds)
    console.log(`[migrate-hero] Created DataSource id=${ds.id}`)
  } else {
    console.log(`[migrate-hero] Reusing DataSource id=${ds.id}`)
  }

  // 10. UPSERT DataBinding for track
  let binding = await bindingRepo.findOne({ where: { pageId: PAGE_ID, blockId: TRACK_ID } })
  const bindingConfig: any = {
    dataSourceId: ds.id,
    bindingType: 'input',
    inputConfig: {
      mode: 'repeater',
      // NB: НЕ кладём templateId/libraryTemplateId сюда — эти поля зарезервированы
      // под UUID библиотечных блоков, иначе injectLibraryTemplates крашнется на SELECT FROM blocks WHERE id IN (...).
      arrayPath: undefined, // массив прямой
      fieldMappings: [
        { sourceField: 'image', targetProperty: 'self.style.backgroundImage' },
        { sourceField: 'subtitle', targetProperty: '[data-bind=subtitle].textContent' },
        { sourceField: 'title', targetProperty: '[data-bind=title].textContent' },
        { sourceField: 'description', targetProperty: '[data-bind=description].textContent' },
        { sourceField: 'ctaText', targetProperty: '[data-bind=cta].textContent' },
        { sourceField: 'ctaHref', targetProperty: '[data-bind=cta].attr.href' },
      ],
    },
    // Читается preparePageDataConfig первым приоритетом в templateId-резолвере.
    // findTemplateInContainer ищет по linkedBlockId; не найдёт — выпадёт в fallback «первый ребёнок»,
    // а ребёнок у нас ровно один — наш template.
    templateBlockId: TEMPLATE_SLIDE_ID,
  }
  if (!binding) {
    binding = bindingRepo.create({
      blockId: TRACK_ID,
      pageId: PAGE_ID,
      dataSourceId: ds.id,
      bindingType: 'input',
      config: bindingConfig,
      isActive: true,
      priority: 0,
    } as Partial<DataBinding>)
    binding = await bindingRepo.save(binding)
    console.log(`[migrate-hero] Created DataBinding id=${binding.id}`)
  } else {
    binding.config = bindingConfig
    binding.dataSourceId = ds.id
    binding.isActive = true
    await bindingRepo.save(binding)
    console.log(`[migrate-hero] Updated DataBinding id=${binding.id}`)
  }

  // 11. Save page (structure + variables + metadata)
  await pageRepo.save(page)
  console.log('[migrate-hero] Page saved')
  console.log('[migrate-hero] DONE. NB: deploy not triggered. Inspect DB / publish manually.')

  if (initDb) await AppDataSource.destroy()
  return { status: 'migrated' }
}

if (require.main === module) {
  migrateHeroToRepeater().catch(err => {
    console.error('[migrate-hero] FAILED:', err)
    process.exit(1)
  })
}
