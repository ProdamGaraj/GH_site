import { Request, Response } from 'express'
import { languageService } from '../services/LanguageService'
import { asyncHandler, NotFoundError, AppError } from '../middleware'

export class LanguageController {
  getAll = asyncHandler(async (_req: Request, res: Response) => {
    const languages = await languageService.getAll()
    res.json(languages)
  })

  getActive = asyncHandler(async (_req: Request, res: Response) => {
    const languages = await languageService.getActive()
    res.json(languages)
  })

  getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const language = await languageService.getById(id)
    if (!language) {
      throw new NotFoundError('Language', id)
    }
    res.json(language)
  })

  create = asyncHandler(async (req: Request, res: Response) => {
    const language = await languageService.create(req.body)
    res.status(201).json(language)
  })

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const language = await languageService.update(id, req.body)
    if (!language) {
      throw new NotFoundError('Language', id)
    }
    res.json(language)
  })

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    try {
      const deleted = await languageService.delete(id)
      if (!deleted) {
        throw new NotFoundError('Language', id)
      }
      res.status(204).send()
    } catch (err: any) {
      if (err.message?.includes('default language')) {
        throw new AppError(err.message, 400, 'CANNOT_DELETE_DEFAULT')
      }
      throw err
    }
  })

  reorder = asyncHandler(async (req: Request, res: Response) => {
    const { orderedIds } = req.body
    const languages = await languageService.reorder(orderedIds)
    res.json(languages)
  })

  seedDefaults = asyncHandler(async (_req: Request, res: Response) => {
    await languageService.seedDefaults()
    const languages = await languageService.getAll()
    res.json(languages)
  })
}

export const languageController = new LanguageController()
