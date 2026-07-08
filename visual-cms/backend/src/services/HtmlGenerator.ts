/**
 * Сервис генерации HTML из структуры страницы
 */
import { styleGenerator } from './StyleGenerator'
import { generateDataBindingRuntime, type PageDataConfig } from './DataBindingGenerator'
import { generateCarouselRuntime } from './CarouselRuntime'
import { generateResponsiveMediaRuntime } from './ResponsiveMediaRuntime'
import {
  resolveResponsiveMedia,
  generateBackgroundMediaCss,
  buildPictureTag,
  type MediaPlanMap,
  type TranslationFieldMap,
} from './ResponsiveMediaResolver'
import type { BlockNode, CSSProperties } from '../types/blockNode'
import { breakpointRangeMap } from './breakpointRanges'

export interface AvailableLanguage {
  code: string
  name: string
  flag: string
  isDefault: boolean
  direction: string
}

interface PageMetadata {
  title: string
  description: string
  keywords: string[]
  ogImage?: string
}

export interface ResolvedNavItem {
  label: string
  href: string
  openInNewTab?: boolean
  children?: ResolvedNavItem[]
}

/**
 * Параметры генерации страницы. Перешли на options-объект (вместо длинного
 * позиционного списка), чтобы безопасно прокидывать ассеты уровня сайта.
 *
 * Уровни общих стилей/скриптов:
 *  - сайт   → siteCss/siteJs (из Site.settings, общие для всех страниц);
 *  - страница → structure.metadata.globalCss/globalJs (корень дерева);
 *  - блок   → metadata.globalCss/globalJs вложенных узлов (собираются и дедупятся здесь).
 */
export interface GeneratePageOptions {
  metadata: PageMetadata
  slug: string
  dataConfig?: PageDataConfig
  lang?: string
  direction?: string
  availableLanguages?: AvailableLanguage[]
  navigation?: ResolvedNavItem[]
  /** Общий CSS сайта (сырой) — инлайнится в <head> до стилей страницы. */
  siteCss?: string
  /** Общий JS сайта (сырой) — инлайнится перед скриптами страницы. */
  siteJs?: string
  /** Сырой HTML сайта в <head> (Site.settings.customHeadHtml). */
  siteCustomHead?: string
  /** Сырой HTML сайта перед </body> (Site.settings.customBodyEndHtml). */
  siteCustomBodyEnd?: string
  /**
   * Переводы активного языка (плоская карта nodeId→field→value) для разрешения
   * адаптивного медиа «экран × язык». Для дефолтного языка не передаётся ({}).
   */
  translationMap?: TranslationFieldMap
  /**
   * UUID страницы для аналитики. Если задан — в конец <body> инжектится
   * /api/analytics/tracker.js (pageview, Web Vitals, engagement блоков и т.д.).
   * Деплой передаёт всегда; превью — НЕ передаёт, чтобы не загрязнять статистику.
   */
  analyticsPageId?: string
}

