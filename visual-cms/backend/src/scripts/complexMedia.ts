/**
 * Медиа на странице проекта: «О проекте», «Дизайнерские холлы», «Дворовое
 * пространство».
 *
 * Что было не так:
 * - «О проекте»: одна картинка, а на ней стрелки и кнопка «плей», которые
 *   ничего не делали (в исходном дизайне тоже были декорацией). Видео проекта
 *   (aboutVideo) на страницу не попадало вовсе;
 * - холлы и двор: карусель CMS работает, но пустая галерея (у Doʼstlik нет
 *   фото двора) показывала серую карточку с мёртвыми стрелками и кнопкой
 *   «развернуть»;
 * - скрипт лайтбокса лежит копией в обоих блоках и каждая копия вешала
 *   обработчик на все карточки — по два на карточку.
 *
 * Как стало — и где это настраивается в CMS:
 * - «О проекте»: стрелки и «плей» убраны; если у ЖК есть видео, карточка
 *   становится плеером (повтор по item.aboutVideos, узел <video> с атрибутами
 *   controls/muted/data-autoplay-visible — всё правится в редакторе);
 * - галереи: стрелки при одном кадре прячет рантайм карусели (для всех
 *   каруселей сайта), пустая галерея прячется целиком по data-carousel-count;
 * - лайтбокс привязывается к карточке один раз.
 *
 * Здесь только чистое преобразование структур блоков: запись в базу — в
 * `migrate-complex-media.ts`. Все правки идемпотентны.
 */
import { MigrationError, MigrationResult, StructureNode, findOne, hasClass } from './choiceToPlanTypes'

// --- «О проекте» ---

const ABOUT_VIDEO_HOLDER = 'about-video'

/** Плеер: повтор по 0..1 видео проекта, без видео узла в разметке нет. */
function aboutVideoHolder(): StructureNode {
  return {
    id: 'about-video-holder',
    tagName: 'div',
    elementType: 'container',
    attributes: { class: ABOUT_VIDEO_HOLDER },
    _repeat: { source: 'item.aboutVideos' },
    children: [
      {
        id: 'about-video',
        tagName: 'video',
        elementType: 'video',
        attributes: {
          src: '{{$.url}}',
          poster: '{{$.poster}}',
          controls: 'true',
          muted: 'true',
          playsinline: 'true',
          preload: 'metadata',
          'data-autoplay-visible': 'true',
        },
      },
    ],
  }
}

export const ABOUT_JS_MARKER = '/* О проекте: видео в карточке, v1.'

export const ABOUT_JS = `${ABOUT_JS_MARKER} Видео играет, пока карточка на экране, и
   встаёт на паузу, когда уходит. Звук выключен: иначе браузеры не дают
   автозапуск; кнопки плеера (атрибут controls) — для звука и перемотки.
   Поведение включается атрибутом data-autoplay-visible="true" у <video>. */
(function () {
  var videos = document.querySelectorAll('video[data-autoplay-visible="true"]');
  Array.prototype.forEach.call(videos, function (video) {
    video.muted = true;
    function play() {
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
    }
    if (!('IntersectionObserver' in window)) {
      play();
      return;
    }
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) play();
        else video.pause();
      });
    }, { threshold: 0.35 }).observe(video);
  });
})();
`

export const ABOUT_CSS_MARKER = '/* ==== about-media v1 ===='

export const ABOUT_CSS = `
${ABOUT_CSS_MARKER}
   «О проекте»: видео проекта прямо в карточке, как в дизайне. Плеер есть в
   разметке, только если у ЖК есть видео (повтор по item.aboutVideos), поэтому
   оформление «с видео» включается по его наличию. */
.media-card:has(video)::after {
  display: none;
}

.media-card:has(video) {
  aspect-ratio: 16 / 9;
  min-height: 0;
  background: #0d0f12;
}
`

