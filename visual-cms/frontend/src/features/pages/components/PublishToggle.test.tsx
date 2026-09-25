// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

vi.mock('@/shared/api', async (importOriginal) => ({
  // slugOccupiedDetails — настоящий: он разбирает ответ сервера на 409.
  ...(await importOriginal<typeof import('@/shared/api')>()),
  deployApi: { deployPage: vi.fn(), unpublishPage: vi.fn() },
}))

import { deployApi } from '@/shared/api'
import { ApiError } from '@/shared/api/http'
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

  describe('варианты страницы: адрес занят опубликованным', () => {
    const occupied = (name: string) =>
      new ApiError('Адрес занят', 409, { details: { code: 'SLUG_OCCUPIED', occupant: { id: 'p0', name } } })

    it('занявший известен: «Сделать основным» спрашивает про замену и публикует с replace', async () => {
      const onChanged = vi.fn()
      render(<PublishToggle page={page('draft')} occupant={{ name: 'Harizma — старая' }} onChanged={onChanged} />)
      fireEvent.click(screen.getByTitle('Сделать основным вместо «Harizma — старая»'))
      await waitFor(() => expect(onChanged).toHaveBeenCalled())
      const question = vi.mocked(window.confirm).mock.calls[0][0] as string
      expect(question).toContain('/harizma')
      expect(question).toContain('«Harizma — старая» станет черновиком')
      expect(deployApi.deployPage).toHaveBeenCalledTimes(1)
      expect(deployApi.deployPage).toHaveBeenCalledWith('p1', { replace: true })
    })

    it('список устарел: сервер отвечает 409 — после подтверждения публикует с заменой', async () => {
      vi.mocked(deployApi.deployPage).mockRejectedValueOnce(occupied('Harizma — старая'))
      const onChanged = vi.fn()
      render(<PublishToggle page={page('draft')} onChanged={onChanged} />)
      fireEvent.click(screen.getByTitle('Опубликовать'))
      await waitFor(() => expect(onChanged).toHaveBeenCalled())
      expect(vi.mocked(deployApi.deployPage).mock.calls).toEqual([['p1'], ['p1', { replace: true }]])
      expect(vi.mocked(window.confirm).mock.calls[1][0]).toContain('«Harizma — старая»')
      expect(window.alert).not.toHaveBeenCalled()
    })

    it('от замены отказались — ничего не меняется и ошибки не показываем', async () => {
      vi.mocked(deployApi.deployPage).mockRejectedValueOnce(occupied('A'))
      vi.mocked(window.confirm).mockReturnValueOnce(true).mockReturnValueOnce(false)
      const onChanged = vi.fn()
      render(<PublishToggle page={page('draft')} onChanged={onChanged} />)
      fireEvent.click(screen.getByTitle('Опубликовать'))
      await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(2))
      expect(deployApi.deployPage).toHaveBeenCalledTimes(1)
      expect(onChanged).not.toHaveBeenCalled()
      expect(window.alert).not.toHaveBeenCalled()
    })

    it('другая ошибка публикации — показывается как есть', async () => {
      vi.mocked(deployApi.deployPage).mockRejectedValueOnce(new ApiError('Ошибка при публикации', 400))
      render(<PublishToggle page={page('draft')} onChanged={vi.fn()} />)
      fireEvent.click(screen.getByTitle('Опубликовать'))
      await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Ошибка при публикации'))
    })
  })
})
