/**
 * VariablesController Unit Tests
 * 
 * Тесты для контроллера переменных
 */

import { Request, Response } from 'express'

// Mock TypeORM
const mockRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getOne: jest.fn(),
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

// Import after mocking
import { VariablesController } from '../controllers/VariablesController'

describe('VariablesController', () => {
  // Use static methods directly instead of instance
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let responseJson: jest.Mock
  let responseStatus: jest.Mock

  beforeEach(() => {
    responseJson = jest.fn()
    responseStatus = jest.fn().mockReturnThis()
    
    mockRequest = {
      params: {},
      body: {},
      query: {},
    }
    
    mockResponse = {
      json: responseJson,
      status: responseStatus,
    }

    // Reset all mocks
    jest.clearAllMocks()
  })

  describe('getAll', () => {
    it('should return all variables grouped by scope', async () => {
      const mockVariables = [
        { id: '1', name: 'var1', scope: 'page', type: 'string', pageId: 'p1' },
        { id: '2', name: 'var2', scope: 'global', type: 'number', pageId: null },
        { id: '3', name: 'var3', scope: 'session', type: 'boolean', pageId: 'p1' },
      ]

      mockRepository.find.mockResolvedValue(mockVariables)

      await VariablesController.getAll(mockRequest as Request, mockResponse as Response)

      expect(mockRepository.find).toHaveBeenCalled()
      expect(responseJson).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          page: expect.any(Array),
          session: expect.any(Array),
          global: expect.any(Array),
        }),
        count: 3,
      })
    })

    it('should filter by scope when provided', async () => {
      mockRequest.query = { scope: 'global' }
      mockRepository.find.mockResolvedValue([
        { id: '2', name: 'var2', scope: 'global', type: 'number' }
      ])

      await VariablesController.getAll(mockRequest as Request, mockResponse as Response)

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ scope: 'global' })
        })
      )
    })
  })

  describe('getByPage', () => {
    it('should return variables for specific page', async () => {
      mockRequest.params = { pageId: 'page-123' }
      const mockVariables = [
        { id: '1', name: 'pageVar', scope: 'page', type: 'string', pageId: 'page-123' },
      ]

      mockRepository.find.mockResolvedValue(mockVariables)

      await VariablesController.getByPage(mockRequest as Request, mockResponse as Response)

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ pageId: 'page-123' })
        })
      )
      expect(responseJson).toHaveBeenCalledWith({
        success: true,
        data: mockVariables,
        count: 1,
      })
    })

    it('should include global variables when requested', async () => {
      mockRequest.params = { pageId: 'page-123' }
      mockRequest.query = { includeGlobal: 'true' }
      
      mockRepository.find.mockResolvedValue([])

      await VariablesController.getByPage(mockRequest as Request, mockResponse as Response)

      // Should have called find twice - for page and global
      expect(mockRepository.find).toHaveBeenCalled()
    })
  })

  describe('create', () => {
    it('should create a new variable', async () => {
      mockRequest.body = {
        name: 'newVar',
        type: 'string',
        defaultValue: 'test',
        scope: 'page',
        pageId: 'page-123',
      }

      const createdVariable = {
        id: 'new-id',
        ...mockRequest.body,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPageRepository.findOne.mockResolvedValue({ id: 'page-123' })
      mockRepository.findOne.mockResolvedValue(null) // No duplicate
      mockRepository.create.mockReturnValue(createdVariable)
      mockRepository.save.mockResolvedValue(createdVariable)

      await VariablesController.create(mockRequest as Request, mockResponse as Response)

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'newVar',
          type: 'string',
          scope: 'page',
        })
      )
      expect(mockRepository.save).toHaveBeenCalled()
      expect(responseStatus).toHaveBeenCalledWith(201)
      expect(responseJson).toHaveBeenCalledWith({
        success: true,
        data: createdVariable,
      })
    })

    it('should return 400 for missing required fields', async () => {
      mockRequest.body = { name: 'test' } // Missing type

      await VariablesController.create(mockRequest as Request, mockResponse as Response)

      expect(responseStatus).toHaveBeenCalledWith(400)
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      )
    })

    it('should return 400 for duplicate name in same scope', async () => {
      mockRequest.body = {
        name: 'existingVar',
        type: 'string',
        scope: 'page',
        pageId: 'page-123',
      }

      mockPageRepository.findOne.mockResolvedValue({ id: 'page-123' })
      mockRepository.findOne.mockResolvedValue({ id: 'existing', name: 'existingVar' })

      await VariablesController.create(mockRequest as Request, mockResponse as Response)

      expect(responseStatus).toHaveBeenCalledWith(400)
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('already exists')
        })
      )
    })

    it('should return 404 for non-existent page', async () => {
      mockRequest.body = {
        name: 'var',
        type: 'string',
        scope: 'page',
        pageId: 'non-existent',
      }

      mockPageRepository.findOne.mockResolvedValue(null)

      await VariablesController.create(mockRequest as Request, mockResponse as Response)

      expect(responseStatus).toHaveBeenCalledWith(404)
    })
  })

  describe('update', () => {
    it('should update existing variable', async () => {
      mockRequest.params = { id: 'var-123' }
      mockRequest.body = { name: 'updatedName', defaultValue: 'newDefault' }

      const existingVar = {
        id: 'var-123',
        name: 'oldName',
        type: 'string',
        scope: 'page',
        defaultValue: 'old',
      }

      mockRepository.findOne.mockResolvedValueOnce(existingVar) // Find existing
      mockRepository.findOne.mockResolvedValueOnce(null) // No duplicate
      mockRepository.save.mockResolvedValue({ ...existingVar, ...mockRequest.body })

      await VariablesController.update(mockRequest as Request, mockResponse as Response)

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'updatedName' })
      )
      expect(responseJson).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ name: 'updatedName' }),
      })
    })

    it('should return 404 for non-existent variable', async () => {
      mockRequest.params = { id: 'non-existent' }
      mockRequest.body = { name: 'test' }

      mockRepository.findOne.mockResolvedValue(null)

      await VariablesController.update(mockRequest as Request, mockResponse as Response)

      expect(responseStatus).toHaveBeenCalledWith(404)
    })
  })

  describe('delete', () => {
    it('should delete existing variable', async () => {
      mockRequest.params = { id: 'var-123' }

      const existingVar = { id: 'var-123', name: 'toDelete' }
      mockRepository.findOne.mockResolvedValue(existingVar)
      mockRepository.remove.mockResolvedValue(existingVar)

      await VariablesController.delete(mockRequest as Request, mockResponse as Response)

      expect(mockRepository.remove).toHaveBeenCalledWith(existingVar)
      expect(responseJson).toHaveBeenCalledWith({
        success: true,
        message: 'Variable deleted successfully',
      })
    })

    it('should return 404 for non-existent variable', async () => {
      mockRequest.params = { id: 'non-existent' }
      mockRepository.findOne.mockResolvedValue(null)

      await VariablesController.delete(mockRequest as Request, mockResponse as Response)

      expect(responseStatus).toHaveBeenCalledWith(404)
    })
  })

  describe('bulkCreate', () => {
    it('should create multiple variables', async () => {
      mockRequest.body = {
        variables: [
          { name: 'var1', type: 'string', scope: 'page', pageId: 'p1' },
          { name: 'var2', type: 'number', scope: 'page', pageId: 'p1' },
        ]
      }

      mockPageRepository.findOne.mockResolvedValue({ id: 'p1' })
      mockRepository.findOne.mockResolvedValue(null)
      mockRepository.create.mockImplementation((data) => ({ id: `id-${data.name}`, ...data }))
      mockRepository.save.mockImplementation((data) => Promise.resolve(data))

      await VariablesController.bulkCreate(mockRequest as Request, mockResponse as Response)

      expect(mockRepository.create).toHaveBeenCalledTimes(2)
      expect(mockRepository.save).toHaveBeenCalledTimes(2)
      expect(responseStatus).toHaveBeenCalledWith(201)
    })
  })

  describe('validateValue', () => {
    it('should validate value against variable type', async () => {
      mockRequest.params = { id: 'var-123' }
      mockRequest.body = { value: 42 }

      const variable = {
        id: 'var-123',
        type: 'number',
        validateValue: jest.fn().mockReturnValue({ valid: true }),
      }

      mockRepository.findOne.mockResolvedValue(variable)

      await VariablesController.validateValue(mockRequest as Request, mockResponse as Response)

      expect(responseJson).toHaveBeenCalledWith({
        success: true,
        valid: true,
      })
    })

    it('should return validation errors', async () => {
      mockRequest.params = { id: 'var-123' }
      mockRequest.body = { value: 'not a number' }

      const variable = {
        id: 'var-123',
        type: 'number',
        validateValue: jest.fn().mockReturnValue({ 
          valid: false, 
          error: 'Expected number, got string' 
        }),
      }

      mockRepository.findOne.mockResolvedValue(variable)

      await VariablesController.validateValue(mockRequest as Request, mockResponse as Response)

      expect(responseJson).toHaveBeenCalledWith({
        success: true,
        valid: false,
        error: 'Expected number, got string',
      })
    })
  })
})

