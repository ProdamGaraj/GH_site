/**
 * LinkedBlocksService — unit-тесты для _collectLinkedNodes guard
 *
 * Проверяет, что placeholder-ноды (linkedBlockId + 0 children)
 * не попадают в список для синхронизации обратно в библиотеку.
 */

// Mock database before importing the service
jest.mock('../config/database', () => ({
  AppDataSource: {
    getRepository: () => ({
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockResolvedValue([]),
    }),
  },
}))

import { LinkedBlocksService } from '../services/LinkedBlocksService'

describe('LinkedBlocksService', () => {
  let service: LinkedBlocksService

  beforeEach(() => {
    service = new LinkedBlocksService()
  })

  describe('syncLinkedBlocksToLibrary — placeholder guard', () => {
    // Access private method via bracket notation for testing
    const collectLinkedNodes = (node: any): Map<string, any> => {
      const result = new Map<string, any>()
      ;(service as any)._collectLinkedNodes(node, result)
      return result
    }

    it('should NOT collect placeholder nodes (0 children)', () => {
      const structure = {
        id: 'root',
        children: [
          {
            id: 'gh-tpl-header',
            tagName: 'header',
            metadata: { name: 'Header (linked)', linkedBlockId: 'block-123' },
            children: [],
          },
        ],
      }

      const result = collectLinkedNodes(structure)
      expect(result.size).toBe(0)
    })

    it('should NOT collect placeholder nodes (no children property)', () => {
      const structure = {
        id: 'root',
        children: [
          {
            id: 'gh-tpl-header',
            tagName: 'header',
            metadata: { name: 'Header (linked)', linkedBlockId: 'block-123' },
          },
        ],
      }

      const result = collectLinkedNodes(structure)
      expect(result.size).toBe(0)
    })

    it('should collect linked nodes WITH children', () => {
      const structure = {
        id: 'root',
        children: [
          {
            id: 'gh-tpl-header',
            tagName: 'header',
            metadata: { name: 'Header (linked)', linkedBlockId: 'block-123' },
            children: [
              { id: 'logo', tagName: 'a', content: 'GOLDEN HOUSE', children: [] },
              { id: 'nav', tagName: 'nav', children: [{ id: 'link1', tagName: 'a' }] },
            ],
          },
        ],
      }

      const result = collectLinkedNodes(structure)
      expect(result.size).toBe(1)
      expect(result.has('block-123')).toBe(true)
      expect(result.get('block-123').children.length).toBe(2)
    })

    it('should handle mixed: some placeholders, some with content', () => {
      const structure = {
        id: 'root',
        children: [
          {
            id: 'header-placeholder',
            tagName: 'header',
            metadata: { linkedBlockId: 'header-block' },
            children: [],
          },
          {
            id: 'section',
            children: [
              {
                id: 'footer-real',
                tagName: 'footer',
                metadata: { linkedBlockId: 'footer-block' },
                children: [{ id: 'copyright', tagName: 'p', content: '© 2026' }],
              },
            ],
          },
        ],
      }

      const result = collectLinkedNodes(structure)
      expect(result.size).toBe(1)
      expect(result.has('header-block')).toBe(false)
      expect(result.has('footer-block')).toBe(true)
    })

    it('should handle deeply nested linked nodes', () => {
      const structure = {
        id: 'root',
        children: [
          {
            id: 'wrapper',
            children: [
              {
                id: 'inner',
                children: [
                  {
                    id: 'deep-linked',
                    metadata: { linkedBlockId: 'deep-block' },
                    children: [{ id: 'child', tagName: 'div' }],
                  },
                ],
              },
            ],
          },
        ],
      }

      const result = collectLinkedNodes(structure)
      expect(result.size).toBe(1)
      expect(result.has('deep-block')).toBe(true)
    })

    it('should handle node without metadata', () => {
      const structure = {
        id: 'root',
        children: [
          { id: 'plain-node', tagName: 'div', children: [] },
        ],
      }

      const result = collectLinkedNodes(structure)
      expect(result.size).toBe(0)
    })

    it('should handle null/undefined input', () => {
      expect(collectLinkedNodes(null).size).toBe(0)
      expect(collectLinkedNodes(undefined).size).toBe(0)
    })
  })
})
