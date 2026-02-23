import {
  createGroupSchema, updateGroupSchema
} from '../schemas/group.schema'
import {
  createPageSchema, updatePageSchema,
  updatePageDataSourcesSchema, updatePageVariablesSchema, updateDataSettingsSchema
} from '../schemas/page.schema'
import {
  createBlockSchema, updateBlockSchema,
  enableTemplateSchema, createFromElementSchema
} from '../schemas/block.schema'
import {
  createVariableSchema, updateVariableSchema,
  bulkCreateVariablesSchema, reorderVariablesSchema, validateValueSchema
} from '../schemas/variable.schema'
import {
  createDataSourceSchema, updateDataSourceSchema, testNewConnectionSchema
} from '../schemas/dataSource.schema'
import {
  createDataBindingSchema, updateDataBindingSchema, fetchDataSchema
} from '../schemas/dataBinding.schema'
import {
  createTemplateSchema, updateTemplateSchema, detectFieldsSchema
} from '../schemas/template.schema'
import {
  createFormSchema, updateFormSchema,
  createDestinationSchema, updateDestinationSchema, submitFormSchema
} from '../schemas/form.schema'
import { submitDataSchema } from '../schemas/dataSubmit.schema'
import { renderTemplateSchema } from '../schemas/templateTest.schema'
import { submitApplicationSchema } from '../schemas/mock.schema'

const uuid = '550e8400-e29b-41d4-a716-446655440000'
const uuid2 = '660e8400-e29b-41d4-a716-446655440001'

describe('group.schema', () => {
  describe('createGroupSchema', () => {
    it('accepts valid input', () => {
      const r = createGroupSchema.safeParse({ name: 'My Group', type: 'pages' })
      expect(r.success).toBe(true)
      if (r.success) expect(r.data.order).toBe(0) // default
    })
    it('rejects missing name', () => {
      expect(createGroupSchema.safeParse({ type: 'pages' }).success).toBe(false)
    })
    it('rejects invalid type', () => {
      expect(createGroupSchema.safeParse({ name: 'X', type: 'invalid' }).success).toBe(false)
    })
    it('rejects empty name', () => {
      expect(createGroupSchema.safeParse({ name: '', type: 'blocks' }).success).toBe(false)
    })
    it('accepts optional parentId as uuid', () => {
      const r = createGroupSchema.safeParse({ name: 'X', type: 'pages', parentId: uuid })
      expect(r.success).toBe(true)
    })
    it('rejects non-uuid parentId', () => {
      expect(createGroupSchema.safeParse({ name: 'X', type: 'pages', parentId: 'not-uuid' }).success).toBe(false)
    })
  })
  describe('updateGroupSchema', () => {
    it('accepts empty object (all optional)', () => {
      expect(updateGroupSchema.safeParse({}).success).toBe(true)
    })
    it('accepts partial update', () => {
      expect(updateGroupSchema.safeParse({ name: 'New' }).success).toBe(true)
    })
  })
})

describe('page.schema', () => {
  const validPage = {
    name: 'Home',
    slug: 'home-page',
    metadata: { title: 'Home Page' },
  }
  describe('createPageSchema', () => {
    it('accepts valid input with defaults', () => {
      const r = createPageSchema.safeParse(validPage)
      expect(r.success).toBe(true)
      if (r.success) {
        expect(r.data.status).toBe('draft')
        expect(r.data.metadata.description).toBe('')
        expect(r.data.metadata.keywords).toEqual([])
      }
    })
    it('rejects missing metadata', () => {
      expect(createPageSchema.safeParse({ name: 'X', slug: 'x' }).success).toBe(false)
    })
    it('rejects invalid slug format', () => {
      expect(createPageSchema.safeParse({ ...validPage, slug: 'Bad Slug!' }).success).toBe(false)
    })
    it('accepts valid slug with hyphens', () => {
      expect(createPageSchema.safeParse({ ...validPage, slug: 'my-cool-page' }).success).toBe(true)
    })
    it('rejects slug with uppercase', () => {
      expect(createPageSchema.safeParse({ ...validPage, slug: 'MyPage' }).success).toBe(false)
    })
    it('rejects invalid status', () => {
      expect(createPageSchema.safeParse({ ...validPage, status: 'unknown' }).success).toBe(false)
    })
  })
  describe('updatePageSchema', () => {
    it('accepts empty object', () => {
      expect(updatePageSchema.safeParse({}).success).toBe(true)
    })
    it('accepts partial metadata', () => {
      expect(updatePageSchema.safeParse({ metadata: { title: 'T' } }).success).toBe(true)
    })
  })
  describe('updatePageDataSourcesSchema', () => {
    it('requires dataSources', () => {
      expect(updatePageDataSourcesSchema.safeParse({}).success).toBe(false)
      expect(updatePageDataSourcesSchema.safeParse({ dataSources: { a: 1 } }).success).toBe(true)
    })
  })
  describe('updateDataSettingsSchema', () => {
    it('accepts both optional', () => {
      expect(updateDataSettingsSchema.safeParse({}).success).toBe(true)
      expect(updateDataSettingsSchema.safeParse({ dataSources: {}, variables: {} }).success).toBe(true)
    })
  })
})

