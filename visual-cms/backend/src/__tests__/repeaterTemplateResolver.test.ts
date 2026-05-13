/**
 * Тесты pure-функции findTemplateInContainer.
 * Главный кейс — bug fix: hybrid-static-слайд, оказавшийся первым в track,
 * не должен возвращаться как template repeater'а.
 */

import { findTemplateInContainer } from '../services/repeaterTemplateResolver'

const track = (children: any[], id = 'track-1') => ({ id, children })
const tpl = (id: string, extra: any = {}) => ({ id, ...extra })
const staticSlide = (id: string, extra: any = {}) => ({
  id,
  attributes: { 'data-carousel-static': 'true' },
  ...extra,
})

describe('findTemplateInContainer', () => {
  describe('linkedBlockId match', () => {
    it('возвращает id блока с совпавшим linkedBlockId', () => {
      const struct = track([
        tpl('child-1', { metadata: { linkedBlockId: 'lib-A' } }),
        tpl('child-2', { metadata: { linkedBlockId: 'lib-B' } }),
      ])
      expect(findTemplateInContainer(struct, 'track-1', 'lib-B')).toBe('child-2')
    })

    it('игнорирует hybrid-static даже если у него совпадает linkedBlockId', () => {
      const struct = track([
        staticSlide('static-1', { metadata: { linkedBlockId: 'lib-A' } }),
        tpl('child-2', { metadata: { linkedBlockId: 'lib-A' } }),
      ])
      expect(findTemplateInContainer(struct, 'track-1', 'lib-A')).toBe('child-2')
    })

    it('падает в fallback если linkedBlockId не найден', () => {
      const struct = track([tpl('child-1'), tpl('child-2')])
      expect(findTemplateInContainer(struct, 'track-1', 'lib-MISSING')).toBe('child-1')
    })
  })

  describe('isTemplate fallback', () => {
    it('берёт child с metadata.isTemplate=true', () => {
      const struct = track([
        tpl('child-1'),
        tpl('child-2', { metadata: { isTemplate: true } }),
      ])
      expect(findTemplateInContainer(struct, 'track-1')).toBe('child-2')
    })

    it('игнорирует hybrid-static с isTemplate=true (защита от data-corruption)', () => {
      const struct = track([
        staticSlide('static-1', { metadata: { isTemplate: true } }),
        tpl('child-2'),
      ])
      expect(findTemplateInContainer(struct, 'track-1')).toBe('child-2')
    })
  })

  describe('first non-static fallback (BUG FIX)', () => {
    it('возвращает первый non-static child когда нет ни linkedBlockId ни isTemplate', () => {
      const struct = track([tpl('child-1'), tpl('child-2')])
      expect(findTemplateInContainer(struct, 'track-1')).toBe('child-1')
    })

    it('🐛 BUG FIX: пропускает hybrid-static на первой позиции и берёт следующий template', () => {
      // Воспроизводит баг: пользователь перетащил static на первую позицию;
      // до фикса fallback возвращал id static'а → repeater клонировал static.
      const struct = track([
        staticSlide('static-hero'),
        tpl('template-real'),
      ])
      expect(findTemplateInContainer(struct, 'track-1')).toBe('template-real')
    })

    it('пропускает несколько hybrid-static подряд в начале', () => {
      const struct = track([
        staticSlide('static-1'),
        staticSlide('static-2'),
        tpl('template-real'),
        staticSlide('static-3'),
      ])
      expect(findTemplateInContainer(struct, 'track-1')).toBe('template-real')
    })

    it('возвращает null если все children — hybrid-static (нет template)', () => {
      const struct = track([staticSlide('static-1'), staticSlide('static-2')])
      expect(findTemplateInContainer(struct, 'track-1')).toBeNull()
    })
  })

  describe('container search', () => {
    it('находит контейнер вложенным в дерево', () => {
      const struct = {
        id: 'root',
        children: [
          { id: 'section', children: [track([tpl('child-1')], 'deep-track')] },
        ],
      }
      expect(findTemplateInContainer(struct, 'deep-track')).toBe('child-1')
    })

    it('возвращает null если контейнер не найден', () => {
      const struct = track([tpl('child-1')])
      expect(findTemplateInContainer(struct, 'unknown')).toBeNull()
    })

    it('возвращает null для null/undefined структуры', () => {
      expect(findTemplateInContainer(null, 'track-1')).toBeNull()
      expect(findTemplateInContainer(undefined, 'track-1')).toBeNull()
    })
  })

  describe('attribute value variations', () => {
    it('распознаёт data-carousel-static как boolean true', () => {
      const struct = track([
        { id: 'static-1', attributes: { 'data-carousel-static': true } },
        tpl('template-real'),
      ])
      expect(findTemplateInContainer(struct, 'track-1')).toBe('template-real')
    })

    it('игнорирует другие значения атрибута (false, "false", undefined)', () => {
      const struct = track([
        { id: 'child-1', attributes: { 'data-carousel-static': 'false' } },
        tpl('child-2'),
      ])
      // 'false' не считается static → берётся первый child
      expect(findTemplateInContainer(struct, 'track-1')).toBe('child-1')
    })
  })
})
