// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

vi.mock('@/shared/api', () => ({
  deployApi: { deployPage: vi.fn(), unpublishPage: vi.fn() },
}))

import { deployApi } from '@/shared/api'
import { PublishToggle } from './PublishToggle'

const page = (status: 'draft' | 'published' | 'archived') => ({
  id: 'p1',
  name: 'Harizma',
  slug: 'harizma',
  status,
})

describe('PublishToggle', () => {
  beforeEach(() => {
    vi.mocked(deployApi.deployPage).mockReset().mockResolvedValue({} as never)
    vi.mocked(deployApi.unpublishPage).mockReset().mockResolvedValue({} as never)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(window, 'alert').mockImplementation(() => undefined)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('опубликованная: кнопка снимает и сообщает о смене', async () => {
    const onChanged = vi.fn()
    render(<PublishToggle page={page('published')} onChanged={onChanged} />)
    fireEvent.click(screen.getByTitle('Снять с публикации'))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(deployApi.unpublishPage).toHaveBeenCalledWith('p1')
    expect(deployApi.deployPage).not.toHaveBeenCalled()
  })

  it('черновик: кнопка публикует', async () => {
    const onChanged = vi.fn()
    render(<PublishToggle page={page('draft')} onChanged={onChanged} />)
    fireEvent.click(screen.getByTitle('Опубликовать'))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(deployApi.deployPage).toHaveBeenCalledWith('p1')
  })

  it('отказ в подтверждении — ничего не происходит', () => {
    vi.mocked(window.confirm).mockReturnValue(false)
    const onChanged = vi.fn()
    render(<PublishToggle page={page('published')} onChanged={onChanged} />)
    fireEvent.click(screen.getByTitle('Снять с публикации'))
    expect(deployApi.unpublishPage).not.toHaveBeenCalled()
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('ошибка сервера (например, «главную снять нельзя») показывается, список не перезагружается', async () => {
    vi.mocked(deployApi.unpublishPage).mockRejectedValue(new Error('Главную страницу сайта снять нельзя'))
    const onChanged = vi.fn()
    render(<PublishToggle page={page('published')} onChanged={onChanged} />)
    fireEvent.click(screen.getByTitle('Снять с публикации'))
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Главную страницу сайта снять нельзя'))
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('в подтверждении снятия — адрес и предупреждение про все языки', () => {
    render(<PublishToggle page={page('published')} onChanged={vi.fn()} />)
    fireEvent.click(screen.getByTitle('Снять с публикации'))
    const question = vi.mocked(window.confirm).mock.calls[0][0] as string
    expect(question).toContain('/harizma')
    expect(question).toContain('на всех языках')
  })
})