export function migrateAboutBlock(input: StructureNode): MigrationResult {
  const structure: StructureNode = JSON.parse(JSON.stringify(input))
  const changes: string[] = []

  const card = findOne(structure, (n) => n.attributes?.id === 'aboutMedia', '#aboutMedia')
  const children = card.children ?? []
  const dead = children.filter((c) => hasClass(c, 'side-arrow') || hasClass(c, 'play-button'))
  if (dead.length > 0) {
    card.children = children.filter((c) => !dead.includes(c))
    changes.push(`«О проекте»: убраны нерабочие кнопки (${dead.length})`)
  }
  if (!(card.children ?? []).some((c) => hasClass(c, ABOUT_VIDEO_HOLDER))) {
    card.children = [...(card.children ?? []), aboutVideoHolder()]
    changes.push('«О проекте»: плеер видео проекта (повтор по item.aboutVideos)')
  }

  const metadata = (structure.metadata ??= {})
  const js = typeof metadata.globalJs === 'string' ? metadata.globalJs : ''
  if (!js.includes(ABOUT_JS_MARKER)) {
    metadata.globalJs = (js.trimEnd() ? js.trimEnd() + '\n\n' : '') + ABOUT_JS
    changes.push('«О проекте»: скрипт автозапуска видео на экране')
  }
  const css = typeof metadata.globalCss === 'string' ? metadata.globalCss : ''
  if (!css.includes(ABOUT_CSS_MARKER)) {
    metadata.globalCss = css.trimEnd() + '\n' + ABOUT_CSS
    changes.push('«О проекте»: оформление карточки с видео')
  }

  if (changes.length === 0) return { structure: input, changes, alreadyMigrated: true }
  return { structure, changes, alreadyMigrated: false }
}

// --- Галереи холлов и двора ---

/** Заголовок первой версии скрипта лайтбокса — с него хвост заменяется. */
const LIGHTBOX_JS_HEAD = '/* Разворот галереи-карусели в лайтбокс.'

export const LIGHTBOX_JS_MARKER = `${LIGHTBOX_JS_HEAD} v2.`

export const LIGHTBOX_JS = `${LIGHTBOX_JS_MARKER} Кадры и текущий индекс читаем
   из слайдов: состоянием листания владеет CarouselRuntime, второй счётчик
   заводить нельзя — разъедутся. Сам лайтбокс живёт в блоке оверлеев.
   Скрипт лежит копией в блоках холлов и двора, поэтому карточка
   привязывается один раз (data-lightbox-bound): иначе клик открывал бы
   лайтбокс по разу на каждую копию. */
(function () {
  var cards = document.querySelectorAll('.media-card[data-carousel="true"]');
  Array.prototype.forEach.call(cards, function (card) {
    if (card.getAttribute('data-lightbox-bound') === 'true') return;
    card.setAttribute('data-lightbox-bound', 'true');
    function slides() {
      return [].slice.call(card.querySelectorAll('[data-carousel-slide="true"]'));
    }
    function shots() {
      return slides().map(function (s) {
        var m = (s.style.backgroundImage || '').match(/url\\(["']?(.*?)["']?\\)/);
        return m ? m[1] : '';
      }).filter(Boolean);
    }
    function activeIndex() {
      var list = slides();
      for (var i = 0; i < list.length; i++) {
        if (list[i].classList.contains('is-active')) return i;
      }
      return 0;
    }
    card.addEventListener('click', function (event) {
      var btn = event.target.closest('button');
      /* Стрелки листают карусель — им мешать нельзя. Разворот и клик по фону открывают. */
      if (btn && btn.className.indexOf('expand-button') === -1) return;
      var images = shots();
      if (images.length && window.ghLightbox) window.ghLightbox.open(images, activeIndex());
    });
  });
})();
`

export const GALLERY_CSS_MARKER = '/* ==== gallery-media v1 ===='

export const GALLERY_CSS = `
${GALLERY_CSS_MARKER}
   Галерея без кадров (у проекта нет фото двора или холлов) прячется целиком,
   текст секции занимает всю ширину. Число кадров пишет рантайм карусели в
   data-carousel-count; стрелки при одном кадре он прячет сам. */
.media-card[data-carousel-count="0"] {
  display: none;
}

.gallery-row:has(> .media-card[data-carousel-count="0"]) {
  grid-template-columns: 1fr;
}
`

export function migrateGalleryBlock(input: StructureNode, label: string): MigrationResult {
  const structure: StructureNode = JSON.parse(JSON.stringify(input))
  const changes: string[] = []

  findOne(structure, (n) => hasClass(n, 'media-card') && n.attributes?.['data-carousel'] === 'true', `${label}: карусель .media-card`)

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
    changes.push(`${label}: лайтбокс привязывается к карточке один раз`)
  }
  const css = typeof metadata.globalCss === 'string' ? metadata.globalCss : ''
  if (!css.includes(GALLERY_CSS_MARKER)) {
    metadata.globalCss = css.trimEnd() + '\n' + GALLERY_CSS
    changes.push(`${label}: пустая галерея прячется, текст — во всю ширину`)
  }

  if (changes.length === 0) return { structure: input, changes, alreadyMigrated: true }
  return { structure, changes, alreadyMigrated: false }
}
