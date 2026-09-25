#!/usr/bin/env node
/**
 * Проверка карты проекта в настоящем браузере. Запускается вручную — после
 * передеплоя страниц проектов или обновления карты (build-map-assets.sh):
 *
 *   node scripts/map/check-project-map.js https://test_analytics.gh.uz/ru/complex/assalom-dostlik/
 *   node scripts/map/check-project-map.js <адрес> --chrome=<путь к Chrome> --out=<куда скриншоты>
 *
 * Нужны playwright-core (лежит в visual-cms/node_modules) и Chrome; без
 * --chrome берётся CHROME_PATH или обычное место установки.
 *
 * Что проверяется:
 *   - карта отрисовалась, в консоли нет ошибок, все файлы /map/ пришли;
 *   - меток столько же, сколько точек, и они не плывут при масштабировании;
 *   - легенда прячет и возвращает места своего типа;
 *   - нажатие на место открывает подсказку;
 *   - кнопки поездки ведут к отделу продаж;
 *   - если /map/ недоступен — вместо карты список мест.
 * Скриншоты секции — компьютер и телефон. Код выхода 1, если что-то не так.
 */
'use strict'

const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright-core')

/** Метка дальше этого от своей точки — «плывёт». */
const MAX_DRIFT_PX = 1.5

function option(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}

