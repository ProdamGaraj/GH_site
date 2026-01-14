import { Router } from 'express'
import pagesRouter from './pages'
import blocksRouter from './blocks'
import groupsRouter from './groups'
import deployRouter from './deploy'

const router = Router()

router.use('/pages', pagesRouter)
router.use('/blocks', blocksRouter)
router.use('/groups', groupsRouter)
router.use('/deploy', deployRouter)

export default router
