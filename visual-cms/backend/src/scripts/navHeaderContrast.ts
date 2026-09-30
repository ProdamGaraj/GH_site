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

/** Скрипт шапки с пробой за шапкой и темой активного слайда; остальное — как было. */
export function patchContrastJs(js: string): string {
  return patchCarousel(patchProbe(js))
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
