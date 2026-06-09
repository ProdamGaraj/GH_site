import {
  detectKind,
  extFromMime,
  validateSize,
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

    it('throws ValidationError on unsupported mime', () => {
      expect(() => detectKind('application/x-msdownload')).toThrow(ValidationError)
      expect(() => detectKind('text/html')).toThrow(ValidationError)
      expect(() => detectKind('')).toThrow(ValidationError)
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

    it('rejects documents above 50 MB', () => {
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
})
