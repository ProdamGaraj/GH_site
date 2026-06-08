/**
 * DataTransformService Unit Tests
 * 
 * Тесты для сервиса трансформации данных
 */

import { dataTransformService, normalizeToList } from '../services/DataTransformService'
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

    it('null source value is not written to result', () => {
      const item = { firstName: 'Jane', nullField: null, age: 25 }
      const mappings: FieldMapping[] = [
        createMapping('nullField', 'target'),
        createMapping('firstName', 'name'),
        createMapping('age', 'userAge')
      ]
      const result = dataTransformService.applyMapping(item, mappings)
      expect('target' in result).toBe(false)
      expect(result.name).toBe('Jane')
      expect(result.userAge).toBe(25)
    })

    it('null source value uses fallbackValue when configured', () => {
      const item = { nullField: null }
      const mappings: FieldMapping[] = [
        createMapping('nullField', 'target', { fallbackValue: 'fallback' })
      ]
      const result = dataTransformService.applyMapping(item, mappings)
      expect(result.target).toBe('fallback')
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
          // B1ф2: template-литералы в expr-eval не поддерживаются → helper concat().
          expression: 'concat(item.firstName, " ", item.lastName)'
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
        { name: 'fullName', expression: 'concat(item.firstName, " ", item.lastName)' },
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

  describe('normalizeToList', () => {
    it('returns empty array for null/undefined', () => {
      expect(normalizeToList(null)).toEqual([])
      expect(normalizeToList(undefined)).toEqual([])
    })

    it('passes arrays through unchanged', () => {
      expect(normalizeToList([1, 2, 3])).toEqual([1, 2, 3])
      expect(normalizeToList(['a'])).toEqual(['a'])
    })

    it('parses JSON-array string', () => {
      expect(normalizeToList('[1, 2, 3]')).toEqual([1, 2, 3])
      expect(normalizeToList('["a","b"]')).toEqual(['a', 'b'])
    })

    it('falls back to CSV split when JSON parse fails', () => {
      expect(normalizeToList('a, b, c')).toEqual(['a', 'b', 'c'])
      expect(normalizeToList('1; 2; 3')).toEqual(['1', '2', '3'])
      expect(normalizeToList('x\ny\nz')).toEqual(['x', 'y', 'z'])
    })

    it('trims and drops empty entries from CSV', () => {
      expect(normalizeToList('a, , b,  ,c')).toEqual(['a', 'b', 'c'])
    })

    it('returns empty array for blank string', () => {
      expect(normalizeToList('')).toEqual([])
      expect(normalizeToList('   ')).toEqual([])
    })

    it('wraps single non-string scalars in an array', () => {
      expect(normalizeToList(42)).toEqual([42])
      expect(normalizeToList(true)).toEqual([true])
    })

    it('parses bug-#1 legacy value: numeric ids stored as JSON-array string', () => {
      const legacy = '[3296403, 3298069, 5081798]'
      expect(normalizeToList(legacy)).toEqual([3296403, 3298069, 5081798])
    })
  })

  describe('matchesFilterCondition: in / notIn', () => {
    it('exclude with in operator: array of numbers matches numeric id', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }]
      const result = dataTransformService.applyDataTransform(items, {
        type: 'exclude',
        filter: { field: 'id', operator: 'in', value: [1, 3] }
      } as any)
      expect(result).toEqual([{ id: 2 }])
    })

    it('exclude with in operator: loose equality (string vs number)', () => {
      // Reproduces bug #2: API возвращает id:1 (number), пользователь ввёл "1" (string)
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }]
      const result = dataTransformService.applyDataTransform(items, {
        type: 'exclude',
        filter: { field: 'id', operator: 'in', value: ['1', '3'] }
      } as any)
      expect(result).toEqual([{ id: 2 }])
    })

    it('exclude with in operator: legacy JSON-string value (bug #1)', () => {
      const items = [{ id: 3296403 }, { id: 9999999 }, { id: 3298069 }]
      const result = dataTransformService.applyDataTransform(items, {
        type: 'exclude',
        filter: { field: 'id', operator: 'in', value: '[3296403, 3298069]' as any }
      } as any)
      expect(result).toEqual([{ id: 9999999 }])
    })

    it('exclude with in operator: CSV-string value', () => {
      const items = [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }]
      const result = dataTransformService.applyDataTransform(items, {
        type: 'exclude',
        filter: { field: 'slug', operator: 'in', value: 'a, c' as any }
      } as any)
      expect(result).toEqual([{ slug: 'b' }])
    })

    it('include with in operator: keep only matching ids', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }]
      const result = dataTransformService.applyDataTransform(items, {
        type: 'include',
        filter: { field: 'id', operator: 'in', value: [2] }
      } as any)
      expect(result).toEqual([{ id: 2 }])
    })

    it('notIn operator: keep items NOT in list (loose equality)', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }]
      const result = dataTransformService.applyDataTransform(items, {
        type: 'include',
        filter: { field: 'id', operator: 'notIn', value: ['2'] }
      } as any)
      expect(result).toEqual([{ id: 1 }, { id: 3 }])
    })

    it('exclude all ids → empty result (canary)', () => {
      const items = [{ id: 1 }, { id: 2 }]
      const result = dataTransformService.applyDataTransform(items, {
        type: 'exclude',
        filter: { field: 'id', operator: 'in', value: [1, 2] }
      } as any)
      expect(result).toEqual([])
    })

    it('exclude with empty list: nothing is removed', () => {
      const items = [{ id: 1 }, { id: 2 }]
      const result = dataTransformService.applyDataTransform(items, {
        type: 'exclude',
        filter: { field: 'id', operator: 'in', value: [] }
      } as any)
      expect(result).toEqual(items)
    })
  })
})

