/**
 * Медиа на странице проекта: «О проекте», «Дизайнерские холлы», «Дворовое
 * пространство» — везде карусель CMS с фото и видео.
 *
 * История:
 * - было: «О проекте» — картинка с нерабочими стрелками и «плеем»; галереи
 *   холлов и двора — карусели только из фото, пустая галерея показывала
 *   серую карточку с мёртвыми кнопками, лайтбокс вешался дважды;
 * - v1: «О проекте» — встроенный <video controls>; пустые галереи прячутся;
 * - v2 (сейчас): все три — карусели из фото и видео. Видеослайд — это
 *   `data-slide-video` у слайда: рантайм карусели сам создаёт <video> без
 *   интерфейса плеера (без звука, по кругу, играет только активный слайд).
 *   Стрелки листают; при одном слайде рантайм их прячет, и слайдер выглядит
 *   как просто фото или видео. Автолистание, эффект, кнопки — в панели
 *   карусели редактора CMS.
 *
 * Слайды приходят из estate DTO: item.aboutSlides, item.hallSlides,
 * item.yard.slides — объекты {url, image, video} (estate-service,
 * services/mediaSlides.ts).
 *
 * Здесь только чистое преобразование структур блоков: запись в базу — в
 * `migrate-complex-media.ts`. Все правки идемпотентны.
 */
import { MigrationError, MigrationResult, StructureNode, findOne, hasClass } from './choiceToPlanTypes'

// --- Общие детали карусели ---

/** Шаблон слайда: фон — фото или постер, data-slide-video — видео слайда. */
function slideTemplate(id: string): StructureNode {
  return {
    id,
    tagName: 'div',
    elementType: 'container',
    attributes: {
      class: 'gallery-slide',
      'aria-hidden': 'true',
      'data-carousel-slide': 'true',
      'data-slide-video': '{{$.video}}',
    },
    styles: {
      properties: {
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        position: 'absolute',
        backgroundSize: 'cover',
        backgroundImage: 'url("{{$.image}}")',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
      },
    },
  }
}

function arrow(side: 'left' | 'right'): StructureNode {
  const prev = side === 'left'
  return {
    id: `about-arrow-${side}`,
    tagName: 'button',
    elementType: 'button',
    content: prev ? '‹' : '›',
    attributes: {
      type: 'button',
      class: `side-arrow ${side}`,
      'aria-label': prev ? 'Предыдущий слайд' : 'Следующий слайд',
      [prev ? 'data-carousel-prev' : 'data-carousel-next']: 'true',
    },
  }
}

/** Вырезает дописанную ранее секцию (она всегда в конце) от маркера до конца. */
function stripSection(text: string, marker: string): string {
  const at = text.indexOf(marker)
  return at === -1 ? text : text.slice(0, at).trimEnd()
}

function trackOf(card: StructureNode): StructureNode | undefined {
  return (card.children ?? []).find((c) => c.attributes?.['data-carousel-track'] === 'true')
}

// --- «О проекте» ---

const ABOUT_SLIDES_SOURCE = 'item.aboutSlides'

/** Маркеры секций v1 — их v2 убирает. */
export const ABOUT_JS_V1_MARKER = '/* О проекте: видео в карточке, v1.'
export const ABOUT_CSS_V1_MARKER = '/* ==== about-media v1 ===='