const url = process.argv.slice(2).find((a) => !a.startsWith('--'))
if (!url) {
  console.error('usage: node scripts/map/check-project-map.js <адрес страницы проекта> [--chrome=путь] [--out=каталог]')
  process.exit(2)
}
const outDir = option('out') || path.join(process.cwd(), 'map-check')
const executablePath =
  option('chrome') ||
  process.env.CHROME_PATH ||
  (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome')

const results = []
function check(name, ok, detail) {
  results.push(ok)
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

/** Открывает страницу и ждёт, пока карта отрисуется или сдастся. */
async function openMap(page) {
  await page.goto(url, { waitUntil: 'load' })
  const root = page.locator('[data-map]').first()
  if ((await root.count()) === 0) {
    throw new Error('на странице нет карты ([data-map]): у проекта не заданы координаты дома?')
  }
  await root.scrollIntoViewIfNeeded()
  await page.waitForFunction(
    () => ['ready', 'failed', 'empty'].includes(document.querySelector('[data-map]').getAttribute('data-map-state')),
    null,
    { timeout: 45000 }
  )
  return root
}

const mapState = (page) => page.evaluate(() => document.querySelector('[data-map]').getAttribute('data-map-state'))

/** Худшее расхождение метки с экранной точкой её координат, px. */
function markerDrift(page) {
  return page.evaluate(() => {
    const view = document.querySelector('[data-map]').ghMap
    const box = view.map.getContainer().getBoundingClientRect()
    let worst = 0
    for (const p of view.points) {
      if (!p.marker || p.marker.hidden) continue
      const r = p.marker.getBoundingClientRect()
      // Место стоит центром на точке, дом и отдел продаж — остриём снизу.
      const x = r.left + r.width / 2
      const y = p.kind === 'place' ? r.top + r.height / 2 : r.bottom
      const q = view.map.project([p.lng, p.lat])
      worst = Math.max(worst, Math.hypot(x - (box.left + q.x), y - (box.top + q.y)))
    }
    return Math.round(worst * 10) / 10
  })
}

async function zoomBy(page, delta) {
  await page.evaluate((d) => {
    const map = document.querySelector('[data-map]').ghMap.map
    map.jumpTo({ zoom: map.getZoom() + d })
  }, delta)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
}

async function checkDesktop(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  // Ошибки загрузки чужих для карты файлов (картинки, favicon) карте не мешают:
  // из консоли берём только ошибки скриптов, из ответов — только /map/.
  page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errors.push(m.text()))
  page.on('response', (r) => r.url().includes('/map/') && r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`))

  await openMap(page)
  check('карта отрисовалась', (await mapState(page)) === 'ready', await mapState(page))
  await page.waitForTimeout(1500) // тайлы и шрифты догружаются после первой отрисовки
  check('без ошибок скриптов и 404 в /map/', errors.length === 0, errors.slice(0, 3).join(' | '))

  const counts = await page.evaluate(() => {
    const view = document.querySelector('[data-map]').ghMap
    return { points: view.points.length, markers: document.querySelectorAll('.project-map-marker').length }
  })
  check('меток столько же, сколько точек', counts.points === counts.markers && counts.points > 0, `${counts.markers} из ${counts.points}`)

  const drift = [await markerDrift(page)]
  await zoomBy(page, 2)
  drift.push(await markerDrift(page))
  await zoomBy(page, -3)
  drift.push(await markerDrift(page))
  await zoomBy(page, 1)
  check('метки не плывут при масштабировании', Math.max(...drift) <= MAX_DRIFT_PX, `${drift.join(' / ')} px`)

  fs.mkdirSync(outDir, { recursive: true })
  const section = page.locator('#location')
  await section.screenshot({ path: path.join(outDir, 'desktop.png') })

  const filter = page.locator('[data-map-filter]').first()
  if ((await filter.count()) > 0) {
    const type = await filter.getAttribute('data-map-filter')
    const visible = () =>
      page.evaluate(
        (t) => document.querySelector('[data-map]').ghMap.points.filter((p) => p.type === t && !p.marker.hidden).length,
        type
      )
    const before = await visible()
    await filter.click()
    const hidden = await visible()
    const pressed = await filter.getAttribute('aria-pressed')
    await filter.click()
    const after = await visible()
    check(`легенда прячет и возвращает «${type}»`, before > 0 && hidden === 0 && pressed === 'false' && after === before, `${before} → ${hidden} → ${after}`)
  } else {
    check('легенда', true, 'мест нет — легенды нет')
  }

  const pin = page.locator('.project-map-marker--place .project-map-pin').first()
  if ((await pin.count()) > 0) {
    await pin.click()
    await page.waitForTimeout(400) // подсказка появляется плавно
    const tip = await page.evaluate(() => {
      const open = document.querySelector('.project-map-marker.is-open .project-map-tip')
      return open ? getComputedStyle(open).visibility : 'не открылась'
    })
    check('нажатие на место открывает подсказку', tip === 'visible', tip)
    await section.screenshot({ path: path.join(outDir, 'desktop-tip.png') })
  }

  const trip = await page.evaluate(() => {
    const office = document.querySelector('[data-map]').ghMap.points.find((p) => p.kind === 'office')
    const links = [...document.querySelectorAll('.location-trip-links a')].map((a) => a.href)
    return { office: office && `${office.lat},${office.lng}`, links }
  })
  if (trip.office) {
    const [lat, lng] = trip.office.split(',')
    const ok =
      trip.links.length === 3 &&
      trip.links[0].includes(`end-lat=${lat}&end-lon=${lng}`) &&
      trip.links.slice(1).every((href) => href.includes(`${lat},${lng}`))
    check('кнопки поездки ведут к отделу продаж', ok, trip.links.join(' '))
  } else {
    check('кнопки поездки', trip.links.length === 0, 'отдела продаж нет — кнопок нет')
  }
  await page.close()
}

async function checkMobile(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  await openMap(page)
  check('телефон: карта отрисовалась', (await mapState(page)) === 'ready')
  await page.waitForTimeout(1500)
  await page.locator('#location').screenshot({ path: path.join(outDir, 'mobile.png') })
  await page.close()
}

async function checkFallback(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.route('**/map/manifest.json', (route) => route.abort())
  await openMap(page)
  const state = await mapState(page)
  const list = await page.evaluate(() => {
    const r = document.querySelector('.project-map-points').getBoundingClientRect()
    return { width: Math.round(r.width), height: Math.round(r.height) }
  })
  check('без /map/ — список мест вместо карты', state === 'failed' && list.width > 100 && list.height > 40, `${state}, список ${list.width}×${list.height}`)
  await page.locator('#location').screenshot({ path: path.join(outDir, 'fallback.png') })
  await page.close()
}

;(async () => {
  const browser = await chromium.launch({
    executablePath,
    // Карта — WebGL; без GPU браузер рисует её программно.
    args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  })
  try {
    await checkDesktop(browser)
    await checkMobile(browser)
    await checkFallback(browser)
  } finally {
    await browser.close()
  }
  console.log(`\nСкриншоты: ${outDir}`)
  process.exit(results.every(Boolean) ? 0 : 1)
})().catch((err) => {
  console.error(`FAIL ${err.message}`)
  process.exit(1)
})
