import { describe, it, expect } from 'vitest'
import { compileMediaForWidth } from './compileCanvasMedia'

describe('compileMediaForWidth', () => {
  it('max-width: разворачивает при совпадении, выкидывает при несовпадении', () => {
    const css = '@media (max-width: 1180px) { .menu { display: none } .burger { display: inline-flex } }'
    // 320 ≤ 1180 → разворачиваем (без обёртки)
    const at320 = compileMediaForWidth(css, 320)
    expect(at320).not.toContain('@media')
    expect(at320).toContain('.menu { display: none }')
    expect(at320).toContain('.burger { display: inline-flex }')
    // 1440 > 1180 → блок выкидывается
    expect(compileMediaForWidth(css, 1440).trim()).toBe('')
  })

  it('min-width работает зеркально', () => {
    const css = '@media (min-width: 768px) { .a { color: red } }'
    expect(compileMediaForWidth(css, 320).trim()).toBe('')
    expect(compileMediaForWidth(css, 1024)).toContain('.a { color: red }')
  })

  it('диапазон min и max через and', () => {
    const css = '@media (min-width: 768px) and (max-width: 1180px) { .a { x: y } }'
    expect(compileMediaForWidth(css, 900)).toContain('.a { x: y }')
    expect(compileMediaForWidth(css, 320).trim()).toBe('')
    expect(compileMediaForWidth(css, 1440).trim()).toBe('')
  })

  it('media-type (screen and …) не мешает вычислению', () => {
    const css = '@media screen and (max-width: 600px) { .a { x: y } }'
    expect(compileMediaForWidth(css, 320)).toContain('.a { x: y }')
    expect(compileMediaForWidth(css, 800).trim()).toBe('')
  })

  it('не-размерные запросы остаются как есть', () => {
    const css = '@media (prefers-reduced-motion: reduce) { .a { animation: none } }'
    expect(compileMediaForWidth(css, 320)).toBe(css)
    const orient = '@media (orientation: portrait) { .a { x: y } }'
    expect(compileMediaForWidth(orient, 320)).toBe(orient)
  })

  it('em/rem и прочие единицы не трогаем (оставляем запрос)', () => {
    const css = '@media (max-width: 40em) { .a { x: y } }'
    expect(compileMediaForWidth(css, 320)).toBe(css)
  })

  it('окружающий CSS сохраняется, вложенные скобки тела балансируются', () => {
    const css = '.x { a: b } @media (max-width: 100px) { .y { c: d } } .z { e: f }'
    const at320 = compileMediaForWidth(css, 320)
    // .y выкидывается (320 > 100), .x и .z сохраняются
    expect(at320).toContain('.x { a: b }')
    expect(at320).toContain('.z { e: f }')
    expect(at320).not.toContain('.y')
    expect(at320).not.toContain('@media')

    const nested = '@media (max-width: 1180px) { .g { display: grid } .h:hover { color: red } }'
    const compiled = compileMediaForWidth(nested, 320)
    expect(compiled).toContain('.g { display: grid }')
    expect(compiled).toContain('.h:hover { color: red }')
  })

  it('несколько @media подряд обрабатываются независимо', () => {
    const css =
      '@media (max-width: 1180px) { .a { x: 1 } }' +
      '@media (min-width: 1181px) { .b { x: 2 } }'
    const at320 = compileMediaForWidth(css, 320)
    expect(at320).toContain('.a { x: 1 }')
    expect(at320).not.toContain('.b')
  })

  it('без @media / нулевая ширина — строка возвращается как есть', () => {
    expect(compileMediaForWidth('.a { x: y }', 320)).toBe('.a { x: y }')
    const css = '@media (max-width: 100px) { .a { x: y } }'
    expect(compileMediaForWidth(css, 0)).toBe(css)
  })
})
