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
