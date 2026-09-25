// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

vi.mock('@/shared/api', () => ({
  pageApi: { createVariant: vi.fn() },
}))

import { pageApi } from '@/shared/api'
import { CreateVariantButton } from './CreateVariantButton'

describe('CreateVariantButton', () => {
  beforeEach(() => {
    vi.mocked(pageApi.createVariant).mockReset()
    vi.spyOn(window, 'alert').mockImplementation(() => undefined)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('создаёт вариант и отдаёт его наверх', async () => {
    const variant = { id: 'p2', name: 'Harizma — вариант 2', slug: 'harizma', status: 'draft' }
    vi.mocked(pageApi.createVariant).mockResolvedValue(variant as never)
    const onCreated = vi.fn()
    render(<CreateVariantButton page={{ id: 'p1', name: 'Harizma' }} onCreated={onCreated} />)
    fireEvent.click(screen.getByTitle('Создать вариант «Harizma» (черновик с тем же адресом)'))
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(variant))
    expect(pageApi.createVariant).toHaveBeenCalledWith('p1')
  })

  it('ошибка сервера показывается, наверх ничего не уходит', async () => {
    vi.mocked(pageApi.createVariant).mockRejectedValue(new Error('Страница не найдена'))
    const onCreated = vi.fn()
    render(<CreateVariantButton page={{ id: 'p1', name: 'Harizma' }} onCreated={onCreated} />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Страница не найдена'))
    expect(onCreated).not.toHaveBeenCalled()
  })
})
