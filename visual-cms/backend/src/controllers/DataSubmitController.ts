import { Request, Response } from 'express'
import { asyncHandler, NotFoundError } from '../middleware'
import { AppDataSource } from '../config/database'
import { DataSubmission } from '../models/DataSubmission'

/**
 * DataSubmitController — журнал отправок привязок (только редактор).
 * Сама отправка — services/requests/RequestPipeline (routes/dataSubmit.ts).
 */

const submissionRepository = AppDataSource.getRepository(DataSubmission)

class DataSubmitController {
  /**
   * GET /api/data/submissions
   * Получить историю отправок (для аналитики)
   */
  getSubmissions = asyncHandler(async (req: Request, res: Response) => {
      const {
        pageId,
        blockId,
        dataSourceId,
        status,
        startDate,
        endDate,
        limit = 50,
        offset = 0,
      } = req.query

      const queryBuilder = submissionRepository.createQueryBuilder('submission')
        .orderBy('submission.createdAt', 'DESC')
        .take(Number(limit))
        .skip(Number(offset))

      if (pageId) {
        queryBuilder.andWhere('submission.pageId = :pageId', { pageId })
      }
      if (blockId) {
        queryBuilder.andWhere('submission.blockId = :blockId', { blockId })
      }
      if (dataSourceId) {
        queryBuilder.andWhere('submission.dataSourceId = :dataSourceId', { dataSourceId })
      }
      if (status) {
        queryBuilder.andWhere('submission.status = :status', { status })
      }
      if (startDate) {
        queryBuilder.andWhere('submission.createdAt >= :startDate', { startDate })
      }
      if (endDate) {
        queryBuilder.andWhere('submission.createdAt <= :endDate', { endDate })
      }

      const [submissions, total] = await queryBuilder.getManyAndCount()

      return res.json({
        items: submissions,
        total,
        limit: Number(limit),
        offset: Number(offset),
      })
  })

  /**
   * GET /api/data/submissions/:id
   * Получить одну запись
   */
  getSubmissionById = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params
      const submission = await submissionRepository.findOne({ where: { id } })

      if (!submission) {
        throw new NotFoundError('Submission', id)
      }
      return res.json(submission)
  })

  /**
   * GET /api/data/submissions/stats
   * Статистика отправок
   */
  getStats = asyncHandler(async (req: Request, res: Response) => {
      const { pageId, dataSourceId, startDate, endDate } = req.query

      let whereClause = ''
      const params: Record<string, unknown> = {}

      if (pageId) {
        whereClause += ' AND "pageId" = :pageId'
        params.pageId = pageId
      }
      if (dataSourceId) {
        whereClause += ' AND "dataSourceId" = :dataSourceId'
        params.dataSourceId = dataSourceId
      }
      if (startDate) {
        whereClause += ' AND "createdAt" >= :startDate'
        params.startDate = startDate
      }
      if (endDate) {
        whereClause += ' AND "createdAt" <= :endDate'
        params.endDate = endDate
      }

      const stats = await submissionRepository.query(`
        SELECT 
          status,
          COUNT(*) as count,
          AVG("durationMs") as avg_duration,
          COUNT(CASE WHEN "validationErrorsCount" > 0 THEN 1 END) as validation_errors
        FROM data_submissions
        WHERE 1=1 ${whereClause}
        GROUP BY status
      `, Object.values(params))

      const total = await submissionRepository.query(`
        SELECT COUNT(*) as total
        FROM data_submissions
        WHERE 1=1 ${whereClause}
      `, Object.values(params))

      return res.json({
        total: Number(total[0]?.total || 0),
        byStatus: stats,
      })
  })
}

export default new DataSubmitController()
