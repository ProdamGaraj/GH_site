/**
 * Hero страницы проекта: слайдер из фото и видео (item.heroSlides) вместо
 * списка фото (item.heroImages), фон по первому фото (item.heroPoster).
 *
 * Фикстура — живой блок «complex hero» со стенда (до миграции). Проверяем и
 * преобразование, и что после подстановки данных ЖК получается разметка,
 * которую понимает рантайм карусели: data-slide-video у видеослайда, фон —
 * фото или постер.
 */
jest.mock('../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockReturnValue({
      findOne: jest.fn(), find: jest.fn(), save: jest.fn(), findByIds: jest.fn(),
    }),
  },
}))

import { deployService } from '../services/DeployService'
import { HERO_CSS_MARKER, migrateHeroBlock, migrateHeroInstances } from '../scripts/complexMedia'
import { MigrationError, StructureNode } from '../scripts/choiceToPlanTypes'

const LIVE: StructureNode = require('./fixtures/complexHeroBlockLive.json')
const HERO_ID = 'e0098d6c-c1bf-4db4-a893-78e49c6e48d3'

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))
const substitute = (structure: unknown, item: unknown) => (deployService as any).substituteItemData(structure, item)

function all(root: StructureNode, pred: (n: StructureNode) => boolean): StructureNode[] {
  const out: StructureNode[] = []
  const visit = (n: StructureNode) => {
    if (pred(n)) out.push(n)
    for (const c of n.children ?? []) visit(c)
  }
  visit(root)
  return out
}
const track = (root: StructureNode) => all(root, (n) => n.attributes?.['data-carousel-track'] === 'true')[0]
const slides = (root: StructureNode) => all(root, (n) => n.attributes?.['data-carousel-slide'] === 'true')

describe('migrateHeroBlock — живой блок', () => {
  const result = migrateHeroBlock(clone(LIVE))
  const text = JSON.stringify(result.structure)

  it('слайды по item.heroSlides, шаблон слайда — фото/постер, видео и кадрирование', () => {
    expect(result.alreadyMigrated).toBe(false)
    expect(track(result.structure)._repeat).toEqual({ source: 'item.heroSlides' })
    const [slide] = slides(result.structure)
    expect(slide.attributes).toMatchObject({ 'data-slide-video': '{{$.video}}', 'data-slide-fit': '{{$.fit}}', class: 'complex-hero-slide' })
    expect(slide.styles!.properties).toMatchObject({
      '--image': 'url("{{$.image}}")',
      '--slide-image': 'url("{{$.image}}")',
      backgroundPosition: '{{$.position}}',
    })
  })

  it('нигде не осталось heroImages.0 и {{$}} — фон по item.heroPoster', () => {
    expect(text).not.toContain('heroImages')
    expect(text).not.toContain('{{$}}')
    expect(text.split('{{item.heroPoster}}').length - 1).toBe(3)
  })

  it('стили режима «целиком» дописаны, прежние стили блока целы', () => {
    const css = String(result.structure.metadata!.globalCss)
    expect(css).toContain(HERO_CSS_MARKER)
    expect(css).toContain('.complex-hero-slide[data-slide-fit="contain"]::before')
    expect(css.startsWith(String(LIVE.metadata!.globalCss).trimEnd())).toBe(true)
  })

  it('исходник не мутирует; повторный запуск ничего не меняет', () => {
    expect(JSON.stringify(LIVE)).toContain('item.heroImages')
    const again = migrateHeroBlock(result.structure)
    expect(again.alreadyMigrated).toBe(true)
    expect(again.changes).toEqual([])
  })

  it('неожиданный источник слайдов — ошибка, блок не трогаем', () => {
    const b = clone(LIVE)
    track(b)._repeat = { source: 'item.gallery' }
    expect(() => migrateHeroBlock(b)).toThrow(MigrationError)
  })

  it('без трека слайдера — ошибка', () => {
    const b = clone(LIVE)
    b.children = (b.children ?? []).filter((c) => c.attributes?.['data-carousel-track'] !== 'true')
    expect(() => migrateHeroBlock(b)).toThrow(MigrationError)
  })
})

describe('hero после подстановки данных ЖК', () => {
  const migrated = migrateHeroBlock(clone(LIVE)).structure
  const item = {
    heroPoster: '/media/p.jpg',
    heroSlides: [
      { url: '/media/v.mp4', image: '/media/p.jpg', video: '/media/v.mp4', position: '50% 50%', fit: 'cover' },
      { url: '/media/p.jpg', image: '/media/p.jpg', video: '', position: '20% 80%', fit: 'contain' },
    ],
    aboutVideo: '',
    className: 'Бизнес',
    name: 'Харизма',
    intro: '',
    soldOut: [],
  }
  const out = substitute(clone(migrated), item) as StructureNode
  const [video, photo] = slides(out)

  it('видеослайд: data-slide-video, постер фоном', () => {
    expect(slides(out)).toHaveLength(2)
    expect(video.attributes!['data-slide-video']).toBe('/media/v.mp4')
    expect(video.styles!.properties!['--image']).toBe('url("/media/p.jpg")')
  })

  it('фото-слайд: пустой data-slide-video, фокус и вписывание из данных', () => {
    expect(photo.attributes!['data-slide-video']).toBe('')
    expect(photo.attributes!['data-slide-fit']).toBe('contain')
    expect(photo.styles!.properties!.backgroundPosition).toBe('20% 80%')
  })

  it('фон секции и трека — постер, не видео', () => {
    expect(String(out.styles!.properties!['--hero-image'])).toBe('url("/media/p.jpg")')
    expect(JSON.stringify(out)).not.toMatch(/url\(\\?"\/media\/v\.mp4/)
  })
})

describe('migrateHeroInstances — экземпляр hero на странице', () => {
  const page = (): StructureNode => ({
    id: 'root',
    tagName: 'div',
    children: [
      { id: 'nav', tagName: 'header', metadata: { linkedBlockId: 'other' }, styles: { properties: { '--x': 'url("{{item.heroImages.0}}")' } } },
      {
        id: 'hero',
        tagName: 'section',
        children: [],
        metadata: { linkedBlockId: HERO_ID },
        styles: { properties: { display: 'flex', '--hero-image': 'url("{{item.heroImages.0}}")' } },
      },
    ],
  })

  it('правит только экземпляр hero', () => {
    const r = migrateHeroInstances(page(), HERO_ID)
    expect(r.alreadyMigrated).toBe(false)
    const [nav, hero] = r.structure.children!
    expect(hero.styles!.properties).toEqual({ display: 'flex', '--hero-image': 'url("{{item.heroPoster}}")' })
    expect(nav.styles!.properties!['--x']).toBe('url("{{item.heroImages.0}}")')
  })

  it('повторно — без правок; исходник не мутирует', () => {
    const input = page()
    const r = migrateHeroInstances(input, HERO_ID)
    expect(JSON.stringify(input)).toContain('heroImages.0')
    expect(migrateHeroInstances(r.structure, HERO_ID).alreadyMigrated).toBe(true)
  })
})
