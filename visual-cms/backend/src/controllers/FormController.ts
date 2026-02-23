import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { Form, CreateFormDto, UpdateFormDto } from '../models/Form'
import { FormDestination, CreateFormDestinationDto, UpdateFormDestinationDto } from '../models/FormDestination'
import { FormSubmissionLog } from '../models/FormSubmissionLog'
import {
  validateFormData,
  dispatchToAllDestinations,
  updateDestinationStats,
} from '../services/FormSubmissionService'
import { logger } from '../services/Logger'
import { asyncHandler, NotFoundError, AppError } from '../middleware'

export class FormController {
  private formRepo = AppDataSource.getRepository(Form)
  private destRepo = AppDataSource.getRepository(FormDestination)
  private submissionRepo = AppDataSource.getRepository(FormSubmissionLog)

  // --- CRUD: Forms ---

  getAll = asyncHandler(async (req: Request, res: Response) => {
    const { status, pageId, search } = req.query
    const qb = this.formRepo.createQueryBuilder('form')
      .leftJoinAndSelect('form.destinations', 'dest')
      .orderBy('form.updatedAt', 'DESC')

    if (status) qb.andWhere('form.status = :status', { status })
    if (pageId) qb.andWhere('form.pageId = :pageId', { pageId })
    if (search) {
      qb.andWhere('(form.name ILIKE :s OR form.description ILIKE :s)', {
        s: `%${search}%`,
      })
    }

    const forms = await qb.getMany()
    res.json(forms)
  })

  getById = asyncHandler(async (req: Request, res: Response) => {
    const form = await this.formRepo.findOne({
      where: { id: req.params.id },
      relations: ['destinations'],
    })
    if (!form) throw new NotFoundError('Form', req.params.id)
    res.json(form)
  })

  create = asyncHandler(async (req: Request, res: Response) => {
    const dto: CreateFormDto = req.body
    const form = this.formRepo.create({
      name: dto.name,
      description: dto.description || null,
      pageId: dto.pageId || null,
      status: dto.status || 'draft',
      fields: dto.fields || [],
      settings: dto.settings || {},
    })
    const saved = await this.formRepo.save(form)
    res.status(201).json(saved)
  })

  update = asyncHandler(async (req: Request, res: Response) => {
    const form = await this.formRepo.findOneBy({ id: req.params.id })
    if (!form) throw new NotFoundError('Form', req.params.id)

    const dto: UpdateFormDto = req.body
    if (dto.name !== undefined) form.name = dto.name
    if (dto.description !== undefined) form.description = dto.description || null
    if (dto.pageId !== undefined) form.pageId = dto.pageId || null
    if (dto.status !== undefined) form.status = dto.status
    if (dto.fields !== undefined) form.fields = dto.fields
    if (dto.settings !== undefined) form.settings = dto.settings

    const saved = await this.formRepo.save(form)
    res.json(saved)
  })

