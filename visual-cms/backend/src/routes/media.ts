import { Router } from 'express'
import multer from 'multer'
import MediaController from '../controllers/MediaController'

// 200 MB hard cap (per-file). Image-vs-video size limits are re-checked in MediaService.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024, files: 2 },
})

const router = Router()

// Папки: регистрируем ДО '/:id', иначе '/folders' попадёт в параметр :id.
router.get('/folders', MediaController.listFolders)
router.post('/folders', MediaController.createFolder)
router.patch('/folders/:id', MediaController.updateFolder)
router.delete('/folders/:id', MediaController.deleteFolder)

router.get('/', MediaController.list)
router.get('/:id', MediaController.getById)
router.post(
  '/',
  upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'poster', maxCount: 1 },
  ]),
  MediaController.upload,
)
router.patch('/:id', MediaController.update)
router.delete('/:id', MediaController.delete)

export default router
