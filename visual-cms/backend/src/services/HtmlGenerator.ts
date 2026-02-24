/**
 * РЎРµСЂРІРёСЃ РіРµРЅРµСЂР°С†РёРё HTML РёР· СЃС‚СЂСѓРєС‚СѓСЂС‹ СЃС‚СЂР°РЅРёС†С‹
 */
import { styleGenerator } from './StyleGenerator'
import { generateDataBindingRuntime, type PageDataConfig } from './DataBindingGenerator'

interface CSSProperties {
  [key: string]: string | undefined
}

interface StateStyles {
  hover?: CSSProperties
  active?: CSSProperties
  focus?: CSSProperties
  disabled?: CSSProperties
}

interface StateTransition {
  duration: number
  easing: string
  properties: string[]
}

export interface AvailableLanguage {
  code: string
  name: string
  flag: string
  isDefault: boolean
  direction: string
}

interface Animation {
  id: string
  preset?: string
  trigger: 'load' | 'scroll-into-view' | 'click' | 'loop'
  duration: number
  delay: number
  easing: string
  iterationCount: number | 'infinite'
  keyframes?: { offset: number; properties: CSSProperties }[]
}

interface BlockNodeVariation {
  inheritedOverrides?: {
    [nodeId: string]: {
      hidden?: boolean
      styles?: Record<string, string>
      attributes?: Record<string, string>
      content?: string
    }
  }
  specificChildren?: BlockNode[]
}

interface BlockNode {
  id: string
  elementType: string
  tagName: string
  content?: string
  attributes?: Record<string, string>
  styles: {
    properties: Record<string, string>
    states?: StateStyles
    stateTransition?: StateTransition
  }
  children: BlockNode[]
  metadata: {
    name?: string
    /** Raw HTML to inject into <head> (scripts, styles, etc.) — only on root node */
    customHeadHtml?: string
    /** Raw HTML to inject before </body> (scripts, etc.) — only on root node */
    customBodyEndHtml?: string
    /** Breakpoint definitions for responsive CSS — only on root node */
    breakpoints?: Array<{ id: string; name: string; width: number; height?: number }>
  }
  animations?: Animation[]
  variations?: {
    [breakpointId: string]: BlockNodeVariation
  }
}

interface PageMetadata {
  title: string
  description: string
  keywords: string[]
  ogImage?: string
}