export class HtmlGenerator {
  /**
   * Генерирует полный HTML документ из структуры страницы
   */
  generatePage(structure: BlockNode, options: GeneratePageOptions): string {
    const { metadata, slug, dataConfig, lang, direction, availableLanguages, navigation } = options

    // Собираем ID specificChildren для базового скрытия
    const specificChildrenIds = styleGenerator.collectSpecificChildrenIds(structure)

    // План адаптивного медиа (матрица «экран × язык»): <picture> для <img> и фон-@media.
    const breakpoints = styleGenerator.getBreakpoints(structure)
    const mediaPlan = resolveResponsiveMedia(structure, options.translationMap || {}, breakpoints)

    const bodyContent = this.renderNode(structure, '  ', mediaPlan)

    // Генерируем CSS для hover, анимаций и т.д.
    const { css: dynamicCSS, keyframes, scripts } = styleGenerator.generateNodeTreeStyles(structure)

    // Генерируем responsive CSS (@media queries) из variations
    const responsiveCSS = styleGenerator.generateResponsiveCSS(structure)

    // Фоновые @media из плана медиа (backgroundImage делегирован сюда из StyleGenerator).
    const responsiveMediaCSS = generateBackgroundMediaCss(mediaPlan, breakpoints)

    // Базовый CSS для скрытия specificChildren (они показываются только в своём @media)
    let specificHideCSS = ''
    if (specificChildrenIds.size > 0) {
      const selectors = Array.from(specificChildrenIds).map(id => `[data-element-id="${id}"]`)
      specificHideCSS = `\n    /* Hide viewport-specific elements by default */\n    ${selectors.join(',\n    ')} { display: none !important; }\n`
    }

    // Custom HTML injected by user via source code editor
    const customHeadHtml = structure.metadata?.customHeadHtml || ''
    const customBodyEndHtml = structure.metadata?.customBodyEndHtml || ''

    // --- Общие стили/скрипты по уровням (сайт → страница → блок) ---
    // Страница — на корне дерева; блок — на вложенных узлах (дедуп по контенту).
    const blockAssets = this.collectBlockAssets(structure)
    // CSS-чанки встраиваются внутрь основного <style> после reset, до dynamic,
    // чтобы element-specific dynamic/responsive перебивали общий авторский CSS.
    const authoredCss = [
      this.cssChunk(options.siteCss, 'Site CSS'),
      this.cssChunk(structure.metadata?.globalCss, 'Page CSS'),
      this.cssChunk(blockAssets.css, 'Block CSS'),
    ].filter(Boolean).join('\n')
    // JS — отдельными <script> в конце <body>, после рантаймов, до element-скриптов.
    const authoredJs = [
      this.scriptTag(options.siteJs, 'Site JS'),
      this.scriptTag(structure.metadata?.globalJs, 'Page JS'),
      ...blockAssets.jsList.map(js => this.scriptTag(js, 'Block JS')),
    ].join('')
    // Сырые HTML-инжекты уровня сайта (как у страницы, но общие).
    const siteCustomHead = options.siteCustomHead || ''
    const siteCustomBodyEnd = options.siteCustomBodyEnd || ''

    return `<!DOCTYPE html>
<html lang="${lang || 'ru'}"${direction === 'rtl' ? ' dir="rtl"' : ''}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(metadata.title)}</title>
  <meta name="description" content="${this.escapeHtml(metadata.description)}">
  ${metadata.keywords?.length ? `<meta name="keywords" content="${this.escapeHtml(metadata.keywords.join(', '))}">` : ''}
  ${metadata.ogImage ? `<meta property="og:image" content="${this.escapeHtml(metadata.ogImage)}">` : ''}
  <meta property="og:title" content="${this.escapeHtml(metadata.title)}">
  <meta property="og:description" content="${this.escapeHtml(metadata.description)}">
  <meta property="og:type" content="website">
  
  <!-- Muller Font -->
  <style>
    @font-face {
      font-family: 'Muller';
      src: url('/fonts/Muller-Light.woff2') format('woff2');
      font-weight: 300;
      font-style: normal;
    }
    @font-face {
      font-family: 'Muller';
      src: url('/fonts/Muller-Regular.woff2') format('woff2');
      font-weight: 400;
      font-style: normal;
    }
    @font-face {
      font-family: 'Muller';
      src: url('/fonts/Muller-Medium.woff2') format('woff2');
      font-weight: 500;
      font-style: normal;
    }
    @font-face {
      font-family: 'Muller';
      src: url('/fonts/Muller-Bold.woff2') format('woff2');
      font-weight: 700;
      font-style: normal;
    }
    @font-face {
      font-family: 'Muller';
      src: url('/fonts/Muller-ExtraBold.woff2') format('woff2');
      font-weight: 800;
      font-style: normal;
    }
    
    /* Reset & Base Styles */
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    html {
      scroll-behavior: smooth;
    }
    
    body {
      font-family: 'Muller', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    
    img {
      max-width: 100%;
      height: auto;
      display: block;
    }
    
    a {
      text-decoration: none;
      color: inherit;
    }
    
    button {
      font-family: inherit;
      cursor: pointer;
    }
    
    input, textarea {
      font-family: inherit;
    }
${authoredCss}
    /* Keyframes for animations */
    ${keyframes}
    
    /* Dynamic styles (hover, animations, etc.) */
    ${dynamicCSS}
    
    /* Form and output binding styles */
    ${styleGenerator.generateFormStyles()}
${specificHideCSS}${responsiveCSS}${responsiveMediaCSS}
  </style>
${siteCustomHead ? '  ' + siteCustomHead.split('\n').join('\n  ') + '\n' : ''}${customHeadHtml ? '  ' + customHeadHtml.split('\n').join('\n  ') + '\n' : ''}</head>
<body>
${bodyContent}
${this.generateLanguageSwitcher(slug, lang, availableLanguages)}
${navigation && navigation.length > 0 ? this.generateNavRuntime(navigation) : ''}
${dataConfig ? generateDataBindingRuntime(dataConfig) : ''}
  <script>window.__ghBreakpoints = ${JSON.stringify((() => {
    // boundary = верхняя граница диапазона (null = не ограничен сверху) —
    // рантайм свапа медиа обязан совпадать с границами @media/<picture>.
    const ranges = breakpointRangeMap(breakpoints)
    return breakpoints
      .filter(b => typeof b.width === 'number')
      .map(b => ({ id: b.id, width: b.width, boundary: ranges.get(b.id)?.maxWidth ?? null }))
  })())};</script>
${generateResponsiveMediaRuntime()}
${generateCarouselRuntime()}
${options.analyticsPageId ? `  <script src="/api/analytics/tracker.js" data-page-id="${options.analyticsPageId}" defer></script>\n` : ''}
${authoredJs}${scripts ? `<script>\n${scripts}\n</script>` : ''}
${siteCustomBodyEnd ? siteCustomBodyEnd + '\n' : ''}${customBodyEndHtml ? customBodyEndHtml + '\n' : ''}</body>
</html>`
  }

