/**
 * Медиа на странице проекта: преобразование блоков «О проекте», холлы, двор.
 *
 * Поведение скриптов в браузере — в complexMedia.runtime.test.ts.
 */
import {
  ABOUT_CSS_MARKER,
  ABOUT_JS,
  ABOUT_JS_MARKER,
  GALLERY_CSS_MARKER,
  LIGHTBOX_JS,
  LIGHTBOX_JS_MARKER,
  migrateAboutBlock,
  migrateGalleryBlock,
} from '../scripts/complexMedia'
import { MigrationError, StructureNode } from '../scripts/choiceToPlanTypes'

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

function aboutBlock(): StructureNode {
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

describe('«О проекте»', () => {
  const result = migrateAboutBlock(aboutBlock())
  const media = find(result.structure, (n) => n.attributes?.id === 'aboutMedia')!

  it('нерабочие стрелки и «плей» убраны', () => {
    const classes = (media.children ?? []).map((c) => c.attributes?.class)
    expect(classes).not.toContain('side-arrow left')
    expect(classes).not.toContain('play-button')
  })

  it('плеер повторяется по item.aboutVideos: без видео узла в разметке нет', () => {
    const holder = (media.children ?? []).find((c) => c.attributes?.class === 'about-video')!
    expect(holder._repeat).toEqual({ source: 'item.aboutVideos' })
    const video = holder.children![0]
    expect(video.tagName).toBe('video')
    expect(video.elementType).toBe('video')
    expect(video.attributes).toMatchObject({
      src: '{{$.url}}',
      poster: '{{$.poster}}',
      controls: 'true',
      muted: 'true',
      playsinline: 'true',
      'data-autoplay-visible': 'true',
    })
  })

  it('картинка карточки (--image) не тронута', () => {
    expect(media.styles?.properties?.['--image']).toBe('url("{{item.media}}")')
  })

  it('скрипт и стили дописаны, исходный CSS сохранён', () => {
    expect(result.structure.metadata!.globalJs).toBe(ABOUT_JS)
    const css = result.structure.metadata!.globalCss as string
    expect(css.startsWith('.media-card { position: relative; }')).toBe(true)
    expect(css).toContain(ABOUT_CSS_MARKER)
  })

  it('повторный запуск ничего не меняет', () => {
    const again = migrateAboutBlock(result.structure)
    expect(again.alreadyMigrated).toBe(true)
    expect(JSON.stringify(again.structure)).toBe(JSON.stringify(result.structure))
  })

  it('исходная структура не мутируется', () => {
    const input = aboutBlock()
    const snapshot = JSON.stringify(input)
    migrateAboutBlock(input)
    expect(JSON.stringify(input)).toBe(snapshot)
  })

  it('существующий скрипт блока сохраняется, новый дописывается после', () => {
    const b = aboutBlock()
    b.metadata!.globalJs = 'var existing = 1;'
    const js = migrateAboutBlock(b).structure.metadata!.globalJs as string
    expect(js.startsWith('var existing = 1;')).toBe(true)
    expect(js).toContain(ABOUT_JS_MARKER)
  })

  it('без #aboutMedia — ошибка, а не тихий пропуск', () => {
    const b = aboutBlock()
    b.children = []
    expect(() => migrateAboutBlock(b)).toThrow(MigrationError)
  })
})

const OLD_LIGHTBOX = `

/* Разворот галереи-карусели в лайтбокс. Кадры и текущий индекс читаем из слайдов. */
(function () {
  var cards = document.querySelectorAll('.media-card[data-carousel="true"]');
})();
`

function galleryBlock(): StructureNode {
  return {
    id: 'hall',
    tagName: 'section',
    metadata: { globalJs: OLD_LIGHTBOX, globalCss: '.gallery-row { display: grid; }\n' },
    children: [
      {
        id: 'media',
        attributes: { id: 'hallMedia', class: 'media-card gallery-media', 'data-carousel': 'true' },
        children: [{ id: 'track', attributes: { 'data-carousel-track': 'true' }, _repeat: { source: 'item.hallGallery' } }],
      },
    ],
  }
}

describe('галереи холлов и двора', () => {
  const result = migrateGalleryBlock(galleryBlock(), 'Холлы')

  it('скрипт лайтбокса заменён на версию с однократной привязкой', () => {
    const js = result.structure.metadata!.globalJs as string
    expect(js).toContain(LIGHTBOX_JS_MARKER)
    expect(js.trim()).toBe(LIGHTBOX_JS.trim())
    expect(js).toContain("data-lightbox-bound")
  })

  it('CSS пустой галереи дописан один раз', () => {
    const css = result.structure.metadata!.globalCss as string
    expect(css.startsWith('.gallery-row { display: grid; }')).toBe(true)
    expect(css.split(GALLERY_CSS_MARKER)).toHaveLength(2)
    expect(css).toContain('[data-carousel-count="0"]')
  })

  it('разметка карусели не тронута: слайды и кнопки настраиваются в редакторе', () => {
    expect(JSON.stringify(result.structure.children)).toBe(JSON.stringify(galleryBlock().children))
  })

  it('повторный запуск ничего не меняет', () => {
    expect(migrateGalleryBlock(result.structure, 'Холлы').alreadyMigrated).toBe(true)
  })

  it('без скрипта лайтбокса — ошибка: блок изменился', () => {
    const b = galleryBlock()
    b.metadata!.globalJs = 'var x;'
    expect(() => migrateGalleryBlock(b, 'Холлы')).toThrow(MigrationError)
  })

  it('после скрипта лайтбокса чужой код — ошибка, чтобы его не отрезать', () => {
    const b = galleryBlock()
    b.metadata!.globalJs = OLD_LIGHTBOX + '\nconsole.log(1);\n'
    expect(() => migrateGalleryBlock(b, 'Холлы')).toThrow(MigrationError)
  })

  it('без карусели в блоке — ошибка', () => {
    const b = galleryBlock()
    b.children = []
    expect(() => migrateGalleryBlock(b, 'Холлы')).toThrow(MigrationError)
  })
})
