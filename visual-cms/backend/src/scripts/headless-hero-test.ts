/**
 * Headless test of deployed Hero page using jsdom.
 * Verifies repeater + carousel runtime end-to-end without browser.
 */
import 'reflect-metadata'
import * as fs from 'fs'
const { JSDOM, VirtualConsole } = require('jsdom')

const HTML_PATH = '/usr/share/nginx/html/index.html' // not mounted — use deployed via curl
const URL_BASE = 'https://localhost/'

async function main() {
  const html = fs.readFileSync('/app/public-site/index.html', 'utf-8')
  console.log('HTML size:', html.length)

  const vc = new VirtualConsole()
  const logs: string[] = []
  vc.on('log', (...a: any[]) => logs.push('[log] ' + a.map(String).join(' ')))
  vc.on('warn', (...a: any[]) => logs.push('[warn] ' + a.map(String).join(' ')))
  vc.on('error', (...a: any[]) => logs.push('[err] ' + a.map(String).join(' ')))
  vc.on('info', (...a: any[]) => logs.push('[info] ' + a.map(String).join(' ')))
  vc.on('jsdomError', (e: any) => logs.push('[jsdomError] ' + (e && e.message ? e.message : String(e)) + (e && e.stack ? '\n' + e.stack : '')))

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: URL_BASE,
    virtualConsole: vc,
  })

  // wait for window 'load' event
  await new Promise<void>(resolve => {
    if (dom.window.document.readyState === 'complete') return resolve()
    dom.window.addEventListener('load', () => resolve())
  })
  // extra tick for MutationObserver / async repeater
  await new Promise(r => setTimeout(r, 800))

  const doc = dom.window.document
  const root = doc.querySelector('[data-carousel="true"]') as any
  const track = doc.querySelector('[data-carousel-track="true"]') as any
  const slides = doc.querySelectorAll('[data-carousel-slide="true"]')
  const dotsContainer = doc.querySelector('[data-carousel-dots]') as any
  const dotsAll = dotsContainer ? dotsContainer.children.length : 0
  const repeaterItems = doc.querySelectorAll('[data-repeater-item]')

  console.log('--- DOM after init ---')
  console.log('  root present:', !!root)
  console.log('  track present:', !!track)
  console.log('  slides total (data-carousel-slide):', slides.length)
  console.log('  repeater clones (data-repeater-item):', repeaterItems.length)
  console.log('  dots in container:', dotsAll)

  if (track) {
    const tStyle = (track as any).style
    console.log('  track.display:', tStyle.display)
    console.log('  track.width:', tStyle.width)
    console.log('  track.transform:', tStyle.transform)
  }

  console.log('\n--- Console logs ---')
  for (const l of logs.slice(0, 80)) console.log(l)

  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