  /**
   * Генерирует JS-рантайм для переключения языков.
   * Не рисует никакого UI — пользователь сам создаёт элементы в редакторе
   * и привязывает их через data-атрибуты:
   *
   *   data-lang-switch="en"       — клик переключает на язык en
   *   data-lang-switch="kz"       — клик переключает на язык kz
   *   data-lang-selector           — <select> с <option value="en"> автоматически работает
   *   data-lang-current            — textContent заполняется названием текущего языка
   *   data-lang-current="code"     — textContent заполняется кодом языка
   *   data-lang-current="flag"     — textContent заполняется флагом
   *   data-lang-current="name"     — textContent заполняется нативным названием
   *   data-lang-active="en"        — элемент получает класс 'active' если текущий язык en
   *
   * JS API (глобальный):
   *   window.__gh.languages       — массив доступных языков
   *   window.__gh.currentLang     — текущий код языка
   *   window.__gh.switchLang(code) — переход на другой язык
   *   window.__gh.getLangUrl(code) — получить URL для языка
   */
  private generateLanguageSwitcher(slug: string, currentLang?: string, languages?: AvailableLanguage[]): string {
    if (!languages || languages.length < 2) return ''

    const currentCode = currentLang || languages.find(l => l.isDefault)?.code || 'ru'
    // Чистые URL без .html: домашняя → '' (корень), остальные → '<slug>/'
    const seg = slug === 'index' || slug === 'home' ? '' : `${slug}/`

    return `
  <!-- Language Runtime -->
  <script>
  (function(){
    var langs = ${JSON.stringify(languages)};
    var current = ${JSON.stringify(currentCode)};
    var seg = ${JSON.stringify(seg)};

    function getLangUrl(code) {
      var lang = langs.find(function(l){ return l.code === code; });
      if (!lang) return null;
      return lang.isDefault ? '/' + seg : '/' + code + '/' + seg;
    }

    function switchLang(code) {
      var url = getLangUrl(code);
      if (url) window.location.href = url;
    }

    // Global API
    window.__gh = window.__gh || {};
    window.__gh.languages = langs;
    window.__gh.currentLang = current;
    window.__gh.switchLang = switchLang;
    window.__gh.getLangUrl = getLangUrl;

    // Auto-bind data attributes on DOM ready
    function init() {
      // data-lang-switch="code" — click to switch
      document.querySelectorAll('[data-lang-switch]').forEach(function(el){
        el.addEventListener('click', function(e){
          e.preventDefault();
          switchLang(el.getAttribute('data-lang-switch'));
        });
      });

      // data-lang-selector — <select> with language options
      document.querySelectorAll('[data-lang-selector]').forEach(function(sel){
        // Auto-populate if empty
        if (sel.tagName === 'SELECT' && sel.options.length === 0) {
          langs.forEach(function(l){
            var opt = document.createElement('option');
            opt.value = l.code;
            opt.textContent = l.flag + ' ' + l.name;
            if (l.code === current) opt.selected = true;
            sel.appendChild(opt);
          });
        }
        // Set current value
        if (sel.tagName === 'SELECT') sel.value = current;
        sel.addEventListener('change', function(){
          switchLang(sel.value);
        });
      });

      // data-lang-current — show current language info
      var currentLangObj = langs.find(function(l){ return l.code === current; });
      if (currentLangObj) {
        document.querySelectorAll('[data-lang-current]').forEach(function(el){
          var attr = el.getAttribute('data-lang-current');
          if (attr === 'code') el.textContent = currentLangObj.code;
          else if (attr === 'flag') el.textContent = currentLangObj.flag;
          else if (attr === 'name') el.textContent = currentLangObj.name;
          else el.textContent = currentLangObj.flag + ' ' + currentLangObj.name;
        });
      }

      // data-lang-active="code" — add 'active' class if current
      document.querySelectorAll('[data-lang-active]').forEach(function(el){
        if (el.getAttribute('data-lang-active') === current) {
          el.classList.add('active');
        }
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();
  </script>`
  }

