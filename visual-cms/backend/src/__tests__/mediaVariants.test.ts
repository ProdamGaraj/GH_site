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

    it('caps to maxVariants, spread from narrowest to widest', () => {
      const plan = buildVariantPlan(5000, [3840, 2560, 1920, 1600, 1440, 1366, 1280, 768], {
        maxVariants: 3,
      })
      // Крайние всегда, середина — ближайшая к √(768·3840) ≈ 1717.
      expect(plan).toEqual([3840, 1600, 768])
    })

    // Ширины стенда: мониторы + брейкпоинты проекта.
    const PROJECT_WIDTHS = [3840, 2560, 1920, 1728, 1600, 1512, 1440, 1366, 1280, 1024, 834, 820, 768, 480, 430, 393, 375]

    it('большое фото: есть и телефонные, и десктопные размеры (раньше — только 1512…3840)', () => {
      const plan = buildVariantPlan(7067, PROJECT_WIDTHS)
      expect(plan).toHaveLength(6)
      expect(plan[0]).toBe(3840)
      expect(plan[plan.length - 1]).toBe(375)
      // Для телефона (до ~430px при плотности 2) нужен размер около 768–1024.
      expect(plan.some((w) => w >= 768 && w <= 1024)).toBe(true)
      expect(plan).toEqual([...plan].sort((a, b) => b - a))
      expect(new Set(plan).size).toBe(plan.length)
    })

    it('фото 2000px: размеры от 375 до 1920', () => {
      const plan = buildVariantPlan(2000, PROJECT_WIDTHS)
      expect(plan).toHaveLength(6)
      expect(plan[0]).toBe(1920)
      expect(plan[plan.length - 1]).toBe(375)
    })

    it('ширин не больше лимита — берутся все', () => {
      expect(buildVariantPlan(800, PROJECT_WIDTHS)).toEqual([768, 480, 430, 393, 375])
      expect(buildVariantPlan(830, PROJECT_WIDTHS)).toEqual([820, 768, 480, 430, 393, 375])
    })

    it('maxVariants 1 — самая широкая; 2 — крайние', () => {
      expect(buildVariantPlan(5000, [3840, 1920, 768], { maxVariants: 1 })).toEqual([3840])
      expect(buildVariantPlan(5000, [3840, 1920, 768], { maxVariants: 2 })).toEqual([3840, 768])
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
