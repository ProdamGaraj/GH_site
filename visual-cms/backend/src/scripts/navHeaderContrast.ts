/**
 * Шапка: цвет текста — по тому, что лежит ЗА ней, а не под ней.
 *
 * 1. Проба (2026-09-30). syncLogoContrast (скрипт блока «Navigation») решал,
 *    светлый у шапки текст или тёмный, по точкам на 12 px НИЖЕ её нижней
 *    кромки. На странице проекта шапка висит над светлой полосой, а сразу под
 *    ней начинается фото. При уменьшенном масштабе (80%) фото подходит к шапке
 *    ближе, точки попадали на него, цвет фото не определяется — и срабатывал
 *    дефолт «тёмный фон»: белый текст на светлой полосе. Теперь точки — на
 *    средней линии самой шапки (элементы шапки при пробе пропускаются).
 *
 * 2. Карусель под шапкой (2026-09-30). Цвет фото/видео по стилям не узнать,
 *    поэтому над слайдером главной шапка была одного цвета на всех кадрах.
 *    Теперь тема берётся у АКТИВНОГО слайда карусели: data-header-theme
 *    (вручную в редакторе или CMS при публикации по яркости верха фото), иначе
 *    data-header-theme-live (runtime карусели оценивает кадр видео). Активного,
 *    а не того, что под точкой: при листании лентой под шапкой ещё предыдущий
 *    кадр. Перекраска — по событию carousel:change от карусели, без опроса.
 *
 * 3. Фон страницы (2026-10-02). Если под точкой до самого низа только
 *    прозрачные слои, скрипт не определял ничего и срабатывал дефолт «над
 *    фото» — белый текст. На «Новостях» у страницы нет фона вовсе (белое
 *    рисует браузер): белый текст на белом при любой прокрутке. Теперь, если в
 *    стеке не было ни фото, ни видео, под шапкой — фон страницы: цвет html и
 *    body проверен в стеке, а прозрачные они — белые. Битая картинка ничего
 *    не рисует и фото не считается.
 *
 * 4. Скрытые слайды (2026-10-07). У перехода «перетекание» и «наплыв» все
 *    слайды лежат стопкой, невидимые — прозрачностью, но в стеке под точкой
 *    они есть. Если у активного слайда темы нет (слайд-блок с «Авто»), скрипт
 *    брал метку или фото невидимого слайда сверху стопки. Теперь элементы
 *    неактивных слайдов и копий по краям ленты пропускаются: под активным
 *    слайдом-блоком решает его собственный фон, прозрачный — то, что под
 *    каруселью, и дальше фон страницы. Пока карусель не разметила активный
 *    слайд, ничего не пропускается — как раньше.
 *
 * Правится globalJs блока и кэш-копии блока в страницах (linked-экземпляры):
 * на деплое берётся библиотечный блок, но старой логики не должно остаться
 * нигде. Чистое преобразование; запись — `migrate-nav-header-contrast.ts`.
 */
import { StructureNode, walk } from './choiceToPlanTypes'

export const PROBE_BEFORE = '    const y = clamp(box.bottom + 12, 1, window.innerHeight - 1);'

export const PROBE_AFTER = `    // Пробы — за самой шапкой, по её средней линии: цвет текста решает то, на
    // чём он лежит. Раньше мерили на 12 px ниже шапки — на странице проекта
    // там уже начиналось фото, и над светлой полосой текст белел (при
    // уменьшенном масштабе фото подходит к шапке ближе).
    const y = clamp(box.top + box.height / 2, 1, window.innerHeight - 1);`

const UNDER_POINT_HEAD = '  function themeUnderPoint(x, y) {'

export const CAROUSEL_THEME_FN = `  // Тема активного слайда карусели под шапкой: data-header-theme (вручную в
  // редакторе или CMS при публикации по яркости верха фото), иначе
  // data-header-theme-live (runtime карусели оценивает кадр видео). Активного,
  // а не того, что под точкой: при листании лентой под шапкой ещё прошлый кадр.
  function carouselTheme(el) {
    const carousel = el.closest("[data-carousel]");
    if (!carousel) return null;
    const activeClass = carousel.getAttribute("data-carousel-slide-active-class") || "is-active";
    const slide = carousel.querySelector("[data-carousel-slide]." + activeClass);
    if (!slide) return null;
    const theme = slide.getAttribute("data-header-theme") || slide.getAttribute("data-header-theme-live");
    return theme === "dark" || theme === "light" ? theme : null;
  }

`

export const SKIP_BEFORE = `      if (el.closest(".gnav")) continue;
      const attr = el.getAttribute("data-header-theme");`

export const SKIP_AFTER = `      if (el.closest(".gnav")) continue;
      const slideTheme = carouselTheme(el);
      if (slideTheme) return slideTheme;
      const attr = el.getAttribute("data-header-theme");`

export const LISTENER_ANCHOR = '  window.addEventListener("resize", requestSync);'

export const LISTENER_AFTER = `  window.addEventListener("resize", requestSync);
  // Смена слайда и темы кадра видео (runtime карусели) — перекрасить шапку.
  document.addEventListener("carousel:change", requestSync);`

export const MEDIA_FN = `  // Фото, видео, холст (карта) и фон-картинка: их цвет по стилям не узнать.
  // Битая картинка ничего не рисует — она не фото.
  function isMedia(el, cs) {
    const tag = el.tagName;
    if (tag === "IMG") return !(el.complete && el.naturalWidth === 0);
    if (tag === "VIDEO" || tag === "CANVAS" || tag === "IFRAME") return true;
    return cs.backgroundImage.indexOf("url(") !== -1;
  }

`

