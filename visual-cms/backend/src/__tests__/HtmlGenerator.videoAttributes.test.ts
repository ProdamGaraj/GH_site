/**
 * Булевы атрибуты и <video> в HtmlGenerator.
 *
 * Регресс-кейсы бага «видеоблоки не работают»:
 *  - controls="false" / controls="" в HTML означают ВКЛ (присутствие = true),
 *    поэтому выключить контролы из редактора было невозможно;
 *  - autoplay без muted/playsinline браузеры блокируют — видео «не играло».
 */
import { htmlGenerator, GeneratePageOptions } from '../services/HtmlGenerator'
import type { BlockNode } from '../types/blockNode'

function videoNode(attributes: Record<string, string>): BlockNode {
  return {
    id: 'vid-1',
    elementType: 'video',
    tagName: 'video',
    styles: { properties: {} },
    children: [],
    attributes,
    metadata: {},
  } as BlockNode
}

function page(children: BlockNode[]): BlockNode {
  return {
    id: 'root',
    elementType: 'container',
    tagName: 'div',
    styles: { properties: {} },
    children,
    attributes: {},
    metadata: {},
  } as BlockNode
}

const opts: GeneratePageOptions = {
  metadata: { title: 'T', description: 'D', keywords: [] },
  slug: 'index',
}

const videoTag = (html: string): string => {
  const m = html.match(/<video[^>]*>/)
  return m ? m[0] : ''
}

describe('HtmlGenerator — булевы атрибуты video', () => {
  it("'true' эмитится голым атрибутом (без ='true')", () => {
    const html = htmlGenerator.generatePage(page([videoNode({ src: '/v.mp4', controls: 'true' })]), opts)
    const tag = videoTag(html)
    expect(tag).toContain(' controls')
    expect(tag).not.toContain('controls="true"')
    expect(tag).toContain('src="/v.mp4"')
  })

  it("'false' НЕ эмитится (раньше controls=\"false\" включал контролы)", () => {
    const html = htmlGenerator.generatePage(page([videoNode({ src: '/v.mp4', controls: 'false', loop: 'false' })]), opts)
    const tag = videoTag(html)
    expect(tag).not.toContain('controls')
    expect(tag).not.toContain('loop')
  })

  it("'' (импорт голого атрибута) эмитится как включённый", () => {
    const html = htmlGenerator.generatePage(page([videoNode({ src: '/v.mp4', controls: '' })]), opts)
    expect(videoTag(html)).toContain(' controls')
  })

  it('autoplay-видео автоматически получает muted и playsinline', () => {
    const html = htmlGenerator.generatePage(page([videoNode({ src: '/v.mp4', autoplay: 'true' })]), opts)
    const tag = videoTag(html)
    expect(tag).toContain(' autoplay')
    expect(tag).toContain(' muted')
    expect(tag).toContain(' playsinline')
  })

  it('без autoplay muted/playsinline не навязываются', () => {
    const html = htmlGenerator.generatePage(page([videoNode({ src: '/v.mp4', controls: 'true' })]), opts)
    const tag = videoTag(html)
    expect(tag).not.toContain('muted')
    expect(tag).not.toContain('playsinline')
  })

  it('небулевы атрибуты рендерятся как раньше (key="value")', () => {
    const html = htmlGenerator.generatePage(page([videoNode({ src: '/v.mp4', poster: '/p.jpg', preload: 'metadata' })]), opts)
    const tag = videoTag(html)
    expect(tag).toContain('poster="/p.jpg"')
    expect(tag).toContain('preload="metadata"')
  })
})

// ── Адаптивное видео: матрица «экран × язык» через data-rmedia ──────────────
// media-атрибут на <video><source> браузеры игнорируют, поэтому брейкпоинтные
// подмены src у видео эмитятся картой data-rmedia (свапает ResponsiveMediaRuntime).

const BPS = [
  { id: 'tablet', name: 'Tablet', width: 768 },
  { id: 'mobile', name: 'Mobile', width: 375 },
]

function pageWithVideoOverride(videoAttrs: Record<string, string>, overrideSrc?: string): BlockNode {
  const root = page([videoNode({ ...videoAttrs })])
  ;(root.metadata as Record<string, unknown>).breakpoints = BPS
  if (overrideSrc) {
    root.variations = {
      mobile: { inheritedOverrides: { 'vid-1': { attributes: { src: overrideSrc } } } },
    }
  }
  return root
}

describe('HtmlGenerator — адаптивное видео (data-rmedia)', () => {
  it('брейкпоинтный src-оверрайд → data-rmedia + data-rmedia-kind="src"', () => {
    const html = htmlGenerator.generatePage(pageWithVideoOverride({ src: '/base.mp4' }, '/m.mp4'), opts)
    const tag = videoTag(html)
    expect(tag).toContain('data-rmedia="{&quot;mobile&quot;:&quot;/m.mp4&quot;}"')
    expect(tag).toContain('data-rmedia-kind="src"')
    // Видео НЕ оборачивается в <picture>
    expect(html).not.toContain('<picture>')
  })

  it('без оверрайдов data-rmedia не эмитится (анти-регресс)', () => {
    const html = htmlGenerator.generatePage(pageWithVideoOverride({ src: '/base.mp4' }), opts)
    expect(videoTag(html)).not.toContain('data-rmedia')
  })

  it('оверрайд, равный базе, не эмитится', () => {
    const html = htmlGenerator.generatePage(pageWithVideoOverride({ src: '/same.mp4' }, '/same.mp4'), opts)
    expect(videoTag(html)).not.toContain('data-rmedia')
  })

  it('приоритет языка: перевод базового src подавляет экранный вариант', () => {
    const root = pageWithVideoOverride({ src: '/ru-base.mp4' }, '/base-mobile.mp4')
    const html = htmlGenerator.generatePage(root, {
      ...opts,
      translationMap: { 'vid-1': { src: '/ru-base.mp4' } },
    })
    expect(videoTag(html)).not.toContain('data-rmedia')
    expect(html).not.toContain('/base-mobile.mp4')
  })

  it('ячейка «язык+экран» (src@mobile) попадает в data-rmedia', () => {
    const root = pageWithVideoOverride({ src: '/ru-base.mp4' })
    const html = htmlGenerator.generatePage(root, {
      ...opts,
      translationMap: { 'vid-1': { src: '/ru-base.mp4', 'src@mobile': '/ru-mobile.mp4' } },
    })
    expect(videoTag(html)).toContain('data-rmedia="{&quot;mobile&quot;:&quot;/ru-mobile.mp4&quot;}"')
  })

  it('data-rmedia сочетается с булевыми атрибутами и autoplay-гарантиями', () => {
    const html = htmlGenerator.generatePage(
      pageWithVideoOverride({ src: '/base.mp4', autoplay: 'true' }, '/m.mp4'),
      opts
    )
    const tag = videoTag(html)
    expect(tag).toContain(' autoplay')
    expect(tag).toContain(' muted')
    expect(tag).toContain(' playsinline')
    expect(tag).toContain('data-rmedia-kind="src"')
  })
})