describe('block.schema', () => {
  const validBlock = { name: 'Hero', type: 'div', structure: { tagName: 'div' } }
  describe('createBlockSchema', () => {
    it('accepts valid input with defaults', () => {
      const r = createBlockSchema.safeParse(validBlock)
      expect(r.success).toBe(true)
      if (r.success) {
        expect(r.data.isReusable).toBe(false)
        expect(r.data.tags).toEqual([])
        expect(r.data.isTemplate).toBe(false)
      }
    })
    it('rejects missing structure', () => {
      expect(createBlockSchema.safeParse({ name: 'X', type: 'div' }).success).toBe(false)
    })
    it('rejects missing name', () => {
      expect(createBlockSchema.safeParse({ type: 'div', structure: {} }).success).toBe(false)
    })
  })
  describe('enableTemplateSchema', () => {
    it('uses defaults when empty', () => {
      const r = enableTemplateSchema.safeParse({})
      expect(r.success).toBe(true)
      if (r.success) {
        expect(r.data.templateCategory).toBe('custom')
        expect(r.data.autoDetectFields).toBe(true)
      }
    })
  })
  describe('createFromElementSchema', () => {
    it('requires structure', () => {
      expect(createFromElementSchema.safeParse({}).success).toBe(false)
      expect(createFromElementSchema.safeParse({ structure: { tag: 'div' } }).success).toBe(true)
    })
  })
})
describe('variable.schema', () => {
  describe('createVariableSchema', () => {
    it('accepts valid input with defaults', () => {
      const r = createVariableSchema.safeParse({ name: 'myVar' })
      expect(r.success).toBe(true)
      if (r.success) {
        expect(r.data.scope).toBe('page')
        expect(r.data.type).toBe('string')
        expect(r.data.order).toBe(0)
      }
    })
    it('rejects empty name', () => {
      expect(createVariableSchema.safeParse({ name: '' }).success).toBe(false)
    })
    it('accepts all valid scopes', () => {
      for (const scope of ['page', 'global', 'session']) {
        expect(createVariableSchema.safeParse({ name: 'v', scope }).success).toBe(true)
      }
    })
    it('rejects invalid scope', () => {
      expect(createVariableSchema.safeParse({ name: 'v', scope: 'local' }).success).toBe(false)
    })
    it('accepts all 10 variable types', () => {
      const types = ['string', 'number', 'boolean', 'array', 'object', 'date', 'color', 'url', 'email', 'json']
      for (const type of types) {
        expect(createVariableSchema.safeParse({ name: 'v', type }).success).toBe(true)
      }
    })
    it('rejects invalid type', () => {
      expect(createVariableSchema.safeParse({ name: 'v', type: 'file' }).success).toBe(false)
    })
  })
  describe('bulkCreateVariablesSchema', () => {
    it('accepts array of variables', () => {
      const r = bulkCreateVariablesSchema.safeParse({ variables: [{ name: 'a' }, { name: 'b' }] })
      expect(r.success).toBe(true)
    })
    it('rejects empty array', () => {
      expect(bulkCreateVariablesSchema.safeParse({ variables: [] }).success).toBe(false)
    })
  })
  describe('reorderVariablesSchema', () => {
    it('accepts valid items', () => {
      const r = reorderVariablesSchema.safeParse({ items: [{ id: uuid, order: 0 }, { id: uuid2, order: 1 }] })
      expect(r.success).toBe(true)
    })
    it('rejects non-uuid id', () => {
      expect(reorderVariablesSchema.safeParse({ items: [{ id: 'bad', order: 0 }] }).success).toBe(false)
    })
    it('rejects empty items', () => {
      expect(reorderVariablesSchema.safeParse({ items: [] }).success).toBe(false)
    })
  })
  describe('validateValueSchema', () => {
    it('accepts any value', () => {
      expect(validateValueSchema.safeParse({ value: 42 }).success).toBe(true)
      expect(validateValueSchema.safeParse({ value: null }).success).toBe(true)
      expect(validateValueSchema.safeParse({ value: 'str' }).success).toBe(true)
    })
  })
})

