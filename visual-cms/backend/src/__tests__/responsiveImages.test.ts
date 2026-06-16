import { injectResponsiveImages, extractMediaIds, type ResponsiveVariant } from '../services/responsiveImages'

const ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const ID2 = '11111111-2222-3333-4444-555555555555'

function mapOf(entries: Record<string, ResponsiveVariant[]>): Map<string, ResponsiveVariant[]> {
  return new Map(Object.entries(entries))
}

describe('responsiveImages', () => {
  describe('injectResponsiveImages', () => {
    it('injects srcset + sizes for a known /media/<uuid> image', () => {
      const html = `<img src="/media/${ID}.webp" data-element-id="x" />`
      const out = injectResponsiveImages(
        html,
        mapOf({
          [ID]: [
            { width: 1280, storageKey: `${ID}.w1280.webp` },
            { width: 768, storageKey: `${ID}.w768.webp` },
          ],
        }),
      )
      expect(out).toContain(`srcset="/media/${ID}.w1280.webp 1280w, /media/${ID}.w768.webp 768w"`)
      expect(out).toContain('sizes="100vw"')
      // оригинальный src сохраняется как fallback
      expect(out).toContain(`src="/media/${ID}.webp"`)
    })

    it('preserves an absolute origin prefix from the original src', () => {
      const html = `<img src="https://cdn.example.com/media/${ID}.jpg" />`
      const out = injectResponsiveImages(html, mapOf({
        [ID]: [{ width: 1920, storageKey: `${ID}.w1920.webp` }],
      }))
      expect(out).toContain(`srcset="https://cdn.example.com/media/${ID}.w1920.webp 1920w"`)
    })

    it('sorts variants by width descending regardless of input order', () => {
      const html = `<img src="/media/${ID}.png" />`
      const out = injectResponsiveImages(html, mapOf({
        [ID]: [
          { width: 768, storageKey: `${ID}.w768.webp` },
          { width: 1920, storageKey: `${ID}.w1920.webp` },
          { width: 1280, storageKey: `${ID}.w1280.webp` },
        ],
      }))
      expect(out).toContain(`srcset="/media/${ID}.w1920.webp 1920w, /media/${ID}.w1280.webp 1280w, /media/${ID}.w768.webp 768w"`)
    })

    it('does not override an existing srcset', () => {
      const html = `<img src="/media/${ID}.webp" srcset="custom 1x" />`
      const out = injectResponsiveImages(html, mapOf({
        [ID]: [{ width: 1280, storageKey: `${ID}.w1280.webp` }],
      }))
      expect(out).toBe(html)
    })

    it('keeps an existing sizes attribute', () => {
      const html = `<img src="/media/${ID}.webp" sizes="50vw" />`
      const out = injectResponsiveImages(html, mapOf({
        [ID]: [{ width: 1280, storageKey: `${ID}.w1280.webp` }],
      }))
      expect(out).toContain('sizes="50vw"')
      expect(out).not.toContain('sizes="100vw"')
    })

    it('leaves images with no variants untouched', () => {
      const html = `<img src="/media/${ID}.webp" />`
      const out = injectResponsiveImages(html, mapOf({ [ID2]: [{ width: 1280, storageKey: 'x' }] }))
      expect(out).toBe(html)
    })

    it('leaves non-media images untouched', () => {
      const html = `<img src="https://example.com/photo.jpg" />`
      const out = injectResponsiveImages(html, mapOf({ [ID]: [{ width: 1280, storageKey: 'x' }] }))
      expect(out).toBe(html)
    })

    it('handles multiple images in one document', () => {
      const html = `<img src="/media/${ID}.webp" /><div></div><img src="/media/${ID2}.jpg" />`
      const out = injectResponsiveImages(html, mapOf({
        [ID]: [{ width: 1280, storageKey: `${ID}.w1280.webp` }],
        [ID2]: [{ width: 768, storageKey: `${ID2}.w768.webp` }],
      }))
      expect(out).toContain(`/media/${ID}.w1280.webp 1280w`)
      expect(out).toContain(`/media/${ID2}.w768.webp 768w`)
    })

    it('is a no-op when the variant map is empty', () => {
      const html = `<img src="/media/${ID}.webp" />`
      expect(injectResponsiveImages(html, new Map())).toBe(html)
    })

    it('supports a custom defaultSizes option', () => {
      const html = `<img src="/media/${ID}.webp" />`
      const out = injectResponsiveImages(
        html,
        mapOf({ [ID]: [{ width: 1280, storageKey: `${ID}.w1280.webp` }] }),
        { defaultSizes: '(max-width: 768px) 100vw, 50vw' },
      )
      expect(out).toContain('sizes="(max-width: 768px) 100vw, 50vw"')
    })
  })

  describe('extractMediaIds', () => {
    it('extracts unique lowercased ids', () => {
      const html = `<img src="/media/${ID}.webp"><img src="/media/${ID}.png"><img src="/media/${ID2}.jpg">`
      expect(extractMediaIds(html).sort()).toEqual([ID2, ID].sort())
    })

    it('returns empty for html without media refs', () => {
      expect(extractMediaIds('<div>hi</div>')).toEqual([])
      expect(extractMediaIds('')).toEqual([])
    })
  })
})
