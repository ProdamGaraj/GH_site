/**
 * API Integration Tests
 * 
 * Тесты для API endpoints с использованием supertest
 */

import request from 'supertest'
import express, { Express } from 'express'

// Mock database
const mockDataSource = {
  isInitialized: true,
  getRepository: jest.fn(),
}

jest.mock('../config/database', () => ({
  AppDataSource: mockDataSource,
}))

// Mock repositories
const mockPageRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((data) => ({ id: 'new-id', ...data, createdAt: new Date(), updatedAt: new Date() })),
  save: jest.fn((data) => Promise.resolve(data)),
  remove: jest.fn((data) => Promise.resolve(data)),
}

const mockBlockRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((data) => ({ id: 'new-id', ...data })),
  save: jest.fn((data) => Promise.resolve(data)),
  remove: jest.fn((data) => Promise.resolve(data)),
}

const mockVariableRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((data) => ({ id: 'new-id', ...data })),
  save: jest.fn((data) => Promise.resolve(data)),
  remove: jest.fn((data) => Promise.resolve(data)),
}

// Setup repository mock
mockDataSource.getRepository.mockImplementation((entity: any) => {
  const entityName = typeof entity === 'function' ? entity.name : entity
  switch (entityName) {
    case 'Page': return mockPageRepository
    case 'Block': return mockBlockRepository
    case 'PageVariable': return mockVariableRepository
    default: return mockPageRepository
  }
})

// Create test app
function createTestApp(): Express {
  const app = express()
  app.use(express.json())
  
  // Import routes after mocking
  const pagesRouter = require('../routes/pages').default
  const blocksRouter = require('../routes/blocks').default
  const variablesRouter = require('../routes/variables').default
  
  app.use('/api/pages', pagesRouter)
  app.use('/api/blocks', blocksRouter)
  app.use('/api/variables', variablesRouter)
  
  return app
}