  /**
   * Некурсивно рендерит узел в HTML
   */
  private renderNode(node: BlockNode, indent: string = '  ', mediaPlan?: MediaPlanMap): string {
    if (!node) return ''

    const tagName = node.tagName || 'div'
    const styles = this.renderStyles(node.styles?.properties || {})
    let attributes = this.renderAttributes(
      this.normalizeLinkAttributes(tagName, this.normalizeMediaAttributes(tagName, node.attributes || {}))
    )

    // Брейкпоинтные подмены src у <video>: media-атрибут на <video><source>
    // браузеры игнорируют, поэтому свапаем JS-рантаймом data-rmedia (тот же,
    // что у динамических слайдов). Язык уже запечён в base-src (applyTranslations),
    // а карта содержит только экраны, отличные от базы.
    if (tagName.toLowerCase() === 'video' && !(node.attributes || {})['data-rmedia']) {
      const videoSources = mediaPlan?.get(node.id)?.img
      if (videoSources && videoSources.length > 0) {
        const rmediaMap: Record<string, string> = {}
        for (const s of videoSources) rmediaMap[s.bpId] = s.value
        attributes += ` data-rmedia="${this.escapeHtml(JSON.stringify(rmediaMap))}" data-rmedia-kind="src"`
      }
    }

    // Добавляем data-element-id для CSS селекторов (hover, анимации) и data-element-name
    const dataAttr = ` data-element-id="${node.id}"` + (node.metadata?.name ? ` data-element-name="${node.metadata.name.replace(/"/g, '&quot;')}"` : '')

    // Void elements (самозакрывающиеся)
    const voidElements = ['input', 'img', 'br', 'hr', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr']

    if (voidElements.includes(tagName.toLowerCase())) {
      const voidTag = `<${tagName}${styles}${dataAttr}${attributes} />`
      // Адаптивный <img> (art-direction): оборачиваем в <picture> с <source media>.
      // data-element-id и атрибуты остаются на внутреннем <img> — CSS-селекторы,
      // карусель и биндинги не замечают разницы.
      const imgSources = tagName.toLowerCase() === 'img' ? mediaPlan?.get(node.id)?.img : undefined
      if (imgSources && imgSources.length > 0) {
        return `${indent}${buildPictureTag(voidTag, imgSources, (s) => this.escapeHtml(s))}\n`
      }
      return `${indent}${voidTag}\n`
    }
    
    // HTML code elements - output raw content without escaping
    if (node.elementType === 'html-code') {
      const rawContent = node.content || ''
      if (!rawContent) {
        return `${indent}<${tagName}${styles}${dataAttr}${attributes}></${tagName}>\n`
      }
      return `${indent}<${tagName}${styles}${dataAttr}${attributes}>\n${rawContent}\n${indent}</${tagName}>\n`
    }
    
    // Текстовый контент
    const textContent = node.content ? this.escapeHtml(node.content) : ''
    
    // Дочерние элементы
    const childrenHtml = node.children?.map(child =>
      this.renderNode(child, indent + '  ', mediaPlan)
    ).join('') || ''

    // Viewport-specific elements from variations (specificChildren)
    let specificChildrenHtml = ''
    if (node.variations) {
      for (const variation of Object.values(node.variations)) {
        if (variation.specificChildren) {
          specificChildrenHtml += variation.specificChildren.map(child =>
            this.renderNode(child, indent + '  ', mediaPlan)
          ).join('')
        }
      }
    }
    
    const allChildrenHtml = childrenHtml + specificChildrenHtml
    
    if (!textContent && !allChildrenHtml) {
      return `${indent}<${tagName}${styles}${dataAttr}${attributes}></${tagName}>\n`
    }
    
    if (textContent && !allChildrenHtml) {
      return `${indent}<${tagName}${styles}${dataAttr}${attributes}>${textContent}</${tagName}>\n`
    }
    
    return `${indent}<${tagName}${styles}${dataAttr}${attributes}>\n${textContent ? indent + '  ' + textContent + '\n' : ''}${allChildrenHtml}${indent}</${tagName}>\n`
  }

  /**
   * Конвертирует объект стилей в inline style атрибут
   */
  private renderStyles(properties: CSSProperties): string {
    if (!properties || Object.keys(properties).length === 0) {
      return ''
    }
    
    const cssString = Object.entries(properties)
      .filter(([_, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => {
        // Конвертируем camelCase в kebab-case
        const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
        return `${cssKey}: ${value}`
      })
      .join('; ')

    if (!cssString) return ''
    // Экранируем двойные кавычки: значение вроде background-image: url("...") иначе
    // закрывает style="..." раньше времени и ломает разметку соседних элементов.
    // &quot; в атрибуте корректно декодируется браузером обратно в ".
    const safeCss = cssString.replace(/"/g, '&quot;')
    return ` style="${safeCss}"`
  }

  /**
   * Булевы HTML-атрибуты: в HTML само присутствие атрибута = «включено»
   * (controls="false" и controls="" — это ВКЛ). Редактор хранит их строками
   * 'true'/'false'/'', поэтому эмитим голый атрибут только при 'true',
   * иначе опускаем — иначе выключить controls/autoplay было невозможно.
   */
  private static readonly BOOLEAN_ATTRS = new Set([
    'controls', 'autoplay', 'loop', 'muted', 'playsinline',
    'disabled', 'checked', 'required', 'readonly', 'multiple', 'selected',
  ])

  /**
   * Гарантии воспроизводимости <video>: autoplay без muted браузеры блокируют,
   * а iOS дополнительно требует playsinline. Чтобы «видео с автозапуском» из
   * редактора реально играло, добавляем оба атрибута к autoplay-видео.
   */
  private normalizeMediaAttributes(tagName: string, attributes: Record<string, string>): Record<string, string> {
    if (tagName.toLowerCase() !== 'video') return attributes
    const autoplayOn = attributes.autoplay !== undefined && attributes.autoplay !== 'false'
    if (!autoplayOn) return attributes
    return { ...attributes, muted: 'true', playsinline: 'true' }
  }

  /**
   * Внутренние относительные href у <a> ("contacts", "./news") на деплое ломаются:
   * страницы публикуются директориями /<slug>/index.html, и браузер резолвит
   * такой href относительно текущей страницы (/about/contacts вместо /contacts).
   * Приводим к корневому виду. Не трогаем: абсолютные URL (scheme:, //),
   * уже корневые (/), якоря (#) и query (?).
   */
  private normalizeLinkAttributes(tagName: string, attributes: Record<string, string>): Record<string, string> {
    if (tagName.toLowerCase() !== 'a') return attributes
    const href = attributes.href
    if (!href || /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#|\?)/i.test(href)) return attributes
    return { ...attributes, href: '/' + href.replace(/^(?:\.\.?\/)+/, '') }
  }

  /**
   * Конвертирует объект атрибутов в строку атрибутов
   */
  private renderAttributes(attributes: Record<string, string>): string {
    if (!attributes || Object.keys(attributes).length === 0) {
      return ''
    }

    return Object.entries(attributes)
      .filter(([key, value]) => value !== undefined && value !== null && key !== 'style')
      .map(([key, value]) => {
        if (HtmlGenerator.BOOLEAN_ATTRS.has(key.toLowerCase())) {
          // Семантика HTML: присутствие атрибута = ВКЛ ('' — импорт голого атрибута,
          // 'controls="controls"' — легаси-разметка). Выкл = 'false' или отсутствие
          // атрибута (редактор при снятии галки удаляет ключ).
          return value === 'false' ? '' : ` ${key}`
        }
        return ` ${key}="${this.escapeHtml(value)}"`
      })
      .join('')
  }

  /**
   * Экранирует HTML спецсимволы
   */
  private escapeHtml(text: string): string {
    if (!text) return ''
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  /**
   * Экранирует закрывающий тег внутри сырого CSS/JS, чтобы он не завершил
   * инлайновый <style>/<script> раньше времени. `</style>`/`</script>` (любой
   * регистр) → `<\/style>`/`<\/script>`. В CSS/JS-строке `\/` эквивалентно `/`,
   * поэтому семантика сохраняется, а HTML-парсер тег не закрывает.
   */
  private escapeClosingTag(code: string, tag: 'style' | 'script'): string {
    return code.replace(new RegExp(`</(${tag})`, 'gi'), '<\\/$1')
  }

  /**
   * Готовит чанк авторского CSS для встраивания в основной <style>.
   * Пустые/пробельные значения дают пустую строку (нет лишних комментариев).
   */
  private cssChunk(rawCss: string | undefined, label: string): string {
    const css = rawCss?.trim()
    if (!css) return ''
    return `    /* ${label} */\n${this.escapeClosingTag(css, 'style')}\n`
  }

  /**
   * Оборачивает сырой JS в отдельный <script>. Пустой JS → пустая строка.
   */
  private scriptTag(rawJs: string | undefined, label: string): string {
    const js = rawJs?.trim()
    if (!js) return ''
    return `<script>\n/* ${label} */\n${this.escapeClosingTag(js, 'script')}\n</script>\n`
  }

  /**
   * Собирает общие CSS/JS уровня блока из вложенных узлов дерева, дедуп по
   * контенту. Корень исключён — это уровень страницы. Один и тот же блок,
   * встречающийся N раз (linked/repeater), эмитится один раз.
   */
  private collectBlockAssets(root: BlockNode): { css: string; jsList: string[] } {
    const cssSet = new Set<string>()
    const jsSet = new Set<string>()

    const visit = (node: BlockNode, isRoot: boolean): void => {
      if (!isRoot) {
        const css = node.metadata?.globalCss?.trim()
        const js = node.metadata?.globalJs?.trim()
        if (css) cssSet.add(css)
        if (js) jsSet.add(js)
      }
      for (const child of node.children || []) visit(child, false)
      // specificChildren из variations тоже попадают в HTML — учитываем их ассеты.
      if (node.variations) {
        for (const variation of Object.values(node.variations)) {
          for (const sc of variation.specificChildren || []) visit(sc, false)
        }
      }
    }

    visit(root, true)
    return {
      css: Array.from(cssSet).join('\n\n'),
      jsList: Array.from(jsSet),
    }
  }

  /**
   * Генерирует JS-рантайм для навигации сайта.
   * window.__siteNav — массив пунктов меню с resolved href.
   * Элементы с data-site-nav автоматически заполняются навигацией.
   */
  private generateNavRuntime(navigation: ResolvedNavItem[]): string {
    return `
  <!-- Site Navigation Runtime -->
  <script>
  (function(){
    var nav = ${JSON.stringify(navigation)};
    window.__siteNav = nav;

    function buildNavItems(items, ul) {
      items.forEach(function(item) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = item.href;
        a.textContent = item.label;
        if (item.openInNewTab) { a.target = '_blank'; a.rel = 'noopener'; }
        li.appendChild(a);
        if (item.children && item.children.length > 0) {
          var sub = document.createElement('ul');
          buildNavItems(item.children, sub);
          li.appendChild(sub);
        }
        ul.appendChild(li);
      });
    }

    // Build label→href map (including children)
    function buildHrefMap(items, map) {
      items.forEach(function(item) {
        if (item.label && item.href && item.href !== '#') {
          map[item.label.trim().toLowerCase()] = item.href;
        }
        if (item.children) buildHrefMap(item.children, map);
      });
      return map;
    }

    document.addEventListener('DOMContentLoaded', function() {
      // 1. Auto-fill [data-site-nav] containers
      document.querySelectorAll('[data-site-nav]').forEach(function(el) {
        var ul = document.createElement('ul');
        buildNavItems(nav, ul);
        el.innerHTML = '';
        el.appendChild(ul);
      });

      // 2. Resolve existing header/nav links by matching text content
      var hrefMap = buildHrefMap(nav, {});
      var selectors = 'header a[href="#"], nav a[href="#"], [data-element-name="Header"] a[href="#"], [data-element-name="Navigation"] a[href="#"]';
      document.querySelectorAll(selectors).forEach(function(a) {
        var text = (a.textContent || '').trim().toLowerCase();
        if (text && hrefMap[text]) {
          a.href = hrefMap[text];
        }
      });
    });
  })();
  </script>
`
  }
}

export const htmlGenerator = new HtmlGenerator()



