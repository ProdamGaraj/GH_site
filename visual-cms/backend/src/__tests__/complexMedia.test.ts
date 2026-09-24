/**
 * Медиа на странице проекта: преобразование блоков «О проекте», холлы, двор
 * в карусели из фото и видео (v2).
 *
 * Поведение скрипта лайтбокса в браузере — в complexMedia.runtime.test.ts.
 */
import {
  ABOUT_CSS_MARKER,
  ABOUT_CSS_V1_MARKER,
  ABOUT_JS_V1_MARKER,
  GALLERY_CSS_MARKER,
  LIGHTBOX_JS,
  LIGHTBOX_JS_MARKER,
  migrateAboutBlock,
  migrateGalleryBlock,
} from '../scripts/complexMedia'
import { MigrationError, StructureNode, incompleteNodes } from '../scripts/choiceToPlanTypes'

function find(root: StructureNode, pred: (n: StructureNode) => boolean): StructureNode | undefined {
  const stack = [root]
  while (stack.length) {
    const n = stack.pop()!
    if (pred(n)) return n
    stack.push(...(n.children ?? []))
  }
  return undefined
}

const btn = (cls: string): StructureNode => ({ tagName: 'button', attributes: { type: 'button', class: cls } })

const slideTemplateOf = (root: StructureNode) => find(root, (n) => n.attributes?.['data-carousel-slide'] === 'true')!

/** Слайд привязан к кадрированию из данных ЖК (v3). */
function expectFramed(slide: StructureNode) {
  expect(slide.attributes!['data-slide-fit']).toBe('{{$.fit}}')
  expect(slide.styles!.properties!.backgroundPosition).toBe('{{$.position}}')
  expect(slide.styles!.properties!['--slide-image']).toBe('url("{{$.image}}")')
}

/** Снимает кадрирование — состояние блока после v2, до v3. */
function unframe(root: StructureNode, cssHead: string): StructureNode {
  const copy: StructureNode = JSON.parse(JSON.stringify(root))
  const slide = slideTemplateOf(copy)
  delete slide.attributes!['data-slide-fit']
  const props = slide.styles!.properties!
  delete props['--slide-image']
  props.backgroundPosition = 'center'
  const css = copy.metadata!.globalCss as string
  copy.metadata!.globalCss = css.slice(0, css.indexOf(cssHead)).trimEnd() + '\n'
  return copy
}

/** «О проекте» в исходном виде: картинка и три нерабочие кнопки. */
function aboutOriginal(): StructureNode {
  return {
    id: 'about',
    tagName: 'section',
    metadata: { globalCss: '.media-card { position: relative; }\n' },
    children: [
      { id: 'copy', attributes: { class: 'section-copy' } },
      {
        id: 'media',
        attributes: { id: 'aboutMedia', class: 'media-card' },
        styles: { properties: { '--image': 'url("{{item.media}}")' } },
        children: [btn('side-arrow left'), btn('play-button'), btn('side-arrow right')],
      },
    ],
  }
}

/** «О проекте» после v1: встроенный плеер и его скрипт/стили. */
function aboutV1(): StructureNode {
  const b = aboutOriginal()
  const media = find(b, (n) => n.attributes?.id === 'aboutMedia')!
  media.children = [
    {
      id: 'about-video-holder',
      attributes: { class: 'about-video' },
      _repeat: { source: 'item.aboutVideos' },
      children: [{ tagName: 'video', attributes: { src: '{{$.url}}', controls: 'true' } }],
    },
  ]
  b.metadata = {
    globalJs: `${ABOUT_JS_V1_MARKER} ... */\n(function () {})();\n`,
    globalCss: `.media-card { position: relative; }\n\n${ABOUT_CSS_V1_MARKER}\n*/\n.media-card:has(video) { aspect-ratio: 16 / 9; }\n`,
  }
  return b
}

