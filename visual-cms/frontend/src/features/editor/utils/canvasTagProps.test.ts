import { describe, it, expect, vi } from 'vitest'
import { canvasTagProps } from './canvasTagProps'

const node = (tagName: string, attributes: Record<string, string> = {}, content = '') => ({ tagName, attributes, content })

describe('canvasTagProps — атрибуты как на сайте', () => {
  it('кнопка: type с узла; нет type — нет и атрибута (button[type="submit"] её не ловит, как на сайте)', () => {
    expect(canvasTagProps(node('button', { type: 'submit', class: 'submit' }))).toEqual({ type: 'submit' })
    expect(canvasTagProps(node('button'))).toEqual({})
  })

  it('поле: type с узла; нет type — не выдумываем «text»', () => {
    expect(canvasTagProps(node('input', { type: 'tel', placeholder: '+998' }))).toEqual({
      type: 'tel',
      placeholder: '+998',
      value: '',
      readOnly: true,
    })
    expect(canvasTagProps(node('input', { placeholder: 'Сумма' }))).not.toHaveProperty('type')
  })

  it('форма в канвасе не отправляется — клик по кнопке не перезагружает редактор', () => {
    const { onSubmit } = canvasTagProps(node('form', { class: 'lead-form' })) as { onSubmit: (e: unknown) => void }
    const event = { preventDefault: vi.fn() }
    onSubmit(event)
    expect(event.preventDefault).toHaveBeenCalled()
  })

  it('текстовое поле, список, вариант — только чтение, значение из узла', () => {
    expect(canvasTagProps(node('textarea', { placeholder: 'Комментарий' }, 'текст'))).toEqual({
      placeholder: 'Комментарий',
      value: 'текст',
      readOnly: true,
    })
    expect(canvasTagProps(node('select', { value: 'a' }))).toMatchObject({ value: 'a' })
    expect(canvasTagProps(node('option', {}, '{{item.name}}'))).toEqual({ value: '{{item.name}}' })
  })

  it('картинка и видео — как раньше', () => {
    expect(canvasTagProps(node('img', { src: '/m.jpg', alt: 'A' }))).toEqual({ src: '/m.jpg', alt: 'A' })
    expect(canvasTagProps(node('video', { src: '/v.mp4', loop: '' }))).toMatchObject({
      src: '/v.mp4',
      loop: true,
      controls: false,
      muted: true,
      autoPlay: false,
    })
  })

  it('прочие теги — ничего', () => {
    expect(canvasTagProps(node('div', { class: 'x', 'data-panel': 'area' }))).toEqual({})
  })
})
