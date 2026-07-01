import {
  resolveResponsiveMedia,
  generateBackgroundMediaCss,
  buildPictureTag,
  breakpointField,
  type TranslationFieldMap,
} from '../services/ResponsiveMediaResolver'
import type { BlockNode, BreakpointDef } from '../types/blockNode'

const BPS: BreakpointDef[] = [
  { id: 'tablet', name: 'Tablet', width: 768 },
  { id: 'mobile', name: 'Mobile', width: 375 },
]

const IMG_ID = 'img-1'

/** Корень с одним <img>-ребёнком; экранные оверрайды img кладём в variations корня. */
function tree(
  img: Partial<BlockNode>,
  rootVariations?: BlockNode['variations'],
): { root: BlockNode; imgId: string } {
  const imgId = IMG_ID
  const imgNode: BlockNode = {
    id: imgId,
    elementType: 'image',
    tagName: 'img',
    styles: { properties: {} },
    children: [],
    attributes: {},
    metadata: {},
    ...img,
  }
  const root: BlockNode = {
    id: 'root',
    elementType: 'container',
    tagName: 'div',
    styles: { properties: {} },
    children: [imgNode],
    attributes: {},
    metadata: {},
    variations: rootVariations,
  }
  return { root, imgId }
}

/** variations корня с экранным src-оверрайдом для img на брейкпоинте bpId. */
function srcOverride(imgId: string, bpId: string, src: string): BlockNode['variations'] {
  return { [bpId]: { inheritedOverrides: { [imgId]: { attributes: { src } } } } }
}

describe('resolveResponsiveMedia — <img> матрица приоритета', () => {
  it('точная ячейка «язык+экран» (src@bp) даёт <source>', () => {
    const { root, imgId } = tree({ attributes: { src: '/base.jpg' } })
    const map: TranslationFieldMap = { [imgId]: { [breakpointField('src', 'mobile')]: '/ru-mobile.jpg' } }
    const plan = resolveResponsiveMedia(root, map, BPS)
    expect(plan.get(imgId)?.img).toEqual([
      { bpId: 'mobile', width: 375, value: '/ru-mobile.jpg' },
    ])
  })

  it('приоритет ЯЗЫКА: языковая база задана → экранный вариант базового языка подавляется', () => {
    // Есть базово-языковой tablet-оверрайд, но у языка задана база 'src' и нет src@tablet.
    const { root, imgId } = tree(
      { attributes: { src: '/ru-base.jpg' } }, // уже локализованная база (applyTranslations)
      srcOverride(IMG_ID, 'tablet', '/base-tablet.jpg'),
    )
    const map: TranslationFieldMap = { [imgId]: { src: '/ru-base.jpg' } } // язык переопределил базу
    const plan = resolveResponsiveMedia(root, map, BPS)
    // Экранный (базовый язык) tablet НЕ эмитим — язык победил.
    expect(plan.get(imgId)?.img).toBeUndefined()
  })

  it('нет языковой базы → фолбэк на правильный экран (variation базового языка)', () => {
    const { root, imgId } = tree(
      { attributes: { src: '/base.jpg' } },
      srcOverride(IMG_ID, 'tablet', '/base-tablet.jpg'),
    )
    const plan = resolveResponsiveMedia(root, {}, BPS) // дефолтный язык, переводов нет
    expect(plan.get(imgId)?.img).toEqual([
      { bpId: 'tablet', width: 768, value: '/base-tablet.jpg' },
    ])
  })

  it('язык L: src@tablet побеждает базово-языковой tablet-оверрайд', () => {
    const { root, imgId } = tree(
      { attributes: { src: '/ru-base.jpg' } },
      srcOverride(IMG_ID, 'tablet', '/base-tablet.jpg'),
    )
    const map: TranslationFieldMap = {
      [imgId]: { src: '/ru-base.jpg', [breakpointField('src', 'tablet')]: '/ru-tablet.jpg' },
    }
    const plan = resolveResponsiveMedia(root, map, BPS)
    expect(plan.get(imgId)?.img).toEqual([
      { bpId: 'tablet', width: 768, value: '/ru-tablet.jpg' },
    ])
  })

  it('значение источника == базе → источник не эмитится', () => {
    const { root, imgId } = tree(
      { attributes: { src: '/same.jpg' } },
      srcOverride(IMG_ID, 'tablet', '/same.jpg'),
    )
    const plan = resolveResponsiveMedia(root, {}, BPS)
    expect(plan.get(imgId)).toBeUndefined()
  })

  it('неизвестный/удалённый брейкпоинт в поле игнорируется', () => {
    const { root, imgId } = tree({ attributes: { src: '/base.jpg' } })
    const map: TranslationFieldMap = { [imgId]: { 'src@deleted-bp': '/x.jpg' } }
    const plan = resolveResponsiveMedia(root, map, BPS)
    expect(plan.get(imgId)).toBeUndefined()
  })

  it('несколько экранов сортируются как источники (по возрастанию — в buildPictureTag)', () => {
    const { root, imgId } = tree(
      { attributes: { src: '/base.jpg' } },
      {
        tablet: { inheritedOverrides: { [IMG_ID]: { attributes: { src: '/t.jpg' } } } },
        mobile: { inheritedOverrides: { [IMG_ID]: { attributes: { src: '/m.jpg' } } } },
      },
    )
    const plan = resolveResponsiveMedia(root, {}, BPS)
    const img = plan.get(imgId)!.img!
    expect(img.map((s) => s.bpId).sort()).toEqual(['mobile', 'tablet'])
  })

  it('src-оверрайд на НЕ-img узле не даёт img-план', () => {
    const div: BlockNode = {
      id: 'd1',
      elementType: 'container',
      tagName: 'div',
      styles: { properties: {} },
      children: [],
      attributes: { src: '/x.jpg' },
      metadata: {},
    }
    const root: BlockNode = {
      id: 'root',
      elementType: 'container',
      tagName: 'div',
      styles: { properties: {} },
      children: [div],
      attributes: {},
      metadata: {},
      variations: { tablet: { inheritedOverrides: { d1: { attributes: { src: '/t.jpg' } } } } },
    }
    const plan = resolveResponsiveMedia(root, {}, BPS)
    expect(plan.get('d1')?.img).toBeUndefined()
  })
})