describe('«О проекте» → карусель фото и видео', () => {
  for (const [name, make] of [['из исходного вида', aboutOriginal], ['из v1 (плеер)', aboutV1]] as const) {
    describe(name, () => {
      const result = migrateAboutBlock(make())
      const media = find(result.structure, (n) => n.attributes?.id === 'aboutMedia')!

      it('карточка стала каруселью (fade), картинка проекта осталась фоном', () => {
        expect(media.attributes).toMatchObject({ 'data-carousel': 'true', 'data-carousel-effect': 'fade' })
        expect(media.styles?.properties?.['--image']).toBe('url("{{item.media}}")')
      })

      it('слайды повторяются по item.aboutSlides, у слайда фон и видео из данных', () => {
        const track = media.children!.find((c) => c.attributes?.['data-carousel-track'] === 'true')!
        expect(track._repeat).toEqual({ source: 'item.aboutSlides' })
        const slide = track.children![0]
        expect(slide.attributes).toMatchObject({ 'data-carousel-slide': 'true', 'data-slide-video': '{{$.video}}' })
        expect(slide.styles?.properties?.backgroundImage).toBe('url("{{$.image}}")')
      })

      it('рабочие стрелки вместо декоративных, плеера и «плея» нет', () => {
        const classes = media.children!.map((c) => c.attributes?.class)
        expect(classes).not.toContain('play-button')
        expect(classes).not.toContain('about-video')
        expect(media.children!.filter((c) => c.attributes?.['data-carousel-prev'] === 'true')).toHaveLength(1)
        expect(media.children!.filter((c) => c.attributes?.['data-carousel-next'] === 'true')).toHaveLength(1)
        expect(find(media, (n) => n.tagName === 'video')).toBeUndefined()
      })

      it('скрипт и стили плеера v1 убраны, прочий CSS сохранён', () => {
        expect(result.structure.metadata?.globalJs ?? '').not.toContain(ABOUT_JS_V1_MARKER)
        const css = result.structure.metadata!.globalCss as string
        expect(css).not.toContain(ABOUT_CSS_V1_MARKER)
        expect(css.startsWith('.media-card { position: relative; }')).toBe(true)
      })

      it('слайд кадрируется из данных ЖК, стили «целиком» — одной секцией', () => {
        expectFramed(slideTemplateOf(media))
        const css = result.structure.metadata!.globalCss as string
        expect(css).toContain(ABOUT_CSS_MARKER)
        expect(css.split('/* ==== about-media')).toHaveLength(2)
        expect(css).toContain('[data-slide-fit="contain"]::after')
      })

      it('новые узлы полные: иначе редактор CMS падает на открытии страницы', () => {
        const added = media.children!.filter((c) => ['about-track', 'about-arrow-left', 'about-arrow-right'].includes(c.id!))
        expect(added).toHaveLength(3)
        for (const node of added) expect(incompleteNodes(node)).toEqual([])
      })

      it('повторный запуск ничего не меняет', () => {
        const again = migrateAboutBlock(result.structure)
        expect(again.alreadyMigrated).toBe(true)
        expect(JSON.stringify(again.structure)).toBe(JSON.stringify(result.structure))
      })
    })
  }

  it('исходная структура не мутируется', () => {
    const input = aboutV1()
    const snapshot = JSON.stringify(input)
    migrateAboutBlock(input)
    expect(JSON.stringify(input)).toBe(snapshot)
  })

  it('карусель v2 без кадрирования получает только кадрирование', () => {
    const v2 = unframe(migrateAboutBlock(aboutOriginal()).structure, '/* ==== about-media')
    const result = migrateAboutBlock(v2)
    expect(result.alreadyMigrated).toBe(false)
    expect(result.changes).toHaveLength(2)
    expectFramed(slideTemplateOf(result.structure))
    const cardBefore = find(v2, (n) => n.attributes?.id === 'aboutMedia')!
    const cardAfter = find(result.structure, (n) => n.attributes?.id === 'aboutMedia')!
    expect(cardAfter.children!.map((c) => c.id)).toEqual(cardBefore.children!.map((c) => c.id))
  })

  it('без #aboutMedia — ошибка, а не тихий пропуск', () => {
    const b = aboutOriginal()
    b.children = []
    expect(() => migrateAboutBlock(b)).toThrow(MigrationError)
  })
})

const LIGHTBOX_V2 = `

/* Разворот галереи-карусели в лайтбокс. v2. Кадры и текущий индекс читаем из слайдов. */
(function () {
  var cards = document.querySelectorAll('.media-card[data-carousel="true"]');
})();
`