export function migrateAboutBlock(input: StructureNode): MigrationResult {
  const structure: StructureNode = JSON.parse(JSON.stringify(input))
  const changes: string[] = []

  const card = findOne(structure, (n) => n.attributes?.id === 'aboutMedia', '#aboutMedia')
  if (trackOf(card)?._repeat?.source !== ABOUT_SLIDES_SOURCE) {
    const removed = (card.children ?? []).filter(
      (c) => hasClass(c, 'side-arrow') || hasClass(c, 'play-button') || hasClass(c, 'about-video')
    )
    card.children = [
      ...(card.children ?? []).filter((c) => !removed.includes(c)),
      {
        id: 'about-track',
        tagName: 'div',
        elementType: 'container',
        attributes: { class: 'gallery-track', 'data-carousel-track': 'true' },
        _repeat: { source: ABOUT_SLIDES_SOURCE },
        children: [slideTemplate('about-slide')],
      },
      arrow('left'),
      arrow('right'),
    ]
    card.attributes = {
      ...card.attributes,
      'data-carousel': 'true',
      'data-carousel-effect': 'fade',
    }
    changes.push(
      `«О проекте»: карусель фото и видео по item.aboutSlides со стрелками` +
        (removed.length ? ` (убрано старое: ${removed.length})` : '')
    )
  }

  const metadata = (structure.metadata ??= {})
  const js = typeof metadata.globalJs === 'string' ? metadata.globalJs : ''
  const jsV2 = stripSection(js, ABOUT_JS_V1_MARKER)
  if (jsV2 !== js) {
    metadata.globalJs = jsV2
    changes.push('«О проекте»: скрипт плеера v1 убран — видео ведёт рантайм карусели')
  }
  const css = typeof metadata.globalCss === 'string' ? metadata.globalCss : ''
  const cssV2 = stripSection(css, ABOUT_CSS_V1_MARKER)
  if (cssV2 !== css) {
    metadata.globalCss = cssV2 + '\n'
    changes.push('«О проекте»: стили плеера v1 убраны')
  }

  if (changes.length === 0) return { structure: input, changes, alreadyMigrated: true }
  return { structure, changes, alreadyMigrated: false }
}

// --- Галереи холлов и двора ---

/** Заголовок любой версии скрипта лайтбокса — с него хвост заменяется. */
const LIGHTBOX_JS_HEAD = '/* Разворот галереи-карусели в лайтбокс.'

export const LIGHTBOX_JS_MARKER = `${LIGHTBOX_JS_HEAD} v3.`

export const LIGHTBOX_JS = `${LIGHTBOX_JS_MARKER} Кадры и текущий индекс читаем
   из слайдов: состоянием листания владеет CarouselRuntime, второй счётчик
   заводить нельзя — разъедутся. Сам лайтбокс живёт в блоке оверлеев.
   В лайтбокс идут только фото: видеослайд разворачивать нечего, кнопка
   «развернуть» на нём прячется стилем блока. Скрипт лежит копией в блоках
   холлов и двора, поэтому карточка привязывается один раз
   (data-lightbox-bound). Карточки без кнопки «развернуть» не трогаем. */
(function () {
  var cards = document.querySelectorAll('.media-card[data-carousel="true"]');
  Array.prototype.forEach.call(cards, function (card) {
    if (card.getAttribute('data-lightbox-bound') === 'true') return;
    if (!card.querySelector('.expand-button')) return;
    card.setAttribute('data-lightbox-bound', 'true');
    function slides() {
      return [].slice.call(card.querySelectorAll('[data-carousel-slide="true"]'));
    }
    function isVideo(slide) {
      return Boolean((slide.getAttribute('data-slide-video') || '').trim());
    }
    function shot(slide) {
      var m = (slide.style.backgroundImage || '').match(/url\\(["']?(.*?)["']?\\)/);
      return m ? m[1] : '';
    }
    function active(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].classList.contains('is-active')) return list[i];
      }
      return list[0];
    }
    card.addEventListener('click', function (event) {
      var btn = event.target.closest('button');
      /* Стрелки листают карусель — им мешать нельзя. Разворот и клик по фону открывают. */
      if (btn && btn.className.indexOf('expand-button') === -1) return;
      var list = slides();
      var current = active(list);
      if (!current || isVideo(current)) return;
      var photos = list.filter(function (s) { return !isVideo(s) && shot(s); });
      var index = photos.indexOf(current);
      if (index !== -1 && window.ghLightbox) window.ghLightbox.open(photos.map(shot), index);
    });
  });
})();
`

