/**
 * Phase 5 — Inspect: render Hero page HTML without deploying to public-site.
 * Writes /tmp/test-hero.html inside container.
 *
 * Run: docker exec visual-cms-backend-1 npx ts-node src/scripts/inspect-hero-html.ts
 */
import 'reflect-metadata'
import * as fs from 'fs'
import { AppDataSource } from '../config/database'
import { Page } from '../models/Page'
import { deployService } from '../services/DeployService'
import { htmlGenerator } from '../services/HtmlGenerator'
import { linkedBlocksService } from '../services/LinkedBlocksService'

const PAGE_ID = '5f597235-130e-4f57-a0ac-1eb1f77af920'
const OUT = '/tmp/test-hero.html'

async function main(): Promise<void> {
  await AppDataSource.initialize()
  const page = await AppDataSource.getRepository(Page).findOne({ where: { id: PAGE_ID }, relations: ['site'] })
  if (!page || !page.structure) throw new Error('page not found / no structure')

  const updated = await linkedBlocksService.updateLinkedBlocks(page.structure)
  // injectLibraryTemplates / preparePageDataConfig — приватные, дёргаем через cast
  const ds = deployService as any
  const updatedWithTpl = await ds.injectLibraryTemplates(updated, PAGE_ID)
  const dataConfig = await ds.preparePageDataConfig(PAGE_ID, updatedWithTpl)

  const html = htmlGenerator.generatePage(
    updatedWithTpl,
    page.metadata || { title: page.name, description: '', keywords: [] },
    page.slug,
    dataConfig,
  )
  fs.writeFileSync(OUT, html, 'utf-8')
  console.log(`Wrote ${OUT} (${html.length} bytes)`)

  // Quick sanity grep
  const checks: Array<[string, boolean]> = [
    ['data-carousel="true" present', /data-carousel="true"/.test(html)],
    ['data-carousel-track present', /data-carousel-track="true"/.test(html)],
    ['data-carousel-slide present', /data-carousel-slide="true"/.test(html)],
    ['data-carousel-autoplay=5000', /data-carousel-autoplay="5000"/.test(html)],
    ['data-bind=title present', /data-bind="title"/.test(html)],
    ['data-bind=cta present', /data-bind="cta"/.test(html)],
    ['heroSlides variable injected', /"name":"heroSlides"|_variables\s*=\s*\{[^}]*"heroSlides"/.test(html) || /"heroSlides":\[/.test(html)],
    ['page-variable type in dataSources', /"type":"page-variable"/.test(html)],
    ['variableName in source', /"variableName":"heroSlides"/.test(html)],
    ['self.style.backgroundImage mapping', /"targetProperty":"self\.style\.backgroundImage"/.test(html)],
    ['[data-bind=title].textContent mapping', /\[data-bind=title\]\.textContent/.test(html)],
    ['[data-bind=cta].attr.href mapping', /\[data-bind=cta\]\.attr\.href/.test(html)],
    ['runtime: page-variable preload code present', /source\.type === 'page-variable'/.test(html)],
    ['runtime: applyValue with backgroundImage url() wrap', /backgroundImage[\s\S]{0,80}'url\("'/.test(html)],
    ['no track inline width:300%', !/width:\s*300%/.test(html)],
    ['carousel runtime injected', /\[data-carousel="true"\]/.test(html) && /MutationObserver/.test(html)],
    ['carousel runtime: track selector', /\[data-carousel-track="true"\]/.test(html)],
    ['carousel runtime: dots/prev/next handlers', /data-carousel-prev/.test(html) && /data-carousel-next/.test(html) && /data-carousel-dots/.test(html)],
  ]
  let pass = 0, fail = 0
  console.log('\n=== Sanity checks ===')
  for (const [name, ok] of checks) {
    console.log((ok ? 'PASS  ' : 'FAIL  ') + name)
    ok ? pass++ : fail++
  }
  console.log(`\n${pass} passed, ${fail} failed (${checks.length} total)`)

  // Print interesting fragment: lines around data-carousel-track and DataBinding script
  const trackIdx = html.indexOf('data-carousel-track')
  if (trackIdx >= 0) {
    console.log('\n--- Track context (±300 chars) ---')
    console.log(html.slice(Math.max(0, trackIdx - 300), trackIdx + 1500))
  }

  await AppDataSource.destroy()
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('FAIL:', err)
  process.exit(1)
})