describe('resolveResponsiveMedia — background-image', () => {
  it('перевод bg:image@bp оборачивается в url()', () => {
    const { root, imgId } = tree({
      styles: { properties: { backgroundImage: 'url("/base.png")' } },
    })
    const map: TranslationFieldMap = { [imgId]: { 'bg:image@mobile': '/ru-mobile.png' } }
    const plan = resolveResponsiveMedia(root, map, BPS)
    expect(plan.get(imgId)?.bg).toEqual([
      { bpId: 'mobile', width: 375, value: 'url("/ru-mobile.png")' },
    ])
  })

  it('экранный градиент базового языка сохраняется как есть', () => {
    const { root, imgId } = tree(
      { styles: { properties: { backgroundImage: 'url("/base.png")' } } },
      { tablet: { inheritedOverrides: { [IMG_ID]: { styles: { backgroundImage: 'linear-gradient(#000,#fff)' } } } } },
    )
    const plan = resolveResponsiveMedia(root, {}, BPS)
    expect(plan.get(imgId)?.bg).toEqual([
      { bpId: 'tablet', width: 768, value: 'linear-gradient(#000,#fff)' },
    ])
  })

  it('приоритет языка распространяется и на фон', () => {
    const { root, imgId } = tree(
      { styles: { properties: { backgroundImage: 'url("/ru-base.png")' } } },
      { tablet: { inheritedOverrides: { [IMG_ID]: { styles: { backgroundImage: 'url("/base-tablet.png")' } } } } },
    )
    const map: TranslationFieldMap = { [imgId]: { 'bg:image': '/ru-base.png' } }
    const plan = resolveResponsiveMedia(root, map, BPS)
    expect(plan.get(imgId)?.bg).toBeUndefined()
  })
})

describe('generateBackgroundMediaCss', () => {
  it('группирует по брейкпоинтам, по убыванию ширины, с !important', () => {
    const plan = new Map([
      ['n1', { bg: [
        { bpId: 'mobile', width: 375, value: 'url("/m.png")' },
        { bpId: 'tablet', width: 768, value: 'url("/t.png")' },
      ] }],
    ])
    const css = generateBackgroundMediaCss(plan, BPS)
    // tablet (768) идёт раньше mobile (375)
    expect(css.indexOf('max-width: 768px')).toBeLessThan(css.indexOf('max-width: 375px'))
    expect(css).toContain('[data-element-id="n1"] { background-image: url("/t.png") !important; }')
  })

  it('пустой план → пустая строка', () => {
    expect(generateBackgroundMediaCss(new Map(), BPS)).toBe('')
  })
})

describe('buildPictureTag', () => {
  const esc = (s: string) => s.replace(/"/g, '&quot;')

  it('источники по возрастанию ширины, img внутри', () => {
    const html = buildPictureTag(
      '<img src="/base.jpg" data-element-id="x" />',
      [
        { bpId: 'tablet', width: 768, value: '/t.jpg' },
        { bpId: 'mobile', width: 375, value: '/m.jpg' },
      ],
      esc,
    )
    expect(html.indexOf('max-width: 375px')).toBeLessThan(html.indexOf('max-width: 768px'))
    expect(html).toMatch(/^<picture><source[^>]+\/><source[^>]+\/><img src="\/base\.jpg"[^>]*\/><\/picture>$/)
  })
})