describe('dataSource.schema', () => {
  const valid = { name: 'API', type: 'rest', config: { url: 'https://api.example.com' } }
  describe('createDataSourceSchema', () => {
    it('accepts valid input with defaults', () => {
      const r = createDataSourceSchema.safeParse(valid)
      expect(r.success).toBe(true)
      if (r.success) expect(r.data.status).toBe('draft')
    })
    it('accepts all valid types', () => {
      for (const type of ['rest', 'graphql', 'static', 'websocket', 'mock']) {
        expect(createDataSourceSchema.safeParse({ ...valid, type }).success).toBe(true)
      }
    })
    it('rejects invalid type', () => {
      expect(createDataSourceSchema.safeParse({ ...valid, type: 'grpc' }).success).toBe(false)
    })
    it('rejects missing config', () => {
      expect(createDataSourceSchema.safeParse({ name: 'A', type: 'rest' }).success).toBe(false)
    })
  })
  describe('testNewConnectionSchema', () => {
    it('requires type and config', () => {
      expect(testNewConnectionSchema.safeParse({ type: 'rest', config: {} }).success).toBe(true)
      expect(testNewConnectionSchema.safeParse({ type: 'rest' }).success).toBe(false)
    })
  })
})

describe('dataBinding.schema', () => {
  const valid = { blockId: uuid, dataSourceId: uuid2, bindingType: 'input', config: {} }
  describe('createDataBindingSchema', () => {
    it('accepts valid input with defaults', () => {
      const r = createDataBindingSchema.safeParse(valid)
      expect(r.success).toBe(true)
      if (r.success) {
        expect(r.data.isActive).toBe(true)
        expect(r.data.priority).toBe(0)
      }
    })
    it('rejects non-uuid blockId', () => {
      expect(createDataBindingSchema.safeParse({ ...valid, blockId: 'bad' }).success).toBe(false)
    })
    it('accepts all binding types', () => {
      for (const bt of ['input', 'output', 'two-way']) {
        expect(createDataBindingSchema.safeParse({ ...valid, bindingType: bt }).success).toBe(true)
      }
    })
  })
  describe('fetchDataSchema', () => {
    it('accepts minimal input', () => {
      expect(fetchDataSchema.safeParse({ dataSourceId: uuid }).success).toBe(true)
    })
    it('rejects missing dataSourceId', () => {
      expect(fetchDataSchema.safeParse({}).success).toBe(false)
    })
    it('accepts nested pagination', () => {
      const r = fetchDataSchema.safeParse({ dataSourceId: uuid, pagination: { page: 1, limit: 10 } })
      expect(r.success).toBe(true)
    })
    it('rejects pagination limit > 1000', () => {
      expect(fetchDataSchema.safeParse({ dataSourceId: uuid, pagination: { limit: 9999 } }).success).toBe(false)
    })
  })
})
describe('template.schema', () => {
  const valid = { name: 'Card', htmlContent: '<div>{{title}}</div>' }
  describe('createTemplateSchema', () => {
    it('accepts valid input with defaults', () => {
      const r = createTemplateSchema.safeParse(valid)
      expect(r.success).toBe(true)
      if (r.success) {
        expect(r.data.category).toBe('custom')
        expect(r.data.cssContent).toBe('')
        expect(r.data.tags).toEqual([])
        expect(r.data.autoDetectFields).toBe(true)
      }
    })
    it('rejects missing htmlContent', () => {
      expect(createTemplateSchema.safeParse({ name: 'X' }).success).toBe(false)
    })
    it('accepts all category values', () => {
      const cats = ['card', 'list-item', 'hero', 'feature', 'testimonial', 'pricing', 'gallery-item', 'custom']
      for (const category of cats) {
        expect(createTemplateSchema.safeParse({ ...valid, category }).success).toBe(true)
      }
    })
  })
  describe('detectFieldsSchema', () => {
    it('requires html', () => {
      expect(detectFieldsSchema.safeParse({}).success).toBe(false)
      expect(detectFieldsSchema.safeParse({ html: '<p>Hi</p>' }).success).toBe(true)
    })
    it('rejects empty html', () => {
      expect(detectFieldsSchema.safeParse({ html: '' }).success).toBe(false)
    })
  })
})

describe('form.schema', () => {
  describe('createFormSchema', () => {
    it('accepts valid input with defaults', () => {
      const r = createFormSchema.safeParse({ name: 'Contact' })
      expect(r.success).toBe(true)
      if (r.success) {
        expect(r.data.status).toBe('draft')
        expect(r.data.fields).toEqual([])
      }
    })
    it('rejects missing name', () => {
      expect(createFormSchema.safeParse({}).success).toBe(false)
    })
  })
  describe('createDestinationSchema', () => {
    it('accepts valid input', () => {
      const r = createDestinationSchema.safeParse({ name: 'Email', type: 'email', config: { to: 'a@b.com' } })
      expect(r.success).toBe(true)
    })
    it('accepts all destination types', () => {
      const types = ['email', 'telegram', 'webhook', 'bitrix24', 'amocrm', 'google_sheets', 'custom']
      for (const type of types) {
        expect(createDestinationSchema.safeParse({ name: 'D', type, config: {} }).success).toBe(true)
      }
    })
    it('rejects invalid type', () => {
      expect(createDestinationSchema.safeParse({ name: 'D', type: 'sms', config: {} }).success).toBe(false)
    })
  })
  describe('submitFormSchema', () => {
    it('accepts empty object (passthrough)', () => {
      expect(submitFormSchema.safeParse({}).success).toBe(true)
    })
    it('passes through extra fields', () => {
      const r = submitFormSchema.safeParse({ name: 'John', phone: '+123' })
      expect(r.success).toBe(true)
      if (r.success) expect((r.data as any).name).toBe('John')
    })
  })
})

