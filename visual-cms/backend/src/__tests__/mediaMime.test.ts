import {
  detectKind,
  extFromMime,
  validateSize,
  isInlineSafe,
  buildContentDisposition,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  MAX_DOCUMENT_BYTES,
} from '../services/mediaMime'
import { ValidationError } from '../middleware/errorHandler'

describe('mediaMime', () => {
  describe('detectKind', () => {
    it('classifies images', () => {
      expect(detectKind('image/jpeg')).toBe('image')
      expect(detectKind('image/png')).toBe('image')
      expect(detectKind('image/svg+xml')).toBe('image')
      expect(detectKind('image/avif')).toBe('image')
    })

    it('classifies videos', () => {
      expect(detectKind('video/mp4')).toBe('video')
      expect(detectKind('video/webm')).toBe('video')
      expect(detectKind('video/quicktime')).toBe('video')
    })

    it('classifies PDF as document', () => {
      expect(detectKind('application/pdf')).toBe('document')
    })

    it('classifies office formats as document', () => {
      expect(detectKind('application/msword')).toBe('document')
      expect(
        detectKind(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ),
      ).toBe('document')
      expect(detectKind('application/vnd.ms-excel')).toBe('document')
      expect(
        detectKind(
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ),
      ).toBe('document')
      expect(detectKind('application/vnd.ms-powerpoint')).toBe('document')
      expect(
        detectKind(
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ),
      ).toBe('document')
    })

    it('classifies any other / unknown mime as document (catch-all)', () => {
      expect(detectKind('application/zip')).toBe('document')
      expect(detectKind('application/x-msdownload')).toBe('document')
      expect(detectKind('text/plain')).toBe('document')
      expect(detectKind('text/csv')).toBe('document')
      expect(detectKind('application/octet-stream')).toBe('document')
      expect(detectKind('')).toBe('document')
    })
  })

  describe('extFromMime', () => {
    it('maps known document mimes to extensions', () => {
      expect(extFromMime('application/pdf', 'bin')).toBe('pdf')
      expect(
        extFromMime(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'bin',
        ),
      ).toBe('docx')
      expect(
        extFromMime(
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'bin',
        ),
      ).toBe('xlsx')
      expect(
        extFromMime(
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'bin',
        ),
      ).toBe('pptx')
    })

    it('maps known image/video mimes (no regression)', () => {
      expect(extFromMime('image/jpeg', 'bin')).toBe('jpg')
      expect(extFromMime('video/mp4', 'bin')).toBe('mp4')
    })

    it('falls back for unknown mime', () => {
      expect(extFromMime('application/unknown', 'dat')).toBe('dat')
    })
  })

  describe('validateSize', () => {
    it('accepts files within the per-kind limit', () => {
      expect(() => validateSize('image', MAX_IMAGE_BYTES)).not.toThrow()
      expect(() => validateSize('video', MAX_VIDEO_BYTES)).not.toThrow()
      expect(() => validateSize('document', MAX_DOCUMENT_BYTES)).not.toThrow()
    })

    it('rejects documents above the catch-all limit', () => {
      expect(() => validateSize('document', MAX_DOCUMENT_BYTES + 1)).toThrow(
        ValidationError,
      )
    })

    it('rejects images above 10 MB and videos above 200 MB', () => {
      expect(() => validateSize('image', MAX_IMAGE_BYTES + 1)).toThrow(
        ValidationError,
      )
      expect(() => validateSize('video', MAX_VIDEO_BYTES + 1)).toThrow(
        ValidationError,
      )
    })
  })

  describe('isInlineSafe', () => {
    it('treats raster images and videos as inline-safe', () => {
      expect(isInlineSafe('image/jpeg')).toBe(true)
      expect(isInlineSafe('image/png')).toBe(true)
      expect(isInlineSafe('image/webp')).toBe(true)
      expect(isInlineSafe('video/mp4')).toBe(true)
    })

    it('treats SVG as NOT inline-safe (can execute scripts)', () => {
      expect(isInlineSafe('image/svg+xml')).toBe(false)
    })

    it('treats PDF, office and arbitrary files as NOT inline-safe', () => {
      expect(isInlineSafe('application/pdf')).toBe(false)
      expect(
        isInlineSafe(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ),
      ).toBe(false)
      expect(isInlineSafe('application/zip')).toBe(false)
      expect(isInlineSafe('text/html')).toBe(false)
      expect(isInlineSafe('')).toBe(false)
    })
  })

  describe('buildContentDisposition', () => {
    it('always produces an attachment header', () => {
      expect(buildContentDisposition('report.pdf')).toMatch(/^attachment;/)
    })

    it('keeps ASCII filename in the quoted fallback', () => {
      expect(buildContentDisposition('report.pdf')).toContain(
        'filename="report.pdf"',
      )
    })

    it('encodes non-ASCII (Cyrillic) names via RFC 5987 filename*', () => {
      const out = buildContentDisposition('отчёт.pdf')
      expect(out).toContain("filename*=UTF-8''")
      expect(out).toContain('%D0%BE') // 'о' encoded
      // ASCII fallback replaces non-ASCII with '_'
      expect(out).toMatch(/filename="_+\.pdf"/)
    })

    it('strips CR/LF to prevent header injection', () => {
      const out = buildContentDisposition('a\r\nSet-Cookie: x=1.pdf')
      expect(out).not.toContain('\r')
      expect(out).not.toContain('\n')
    })

    it('falls back to "download" for empty/whitespace names', () => {
      expect(buildContentDisposition('')).toContain('filename="download"')
      expect(buildContentDisposition('   ')).toContain('filename="download"')
    })
  })
})
