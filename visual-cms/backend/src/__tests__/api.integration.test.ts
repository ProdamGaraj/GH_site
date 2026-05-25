/**
 * API Integration Tests
 *
 * Tests for API endpoints using supertest
 */

import request from 'supertest'
import express, { Express } from 'express'
import { errorHandler, notFoundHandler } from '../middleware/errorHandler'

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
  delete: jest.fn(() => Promise.resolve({ affected: 1 })),
}

const mockBlockRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((data) => ({ id: 'new-id', ...data })),
  save: jest.fn((data) => Promise.resolve(data)),
  remove: jest.fn((data) => Promise.resolve(data)),
  delete: jest.fn(() => Promise.resolve({ affected: 1 })),
}

const mockVariableRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((data) => ({ id: 'new-id', ...data })),
  save: jest.fn((data) => Promise.resolve(data)),
  remove: jest.fn((data) => Promise.resolve(data)),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn(),
  })),
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

jest.mock('../services/LinkedBlocksService', () => ({
  linkedBlocksService: {
    updateLinkedBlocks: jest.fn((s: any) => Promise.resolve(s)),
    applyLinkedDecisions: jest.fn((s: any) => ({ structure: s, libraryWrites: [] })),
    syncBlockToAllPages: jest.fn(() => Promise.resolve({ updatedPages: [], errors: [] })),
    detectChangedLinkedInstances: jest.fn(() => Promise.resolve([])),
  },
}))

jest.mock('../services/BlockTemplateService', () => ({
  blockTemplateService: {
    detectFieldsFromStructure: jest.fn(() => []),
    diffFields: jest.fn(() => ({ added: [], removed: [], unchanged: [] })),
    syncBindingsOnFieldChange: jest.fn(() => Promise.resolve()),
  },
}))

// Create test app with error handling
function createTestApp(): Express {
  const app = express()
  app.use(express.json())
  const pagesRouter = require('../routes/pages').default
  const blocksRouter = require('../routes/blocks').default
  const variablesRouter = require('../routes/variables').default
  app.use('/api/pages', pagesRouter)
  app.use('/api/blocks', blocksRouter)
  app.use('/api/variables', variablesRouter)
  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}

describe('API Integration Tests', () => {
  let app: Express

  beforeAll(() => { app = createTestApp() })
  beforeEach(() => { jest.clearAllMocks() })

  describe('Pages API', () => {
    describe('GET /api/pages', () => {
      it('should return list of pages', async () => {
        const mockPages = [{ id: '1', name: 'Home', slug: 'home' }]
        mockPageRepository.find.mockResolvedValue(mockPages)
        const res = await request(app).get('/api/pages').expect(200)
        expect(res.body).toEqual(mockPages)
      })
    })

    describe('GET /api/pages/:id', () => {
      it('should return page by id', async () => {
        mockPageRepository.findOne.mockResolvedValue({ id: '1', name: 'Home' })
        const res = await request(app).get('/api/pages/1').expect(200)
        expect(res.body.id).toBe('1')
      })

      it('should return 404 for non-existent page', async () => {
        mockPageRepository.findOne.mockResolvedValue(null)
        await request(app).get('/api/pages/bad').expect(404)
      })
    })

    describe('POST /api/pages', () => {
      it('should create new page', async () => {
        const newPage = {
          name: 'New Page',
          slug: 'new-page',
          metadata: { title: 'New Page' },
        }
        mockPageRepository.save.mockResolvedValue({ id: '3', ...newPage })
        const res = await request(app).post('/api/pages').send(newPage).expect(201)
        expect(res.body.name).toBe('New Page')
      })

      it('should return 400 for missing name', async () => {
        await request(app).post('/api/pages').send({ slug: 'test', metadata: { title: 'T' } }).expect(400)
      })
    })

    describe('PUT /api/pages/:id', () => {
      it('should update existing page', async () => {
        const existing = { id: '1', name: 'Old', slug: 'old', version: 1 }
        mockPageRepository.findOne.mockResolvedValue(existing)
        mockPageRepository.save.mockResolvedValue({ ...existing, name: 'New', version: 2 })
        const res = await request(app).put('/api/pages/1').send({ name: 'New' }).expect(200)
        expect(res.body.name).toBe('New')
      })

      it('should return 404 for non-existent page', async () => {
        mockPageRepository.findOne.mockResolvedValue(null)
        await request(app).put('/api/pages/bad').send({ name: 'T' }).expect(404)
      })
    })

    describe('DELETE /api/pages/:id', () => {
      it('should delete existing page', async () => {
        mockPageRepository.delete.mockResolvedValue({ affected: 1 })
        await request(app).delete('/api/pages/1').expect(204)
      })
    })
  })

  describe('Blocks API', () => {
    describe('GET /api/blocks', () => {
      it('should return list of blocks', async () => {
        const mockBlocks = [{ id: '1', name: 'Header' }]
        mockBlockRepository.find.mockResolvedValue(mockBlocks)
        const res = await request(app).get('/api/blocks').expect(200)
        expect(Array.isArray(res.body)).toBe(true)
      })
    })

    describe('POST /api/blocks', () => {
      it('should create new block', async () => {
        const newBlock = { name: 'New Block', type: 'container', structure: { tagName: 'div' } }
        mockBlockRepository.save.mockResolvedValue({ id: '3', ...newBlock })
        const res = await request(app).post('/api/blocks').send(newBlock).expect(201)
        expect(res.body.name).toBe('New Block')
      })
    })
  })

  describe('Variables API', () => {
    describe('GET /api/variables', () => {
      it('should return all variables', async () => {
        const res = await request(app).get('/api/variables').expect(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data).toBeDefined()
      })
    })

    describe('POST /api/variables', () => {
      it('should create new variable', async () => {
        const newVar = { name: 'newVar', type: 'string', scope: 'global' }
        mockVariableRepository.findOne.mockResolvedValue(null)
        mockVariableRepository.save.mockResolvedValue({ id: '3', ...newVar })
        const res = await request(app).post('/api/variables').send(newVar).expect(201)
        expect(res.body.success).toBe(true)
      })

      it('should return 400 for invalid type', async () => {
        const bad = { name: 'bad', type: 'invalid-type', scope: 'page' }
        const res = await request(app).post('/api/variables').send(bad).expect(400)
        expect(res.body.success).toBe(false)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPageRepository.find.mockRejectedValue(new Error('Database connection failed'))
      const res = await request(app).get('/api/pages').expect(500)
      expect(res.body.success).toBe(false)
      expect(res.body.error).toHaveProperty('message')
    })

    it('should return 404 for unknown routes', async () => {
      await request(app).get('/api/unknown-route').expect(404)
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
      await request(app).post('/api/pages').send({}).expect(400)
    })
  })
})