describe('dataSubmit.schema', () => {
  describe('submitDataSchema', () => {
    it('accepts minimal valid input', () => {
      const r = submitDataSchema.safeParse({ data: { key: 'value' } })
      expect(r.success).toBe(true)
      if (r.success) {
        expect(r.data.method).toBe('POST')
        expect(r.data.trigger).toBe('api_call')
        expect(r.data.isRetry).toBe(false)
        expect(r.data.attemptNumber).toBe(1)
      }
    })
    it('rejects missing data', () => {
      expect(submitDataSchema.safeParse({}).success).toBe(false)
    })
    it('accepts all HTTP methods', () => {
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        expect(submitDataSchema.safeParse({ data: {}, method }).success).toBe(true)
      }
    })
    it('rejects GET method', () => {
      expect(submitDataSchema.safeParse({ data: {}, method: 'GET' }).success).toBe(false)
    })
    it('accepts all trigger types', () => {
      const triggers = ['form_submit', 'button_click', 'input_change', 'input_blur', 'interval', 'custom_event', 'api_call']
      for (const trigger of triggers) {
        expect(submitDataSchema.safeParse({ data: {}, trigger }).success).toBe(true)
      }
    })
    it('rejects invalid endpoint url', () => {
      expect(submitDataSchema.safeParse({ data: {}, endpoint: 'not-a-url' }).success).toBe(false)
    })
    it('accepts valid endpoint url', () => {
      expect(submitDataSchema.safeParse({ data: {}, endpoint: 'https://api.example.com/submit' }).success).toBe(true)
    })
  })
})

describe('templateTest.schema', () => {
  describe('renderTemplateSchema', () => {
    it('accepts valid input', () => {
      const r = renderTemplateSchema.safeParse({ templateBlockId: uuid, testData: [{ title: 'Test' }] })
      expect(r.success).toBe(true)
    })
    it('rejects empty testData', () => {
      expect(renderTemplateSchema.safeParse({ templateBlockId: uuid, testData: [] }).success).toBe(false)
    })
    it('rejects non-uuid templateBlockId', () => {
      expect(renderTemplateSchema.safeParse({ templateBlockId: 'bad', testData: [{}] }).success).toBe(false)
    })
    it('accepts optional fieldMappings', () => {
      const r = renderTemplateSchema.safeParse({
        templateBlockId: uuid,
        testData: [{ a: 1 }],
        fieldMappings: [{ id: '1', targetProperty: 'title', sourceField: 'a' }]
      })
      expect(r.success).toBe(true)
    })
  })
})

describe('mock.schema', () => {
  describe('submitApplicationSchema', () => {
    it('accepts valid input with phone', () => {
      expect(submitApplicationSchema.safeParse({ name: 'John', phone: '+1234567890' }).success).toBe(true)
    })
    it('accepts valid input with email', () => {
      expect(submitApplicationSchema.safeParse({ name: 'Jane', email: 'j@e.com' }).success).toBe(true)
    })
    it('accepts both phone and email', () => {
      expect(submitApplicationSchema.safeParse({ name: 'X', phone: '123', email: 'a@b.com' }).success).toBe(true)
    })
    it('rejects missing both phone and email (.refine)', () => {
      const r = submitApplicationSchema.safeParse({ name: 'Anon' })
      expect(r.success).toBe(false)
      if (!r.success) {
        const msgs = r.error.issues.map(i => i.message)
        expect(msgs).toContain('At least phone or email is required')
      }
    })
    it('rejects missing name', () => {
      expect(submitApplicationSchema.safeParse({ phone: '123' }).success).toBe(false)
    })
    it('rejects invalid email format', () => {
      expect(submitApplicationSchema.safeParse({ name: 'X', email: 'bad' }).success).toBe(false)
    })
    it('applies source default', () => {
      const r = submitApplicationSchema.safeParse({ name: 'X', phone: '1' })
      expect(r.success).toBe(true)
      if (r.success) expect(r.data.source).toBe('website')
    })
  })
})
