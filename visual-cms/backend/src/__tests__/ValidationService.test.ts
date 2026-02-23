import { validationService } from '../services/ValidationService'
import type { FieldValidation } from '../services/ValidationService'

function v(fieldName: string, value: unknown, rules: FieldValidation['rules']) {
  return validationService.validate({ [fieldName]: value }, [{ fieldName, rules }])
}

describe('ValidationService', () => {
  describe('required rule', () => {
    it('fails on undefined', () => {
      expect(v('f', undefined, [{ type: 'required' }]).isValid).toBe(false)
    })
    it('fails on null', () => {
      expect(v('f', null, [{ type: 'required' }]).isValid).toBe(false)
    })
    it('fails on empty string', () => {
      expect(v('f', '', [{ type: 'required' }]).isValid).toBe(false)
    })
    it('fails on empty array', () => {
      expect(v('f', [], [{ type: 'required' }]).isValid).toBe(false)
    })
    it('passes with value', () => {
      expect(v('f', 'ok', [{ type: 'required' }]).isValid).toBe(true)
    })
  })
  describe('email rule', () => {
    it('passes valid', () => { expect(v('e', 'a@b.com', [{ type: 'email' }]).isValid).toBe(true) })
    it('fails invalid', () => { expect(v('e', 'bad', [{ type: 'email' }]).isValid).toBe(false) })
    it('passes empty (not required)', () => { expect(v('e', '', [{ type: 'email' }]).isValid).toBe(true) })
  })
  describe('url rule', () => {
    it('passes valid', () => { expect(v('u', 'https://x.com/p', [{ type: 'url' }]).isValid).toBe(true) })
    it('fails invalid', () => { expect(v('u', 'badurl', [{ type: 'url' }]).isValid).toBe(false) })
  })
  describe('phone rule', () => {
    it('passes valid', () => { expect(v('p', '+79991234567', [{ type: 'phone' }]).isValid).toBe(true) })
    it('fails invalid', () => { expect(v('p', 'abc', [{ type: 'phone' }]).isValid).toBe(false) })
  })
  describe('minLength / maxLength', () => {
    it('fails too short', () => { expect(v('f', 'ab', [{ type: 'minLength', value: 5 }]).isValid).toBe(false) })
    it('passes long enough', () => { expect(v('f', 'abcde', [{ type: 'minLength', value: 5 }]).isValid).toBe(true) })
    it('fails too long', () => { expect(v('f', 'abcdef', [{ type: 'maxLength', value: 3 }]).isValid).toBe(false) })
    it('passes within max', () => { expect(v('f', 'abc', [{ type: 'maxLength', value: 3 }]).isValid).toBe(true) })
  })
  describe('min / max', () => {
    it('fails below min', () => { expect(v('n', 3, [{ type: 'min', value: 5 }]).isValid).toBe(false) })
    it('passes at min', () => { expect(v('n', 5, [{ type: 'min', value: 5 }]).isValid).toBe(true) })
    it('fails above max', () => { expect(v('n', 11, [{ type: 'max', value: 10 }]).isValid).toBe(false) })
  })
  describe('pattern rule', () => {
    it('passes matching', () => { expect(v('f', 'ABC', [{ type: 'pattern', value: '^[A-Z]+$' }]).isValid).toBe(true) })
    it('fails non-matching', () => { expect(v('f', 'abc', [{ type: 'pattern', value: '^[A-Z]+$' }]).isValid).toBe(false) })
  })
  describe('enum rule', () => {
    it('passes valid', () => { expect(v('f', 'a', [{ type: 'enum', value: ['a', 'b'] }]).isValid).toBe(true) })
    it('fails invalid', () => { expect(v('f', 'c', [{ type: 'enum', value: ['a', 'b'] }]).isValid).toBe(false) })
  })
  describe('date rule', () => {
    it('passes valid', () => { expect(v('d', '2024-01-15', [{ type: 'date' }]).isValid).toBe(true) })
    it('fails invalid', () => { expect(v('d', 'not-date', [{ type: 'date' }]).isValid).toBe(false) })
  })
  describe('creditCard rule', () => {
    it('passes valid Visa', () => { expect(v('c', '4111111111111111', [{ type: 'creditCard' }]).isValid).toBe(true) })
    it('fails bad card', () => { expect(v('c', '1234', [{ type: 'creditCard' }]).isValid).toBe(false) })
  })
  describe('custom messages', () => {
    it('uses custom message', () => {
      const r = v('f', undefined, [{ type: 'required', message: 'Fill this!' }])
      expect(r.errors.f).toContain('Fill this!')
    })
  })
  describe('sanitization', () => {
    it('trims', () => {
      const r = validationService.validate({ f: '  hi  ' }, [{ fieldName: 'f', rules: [], sanitize: [{ type: 'trim' }] }])
      expect(r.sanitizedData.f).toBe('hi')
    })
    it('lowercases', () => {
      const r = validationService.validate({ f: 'ABC' }, [{ fieldName: 'f', rules: [], sanitize: [{ type: 'lowercase' }] }])
      expect(r.sanitizedData.f).toBe('abc')
    })
    it('uppercases', () => {
      const r = validationService.validate({ f: 'abc' }, [{ fieldName: 'f', rules: [], sanitize: [{ type: 'uppercase' }] }])
      expect(r.sanitizedData.f).toBe('ABC')
    })
    it('strips HTML', () => {
      const r = validationService.validate({ f: '<b>hi</b>' }, [{ fieldName: 'f', rules: [], sanitize: [{ type: 'stripHtml' }] }])
      expect(r.sanitizedData.f).toBe('hi')
    })
    it('escapes HTML', () => {
      const r = validationService.validate({ f: '<script>' }, [{ fieldName: 'f', rules: [], sanitize: [{ type: 'escapeHtml' }] }])
      expect(String(r.sanitizedData.f)).toContain('&lt;')
    })
    it('normalizes phone', () => {
      const r = validationService.validate({ f: '+7 (999) 123-45-67' }, [{ fieldName: 'f', rules: [], sanitize: [{ type: 'normalizePhone' }] }])
      expect(r.sanitizedData.f).toBe('+79991234567')
    })
    it('handles null', () => {
      const r = validationService.validate({ f: null }, [{ fieldName: 'f', rules: [], sanitize: [{ type: 'trim' }] }])
      expect(r.sanitizedData.f).toBeNull()
    })
    it('chains multiple rules', () => {
      const r = validationService.validate({ f: '  ABC  ' }, [{ fieldName: 'f', rules: [], sanitize: [{ type: 'trim' }, { type: 'lowercase' }] }])
      expect(r.sanitizedData.f).toBe('abc')
    })
  })
  describe('multi-field validation', () => {
    it('aggregates errors', () => {
      const r = validationService.validate({}, [
        { fieldName: 'a', rules: [{ type: 'required' }] },
        { fieldName: 'b', rules: [{ type: 'required' }] },
      ])
      expect(r.isValid).toBe(false)
      expect(Object.keys(r.errors).length).toBe(2)
    })
    it('passes all valid', () => {
      const r = validationService.validate({ a: '1', b: '2' }, [
        { fieldName: 'a', rules: [{ type: 'required' }] },
        { fieldName: 'b', rules: [{ type: 'required' }] },
      ])
      expect(r.isValid).toBe(true)
    })
  })
  describe('helper methods', () => {
    it('getErrorFieldNames', () => {
      const r = validationService.validate({}, [{ fieldName: 'a', rules: [{ type: 'required' }] }, { fieldName: 'b', rules: [] }])
      expect(validationService.getErrorFieldNames(r)).toEqual(['a'])
    })
    it('formatErrorResponse', () => {
      const r = validationService.validate({}, [{ fieldName: 'name', rules: [{ type: 'required' }] }])
      const fmt = validationService.formatErrorResponse(r)
      expect(fmt.message).toBeDefined()
      expect(fmt.errors.name).toBeDefined()
      expect(fmt.fields).toContain('name')
    })
  })
  describe('conditional rules', () => {
    it('applies when condition true', () => {
      const r = validationService.validate({ type: 'email', value: 'bad' }, [{
        fieldName: 'value',
        rules: [{ type: 'email', condition: 'type == "email"' }]
      }])
      expect(r.isValid).toBe(false)
    })
    it('skips when condition false', () => {
      const r = validationService.validate({ type: 'text', value: 'not-email' }, [{
        fieldName: 'value',
        rules: [{ type: 'email', condition: 'type == "email"' }]
      }])
      expect(r.isValid).toBe(true)
    })
  })
})