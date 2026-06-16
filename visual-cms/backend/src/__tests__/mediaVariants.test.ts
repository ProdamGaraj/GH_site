import { buildVariantPlan, parseVariantWidths } from '../services/mediaVariants'

describe('mediaVariants', () => {
  describe('buildVariantPlan', () => {
    it('dedupes, sorts desc, and drops widths >= original (no upscaling)', () => {
      const plan = buildVariantPlan(1600, [768, 1280, 1280, 1920, 2560])
      expect(plan).toEqual([1280, 768]) // 1920/2560 >= 1600 отброшены
    })

    it('keeps all widths when original width is unknown', () => {
      const plan = buildVariantPlan(null, [1920, 1280, 768])
      expect(plan).toEqual([1920, 1280, 768])
    })

    it('drops too-small and non-finite widths', () => {
      const plan = buildVariantPlan(4000, [10, 0, -5, NaN as unknown as number, 768])
      expect(plan).toEqual([768]) // 10 < minWidth(16), 0/-5/NaN отброшены
    })

    it('caps to maxVariants (largest first)', () => {
      const plan = buildVariantPlan(5000, [3840, 2560, 1920, 1600, 1440, 1366, 1280, 768], {
        maxVariants: 3,
      })
      expect(plan).toEqual([3840, 2560, 1920])
    })

    it('returns empty when nothing qualifies', () => {
      expect(buildVariantPlan(500, [768, 1920])).toEqual([])
      expect(buildVariantPlan(1600, [])).toEqual([])
    })
  })

  describe('parseVariantWidths', () => {
    it('parses CSV string', () => {
      expect(parseVariantWidths('1920,1280, 768')).toEqual([1920, 1280, 768])
    })

    it('parses array of strings/numbers', () => {
      expect(parseVariantWidths(['1920', 1280])).toEqual([1920, 1280])
    })

    it('drops invalid entries', () => {
      expect(parseVariantWidths('1920,abc,,0,-5')).toEqual([1920])
    })

    it('returns empty for null/undefined', () => {
      expect(parseVariantWidths(null)).toEqual([])
      expect(parseVariantWidths(undefined)).toEqual([])
    })
  })
})
