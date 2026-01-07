import { Router } from 'express'
import pagesRouter from './pages'
import blocksRouter from './blocks'
import groupsRouter from './groups'

const router = Router()

router.use('/pages', pagesRouter)
router.use('/blocks', blocksRouter)
router.use('/groups', groupsRouter)

export default router
