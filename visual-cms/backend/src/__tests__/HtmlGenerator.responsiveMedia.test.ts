/**
 * Интеграция адаптивного медиа в generatePage:
 *  - <img> с брейкпоинтными оверрайдами → <picture> с <source media>, id на <img>;
 *  - <img> без оверрайдов → обычный <img> (анти-регресс);
 *  - фоновые @media из плана (backgroundImage делегирован резолверу);
 *  - приоритет «язык побеждает экран» через translationMap.
 */
import { htmlGenerator, GeneratePageOptions } from '../services/HtmlGenerator'
import type { BlockNode, BreakpointDef } from '../types/blockNode'

const BPS: BreakpointDef[] = [
  { id: 'tablet', name: 'Tablet', width: 768 },
  { id: 'mobile', name: 'Mobile', width: 375 },
]

function node(partial: Partial<BlockNode> = {}): BlockNode {
  return {
    id: partial.id ?? 'root',
    elementType: partial.elementType ?? 'container',
    tagName: partial.tagName ?? 'div',
    styles: partial.styles ?? { properties: {} },
    children: partial.children ?? [],
    attributes: partial.attributes ?? {},
    content: partial.content,
    metadata: partial.metadata ?? { breakpoints: BPS },
    variations: partial.variations,
  } as BlockNode
}

const opts = (o: Partial<GeneratePageOptions> = {}): GeneratePageOptions => ({
  metadata: { title: 'T', description: 'D', keywords: [] },
  slug: 'index',
  ...o,
})

function imgNode(): BlockNode {
  return node({ id: 'img-1', elementType: 'image', tagName: 'img', attributes: { src: '/base.jpg', alt: 'x' } })
}

describe('HtmlGenerator — адаптивное медиа', () => {
  it('анти-регресс: <img> без оверрайдов НЕ оборачивается в <picture>', () => {
    const tree = node({ metadata: { breakpoints: BPS }, children: [imgNode()] })
    const html = htmlGenerator.generatePage(tree, opts())
    expect(html).not.toContain('<picture>')
    expect(html).toContain('<img')
  })

  it('<img> с экранным оверрайдом → <picture> с <source media>, id остаётся на <img>', () => {
    const tree = node({
      metadata: { breakpoints: BPS },
      children: [imgNode()],
      variations: {
        mobile: { inheritedOverrides: { 'img-1': { attributes: { src: '/m.jpg' } } } },
      },
    })
    const html = htmlGenerator.generatePage(tree, opts())
    expect(html).toContain('<picture>')
    expect(html).toContain('<source media="(max-width: 375px)" srcset="/m.jpg" />')
    // data-element-id на внутреннем <img>, а не на <picture>
    expect(html).toMatch(/<picture><source[^>]+\/><img[^>]*data-element-id="img-1"[^>]*\/><\/picture>/)
  })

  it('фон-оверрайд под брейкпоинт эмитится как @media background-image', () => {
    const tree = node({
      metadata: { breakpoints: BPS },
      children: [node({ id: 'hero', styles: { properties: { backgroundImage: 'url("/base.png")' } } })],
      variations: {
        mobile: { inheritedOverrides: { hero: { styles: { backgroundImage: 'url("/m.png")' } } } },
      },
    })
    const html = htmlGenerator.generatePage(tree, opts())
    expect(html).toContain('Responsive media (background)')
    expect(html).toContain('@media (max-width: 375px)')
    expect(html).toContain('[data-element-id="hero"] { background-image: url("/m.png") !important; }')
  })

  it('приоритет языка: перевод базового src подавляет экранный вариант базового языка', () => {
    const tree = node({
      metadata: { breakpoints: BPS },
      children: [node({ id: 'img-1', elementType: 'image', tagName: 'img', attributes: { src: '/ru-base.jpg' } })],
      variations: {
        mobile: { inheritedOverrides: { 'img-1': { attributes: { src: '/base-mobile.jpg' } } } },
      },
    })
    // язык переопределил базу (src) и НЕ задал src@mobile → экран подавлен
    const html = htmlGenerator.generatePage(tree, opts({ translationMap: { 'img-1': { src: '/ru-base.jpg' } } }))
    expect(html).not.toContain('<picture>')
    expect(html).not.toContain('/base-mobile.jpg')
  })
})
