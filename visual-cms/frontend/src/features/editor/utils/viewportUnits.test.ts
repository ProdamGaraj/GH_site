import { describe, it, expect } from 'vitest'
import { convertViewportUnits } from './viewportUnits'

// Телефон на канвасе: 375 × 507 (монитор 667 − хром браузера 160).
const phone = { width: 375, height: 507 }

describe('convertViewportUnits', () => {
  it('vh и vw считаются от экрана канваса', () => {
    expect(convertViewportUnits('100vh', phone)).toBe('507px')
    expect(convertViewportUnits('50vw', phone)).toBe('187.5px')
  })

  it('svh / dvh / lvh и svw / dvw / lvw — как обычные (баг: секция 100svh была высотой с окно редактора)', () => {
    for (const unit of ['svh', 'dvh', 'lvh']) {
      expect(convertViewportUnits(`100${unit}`, phone)).toBe('507px')
    }
    for (const unit of ['svw', 'dvw', 'lvw']) {
      expect(convertViewportUnits(`100${unit}`, phone)).toBe('375px')
    }
  })

  it('vh и vw в одном значении пересчитываются оба (раньше vw терялся)', () => {
    expect(convertViewportUnits('calc(100vh - 2vw)', phone)).toBe('calc(507px - 7.5px)')
    expect(convertViewportUnits('calc(100svh - clamp(20px, 2.9vw, 36px))', phone)).toBe(
      'calc(507px - clamp(20px, 10.875px, 36px))',
    )
  })

  it('vmin / vmax — от меньшей и большей стороны', () => {
    expect(convertViewportUnits('10vmin', phone)).toBe('37.5px')
    expect(convertViewportUnits('10vmax', phone)).toBe('50.7px')
    expect(convertViewportUnits('10vmin', { width: 1440, height: 740 })).toBe('74px')
  })

  it('дробные и отрицательные значения, запись без ведущего нуля', () => {
    expect(convertViewportUnits('1.45vw', phone)).toBe('5.438px')
    expect(convertViewportUnits('.5vw', phone)).toBe('1.875px')
    expect(convertViewportUnits('-10vh', phone)).toBe('-50.7px')
    expect(convertViewportUnits('calc(100% - -4vw)', phone)).toBe('calc(100% - -15px)')
  })

  it('регистр единиц не важен', () => {
    expect(convertViewportUnits('100VH', phone)).toBe('507px')
    expect(convertViewportUnits('100SVH', phone)).toBe('507px')
  })

  it('высота неизвестна — единицы высоты и vmin/vmax остаются, vw пересчитывается', () => {
    expect(convertViewportUnits('calc(100vh - 2vw)', { width: 375 })).toBe('calc(100vh - 7.5px)')
    expect(convertViewportUnits('10vmin', { width: 375 })).toBe('10vmin')
  })

  it('имена, цвета и прочие строки с «vw»/«vh» не трогаются', () => {
    expect(convertViewportUnits('var(--gap-2vw)', phone)).toBe('var(--gap-2vw)')
    expect(convertViewportUnits('url("/media/hero-100vh.png")', phone)).toBe('url("/media/hero-100vh.png")')
    expect(convertViewportUnits('#12vh', phone)).toBe('#12vh')
    expect(convertViewportUnits('1.2.3vw', phone)).toBe('1.2.3vw')
    expect(convertViewportUnits('100vhx', phone)).toBe('100vhx')
  })

  it('значения без viewport-единиц возвращаются как есть', () => {
    expect(convertViewportUnits('100%', phone)).toBe('100%')
    expect(convertViewportUnits('clamp(16px, 2rem, 28px)', phone)).toBe('clamp(16px, 2rem, 28px)')
    expect(convertViewportUnits('', phone)).toBe('')
    expect(convertViewportUnits(42 as any, phone)).toBe(42)
  })

  it('ширина не задана — ничего не меняется', () => {
    expect(convertViewportUnits('100vh', { width: 0, height: 507 })).toBe('100vh')
  })

  it('целый CSS: правила подряд пересчитываются независимо', () => {
    const css = '.hero-stage { min-height: 100svh; padding: clamp(10px, 1.45vw, 18px); }\n.glass{min-height:calc(86svh - 16px)}'
    expect(convertViewportUnits(css, phone)).toBe(
      '.hero-stage { min-height: 507px; padding: clamp(10px, 5.438px, 18px); }\n.glass{min-height:calc(436.02px - 16px)}',
    )
  })

  it('повторный вызов даёт тот же результат (регулярка без состояния между вызовами)', () => {
    expect(convertViewportUnits('100vh', phone)).toBe('507px')
    expect(convertViewportUnits('100vh', phone)).toBe('507px')
  })
})
