import { Router } from 'express'
import { AdminController } from '../controllers/AdminController'
import { ReadController } from '../controllers/ReadController'
import { requireWriteToken } from '../middleware/writeAuth'
import { validate } from '../middleware/validate'
import {
  createNewsSchema,
  deployedSchema,
  dictionarySchema,
  updateDictionarySchema,
  updateNewsSchema,
} from '../schemas/news.schema'

const router = Router()

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'news-service', time: new Date().toISOString() })
})

// Внутреннее чтение (DataSource CMS, server-fetch во внутренней сети).
router.get('/api/news', ReadController.list)
router.get('/api/news/:slug', ReadController.detail)

// Публичная лента (наружу через nginx: только чтение, кэш, лимит частоты).
router.get('/api/public/news', ReadController.feed)
router.get('/api/public/news/facets', ReadController.facets)

// Админ-API (под X-News-Token): админка CMS и отчёт CMS о деплое.
const admin = Router()
admin.use(requireWriteToken)

admin.get('/news', AdminController.listNews)
admin.get('/news/:id', AdminController.getNews)
admin.post('/news', validate(createNewsSchema), AdminController.createNews)
admin.put('/news/:id', validate(updateNewsSchema), AdminController.updateNews)
admin.delete('/news/:id', AdminController.deleteNews)
admin.post('/news/:id/publish', AdminController.publish)
admin.post('/news/:id/unpublish', AdminController.unpublish)
admin.post('/news/:id/archive', AdminController.archive)

for (const [path, dict] of [
  ['categories', AdminController.categories],
  ['tags', AdminController.tags],
] as const) {
  admin.get(`/${path}`, dict.list)
  admin.post(`/${path}`, validate(dictionarySchema), dict.create)
  admin.put(`/${path}/:key`, validate(updateDictionarySchema), dict.update)
  admin.delete(`/${path}/:key`, dict.remove)
}

admin.post('/deployed', validate(deployedSchema), AdminController.deployed)

router.use('/api/admin', admin)

export default router
