import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import { AnalyticsController } from '../controllers/AnalyticsController'
import { logger } from '../services/Logger'

const router = Router()
const controller = new AnalyticsController()

// ─── Public: tracker.js script (для встраивания в сайт) ────────
// Кешируем содержимое файла в памяти при старте
let trackerScript: string | null = null
function getTrackerScript(): string {
  if (trackerScript) return trackerScript
  // Пробуем несколько путей (ts-node vs compiled)
  const candidates = [
    path.resolve(__dirname, '../controllers/analytics-tracker.js'),
    path.resolve(__dirname, '../../src/controllers/analytics-tracker.js'),
    path.resolve(process.cwd(), 'src/controllers/analytics-tracker.js'),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      trackerScript = fs.readFileSync(p, 'utf-8')
      return trackerScript
    }
  }
  throw new Error(`analytics-tracker.js not found. Tried: ${candidates.join(', ')}`)
}

router.get('/tracker.js', (_req, res) => {
  try {
    const script = getTrackerScript()
    res.set({
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    })
    res.send(script)
  } catch (err: any) {
    logger.error('Failed to serve tracker.js', err as Error)
    res.status(500).send('// tracker.js not available')
  }
})

// ─── Public: tracking (вызывается из published-сайтов) ─────────
router.post('/track', controller.track)
router.post('/heartbeat', controller.heartbeat)

// ─── CMS Dashboard: reports ────────────────────────────────────
router.get('/report', controller.getFullReport)
router.get('/overview', controller.getOverview)
router.get('/timeseries', controller.getTimeSeries)
router.get('/pages', controller.getPageStats)
router.get('/pages/:id', controller.getPageDetailed)
router.get('/blocks', controller.getBlockStats)
router.get('/requests', controller.getRequestStats)
router.get('/web-vitals', controller.getWebVitals)
router.get('/devices', controller.getDevices)
router.get('/browsers', controller.getBrowsers)
router.get('/countries', controller.getCountries)
router.get('/traffic-sources', controller.getTrafficSources)
router.get('/realtime', controller.getRealtime)

export default router
