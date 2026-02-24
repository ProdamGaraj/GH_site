import { Router } from 'express'
import pagesRouter from './pages'
import blocksRouter from './blocks'
import groupsRouter from './groups'
import deployRouter from './deploy'
import dataSourcesRouter from './dataSources'
import dataBindingsRouter from './dataBindings'
import dataFetchRouter from './dataFetch'
import dataSubmitRouter from './dataSubmit'
import templatesRouter from './templates'
import variablesRouter from './variables'
import templateTestRouter from './template-test'
import mockRouter from './mock'
import formsRouter from './forms'
import analyticsRouter from './analytics'
import languagesRouter from './languages'
import translationsRouter from './translations'

const router = Router()

router.use('/analytics', analyticsRouter)
router.use('/pages', pagesRouter)
router.use('/blocks', blocksRouter)
router.use('/groups', groupsRouter)
router.use('/deploy', deployRouter)
router.use('/data-sources', dataSourcesRouter)
router.use('/data-bindings', dataBindingsRouter)
router.use('/data', dataFetchRouter)
router.use('/data', dataSubmitRouter)
router.use('/templates', templatesRouter)
router.use('/variables', variablesRouter)
router.use('/template-test', templateTestRouter)
router.use('/mock', mockRouter)
router.use('/forms', formsRouter)
router.use('/languages', languagesRouter)
router.use('/translations', translationsRouter)

export default router
