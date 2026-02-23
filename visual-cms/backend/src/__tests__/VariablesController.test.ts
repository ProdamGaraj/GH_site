/**
 * VariablesController Unit Tests
 */

import { Request, Response, NextFunction } from 'express'

const flushPromises = (): Promise<void> => new Promise(resolve => setImmediate(resolve))

const mockQueryBuilder = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  getMany: jest.fn(),
  getOne: jest.fn(),
}

const mockRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: mockQueryBuilder.getMany,
    getOne: mockQueryBuilder.getOne,
  })),
}

const mockPageRepository = {
  findOne: jest.fn(),
}

jest.mock('../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn((entity) => {
      if (entity.name === 'PageVariable') return mockRepository
      if (entity.name === 'Page') return mockPageRepository
      return mockRepository
    }),
  },
}))

import { VariablesController } from '../controllers/VariablesController'

describe('VariablesController', () => {
  const mockNext = jest.fn() as unknown as NextFunction
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let responseJson: jest.Mock
  let responseStatus: jest.Mock

  beforeEach(() => {
    responseJson = jest.fn()
    responseStatus = jest.fn().mockReturnThis()
    mockRequest = { params: {}, body: {}, query: {} }
    mockResponse = { json: responseJson, status: responseStatus }
    jest.clearAllMocks()
  })

  describe('getAll', () => {
    it('should return all variables as flat array', async () => {
      const mockVars = [
        { id: '1', name: 'v1', scope: 'page' },
        { id: '2', name: 'v2', scope: 'global' },
      ]
      mockQueryBuilder.getMany.mockResolvedValue(mockVars)
      VariablesController.getAll(mockRequest as Request, mockResponse as Response, mockNext)
      await flushPromises()
      expect(responseJson).toHaveBeenCalledWith({ success: true, data: mockVars, count: 2 })
    })
  })

  describe('getByPage', () => {
    it('should return variables for page', async () => {
      mockRequest.params = { pageId: 'p1' }
      mockPageRepository.findOne.mockResolvedValue({ id: 'p1' })
      const mockVars = [{ id: '1', name: 'v1', scope: 'page' }]
      mockQueryBuilder.getMany.mockResolvedValue(mockVars)
      VariablesController.getByPage(mockRequest as Request, mockResponse as Response, mockNext)
      await flushPromises()
      expect(responseJson).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: mockVars, count: 1 }))
    })

    it('should 404 for non-existent page', async () => {
      mockRequest.params = { pageId: 'bad' }
      mockPageRepository.findOne.mockResolvedValue(null)
      VariablesController.getByPage(mockRequest as Request, mockResponse as Response, mockNext)
      await flushPromises()
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }))
    })
  })

  describe('create', () => {
    it('should create a new variable', async () => {
      mockRequest.body = { name: 'nv', type: 'string', scope: 'page', pageId: 'p1' }
      const created = { id: 'x', ...mockRequest.body }
      mockPageRepository.findOne.mockResolvedValue({ id: 'p1' })
      mockRepository.findOne.mockResolvedValue(null)
      mockRepository.create.mockReturnValue(created)
      mockRepository.save.mockResolvedValue(created)
      VariablesController.create(mockRequest as Request, mockResponse as Response, mockNext)
      await flushPromises()
      expect(mockRepository.save).toHaveBeenCalled()
      expect(responseStatus).toHaveBeenCalledWith(201)
      expect(responseJson).toHaveBeenCalledWith({ success: true, data: created })
    })

    it('should 409 for duplicate name', async () => {
      mockRequest.body = { name: 'dup', type: 'string', scope: 'page', pageId: 'p1' }
      mockPageRepository.findOne.mockResolvedValue({ id: 'p1' })
      mockRepository.findOne.mockResolvedValue({ id: 'e', name: 'dup' })
      VariablesController.create(mockRequest as Request, mockResponse as Response, mockNext)
      await flushPromises()
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }))
    })

    it('should 404 for non-existent page', async () => {
      mockRequest.body = { name: 'v', type: 'string', scope: 'page', pageId: 'bad' }
      mockPageRepository.findOne.mockResolvedValue(null)
      VariablesController.create(mockRequest as Request, mockResponse as Response, mockNext)
      await flushPromises()
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }))
    })
  })

  describe('update', () => {
    it('should update existing variable', async () => {
      mockRequest.params = { id: 'v1' }
      mockRequest.body = { name: 'updated' }
      const existing = { id: 'v1', name: 'old', type: 'string', scope: 'page' }
      mockRepository.findOne.mockResolvedValueOnce(existing)
      mockRepository.findOne.mockResolvedValueOnce(null)
      mockRepository.save.mockResolvedValue({ ...existing, name: 'updated' })
      VariablesController.update(mockRequest as Request, mockResponse as Response, mockNext)
      await flushPromises()
      expect(responseJson).toHaveBeenCalledWith({ success: true, data: expect.objectContaining({ name: 'updated' }) })
    })

    it('should 404 for non-existent variable', async () => {
      mockRequest.params = { id: 'bad' }
      mockRequest.body = { name: 't' }
      mockRepository.findOne.mockResolvedValue(null)
      VariablesController.update(mockRequest as Request, mockResponse as Response, mockNext)
      await flushPromises()
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }))
    })
  })

  describe('delete', () => {
    it('should delete existing variable', async () => {
      mockRequest.params = { id: 'v1' }
      const existing = { id: 'v1', name: 'del' }
      mockRepository.findOne.mockResolvedValue(existing)
      mockRepository.remove.mockResolvedValue(existing)
      VariablesController.delete(mockRequest as Request, mockResponse as Response, mockNext)
      await flushPromises()
      expect(mockRepository.remove).toHaveBeenCalledWith(existing)
      expect(responseJson).toHaveBeenCalledWith({ success: true, message: 'Variable deleted' })
    })

    it('should 404 for non-existent variable', async () => {
      mockRequest.params = { id: 'bad' }
      mockRepository.findOne.mockResolvedValue(null)
      VariablesController.delete(mockRequest as Request, mockResponse as Response, mockNext)
      await flushPromises()
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }))
    })
  })

  describe('bulkCreate', () => {
    it('should create multiple variables', async () => {
      mockRequest.body = {
        variables: [
          { name: 'v1', type: 'string', scope: 'page' },
          { name: 'v2', type: 'number', scope: 'page' },
        ]
      }
      mockRepository.create.mockImplementation((d: any) => ({ id: 'id', ...d }))
      mockRepository.save.mockImplementation((d: any) => Promise.resolve(d))
      VariablesController.bulkCreate(mockRequest as Request, mockResponse as Response, mockNext)
      await flushPromises()
      expect(mockRepository.create).toHaveBeenCalledTimes(2)
      expect(mockRepository.save).toHaveBeenCalledTimes(2)
      expect(responseStatus).toHaveBeenCalledWith(201)
    })
  })

  describe('validateValue', () => {
    it('should validate value', async () => {
      mockRequest.params = { id: 'v1' }
      mockRequest.body = { value: 42 }
      const variable = {
        id: 'v1',
        type: 'number',
        validateValue: jest.fn().mockReturnValue({ valid: true }),
        coerceValue: jest.fn().mockReturnValue(42),
      }
      mockRepository.findOne.mockResolvedValue(variable)
      VariablesController.validateValue(mockRequest as Request, mockResponse as Response, mockNext)
      await flushPromises()
      expect(responseJson).toHaveBeenCalledWith({ success: true, data: expect.objectContaining({ valid: true, coercedValue: 42 }) })
    })

    it('should return validation errors', async () => {
      mockRequest.params = { id: 'v1' }
      mockRequest.body = { value: 'bad' }
      const variable = {
        id: 'v1',
        type: 'number',
        validateValue: jest.fn().mockReturnValue({ valid: false, error: 'Expected number' }),
        coerceValue: jest.fn().mockReturnValue(NaN),
      }
      mockRepository.findOne.mockResolvedValue(variable)
      VariablesController.validateValue(mockRequest as Request, mockResponse as Response, mockNext)
      await flushPromises()
      expect(responseJson).toHaveBeenCalledWith({ success: true, data: expect.objectContaining({ valid: false, error: 'Expected number' }) })
    })
  })
})
