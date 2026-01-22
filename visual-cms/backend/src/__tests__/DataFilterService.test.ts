/**
 * DataFilterService Unit Tests
 * 
 * Тесты для сервиса фильтрации данных
 */

import { dataFilterService } from '../services/DataFilterService'
import type { FilterConfig, SortConfig, PaginationConfig } from '../models/DataBinding'

// Helper to create FilterConfig with required fields
const createFilter = (
  field: string, 
  operator: FilterConfig['operator'], 
  value: unknown, 
  extra: Partial<FilterConfig> = {}
): FilterConfig => ({
  id: `filter-${field}-${Date.now()}`,
  field,
  operator,
  value,
  valueSource: 'static',
  ...extra
})

describe('DataFilterService', () => {
  // Test data
  const testData = [
    { id: 1, name: 'Alice', age: 30, city: 'New York', active: true },
    { id: 2, name: 'Bob', age: 25, city: 'Los Angeles', active: false },
    { id: 3, name: 'Charlie', age: 35, city: 'Chicago', active: true },
    { id: 4, name: 'Diana', age: 28, city: 'New York', active: true },
    { id: 5, name: 'Eve', age: 32, city: 'Boston', active: false },
  ]

  describe('applyFilters', () => {
    describe('equals operator', () => {
      it('should filter by exact string match', () => {
        const filters: FilterConfig[] = [
          createFilter('city', 'equals', 'New York')
        ]
        const result = dataFilterService.applyFilters(testData, filters)
        expect(result).toHaveLength(2)
        expect(result.every(item => item.city === 'New York')).toBe(true)
      })

      it('should filter by exact number match', () => {
        const filters: FilterConfig[] = [
          createFilter('age', 'equals', 30)
        ]
        const result = dataFilterService.applyFilters(testData, filters)
        expect(result).toHaveLength(1)
        expect(result[0].name).toBe('Alice')
      })

      it('should filter by boolean', () => {
        const filters: FilterConfig[] = [
          createFilter('active', 'equals', true)
        ]
        const result = dataFilterService.applyFilters(testData, filters)
        expect(result).toHaveLength(3)
      })
    })

    describe('notEquals operator', () => {
      it('should exclude matching values', () => {
        const filters: FilterConfig[] = [
          createFilter('city', 'notEquals', 'New York')
        ]
        const result = dataFilterService.applyFilters(testData, filters)
        expect(result).toHaveLength(3)
        expect(result.every(item => item.city !== 'New York')).toBe(true)
      })
    })

    describe('contains operator', () => {
      it('should find partial string matches', () => {
        const filters: FilterConfig[] = [
          createFilter('name', 'contains', 'li')
        ]
        const result = dataFilterService.applyFilters(testData, filters)
        expect(result).toHaveLength(2) // Alice, Charlie
      })

      it('should be case-insensitive', () => {
        const filters: FilterConfig[] = [
          createFilter('name', 'contains', 'BOB')
        ]
        const result = dataFilterService.applyFilters(testData, filters)
        expect(result).toHaveLength(1)
        expect(result[0].name).toBe('Bob')
      })
    })

    describe('startsWith operator', () => {
      it('should match strings starting with value', () => {
        const filters: FilterConfig[] = [
          createFilter('name', 'startsWith', 'A')
        ]
        const result = dataFilterService.applyFilters(testData, filters)
        expect(result).toHaveLength(1)
        expect(result[0].name).toBe('Alice')
      })
    })

    describe('endsWith operator', () => {
      it('should match strings ending with value', () => {
        const filters: FilterConfig[] = [
          createFilter('name', 'endsWith', 'e')
        ]
        const result = dataFilterService.applyFilters(testData, filters)
        expect(result).toHaveLength(3) // Alice, Charlie, Eve
      })
    })

    describe('comparison operators', () => {
      it('greaterThan should filter correctly', () => {
        const filters: FilterConfig[] = [
          createFilter('age', 'greaterThan', 30)
        ]
        const result = dataFilterService.applyFilters(testData, filters)
        expect(result).toHaveLength(2) // Charlie (35), Eve (32)
      })

      it('greaterThanOrEqual should include boundary', () => {
        const filters: FilterConfig[] = [
          createFilter('age', 'greaterThanOrEqual', 30)
        ]
        const result = dataFilterService.applyFilters(testData, filters)
        expect(result).toHaveLength(3) // Alice (30), Charlie (35), Eve (32)
      })

      it('lessThan should filter correctly', () => {
        const filters: FilterConfig[] = [
          createFilter('age', 'lessThan', 30)
        ]
        const result = dataFilterService.applyFilters(testData, filters)
        expect(result).toHaveLength(2) // Bob (25), Diana (28)
      })

      it('lessThanOrEqual should include boundary', () => {
        const filters: FilterConfig[] = [
          createFilter('age', 'lessThanOrEqual', 30)
        ]
        const result = dataFilterService.applyFilters(testData, filters)
        expect(result).toHaveLength(3) // Alice (30), Bob (25), Diana (28)
      })
    })

    describe('in operator', () => {
      it('should match values in array', () => {
        const filters: FilterConfig[] = [
          createFilter('city', 'in', ['New York', 'Boston'])
        ]
        const result = dataFilterService.applyFilters(testData, filters)
        expect(result).toHaveLength(3)
      })
    })

    describe('notIn operator', () => {
      it('should exclude values in array', () => {
        const filters: FilterConfig[] = [
          createFilter('city', 'notIn', ['New York', 'Boston'])
        ]
        const result = dataFilterService.applyFilters(testData, filters)
        expect(result).toHaveLength(2) // Bob, Charlie
      })
    })

    describe('between operator', () => {
      it('should match values in range', () => {
        const filters: FilterConfig[] = [
          createFilter('age', 'between', [28, 32])
        ]
        const result = dataFilterService.applyFilters(testData, filters)
        expect(result).toHaveLength(3) // Alice (30), Diana (28), Eve (32)
      })
    })

    describe('logical operators', () => {
      it('AND should require all conditions', () => {
        const filters: FilterConfig[] = [
          createFilter('city', 'equals', 'New York'),
          createFilter('active', 'equals', true, { logicalOperator: 'and' })
        ]
        const result = dataFilterService.applyFilters(testData, filters)
        expect(result).toHaveLength(2) // Alice and Diana
      })

      it('OR should match any condition', () => {
        const filters: FilterConfig[] = [
          createFilter('name', 'equals', 'Alice'),
          createFilter('name', 'equals', 'Bob', { logicalOperator: 'or' })
        ]
        const result = dataFilterService.applyFilters(testData, filters)
        expect(result).toHaveLength(2)
      })
    })
  })

  describe('applySorting', () => {
    it('should sort strings ascending', () => {
      const sorting: SortConfig[] = [
        { field: 'name', direction: 'asc', dataType: 'string' }
      ]
      const result = dataFilterService.applySorting(testData, sorting)
      expect(result[0].name).toBe('Alice')
      expect(result[4].name).toBe('Eve')
    })

    it('should sort strings descending', () => {
      const sorting: SortConfig[] = [
        { field: 'name', direction: 'desc', dataType: 'string' }
      ]
      const result = dataFilterService.applySorting(testData, sorting)
      expect(result[0].name).toBe('Eve')
      expect(result[4].name).toBe('Alice')
    })

    it('should sort numbers ascending', () => {
      const sorting: SortConfig[] = [
        { field: 'age', direction: 'asc', dataType: 'number' }
      ]
      const result = dataFilterService.applySorting(testData, sorting)
      expect(result[0].age).toBe(25)
      expect(result[4].age).toBe(35)
    })

    it('should sort numbers descending', () => {
      const sorting: SortConfig[] = [
        { field: 'age', direction: 'desc', dataType: 'number' }
      ]
      const result = dataFilterService.applySorting(testData, sorting)
      expect(result[0].age).toBe(35)
      expect(result[4].age).toBe(25)
    })

    it('should handle multiple sort fields', () => {
      const sorting: SortConfig[] = [
        { field: 'city', direction: 'asc', dataType: 'string' },
        { field: 'age', direction: 'desc', dataType: 'number' }
      ]
      const result = dataFilterService.applySorting(testData, sorting)
      // Boston first, then Chicago, Los Angeles, New York (sorted by age desc within city)
      expect(result[0].city).toBe('Boston')
    })
  })

  describe('applyPagination', () => {
    it('should return correct page of results', () => {
      const config: PaginationConfig = { enabled: true, itemsPerPage: 2, style: 'numbers' }
      const result = dataFilterService.applyPagination(testData, config, 1)
      
      expect(result.items).toHaveLength(2)
      expect(result.page).toBe(1)
      expect(result.totalPages).toBe(3)
      expect(result.total).toBe(5)
    })

    it('should return second page', () => {
      const config: PaginationConfig = { enabled: true, itemsPerPage: 2, style: 'numbers' }
      const result = dataFilterService.applyPagination(testData, config, 2)
      
      expect(result.items).toHaveLength(2)
      expect(result.page).toBe(2)
      expect(result.items[0].id).toBe(3)
    })

    it('should return last page with remaining items', () => {
      const config: PaginationConfig = { enabled: true, itemsPerPage: 2, style: 'numbers' }
      const result = dataFilterService.applyPagination(testData, config, 3)
      
      expect(result.items).toHaveLength(1)
      expect(result.page).toBe(3)
    })

    it('should clamp to valid page range', () => {
      const config: PaginationConfig = { enabled: true, itemsPerPage: 2, style: 'numbers' }
      const result = dataFilterService.applyPagination(testData, config, 100)
      
      expect(result.page).toBe(3) // Max pages
    })

    it('should return all when disabled', () => {
      const config: PaginationConfig = { enabled: false, itemsPerPage: 2, style: 'numbers' }
      const result = dataFilterService.applyPagination(testData, config, 1)
      
      expect(result.items).toHaveLength(5)
    })
  })

  describe('process (combined operations)', () => {
    it('should filter, sort, and paginate together', () => {
      const filters: FilterConfig[] = [
        createFilter('active', 'equals', true)
      ]
      const sorting: SortConfig[] = [
        { field: 'age', direction: 'asc', dataType: 'number' }
      ]
      const pagination: PaginationConfig = { enabled: true, itemsPerPage: 2, style: 'numbers' }
      
      const result = dataFilterService.process(testData, filters, sorting, pagination)
      
      expect(result.total).toBe(5) // Original count
      expect(result.filtered).toBe(3) // After filter
      expect(result.items).toHaveLength(2) // After pagination
      expect(result.page).toBe(1)
      expect(result.totalPages).toBe(2)
      
      // Should be sorted by age
      expect(result.items[0].age).toBeLessThan(result.items[1].age)
    })
  })

  describe('getValueByPath', () => {
    it('should get simple property', () => {
      const obj = { name: 'test' }
      const result = dataFilterService.getValueByPath(obj, 'name')
      expect(result).toBe('test')
    })

    it('should get nested property', () => {
      const obj = { user: { profile: { name: 'test' } } }
      const result = dataFilterService.getValueByPath(obj, 'user.profile.name')
      expect(result).toBe('test')
    })

    it('should get array element', () => {
      const obj = { items: ['a', 'b', 'c'] }
      const result = dataFilterService.getValueByPath(obj, 'items[1]')
      expect(result).toBe('b')
    })

    it('should return undefined for missing path', () => {
      const obj = { name: 'test' }
      const result = dataFilterService.getValueByPath(obj, 'missing.path')
      expect(result).toBeUndefined()
    })
  })
})