describe('API Integration Tests', () => {
  let app: Express

  beforeAll(() => {
    app = createTestApp()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Pages API', () => {
    describe('GET /api/pages', () => {
      it('should return list of pages', async () => {
        const mockPages = [
          { id: '1', name: 'Home', slug: 'home', status: 'draft' },
          { id: '2', name: 'About', slug: 'about', status: 'published' },
        ]
        mockPageRepository.find.mockResolvedValue(mockPages)

        const response = await request(app)
          .get('/api/pages')
          .expect('Content-Type', /json/)
          .expect(200)

        expect(response.body).toEqual(mockPages)
        expect(mockPageRepository.find).toHaveBeenCalled()
      })
    })

    describe('GET /api/pages/:id', () => {
      it('should return page by id', async () => {
        const mockPage = { id: '1', name: 'Home', slug: 'home' }
        mockPageRepository.findOne.mockResolvedValue(mockPage)

        const response = await request(app)
          .get('/api/pages/1')
          .expect(200)

        expect(response.body).toEqual(mockPage)
      })

      it('should return 404 for non-existent page', async () => {
        mockPageRepository.findOne.mockResolvedValue(null)

        await request(app)
          .get('/api/pages/non-existent')
          .expect(404)
      })
    })

    describe('POST /api/pages', () => {
      it('should create new page', async () => {
        const newPage = { name: 'New Page', slug: 'new-page' }
        mockPageRepository.findOne.mockResolvedValue(null) // No duplicate
        mockPageRepository.save.mockResolvedValue({ id: '3', ...newPage })

        const response = await request(app)
          .post('/api/pages')
          .send(newPage)
          .expect('Content-Type', /json/)
          .expect(201)

        expect(response.body.name).toBe('New Page')
        expect(mockPageRepository.save).toHaveBeenCalled()
      })

      it('should return 400 for missing name', async () => {
        await request(app)
          .post('/api/pages')
          .send({ slug: 'test' })
          .expect(400)
      })
    })

    describe('PUT /api/pages/:id', () => {
      it('should update existing page', async () => {
        const existingPage = { id: '1', name: 'Old Name', slug: 'old' }
        mockPageRepository.findOne.mockResolvedValue(existingPage)
        mockPageRepository.save.mockResolvedValue({ ...existingPage, name: 'New Name' })

        const response = await request(app)
          .put('/api/pages/1')
          .send({ name: 'New Name' })
          .expect(200)

        expect(response.body.name).toBe('New Name')
      })

      it('should return 404 for non-existent page', async () => {
        mockPageRepository.findOne.mockResolvedValue(null)

        await request(app)
          .put('/api/pages/non-existent')
          .send({ name: 'Test' })
          .expect(404)
      })
    })

    describe('DELETE /api/pages/:id', () => {
      it('should delete existing page', async () => {
        const existingPage = { id: '1', name: 'To Delete' }
        mockPageRepository.findOne.mockResolvedValue(existingPage)

        await request(app)
          .delete('/api/pages/1')
          .expect(200)

        expect(mockPageRepository.remove).toHaveBeenCalledWith(existingPage)
      })
    })
  })

  describe('Blocks API', () => {
    describe('GET /api/blocks', () => {
      it('should return list of blocks', async () => {
        const mockBlocks = [
          { id: '1', name: 'Header', type: 'section' },
          { id: '2', name: 'Footer', type: 'section' },
        ]
        mockBlockRepository.find.mockResolvedValue(mockBlocks)

        const response = await request(app)
          .get('/api/blocks')
          .expect(200)

        expect(Array.isArray(response.body)).toBe(true)
      })
    })

    describe('GET /api/blocks/:id', () => {
      it('should return block by id', async () => {
        const mockBlock = { id: '1', name: 'Header', content: {} }
        mockBlockRepository.findOne.mockResolvedValue(mockBlock)

        const response = await request(app)
          .get('/api/blocks/1')
          .expect(200)

        expect(response.body.id).toBe('1')
      })
    })

    describe('POST /api/blocks', () => {
      it('should create new block', async () => {
        const newBlock = { name: 'New Block', type: 'container', content: {} }
        mockBlockRepository.save.mockResolvedValue({ id: '3', ...newBlock })

        const response = await request(app)
          .post('/api/blocks')
          .send(newBlock)
          .expect(201)

        expect(response.body.name).toBe('New Block')
      })
    })
  })

  describe('Variables API', () => {
    describe('GET /api/variables', () => {
      it('should return all variables grouped by scope', async () => {
        const mockVariables = [
          { id: '1', name: 'var1', scope: 'page', type: 'string' },
          { id: '2', name: 'var2', scope: 'global', type: 'number' },
        ]
        mockVariableRepository.find.mockResolvedValue(mockVariables)

        const response = await request(app)
          .get('/api/variables')
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(response.body.data).toBeDefined()
      })
    })

    describe('GET /api/variables/page/:pageId', () => {
      it('should return variables for specific page', async () => {
        mockVariableRepository.find.mockResolvedValue([
          { id: '1', name: 'pageVar', scope: 'page', pageId: 'page-1' }
        ])

        const response = await request(app)
          .get('/api/variables/page/page-1')
          .expect(200)

        expect(response.body.success).toBe(true)
      })
    })

    describe('POST /api/variables', () => {
      it('should create new variable', async () => {
        const newVariable = {
          name: 'newVar',
          type: 'string',
          scope: 'global',
          defaultValue: 'test',
        }
        
        mockVariableRepository.findOne.mockResolvedValue(null)
        mockVariableRepository.save.mockResolvedValue({ id: '3', ...newVariable })

        const response = await request(app)
          .post('/api/variables')
          .send(newVariable)
          .expect(201)

        expect(response.body.success).toBe(true)
        expect(response.body.data.name).toBe('newVar')
      })

      it('should return 400 for invalid type', async () => {
        const invalidVariable = {
          name: 'badVar',
          type: 'invalid-type',
          scope: 'page',
        }

        const response = await request(app)
          .post('/api/variables')
          .send(invalidVariable)
          .expect(400)

        expect(response.body.success).toBe(false)
      })
    })

    describe('PUT /api/variables/:id', () => {
      it('should update existing variable', async () => {
        const existingVar = { id: '1', name: 'oldName', type: 'string', scope: 'page' }
        mockVariableRepository.findOne.mockResolvedValueOnce(existingVar)
        mockVariableRepository.findOne.mockResolvedValueOnce(null) // No duplicate
        mockVariableRepository.save.mockResolvedValue({ ...existingVar, name: 'newName' })

        const response = await request(app)
          .put('/api/variables/1')
          .send({ name: 'newName' })
          .expect(200)

        expect(response.body.data.name).toBe('newName')
      })
    })

    describe('DELETE /api/variables/:id', () => {
      it('should delete existing variable', async () => {
        mockVariableRepository.findOne.mockResolvedValue({ id: '1', name: 'toDelete' })

        const response = await request(app)
          .delete('/api/variables/1')
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(mockVariableRepository.remove).toHaveBeenCalled()
      })
    })

    describe('POST /api/variables/bulk', () => {
      it('should create multiple variables', async () => {
        const variables = [
          { name: 'var1', type: 'string', scope: 'global' },
          { name: 'var2', type: 'number', scope: 'global' },
        ]

        mockVariableRepository.findOne.mockResolvedValue(null)
        mockVariableRepository.save.mockImplementation((data) => Promise.resolve(data))

        const response = await request(app)
          .post('/api/variables/bulk')
          .send({ variables })
          .expect(201)

        expect(response.body.success).toBe(true)
        expect(response.body.data).toHaveLength(2)
      })
    })

    describe('POST /api/variables/:id/validate', () => {
      it('should validate value against type', async () => {
        mockVariableRepository.findOne.mockResolvedValue({
          id: '1',
          type: 'number',
          validateValue: () => ({ valid: true }),
        })

        const response = await request(app)
          .post('/api/variables/1/validate')
          .send({ value: 42 })
          .expect(200)

        expect(response.body.valid).toBe(true)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPageRepository.find.mockRejectedValue(new Error('Database connection failed'))

      const response = await request(app)
        .get('/api/pages')
        .expect(500)

      expect(response.body).toHaveProperty('error')
    })

    it('should return 404 for unknown routes', async () => {
      await request(app)
        .get('/api/unknown-route')
        .expect(404)
    })
  })

  describe('Request Validation', () => {
    it('should reject invalid JSON', async () => {
      await request(app)
        .post('/api/pages')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400)
    })

    it('should handle empty body', async () => {
      await request(app)
        .post('/api/pages')
        .send({})
        .expect(400)
    })
  })
})
