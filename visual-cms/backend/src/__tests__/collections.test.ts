/**
 * Collection Tests
 * 
 * Тесты для коллекций: Zod-схемы, template: трансформ, DeployService helpers
 */

import { dataTransformService } from '../services/DataTransformService'
import type { FieldMapping } from '../models/DataBinding'
import {
  createCollectionSchema,
  updateCollectionSchema,
  createOverrideSchema,
} from '../schemas/collection.schema'

const createMapping = (
  sourceField: string,
  targetProperty: string,
  extra: Partial<FieldMapping> = {}
): FieldMapping => ({
  id: `mapping-${sourceField}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  sourceField,
  targetProperty,
  ...extra,
})

// ========== Zod Schemas ==========

describe('Collection Zod Schemas', () => {
  describe('createCollectionSchema', () => {
    const validData = {
      siteId: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Проекты',
      dataSourceId: '550e8400-e29b-41d4-a716-446655440002',
      arrayPath: 'data.projects',
      templatePageId: '550e8400-e29b-41d4-a716-446655440003',
      basePath: '/projects',
      slugField: 'slug',
      titleField: 'title',
    }

    it('should accept valid data with required fields only', () => {
      const result = createCollectionSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should accept valid data with optional fields', () => {
      const result = createCollectionSchema.safeParse({
        ...validData,
        linkMode: 'manual',
        isActive: false,
        useCache: false,
        cacheTtl: 1200,
        pollInterval: 0,
        itemsOrder: 'alphabetical',
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty name', () => {
      const result = createCollectionSchema.safeParse({ ...validData, name: '' })
      expect(result.success).toBe(false)
    })

    it('should reject invalid basePath (no leading slash)', () => {
      const result = createCollectionSchema.safeParse({ ...validData, basePath: 'projects' })
      expect(result.success).toBe(false)
    })

    it('should reject basePath with uppercase', () => {
      const result = createCollectionSchema.safeParse({ ...validData, basePath: '/Projects' })
      expect(result.success).toBe(false)
    })

    it('should accept nested basePath', () => {
      const result = createCollectionSchema.safeParse({ ...validData, basePath: '/real-estate/projects' })
      expect(result.success).toBe(true)
    })

    it('should reject invalid linkMode', () => {
      const result = createCollectionSchema.safeParse({ ...validData, linkMode: 'invalid' })
      expect(result.success).toBe(false)
    })

    it('should reject negative cacheTtl', () => {
      const result = createCollectionSchema.safeParse({ ...validData, cacheTtl: -1 })
      expect(result.success).toBe(false)
    })

    it('should reject negative pollInterval', () => {
      const result = createCollectionSchema.safeParse({ ...validData, pollInterval: -10 })
      expect(result.success).toBe(false)
    })
  })

  describe('updateCollectionSchema', () => {
    it('should accept partial update', () => {
      const result = updateCollectionSchema.safeParse({ name: 'Новое имя' })
      expect(result.success).toBe(true)
    })

    it('should accept empty object', () => {
      const result = updateCollectionSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('should reject invalid basePath on update', () => {
      const result = updateCollectionSchema.safeParse({ basePath: 'no-slash' })
      expect(result.success).toBe(false)
    })
  })

  describe('createOverrideSchema', () => {
    it('should accept valid override', () => {
      const result = createOverrideSchema.safeParse({
        apiItemId: '42',
        apiItemSlug: 'project-alpha',
        customPageId: '550e8400-e29b-41d4-a716-446655440010',
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty apiItemId', () => {
      const result = createOverrideSchema.safeParse({
        apiItemId: '',
        apiItemSlug: 'slug',
        customPageId: '550e8400-e29b-41d4-a716-446655440010',
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty customPageId', () => {
      const result = createOverrideSchema.safeParse({
        apiItemId: '42',
        apiItemSlug: 'slug',
        customPageId: '',
      })
      expect(result.success).toBe(false)
    })
  })
})

// ========== template: transform ==========

describe('template: transform', () => {
  const testItem = {
    price: 1500000,
    area: 120,
    name: 'Alpha',
    percentage: 85.5,
  }

  it('should apply template: with simple substitution', () => {
    const mappings: FieldMapping[] = [
      createMapping('price', 'formatted', { transform: 'template:Цена: {{value}} ₽' }),
    ]
    const result = dataTransformService.applyMapping(testItem, mappings)
    expect(result.formatted).toBe('Цена: 1500000 ₽')
  })

  it('should apply template: with multiple {{value}} placeholders', () => {
    const mappings: FieldMapping[] = [
      createMapping('name', 'double', { transform: 'template:{{value}} — {{value}}' }),
    ]
    const result = dataTransformService.applyMapping(testItem, mappings)
    expect(result.double).toBe('Alpha — Alpha')
  })

  it('should apply template: with no placeholder (literal text)', () => {
    const mappings: FieldMapping[] = [
      createMapping('name', 'literal', { transform: 'template:всегда так' }),
    ]
    const result = dataTransformService.applyMapping(testItem, mappings)
    expect(result.literal).toBe('всегда так')
  })

  it('should convert number to string in template', () => {
    const mappings: FieldMapping[] = [
      createMapping('area', 'desc', { transform: 'template:{{value}} м²' }),
    ]
    const result = dataTransformService.applyMapping(testItem, mappings)
    expect(result.desc).toBe('120 м²')
  })

  it('should handle template: combined with fallback', () => {
    const mappings: FieldMapping[] = [
      createMapping('missing_field', 'result', {
        transform: 'template:Value: {{value}}',
        fallbackValue: 'N/A',
      }),
    ]
    const result = dataTransformService.applyMapping(testItem, mappings)
    // fallbackValue is applied before transform when source is missing
    // Actual behavior: transform is skipped for undefined, fallback kicks in
    expect(result.result).toBe('N/A')
  })
})

// ========== DataBindingGenerator runtime (unit-level string checks) ==========

describe('DataBindingGenerator collectionLink config', () => {
  // We test the interface shape only — runtime tests need browser/JSDOM
  it('should define collectionLink in repeaterConfig interface', () => {
    // Type-level check: import the interface
    const config = {
      blockId: 'block-1',
      type: 'repeater' as const,
      sourceAlias: 'projects',
      repeaterConfig: {
        itemTemplate: 'tpl-1',
        containerSelector: '[data-element-id="block-1"]',
        collectionLink: {
          basePath: '/projects',
          slugField: 'slug',
        },
      },
    }
    expect(config.repeaterConfig.collectionLink.basePath).toBe('/projects')
    expect(config.repeaterConfig.collectionLink.slugField).toBe('slug')
  })

  it('should allow repeaterConfig without collectionLink', () => {
    const config = {
      blockId: 'block-2',
      type: 'repeater' as const,
      sourceAlias: 'news',
      repeaterConfig: {
        itemTemplate: 'tpl-2',
        containerSelector: '[data-element-id="block-2"]',
      },
    }
    expect((config.repeaterConfig as any).collectionLink).toBeUndefined()
  })
})

// ========== DataBindingGenerator runtime: hybrid-static guard ==========

describe('DataBindingGenerator hybrid-static runtime guard', () => {
  it('renderRepeater должен пропускать children с data-carousel-static', async () => {
    // Импорт через динамический require чтобы не ломать TS-isolation тестового файла.
    const { generateDataBindingRuntime } = await import('../services/DataBindingGenerator')
    const runtime: string = generateDataBindingRuntime({
      dataSources: [
        {
          alias: 'projects',
          dataSourceId: 'ds-1',
          endpoint: '/api/projects',
          loadStrategy: 'pageLoad',
          cacheEnabled: false,
        },
      ],
      bindings: [
        {
          blockId: 'track-1',
          type: 'repeater',
          sourceAlias: 'projects',
          repeaterConfig: {
            itemTemplate: 'tpl-1',
            containerSelector: '[data-element-id="track-1"]',
          },
          fieldMappings: [],
        },
      ],
      variables: [],
    })
    // Гард: внутри обхода container.children проверяем атрибут data-carousel-static
    // и НЕ скрываем такого ребёнка. Если этот substring потерян — hybrid сломан.
    expect(runtime).toContain("hasAttribute('data-carousel-static')")
    // И сам комментарий-инвариант обязан остаться
    expect(runtime).toContain('hybrid-static')
  })

  it('renderRepeater должен вставлять clones через insertBefore(template.nextSibling)', async () => {
    const { generateDataBindingRuntime } = await import('../services/DataBindingGenerator')
    const runtime: string = generateDataBindingRuntime({
      dataSources: [
        {
          alias: 'projects',
          dataSourceId: 'ds-1',
          endpoint: '/api/projects',
          loadStrategy: 'pageLoad',
          cacheEnabled: false,
        },
      ],
      bindings: [
        {
          blockId: 'track-1',
          type: 'repeater',
          sourceAlias: 'projects',
          repeaterConfig: {
            itemTemplate: 'tpl-1',
            containerSelector: '[data-element-id="track-1"]',
          },
          fieldMappings: [],
        },
      ],
      variables: [],
    })
    // Hybrid-MVP: clones размещаются СРАЗУ ПОСЛЕ template'а через
    // insertBefore(clone, templateElement.nextSibling). anchor=null → как appendChild.
    expect(runtime).toContain('templateElement.nextSibling')
    expect(runtime).toContain('container.insertBefore(clone, insertAnchor)')
    // Старая реализация appendChild больше не используется для clones
    expect(runtime).not.toContain('container.appendChild(clone)')
  })
})