export class HtmlGenerator {
  /**
   * Р“РµРЅРµСЂРёСЂСѓРµС‚ РїРѕР»РЅС‹Р№ HTML РґРѕРєСѓРјРµРЅС‚ РёР· СЃС‚СЂСѓРєС‚СѓСЂС‹ СЃС‚СЂР°РЅРёС†С‹
   */
  generatePage(structure: BlockNode, metadata: PageMetadata, slug: string, dataConfig?: PageDataConfig, lang?: string, direction?: string, availableLanguages?: AvailableLanguage[]): string {
    // Собираем ID specificChildren для базового скрытия
    const specificChildrenIds = styleGenerator.collectSpecificChildrenIds(structure as any)
    
    const bodyContent = this.renderNode(structure)
    
    // Генерируем CSS для hover, анимаций и т.д.
    const { css: dynamicCSS, keyframes, scripts } = styleGenerator.generateNodeTreeStyles(structure as any)

    // Генерируем responsive CSS (@media queries) из variations
    const responsiveCSS = styleGenerator.generateResponsiveCSS(structure as any)

    // Базовый CSS для скрытия specificChildren (они показываются только в своём @media)
    let specificHideCSS = ''
    if (specificChildrenIds.size > 0) {
      const selectors = Array.from(specificChildrenIds).map(id => `[data-element-id="${id}"]`)
      specificHideCSS = `\n    /* Hide viewport-specific elements by default */\n    ${selectors.join(',\n    ')} { display: none !important; }\n`
    }

    // Custom HTML injected by user via source code editor
    const customHeadHtml = structure.metadata?.customHeadHtml || ''
    const customBodyEndHtml = structure.metadata?.customBodyEndHtml || ''
    
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
    
    /* Keyframes for animations */
    ${keyframes}
    
    /* Dynamic styles (hover, animations, etc.) */
    ${dynamicCSS}
    
    /* Form and output binding styles */
    ${styleGenerator.generateFormStyles()}
${specificHideCSS}${responsiveCSS}
  </style>
${customHeadHtml ? '  ' + customHeadHtml.split('\n').join('\n  ') + '\n' : ''}</head>
<body>
${bodyContent}
${this.generateLanguageSwitcher(slug, lang, availableLanguages)}
${dataConfig ? generateDataBindingRuntime(dataConfig) : ''}
${scripts ? `<script>\n${scripts}\n</script>` : ''}
${customBodyEndHtml ? customBodyEndHtml + '\n' : ''}</body>
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
    const fileName = slug === 'index' || slug === 'home' ? 'index.html' : `${slug}.html`

    return `
  <!-- Language Runtime -->
  <script>
  (function(){
    var langs = ${JSON.stringify(languages)};
    var current = ${JSON.stringify(currentCode)};
    var file = ${JSON.stringify(fileName)};

    function getLangUrl(code) {
      var lang = langs.find(function(l){ return l.code === code; });
      if (!lang) return null;
      return lang.isDefault ? '/' + file : '/' + code + '/' + file;
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
  private renderNode(node: BlockNode, indent: string = '  '): string {
    if (!node) return ''
    
    const tagName = node.tagName || 'div'
    const styles = this.renderStyles(node.styles?.properties || {})
    const attributes = this.renderAttributes(node.attributes || {})
    
    // Р"РѕР±Р°РІР»СЏРµРј data-element-id РґР»СЏ CSS СЃРµР»РµРєС‚РѕСЂРѕРІ (hover, Р°РЅРёРјР°С†РёРї) Рё data-element-name
    const dataAttr = ` data-element-id="${node.id}"` + (node.metadata?.name ? ` data-element-name="${node.metadata.name.replace(/"/g, '&quot;')}"` : '')
    
    // Void elements (СЃР°РјРѕР·Р°РєСЂС‹РІР°СЋС‰РёРµСЃСЏ)
    const voidElements = ['input', 'img', 'br', 'hr', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr']
    
    if (voidElements.includes(tagName.toLowerCase())) {
      return `${indent}<${tagName}${styles}${dataAttr}${attributes} />\n`
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
    
    // Р”РѕС‡РµСЂРЅРёРµ СЌР»РµРјРµРЅС‚С‹
    const childrenHtml = node.children?.map(child => 
      this.renderNode(child, indent + '  ')
    ).join('') || ''
    
    // Viewport-specific elements from variations (specificChildren)
    let specificChildrenHtml = ''
    if (node.variations) {
      for (const variation of Object.values(node.variations)) {
        if (variation.specificChildren) {
          specificChildrenHtml += variation.specificChildren.map(child =>
            this.renderNode(child, indent + '  ')
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
   * РљРѕРЅРІРµСЂС‚РёСЂСѓРµС‚ РѕР±СЉРµРєС‚ СЃС‚РёР»РµР№ РІ inline style Р°С‚СЂРёР±СѓС‚
   */
  private renderStyles(properties: Record<string, string>): string {
    if (!properties || Object.keys(properties).length === 0) {
      return ''
    }
    
    const cssString = Object.entries(properties)
      .filter(([_, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => {
        // РљРѕРЅРІРµСЂС‚РёСЂСѓРµРј camelCase РІ kebab-case
        const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
        return `${cssKey}: ${value}`
      })
      .join('; ')
    
    return cssString ? ` style="${cssString}"` : ''
  }

  /**
   * РљРѕРЅРІРµСЂС‚РёСЂСѓРµС‚ РѕР±СЉРµРєС‚ Р°С‚СЂРёР±СѓС‚РѕРІ РІ СЃС‚СЂРѕРєСѓ Р°С‚СЂРёР±СѓС‚РѕРІ
   */
  private renderAttributes(attributes: Record<string, string>): string {
    if (!attributes || Object.keys(attributes).length === 0) {
      return ''
    }
    
    return Object.entries(attributes)
      .filter(([key, value]) => value !== undefined && value !== null && key !== 'style')
      .map(([key, value]) => ` ${key}="${this.escapeHtml(value)}"`)
      .join('')
  }

  /**
   * Р­РєСЂР°РЅРёСЂСѓРµС‚ HTML СЃРїРµС†СЃРёРјРІРѕР»С‹
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
}

export const htmlGenerator = new HtmlGenerator()