/** Начало любой версии CSS-секции галерей — с него секция заменяется. */
const GALLERY_CSS_HEAD = '/* ==== gallery-media'

export const GALLERY_CSS_MARKER = `${GALLERY_CSS_HEAD} v2 ====`

export const GALLERY_CSS = `
${GALLERY_CSS_MARKER}
   Галерея без кадров (у проекта нет фото и видео двора или холлов) прячется
   целиком, текст секции занимает всю ширину. Число кадров пишет рантайм
   карусели в data-carousel-count; стрелки при одном кадре он прячет сам.
   Правило только для .gallery-media: CSS блоков собирается на страницу
   общим, а «О проекте» без слайдов должна остаться картинкой. */
.gallery-media[data-carousel-count="0"] {
  display: none;
}

.gallery-row:has(> .gallery-media[data-carousel-count="0"]) {
  grid-template-columns: 1fr;
}

/* На видеослайде разворачивать нечего. */
.media-card:has([data-carousel-slide].is-active[data-slide-video]:not([data-slide-video=""])) .expand-button {
  display: none;
}
`

export interface GallerySource {
  /** Прежний источник повтора (список строк). */
  from: string
  /** Новый источник (слайды {url, image, video}). */
  to: string
}

export function migrateGalleryBlock(input: StructureNode, label: string, source: GallerySource): MigrationResult {
  const structure: StructureNode = JSON.parse(JSON.stringify(input))
  const changes: string[] = []

  const card = findOne(
    structure,
    (n) => hasClass(n, 'media-card') && n.attributes?.['data-carousel'] === 'true',
    `${label}: карусель .media-card`
  )
  const track = trackOf(card)
  if (!track) throw new MigrationError(`${label}: у карусели нет data-carousel-track`)
  if (track._repeat?.source === source.from) {
    track._repeat = { ...track._repeat, source: source.to }
    const slide = (track.children ?? []).find((c) => c.attributes?.['data-carousel-slide'] === 'true')
    if (!slide) throw new MigrationError(`${label}: нет шаблона слайда`)
    slide.attributes = { ...slide.attributes, 'data-slide-video': '{{$.video}}' }
    const props = slide.styles?.properties ?? {}
    slide.styles = { ...slide.styles, properties: { ...props, backgroundImage: 'url("{{$.image}}")' } }
    changes.push(`${label}: слайды по ${source.to} — фото и видео`)
  } else if (track._repeat?.source !== source.to) {
    throw new MigrationError(`${label}: неожиданный источник слайдов ${String(track._repeat?.source)}`)
  }

  const metadata = (structure.metadata ??= {})
  const js = typeof metadata.globalJs === 'string' ? metadata.globalJs : ''
  if (!js.includes(LIGHTBOX_JS_MARKER)) {
    const start = js.indexOf(LIGHTBOX_JS_HEAD)
    if (start === -1) throw new MigrationError(`${label}: не найден скрипт лайтбокса — блок изменился`)
    const tail = js.slice(start).trimEnd()
    if (!tail.endsWith('})();')) {
      throw new MigrationError(`${label}: после скрипта лайтбокса есть другой код — не заменяю`)
    }
    metadata.globalJs = js.slice(0, start) + LIGHTBOX_JS
    changes.push(`${label}: лайтбокс — только фото, привязка к карточке один раз`)
  }
  const css = typeof metadata.globalCss === 'string' ? metadata.globalCss : ''
  if (!css.includes(GALLERY_CSS_MARKER)) {
    metadata.globalCss = stripSection(css, GALLERY_CSS_HEAD) + '\n' + GALLERY_CSS
    changes.push(`${label}: пустая галерея прячется, «развернуть» прячется на видео`)
  }

  if (changes.length === 0) return { structure: input, changes, alreadyMigrated: true }
  return { structure, changes, alreadyMigrated: false }
}
