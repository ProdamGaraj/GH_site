// @vitest-environment jsdom
import { useEffect, useState } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'

vi.mock('@/features/media/MediaPicker', () => ({
  MediaPicker: ({ open, onSelect }: any) =>
    open ? (
      <button type="button" onClick={() => onSelect({ url: '/media/picked.jpg' })}>
        выбрать
      </button>
    ) : null,
}))
vi.mock('@/features/media/useProjectVariantWidths', () => ({ useProjectVariantWidths: () => [] }))

import { SiteCardSection } from './SiteCardSection'
import type { ComplexDetail, Locale } from '../types'

function complex(extra: Partial<ComplexDetail> = {}): ComplexDetail {
  return {
    id: 'c1',
    translations: {},
    showOnSite: false,
    filterClass: 'business',
    cardImage: '',
    cardTags: ['Рассрочка', 'Ипотека'],
    ...extra,
  } as unknown as ComplexDetail
}

/** Раздел с настоящим состоянием формы; последняя версия — в form.current. */
function setup(initial: ComplexDetail, locale: Locale = 'ru') {
  const form: { current: ComplexDetail } = { current: initial }
  const Harness = () => {
    const [state, setState] = useState(initial)
    useEffect(() => {
      form.current = state
    }, [state])
    return <SiteCardSection form={state} setForm={setState} locale={locale} />
  }
  render(<Harness />)
  return form
}

const section = () => within(screen.getByTestId('site-card'))

describe('SiteCardSection — ru', () => {
  afterEach(() => cleanup())

  it('галочка «Показывать на сайте» уходит в форму', () => {
    const form = setup(complex())
    fireEvent.click(section().getByLabelText(/Показывать на сайте/))
    expect(form.current.showOnSite).toBe(true)
  })

  it('класс для фильтра — из трёх ключей кнопок фильтра на главной', () => {
    const form = setup(complex())
    const select = section().getByDisplayValue('Бизнес') as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['comfort', 'business', 'premium'])
    fireEvent.change(select, { target: { value: 'comfort' } })
    expect(form.current.filterClass).toBe('comfort')
  })

  it('«На главной»: одной карточкой проекта (по умолчанию) или карточками домов', () => {
    const form = setup(complex())
    const select = section().getByDisplayValue('Одной карточкой проекта') as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['project', 'houses'])
    fireEvent.change(select, { target: { value: 'houses' } })
    expect(form.current.catalogMode).toBe('houses')
  })

  it('картинка и теги карточки', () => {
    const form = setup(complex())
    fireEvent.change(section().getByLabelText('Картинка карточки'), { target: { value: '/media/card.jpg' } })
    expect(form.current.cardImage).toBe('/media/card.jpg')
    const tags = section().getByDisplayValue(/Рассрочка/)
    fireEvent.change(tags, { target: { value: 'Скидка\n\n Ипотека ' } })
    expect(form.current.cardTags).toEqual(['Скидка', 'Ипотека'])
  })
})

describe('SiteCardSection — перевод (uz)', () => {
  afterEach(() => cleanup())

  it('на uz — только теги: галочки и класса нет, ru-теги подсказкой', () => {
    setup(complex(), 'uz')
    expect(section().queryByLabelText(/Показывать на сайте/)).toBeNull()
    expect(section().queryByDisplayValue('Бизнес')).toBeNull()
    expect(section().getByText(/ru: Рассрочка, Ипотека/)).toBeTruthy()
  })

  it('перевод тегов пишется в translations.uz, пустой — удаляется (на сайте ru)', () => {
    const form = setup(complex(), 'uz')
    const field = section().getByRole('textbox')
    fireEvent.change(field, { target: { value: 'Muddatli to‘lov\nIpoteka' } })
    expect((form.current.translations as any).uz.cardTags).toEqual(['Muddatli to‘lov', 'Ipoteka'])
    fireEvent.change(field, { target: { value: '' } })
    expect((form.current.translations as any).uz.cardTags).toBeUndefined()
  })
})

describe('SiteCardSection — картинка из медиатеки', () => {
  afterEach(() => cleanup())

  it('выбор в медиатеке пишет адрес в cardImage, миниатюра показывает его', () => {
    const form = setup(complex())
    fireEvent.click(section().getByRole('button', { name: /Медиатека/ }))
    fireEvent.click(screen.getByRole('button', { name: 'выбрать' }))
    expect(form.current.cardImage).toBe('/media/picked.jpg')
    expect(section().getByTestId('media-tile').querySelector('img')?.getAttribute('src')).toBe('/media/picked.jpg')
  })
})
