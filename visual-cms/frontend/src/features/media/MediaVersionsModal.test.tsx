// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react'
import type { MediaAsset } from '@/shared/api/mediaApi'
import { MediaVersionsModal } from './MediaVersionsModal'

const asset: MediaAsset = {
  id: 'a1',
  siteId: null,
  kind: 'image',
  fileName: 'photo.jpg',
  mimeType: 'image/jpeg',
  url: '/media/u.jpg',
  posterUrl: null,
  thumbnailUrl: null,
  optimizedUrl: '/media/u.opt.webp',
  optimizedSizeBytes: 300_000,
  variants: [
    { width: 768, height: 384, url: '/media/u.w768.webp', sizeBytes: 40_000 },
    { width: 1920, height: 960, url: '/media/u.w1920.webp', sizeBytes: 150_000 },
  ],
  folderId: null,
  sizeBytes: 6_000_000,
  width: 3840,
  height: 1920,
  durationSec: null,
  title: 'Фасад',
  alt: null,
  tags: [],
  createdAt: '2026-11-13T00:00:00Z',
  updatedAt: '2026-11-13T00:00:00Z',
}

afterEach(cleanup)

describe('MediaVersionsModal — окно «Размеры»', () => {
  it('закрыто, пока файл не выбран', () => {
    render(<MediaVersionsModal asset={null} onClose={() => {}} onCopy={async () => true} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('показывает оригинал, сжатую версию и каждый размер с весом и экономией', () => {
    render(<MediaVersionsModal asset={asset} onClose={() => {}} onCopy={async () => true} />)
    const rows = within(screen.getByRole('dialog')).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(4)

    expect(rows[0].textContent).toContain('Оригинал')
    expect(rows[0].textContent).toContain('3840 × 1920')
    expect(rows[0].textContent).toContain('5,7 МБ')
    expect(rows[0].textContent).not.toContain('%')

    expect(rows[1].textContent).toContain('Сжатая, полный размер')
    expect(rows[1].textContent).toContain('293 КБ')
    expect(rows[1].textContent).toContain('−95%')

    expect(rows[2].textContent).toContain('1920 px')
    expect(rows[2].textContent).toContain('1920 × 960')
    expect(rows[3].textContent).toContain('768 px')
    expect(rows[3].textContent).toContain('39 КБ')
    expect(screen.getByText('Фасад')).toBeTruthy()
  })

  it('у каждой версии ссылка «Открыть» на свой файл', () => {
    render(<MediaVersionsModal asset={asset} onClose={() => {}} onCopy={async () => true} />)
    const link = screen.getByLabelText('Открыть: 768 px') as HTMLAnchorElement
    expect(link.getAttribute('href')).toContain('/media/u.w768.webp')
    expect(link.getAttribute('target')).toBe('_blank')
  })

  it('копирует ссылку именно этой версии', async () => {
    const onCopy = vi.fn(async (_text: string) => true)
    render(<MediaVersionsModal asset={asset} onClose={() => {}} onCopy={onCopy} />)
    fireEvent.click(screen.getByLabelText('Копировать ссылку: 1920 px'))
    await waitFor(() => expect(onCopy).toHaveBeenCalledTimes(1))
    expect(onCopy.mock.calls[0][0]).toContain('/media/u.w1920.webp')
  })

  it('кнопка «Закрыть» закрывает окно', () => {
    const onClose = vi.fn()
    render(<MediaVersionsModal asset={asset} onClose={onClose} onCopy={async () => true} />)
    fireEvent.click(screen.getByLabelText('Закрыть'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('файл без производных — одна строка оригинала', () => {
    render(
      <MediaVersionsModal
        asset={{ ...asset, optimizedUrl: null, optimizedSizeBytes: null, variants: [] }}
        onClose={() => {}}
        onCopy={async () => true}
      />,
    )
    expect(within(screen.getByRole('dialog')).getAllByRole('row').slice(1)).toHaveLength(1)
  })
})