export const STACK_BEFORE = `    const stack = document.elementsFromPoint(x, y);
    for (const el of stack) {
`

export const STACK_AFTER = `    const stack = document.elementsFromPoint(x, y);
    let media = false;
    for (const el of stack) {
`

export const FALLBACK_BEFORE = `      if (theme) return theme;
    }
    return null;
  }
`

export const FALLBACK_AFTER = `      if (theme) return theme;
      if (isMedia(el, cs)) media = true;
    }
    // До самого низа прозрачно и ни одного фото — под шапкой фон страницы:
    // цвет html и body проверен выше, а прозрачные они — белые (браузер).
    // Без фото это не «фото без метки»: белый текст на белом («Новости»).
    return media ? null : "light";
  }
`

export const RULES_BEFORE = `     4) ничего не определилось (сплошь медиа без меток) → дефолт тёмный
        (светлый текст) — правило «над фото текст не чернить». */`

export const RULES_AFTER = `     4) до самого низа прозрачно и нет фото/видео → фон страницы, светлый
        (белое рисует браузер);
     5) ничего не определилось (сплошь медиа без меток) → дефолт тёмный
        (светлый текст) — правило «над фото текст не чернить». */`

export interface NavContrastResult {
  structure: StructureNode
  /** id узлов, чей globalJs поправлен. */
  patched: string[]
  alreadyMigrated: boolean
}

function patchProbe(js: string): string {
  return js.split(PROBE_BEFORE).join(PROBE_AFTER)
}

function patchCarousel(js: string): string {
  if (js.includes('function carouselTheme(el)')) return js
  if (!js.includes(UNDER_POINT_HEAD) || !js.includes(SKIP_BEFORE) || !js.includes(LISTENER_ANCHOR)) return js
  return js
    .replace(UNDER_POINT_HEAD, CAROUSEL_THEME_FN + UNDER_POINT_HEAD)
    .replace(SKIP_BEFORE, SKIP_AFTER)
    .replace(LISTENER_ANCHOR, LISTENER_AFTER)
}

export const HIDDEN_SLIDE_FN = `  // Элемент внутри невидимого слайда карусели (неактивный — при «перетекании»
  // все слайды лежат стопкой — или копия по краю ленты): он не виден за
  // шапкой и решать её цвет не должен. Пока активного слайда нет (карусель не
  // запустилась), не пропускаем ничего.
  function inHiddenSlide(el) {
    const slide = el.closest("[data-carousel-slide], [data-carousel-clone]");
    if (!slide) return false;
    const carousel = slide.closest("[data-carousel]");
    if (!carousel) return false;
    const activeClass = carousel.getAttribute("data-carousel-slide-active-class") || "is-active";
    if (!carousel.querySelector("[data-carousel-slide]." + activeClass)) return false;
    if (slide.hasAttribute("data-carousel-clone")) return true;
    return !slide.classList.contains(activeClass);
  }

`

export const HIDDEN_BEFORE = `      const slideTheme = carouselTheme(el);
      if (slideTheme) return slideTheme;
`

export const HIDDEN_AFTER = `      const slideTheme = carouselTheme(el);
      if (slideTheme) return slideTheme;
      if (inHiddenSlide(el)) continue;
`

function patchHiddenSlides(js: string): string {
  if (js.includes('function inHiddenSlide(el)')) return js
  if (!js.includes(UNDER_POINT_HEAD) || !js.includes(HIDDEN_BEFORE)) return js
  return js.replace(UNDER_POINT_HEAD, HIDDEN_SLIDE_FN + UNDER_POINT_HEAD).replace(HIDDEN_BEFORE, HIDDEN_AFTER)
}

function patchPageCanvas(js: string): string {
  if (js.includes('function isMedia(el, cs)')) return js
  if (![UNDER_POINT_HEAD, STACK_BEFORE, FALLBACK_BEFORE, RULES_BEFORE].every((anchor) => js.includes(anchor))) return js
  return js
    .replace(UNDER_POINT_HEAD, MEDIA_FN + UNDER_POINT_HEAD)
    .replace(STACK_BEFORE, STACK_AFTER)
    .replace(FALLBACK_BEFORE, FALLBACK_AFTER)
    .replace(RULES_BEFORE, RULES_AFTER)
}

/**
 * Скрипт шапки с пробой за шапкой, темой активного слайда, фоном страницы и
 * без невидимых слайдов в стеке; остальное — как было.
 */
export function patchContrastJs(js: string): string {
  return patchHiddenSlides(patchPageCanvas(patchCarousel(patchProbe(js))))
}

/** Скрипт шапки, который этот модуль правит (есть syncLogoContrast). */
function isHeaderScript(js: string): boolean {
  return js.includes('function syncLogoContrast()') && js.includes(UNDER_POINT_HEAD)
}

export function migrateNavHeaderContrast(input: StructureNode): NavContrastResult {
  const structure: StructureNode = JSON.parse(JSON.stringify(input))
  const patched: string[] = []
  walk(structure, (node) => {
    const js = node.metadata?.globalJs
    if (typeof js !== 'string' || !isHeaderScript(js)) return
    const next = patchContrastJs(js)
    if (next === js) return
    node.metadata!.globalJs = next
    patched.push(node.id ?? '(корень)')
  })
  if (patched.length === 0) return { structure: input, patched, alreadyMigrated: true }
  return { structure, patched, alreadyMigrated: false }
}