function galleryBlock(source = 'item.hallGallery'): StructureNode {
  return {
    id: 'hall',
    tagName: 'section',
    metadata: {
      globalJs: LIGHTBOX_V2,
      globalCss: '.gallery-row { display: grid; }\n\n/* ==== gallery-media v1 ====\n*/\n.media-card[data-carousel-count="0"] { display: none; }\n',
    },
    children: [
      {
        id: 'media',
        attributes: { id: 'hallMedia', class: 'media-card gallery-media', 'data-carousel': 'true' },
        children: [
          {
            id: 'track',
            attributes: { 'data-carousel-track': 'true' },
            _repeat: { source },
            children: [
              {
                id: 'slide',
                attributes: { class: 'gallery-slide', 'data-carousel-slide': 'true' },
                styles: { properties: { position: 'absolute', backgroundImage: 'url("{{$}}")' } },
              },
            ],
          },
        ],
      },
    ],
  }
}

const HALL = { from: 'item.hallGallery', to: 'item.hallSlides' }

describe('галереи холлов и двора → фото и видео', () => {
  const result = migrateGalleryBlock(galleryBlock(), 'Холлы', HALL)
  const slide = find(result.structure, (n) => n.id === 'slide')!

  it('слайды повторяются по новому списку, фон и видео из данных слайда', () => {
    expect(find(result.structure, (n) => n.id === 'track')!._repeat).toEqual({ source: 'item.hallSlides' })
    expect(slide.attributes!['data-slide-video']).toBe('{{$.video}}')
    expect(slide.styles!.properties!.backgroundImage).toBe('url("{{$.image}}")')
    expect(slide.styles!.properties!.position).toBe('absolute')
  })

  it('лайтбокс заменён на v3: только фото, привязка один раз', () => {
    const js = result.structure.metadata!.globalJs as string
    expect(js.trim()).toBe(LIGHTBOX_JS.trim())
    expect(js).toContain(LIGHTBOX_JS_MARKER)
  })

  it('CSS прежней версии заменён на актуальную, а не дописан вторым', () => {
    const css = result.structure.metadata!.globalCss as string
    expect(css.startsWith('.gallery-row { display: grid; }')).toBe(true)
    expect(css).toContain(GALLERY_CSS_MARKER)
    expect(css.split('/* ==== gallery-media')).toHaveLength(2)
    expect(css).toContain('.gallery-media[data-carousel-count="0"]')
    expect(css).not.toMatch(/^\.media-card\[data-carousel-count="0"\]/m)
  })

  it('слайд кадрируется из данных ЖК, в CSS есть режим «целиком»', () => {
    expectFramed(slide)
    expect(result.structure.metadata!.globalCss).toContain('[data-slide-fit="contain"]::before')
  })

  it('галерея v2 без кадрирования получает кадрирование и CSS v3 — одной секцией', () => {
    const v2 = unframe(result.structure, '/* ==== gallery-media')
    const again = migrateGalleryBlock(v2, 'Холлы', HALL)
    expect(again.alreadyMigrated).toBe(false)
    expectFramed(find(again.structure, (n) => n.id === 'slide')!)
    const css = again.structure.metadata!.globalCss as string
    expect(css.split('/* ==== gallery-media')).toHaveLength(2)
    expect(css).toContain(GALLERY_CSS_MARKER)
    expect(find(again.structure, (n) => n.id === 'track')!._repeat).toEqual({ source: 'item.hallSlides' })
  })

  it('повторный запуск ничего не меняет', () => {
    expect(migrateGalleryBlock(result.structure, 'Холлы', HALL).alreadyMigrated).toBe(true)
  })

  it('неожиданный источник слайдов — ошибка', () => {
    expect(() => migrateGalleryBlock(galleryBlock('item.something'), 'Холлы', HALL)).toThrow(MigrationError)
  })

  it('без скрипта лайтбокса — ошибка: блок изменился', () => {
    const b = galleryBlock()
    b.metadata!.globalJs = 'var x;'
    expect(() => migrateGalleryBlock(b, 'Холлы', HALL)).toThrow(MigrationError)
  })

  it('после скрипта лайтбокса чужой код — ошибка, чтобы его не отрезать', () => {
    const b = galleryBlock()
    b.metadata!.globalJs = LIGHTBOX_V2 + '\nconsole.log(1);\n'
    expect(() => migrateGalleryBlock(b, 'Холлы', HALL)).toThrow(MigrationError)
  })

  it('без карусели в блоке — ошибка', () => {
    const b = galleryBlock()
    b.children = []
    expect(() => migrateGalleryBlock(b, 'Холлы', HALL)).toThrow(MigrationError)
  })
})
