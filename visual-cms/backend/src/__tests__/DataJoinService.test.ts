/**
 * DataJoinService Unit Tests
 * 
 * Тесты для сервиса объединения данных
 */

import dataJoinService, { JoinType, MergeStrategy, DataSourceJoinConfig } from '../services/DataJoinService'

describe('DataJoinService', () => {
  // Test data
  const users = [
    { id: 1, name: 'Alice', departmentId: 'D1' },
    { id: 2, name: 'Bob', departmentId: 'D2' },
    { id: 3, name: 'Charlie', departmentId: 'D1' },
    { id: 4, name: 'Diana', departmentId: 'D3' },
  ]

  const departments = [
    { id: 'D1', name: 'Engineering', budget: 100000 },
    { id: 'D2', name: 'Marketing', budget: 50000 },
    { id: 'D4', name: 'HR', budget: 30000 }, // D4 has no users
  ]

  const orders = [
    { orderId: 1, userId: 1, total: 100 },
    { orderId: 2, userId: 1, total: 200 },
    { orderId: 3, userId: 2, total: 150 },
  ]

  describe('LEFT JOIN', () => {
    it('should keep all primary records and add matching additional data', () => {
      const config: DataSourceJoinConfig = {
        alias: 'department',
        data: departments,
        joinType: 'left',
        conditions: [{ primaryField: 'departmentId', additionalField: 'id' }]
      }

      const result = dataJoinService.joinDataSources(users, [config])

      expect(result.data).toHaveLength(4) // All users kept
      expect(result.stats.matchedCount).toBe(3) // D1 matched 2, D2 matched 1
      expect(result.stats.unmatchedCount).toBe(1) // D3 not found

      // Check matched record
      const alice = result.data.find((r: any) => r.name === 'Alice') as any
      expect(alice.department?.name).toBe('Engineering')

      // Check unmatched record
      const diana = result.data.find((r: any) => r.name === 'Diana') as any
      expect(diana.department).toBeUndefined()
    })

    it('should handle prefix for additional fields', () => {
      const config: DataSourceJoinConfig = {
        alias: 'dept',
        data: departments,
        joinType: 'left',
        conditions: [{ primaryField: 'departmentId', additionalField: 'id' }],
        prefix: 'dept_'
      }

      const result = dataJoinService.joinDataSources(users, [config])
      const alice = result.data.find((r: any) => r.name === 'Alice') as any

      expect(alice.dept_name).toBe('Engineering')
      expect(alice.dept_budget).toBe(100000)
    })
  })

  describe('INNER JOIN', () => {
    it('should only keep records with matches', () => {
      const config: DataSourceJoinConfig = {
        alias: 'department',
        data: departments,
        joinType: 'inner',
        conditions: [{ primaryField: 'departmentId', additionalField: 'id' }]
      }

      const result = dataJoinService.joinDataSources(users, [config])

      expect(result.data).toHaveLength(3) // Diana (D3) excluded
      expect(result.stats.matchedCount).toBe(3)
      expect(result.data.every((r: any) => r.department !== undefined)).toBe(true)
    })
  })

  describe('FULL JOIN', () => {
    it('should include all records from both sources', () => {
      const config: DataSourceJoinConfig = {
        alias: 'department',
        data: departments,
        joinType: 'full',
        conditions: [{ primaryField: 'departmentId', additionalField: 'id' }]
      }

      const result = dataJoinService.joinDataSources(users, [config])

      // 4 users + 1 unmatched department (D4)
      expect(result.data.length).toBeGreaterThanOrEqual(4)
      
      // Check that D4 (HR) is included even without users
      const hrRecord = result.data.find((r: any) => r.department?.name === 'HR')
      expect(hrRecord).toBeDefined()
    })
  })

  describe('CROSS JOIN', () => {
    it('should create cartesian product', () => {
      const smallUsers = users.slice(0, 2) // Alice, Bob
      const smallDepts = departments.slice(0, 2) // Engineering, Marketing
      
      const config: DataSourceJoinConfig = {
        alias: 'department',
        data: smallDepts,
        joinType: 'cross',
        conditions: [] // No conditions for cross join
      }

      const result = dataJoinService.joinDataSources(smallUsers, [config])

      expect(result.data).toHaveLength(4) // 2 * 2 = 4
    })
  })

  describe('Multiple join conditions', () => {
    const employees = [
      { id: 1, name: 'Alice', dept: 'ENG', level: 'senior' },
      { id: 2, name: 'Bob', dept: 'ENG', level: 'junior' },
      { id: 3, name: 'Charlie', dept: 'MKT', level: 'senior' },
    ]

    const salaries = [
      { department: 'ENG', level: 'senior', amount: 100000 },
      { department: 'ENG', level: 'junior', amount: 60000 },
      { department: 'MKT', level: 'senior', amount: 80000 },
    ]

    it('should match on multiple conditions (AND)', () => {
      const config: DataSourceJoinConfig = {
        alias: 'salary',
        data: salaries,
        joinType: 'left',
        conditions: [
          { primaryField: 'dept', additionalField: 'department' },
          { primaryField: 'level', additionalField: 'level' }
        ]
      }

      const result = dataJoinService.joinDataSources(employees, [config])

      const alice = result.data.find((r: any) => r.name === 'Alice') as any
      expect(alice.salary?.amount).toBe(100000)

      const bob = result.data.find((r: any) => r.name === 'Bob') as any
      expect(bob.salary?.amount).toBe(60000)
    })
  })

  describe('Merge strategies', () => {
    const primary = [{ id: 1, name: 'Primary Name', value: 10 }]
    const additional = [{ id: 1, name: 'Additional Name', extra: 20 }]

    it('primary_wins should keep primary values on conflict', () => {
      const config: DataSourceJoinConfig = {
        alias: 'extra',
        data: additional,
        joinType: 'left',
        conditions: [{ primaryField: 'id', additionalField: 'id' }],
        mergeStrategy: 'primary_wins'
      }

      const result = dataJoinService.joinDataSources(primary, [config])
      expect((result.data[0] as any).name).toBe('Primary Name')
    })

    it('additional_wins should use additional values on conflict', () => {
      const config: DataSourceJoinConfig = {
        alias: 'extra',
        data: additional,
        joinType: 'left',
        conditions: [{ primaryField: 'id', additionalField: 'id' }],
        mergeStrategy: 'additional_wins'
      }

      const result = dataJoinService.joinDataSources(primary, [config])
      expect((result.data[0] as any).extra?.name).toBe('Additional Name')
    })
  })

  describe('Multiple data sources', () => {
    it('should join with multiple sources sequentially', () => {
      const deptConfig: DataSourceJoinConfig = {
        alias: 'department',
        data: departments,
        joinType: 'left',
        conditions: [{ primaryField: 'departmentId', additionalField: 'id' }]
      }

      const orderConfig: DataSourceJoinConfig = {
        alias: 'orders',
        data: orders,
        joinType: 'left',
        conditions: [{ primaryField: 'id', additionalField: 'userId' }]
      }

      const result = dataJoinService.joinDataSources(users, [deptConfig, orderConfig])

      const alice = result.data.find((r: any) => r.name === 'Alice') as any
      expect(alice.department?.name).toBe('Engineering')
      // Alice has 2 orders, depending on implementation might be first match or array
    })
  })

  describe('Join condition operators', () => {
    const items = [
      { id: 1, code: 'ABC-123' },
      { id: 2, code: 'DEF-456' },
    ]

    const categories = [
      { prefix: 'ABC', category: 'Alpha' },
      { prefix: 'DEF', category: 'Delta' },
    ]

    it('startsWith operator should match prefix', () => {
      const config: DataSourceJoinConfig = {
        alias: 'cat',
        data: categories,
        joinType: 'left',
        conditions: [{ 
          primaryField: 'code', 
          additionalField: 'prefix',
          operator: 'startsWith'
        }]
      }

      const result = dataJoinService.joinDataSources(items, [config])
      expect((result.data[0] as any).cat?.category).toBe('Alpha')
      expect((result.data[1] as any).cat?.category).toBe('Delta')
    })
  })

  describe('Error handling', () => {
    it('should handle empty primary data', () => {
      const config: DataSourceJoinConfig = {
        alias: 'dept',
        data: departments,
        joinType: 'left',
        conditions: [{ primaryField: 'departmentId', additionalField: 'id' }]
      }

      const result = dataJoinService.joinDataSources([], [config])
      expect(result.data).toHaveLength(0)
      expect(result.stats.primaryCount).toBe(0)
    })

    it('should handle empty additional data', () => {
      const config: DataSourceJoinConfig = {
        alias: 'dept',
        data: [],
        joinType: 'left',
        conditions: [{ primaryField: 'departmentId', additionalField: 'id' }]
      }

      const result = dataJoinService.joinDataSources(users, [config])
      expect(result.data).toHaveLength(4) // All users, no matches
      expect(result.stats.matchedCount).toBe(0)
    })

    it('should handle null/undefined in join fields', () => {
      const usersWithNull = [
        { id: 1, name: 'Alice', departmentId: null },
        { id: 2, name: 'Bob', departmentId: undefined },
        { id: 3, name: 'Charlie', departmentId: 'D1' },
      ]

      const config: DataSourceJoinConfig = {
        alias: 'dept',
        data: departments,
        joinType: 'left',
        conditions: [{ primaryField: 'departmentId', additionalField: 'id' }]
      }

      const result = dataJoinService.joinDataSources(usersWithNull, [config])
      expect(result.data).toHaveLength(3)
      expect(result.stats.matchedCount).toBe(1) // Only Charlie matches
    })
  })

  describe('Stats reporting', () => {
    it('should return accurate stats', () => {
      const config: DataSourceJoinConfig = {
        alias: 'dept',
        data: departments,
        joinType: 'left',
        conditions: [{ primaryField: 'departmentId', additionalField: 'id' }]
      }

      const result = dataJoinService.joinDataSources(users, [config])

      expect(result.stats.primaryCount).toBe(4)
      expect(result.stats.additionalCount).toBe(3)
      expect(result.stats.joinType).toBe('left')
      expect(result.stats.processingTimeMs).toBeGreaterThanOrEqual(0)
    })
  })
})