  delete = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.formRepo.delete(req.params.id)
    if (result.affected === 0) throw new NotFoundError('Form', req.params.id)
    res.json({ message: 'Form deleted' })
  })

  duplicate = asyncHandler(async (req: Request, res: Response) => {
    const form = await this.formRepo.findOne({
      where: { id: req.params.id },
      relations: ['destinations'],
    })
    if (!form) throw new NotFoundError('Form', req.params.id)

    const newForm = this.formRepo.create({
      name: `${form.name} (копия)`,
      description: form.description,
      pageId: form.pageId,
      status: 'draft',
      fields: form.fields,
      settings: form.settings,
    })
    const saved = await this.formRepo.save(newForm)

    // Duplicate destinations
    if (form.destinations?.length) {
      for (const dest of form.destinations) {
        const newDest = this.destRepo.create({
          formId: saved.id,
          name: dest.name,
          type: dest.type,
          config: dest.config,
          fieldMapping: dest.fieldMapping,
          isActive: dest.isActive,
          priority: dest.priority,
        })
        await this.destRepo.save(newDest)
      }
    }

    const result = await this.formRepo.findOne({
      where: { id: saved.id },
      relations: ['destinations'],
    })
    res.status(201).json(result)
  })

  // --- CRUD: Destinations ---

  getDestinations = asyncHandler(async (req: Request, res: Response) => {
    const destinations = await this.destRepo.find({
      where: { formId: req.params.formId },
      order: { priority: 'ASC' },
    })
    res.json(destinations)
  })

  createDestination = asyncHandler(async (req: Request, res: Response) => {
    const form = await this.formRepo.findOneBy({ id: req.params.formId })
    if (!form) throw new NotFoundError('Form', req.params.formId)

    const dto: CreateFormDestinationDto = req.body
    const dest = this.destRepo.create({
      formId: req.params.formId,
      name: dto.name,
      type: dto.type,
      config: dto.config,
      fieldMapping: dto.fieldMapping || [],
      isActive: dto.isActive ?? true,
      priority: dto.priority ?? 0,
    })
    const saved = await this.destRepo.save(dest)
    res.status(201).json(saved)
  })

  updateDestination = asyncHandler(async (req: Request, res: Response) => {
    const dest = await this.destRepo.findOneBy({ id: req.params.destId })
    if (!dest) throw new NotFoundError('Destination', req.params.destId)

    const dto: UpdateFormDestinationDto = req.body
    if (dto.name !== undefined) dest.name = dto.name
    if (dto.type !== undefined) dest.type = dto.type
    if (dto.config !== undefined) dest.config = dto.config
    if (dto.fieldMapping !== undefined) dest.fieldMapping = dto.fieldMapping
    if (dto.isActive !== undefined) dest.isActive = dto.isActive
    if (dto.priority !== undefined) dest.priority = dto.priority

    const saved = await this.destRepo.save(dest)
    res.json(saved)
  })

  deleteDestination = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.destRepo.delete(req.params.destId)
    if (result.affected === 0) throw new NotFoundError('Destination', req.params.destId)
    res.json({ message: 'Destination deleted' })
  })

  testDestination = asyncHandler(async (req: Request, res: Response) => {
    const dest = await this.destRepo.findOneBy({ id: req.params.destId })
    if (!dest) throw new NotFoundError('Destination', req.params.destId)

    const form = await this.formRepo.findOneBy({ id: dest.formId })
    const testData: Record<string, unknown> = {}
    if (form) {
      for (const field of form.fields) {
        switch (field.type) {
          case 'email': testData[field.name] = 'test@example.com'; break
          case 'phone': testData[field.name] = '+7 999 123-45-67'; break
          case 'number': testData[field.name] = 42; break
          case 'checkbox': testData[field.name] = true; break
          default: testData[field.name] = `Тестовое значение (${field.label})`
        }
      }
    } else {
      testData['test'] = 'Тестовое сообщение'
    }

    const result = await (await import('../services/FormSubmissionService')).dispatchToDestination(dest, testData)
    res.json(result)
  })

  // --- Public Submit ---

  submit = asyncHandler(async (req: Request, res: Response) => {
    const formId = req.params.formId || req.body.formId
    if (!formId) {
      return res.status(400).json({ success: false, message: 'formId is required' })
    }

    const form = await this.formRepo.findOne({
      where: { id: formId },
      relations: ['destinations'],
    })

    if (!form) {
      return res.status(404).json({ success: false, message: 'Form not found' })
    }

    if (form.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Form is not active' })
    }

    const data: Record<string, unknown> = req.body.data || req.body

    // Honeypot check
    if (form.settings.honeypotField) {
      const hpValue = data[form.settings.honeypotField] || req.body._hp
      if (hpValue) {
        logger.info(`Honeypot triggered for form ${formId}`)
        return res.json({
          success: true,
          message: form.settings.successMessage || 'Спасибо! Ваша заявка отправлена.',
        })
      }
    }

    // Rate limiting per IP
    if (form.settings.rateLimitPerMinute) {
      const ip = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown'
      const oneMinuteAgo = new Date(Date.now() - 60000)
      const recentCount = await this.submissionRepo
        .createQueryBuilder('s')
        .where('s.formId = :formId', { formId })
        .andWhere('s.ip = :ip', { ip })
        .andWhere('s.createdAt > :since', { since: oneMinuteAgo })
        .getCount()

      if (recentCount >= form.settings.rateLimitPerMinute) {
        return res.status(429).json({
          success: false,
          message: 'Слишком много запросов. Попробуйте позже.',
        })
      }
    }

    // Validation
    const validationErrors = validateFormData(form.fields, data)
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации',
        errors: Object.fromEntries(validationErrors.map((e) => [e.field, e.message])),
      })
    }

    // Dispatch to all destinations
    const destinationResults = await dispatchToAllDestinations(
      form.destinations || [],
      data
    )

    // Update destination stats in background
    updateDestinationStats(destinationResults).catch((err) =>
      logger.error('Failed to update destination stats:', err)
    )

    // Log submission
    const allSuccess = destinationResults.every((r) => r.success)
    const anySuccess = destinationResults.some((r) => r.success)
    const status = allSuccess ? 'success' : anySuccess ? 'partial' : 'failed'

    if (form.settings.storeSubmissions !== false) {
      const submission = this.submissionRepo.create({
        formId: form.id,
        data,
        status,
        destinationResults,
        ip: req.ip || req.headers['x-forwarded-for']?.toString() || null,
        userAgent: req.headers['user-agent']?.slice(0, 300) || null,
        referrer: req.headers.referer?.slice(0, 500) || null,
      })
      await this.submissionRepo.save(submission)

      // Increment form counter
      await this.formRepo
        .createQueryBuilder()
        .update(Form)
        .set({ submissionsCount: () => '"submissionsCount" + 1' })
        .where('id = :id', { id: form.id })
        .execute()
    }

    // Response
    if (!anySuccess && destinationResults.length > 0) {
      return res.status(502).json({
        success: false,
        message: 'Не удалось отправить данные. Попробуйте позже.',
        destinationResults,
      })
    }

    res.json({
      success: true,
      message: form.settings.successMessage || 'Спасибо! Ваша заявка отправлена.',
      destinationResults,
    })
  })

  // --- Submissions History ---

  getSubmissions = asyncHandler(async (req: Request, res: Response) => {
    const { formId, status, limit = 50, offset = 0 } = req.query
    const qb = this.submissionRepo.createQueryBuilder('s')
      .orderBy('s.createdAt', 'DESC')
      .take(Number(limit))
      .skip(Number(offset))

    if (formId) qb.andWhere('s.formId = :formId', { formId })
    if (status) qb.andWhere('s.status = :status', { status })

    const [items, total] = await qb.getManyAndCount()
    res.json({ items, total })
  })

  getSubmissionStats = asyncHandler(async (req: Request, res: Response) => {
    const formId = req.params.formId
    const stats = await this.submissionRepo
      .createQueryBuilder('s')
      .select('s.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('s.formId = :formId', { formId })
      .groupBy('s.status')
      .getRawMany()

    const total = stats.reduce((sum: number, s: any) => sum + Number(s.count), 0)
    res.json({ formId, total, byStatus: stats })
  })
}
