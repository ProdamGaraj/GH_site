/**
 * DataTransformService Unit Tests
 * 
 * Тесты для сервиса трансформации данных
 */

import { dataTransformService } from '../services/DataTransformService'
import type { ComputedFieldConfig, ConditionalFieldConfig } from '../services/DataTransformService'
import type { FieldMapping } from '../models/DataBinding'

// Helper to create FieldMapping with required id field
const createMapping = (
  sourceField: string, 
  targetProperty: string, 
  extra: Partial<FieldMapping> = {}
): FieldMapping => ({
  id: `mapping-${sourceField}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  sourceField,
  targetProperty,
  ...extra
})

describe('DataTransformService', () => {
  describe('applyMapping', () => {
    const testItem = {
      id: 1,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      age: 30,
      salary: 50000,
      active: true,
      createdAt: '2024-01-15T10:30:00Z',
      tags: ['developer', 'senior'],
      address: {
        city: 'New York',
        country: 'USA'
      }
    }

    it('should map simple field', () => {
      const mappings: FieldMapping[] = [
        createMapping('firstName', 'name')
      ]
      const result = dataTransformService.applyMapping(testItem, mappings)
      expect(result.name).toBe('John')
    })

    it('should map nested field', () => {
      const mappings: FieldMapping[] = [
        createMapping('address.city', 'location')
      ]
      const result = dataTransformService.applyMapping(testItem, mappings)
      expect(result.location).toBe('New York')
    })

    it('should map to nested target', () => {
      const mappings: FieldMapping[] = [
        createMapping('firstName', 'user.name')
      ]
      const result = dataTransformService.applyMapping(testItem, mappings)
      expect((result.user as any).name).toBe('John')
    })

    it('should use fallback value when source is missing', () => {
      const mappings: FieldMapping[] = [
        createMapping('missing.field', 'value', { fallbackValue: 'default' })
      ]
      const result = dataTransformService.applyMapping(testItem, mappings)
      expect(result.value).toBe('default')
    })

    it('should map multiple fields', () => {
      const mappings: FieldMapping[] = [
        createMapping('firstName', 'name'),
        createMapping('age', 'userAge'),
        createMapping('active', 'isActive')
      ]
      const result = dataTransformService.applyMapping(testItem, mappings)
      expect(result.name).toBe('John')
      expect(result.userAge).toBe(30)
      expect(result.isActive).toBe(true)
    })
  })

  describe('transforms', () => {
    const testItem = {
      name: '  John Doe  ',
      price: 99.99,
      date: '2024-01-15',
      items: ['a', 'b', 'c'],
      count: 5
    }

    it('should apply uppercase transform', () => {
      const mappings: FieldMapping[] = [
        createMapping('name', 'upper', { transform: 'uppercase' })
      ]
      const result = dataTransformService.applyMapping(testItem, mappings)
      expect(result.upper).toBe('  JOHN DOE  ')
    })

    it('should apply lowercase transform', () => {
      const mappings: FieldMapping[] = [
        createMapping('name', 'lower', { transform: 'lowercase' })
      ]
      const result = dataTransformService.applyMapping(testItem, mappings)
      expect(result.lower).toBe('  john doe  ')
    })

    it('should apply trim transform', () => {
      const mappings: FieldMapping[] = [
        createMapping('name', 'trimmed', { transform: 'trim' })
      ]
      const result = dataTransformService.applyMapping(testItem, mappings)
      expect(result.trimmed).toBe('John Doe')
    })

    it('should apply number transform', () => {
      const mappings: FieldMapping[] = [
        createMapping('count', 'num', { transform: 'number' })
      ]
      const result = dataTransformService.applyMapping(testItem, mappings)
      expect(result.num).toBe(5)
    })

    it('should apply round transform', () => {
      const mappings: FieldMapping[] = [
        createMapping('price', 'rounded', { transform: 'round' })
      ]
      const result = dataTransformService.applyMapping(testItem, mappings)
      expect(result.rounded).toBe(100)
    })

    it('should apply length transform to array', () => {
      const mappings: FieldMapping[] = [
        createMapping('items', 'itemCount', { transform: 'length' })
      ]
      const result = dataTransformService.applyMapping(testItem, mappings)
      expect(result.itemCount).toBe(3)
    })

    it('should apply json transform', () => {
      const mappings: FieldMapping[] = [
        createMapping('items', 'jsonItems', { transform: 'json' })
      ]
      const result = dataTransformService.applyMapping(testItem, mappings)
      expect(result.jsonItems).toBe('["a","b","c"]')
    })
  })

  describe('addComputedFields', () => {
    const testItems = [
      { firstName: 'John', lastName: 'Doe', price: 100, quantity: 2 },
      { firstName: 'Jane', lastName: 'Smith', price: 50, quantity: 3 }
    ]

    it('should compute concatenated fields', () => {
      const computedFields: ComputedFieldConfig[] = [
        {
          name: 'fullName',
          expression: 'return `${item.firstName} ${item.lastName}`'
        }
      ]
      const result = dataTransformService.addComputedFields(testItems, computedFields) as Record<string, unknown>[]
      expect(result[0].fullName).toBe('John Doe')
      expect(result[1].fullName).toBe('Jane Smith')
    })

    it('should compute calculated fields', () => {
      const computedFields: ComputedFieldConfig[] = [
        {
          name: 'total',
          expression: 'return item.price * item.quantity'
        }
      ]
      const result = dataTransformService.addComputedFields(testItems, computedFields) as Record<string, unknown>[]
      expect(result[0].total).toBe(200)
      expect(result[1].total).toBe(150)
    })

    it('should handle multiple computed fields', () => {
      const computedFields: ComputedFieldConfig[] = [
        { name: 'fullName', expression: 'return `${item.firstName} ${item.lastName}`' },
        { name: 'total', expression: 'return item.price * item.quantity' },
        { name: 'hasDiscount', expression: 'return item.price > 75' }
      ]
      const result = dataTransformService.addComputedFields(testItems, computedFields) as Record<string, unknown>[]
      expect(result[0].fullName).toBe('John Doe')
      expect(result[0].total).toBe(200)
      expect(result[0].hasDiscount).toBe(true)
      expect(result[1].hasDiscount).toBe(false)
    })

    it('should provide index in context', () => {
      const computedFields: ComputedFieldConfig[] = [
        { name: 'rowNumber', expression: 'return index + 1' }
      ]
      const result = dataTransformService.addComputedFields(testItems, computedFields) as Record<string, unknown>[]
      expect(result[0].rowNumber).toBe(1)
      expect(result[1].rowNumber).toBe(2)
    })
  })

  describe('applyConditionalFields', () => {
    const testItems = [
      { status: 'active', score: 90, type: 'premium' },
      { status: 'inactive', score: 50, type: 'basic' },
      { status: 'pending', score: 75, type: 'premium' }
    ]

    it('should apply conditional value based on field', () => {
      const conditionalFields: ConditionalFieldConfig[] = [
        {
          field: 'statusLabel',
          conditions: [
            { when: { field: 'status', operator: 'equals', value: 'active' }, then: 'Active User' },
            { when: { field: 'status', operator: 'equals', value: 'inactive' }, then: 'Inactive User' }
          ],
          else: 'Unknown Status'
        }
      ]
      const result = dataTransformService.applyConditionalFields(testItems, conditionalFields) as Record<string, unknown>[]
      expect(result[0].statusLabel).toBe('Active User')
      expect(result[1].statusLabel).toBe('Inactive User')
      expect(result[2].statusLabel).toBe('Unknown Status')
    })

    it('should use comparison operators', () => {
      const conditionalFields: ConditionalFieldConfig[] = [
        {
          field: 'grade',
          conditions: [
            { when: { field: 'score', operator: 'greaterThan', value: 79 }, then: 'A' },
            { when: { field: 'score', operator: 'greaterThan', value: 59 }, then: 'B' }
          ],
          else: 'C'
        }
      ]
      const result = dataTransformService.applyConditionalFields(testItems, conditionalFields) as Record<string, unknown>[]
      expect(result[0].grade).toBe('A')
      expect(result[1].grade).toBe('C')
      expect(result[2].grade).toBe('B')
    })

    it('should map from another field when then is field reference', () => {
      const conditionalFields: ConditionalFieldConfig[] = [
        {
          field: 'displayType',
          conditions: [
            { when: { field: 'status', operator: 'equals', value: 'active' }, then: { field: 'type' } }
          ],
          else: 'N/A'
        }
      ]
      const result = dataTransformService.applyConditionalFields(testItems, conditionalFields) as Record<string, unknown>[]
      expect(result[0].displayType).toBe('premium')
      expect(result[1].displayType).toBe('N/A')
    })
  })

  describe('processArray', () => {
    it('should transform each item in array', () => {
      const items = [
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 30 }
      ]
      const mappings: FieldMapping[] = [
        createMapping('name', 'userName', { transform: 'uppercase' })
      ]
      const result = dataTransformService.processArray(items, mappings)
      expect(result).toHaveLength(2)
      expect(result[0].userName).toBe('ALICE')
      expect(result[1].userName).toBe('BOB')
    })
  })

  describe('error handling', () => {
    it('should use fallback on transform error', () => {
      const testItem = { value: null }
      const mappings: FieldMapping[] = [
        createMapping('value', 'result', { transform: 'uppercase', fallbackValue: 'N/A' })
      ]
      const result = dataTransformService.applyMapping(testItem, mappings)
      expect(result.result).toBe('N/A')
    })

    it('should handle invalid expression gracefully', () => {
      const testItems = [{ name: 'test' }]
      const computedFields: ComputedFieldConfig[] = [
        { name: 'bad', expression: 'this.is.invalid.syntax(' }
      ]
      // Should not throw, but computed field may be undefined or null
      expect(() => {
        dataTransformService.addComputedFields(testItems, computedFields)
      }).not.toThrow()
    })
  })
})
