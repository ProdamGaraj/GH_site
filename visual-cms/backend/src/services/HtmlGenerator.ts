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
  }
  animations?: Animation[]
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
  generatePage(structure: BlockNode, metadata: PageMetadata, slug: string, dataConfig?: PageDataConfig): string {
    const bodyContent = this.renderNode(structure)
    
    // Р“РµРЅРµСЂРёСЂСѓРµРј CSS РґР»СЏ hover, Р°РЅРёРјР°С†РёР№ Рё С‚.Рґ.
    const { css: dynamicCSS, keyframes, scripts } = styleGenerator.generateNodeTreeStyles(structure as any)
    
    return `<!DOCTYPE html>
<html lang="ru">
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
  </style>
</head>
<body>
${bodyContent}
${dataConfig ? generateDataBindingRuntime(dataConfig) : ''}
${scripts ? `<script>\n${scripts}\n</script>` : ''}
</body>
</html>`
  }

  /**
   * РќРµРєСѓСЂСЃРёРІРЅРѕ СЂРµРЅРґРµСЂРёС‚ СѓР·РµР» РІ HTML
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
    
    // РўРµРєСЃС‚РѕРІС‹Р№ РєРѕРЅС‚РµРЅС‚
    const textContent = node.content ? this.escapeHtml(node.content) : ''
    
    // Р”РѕС‡РµСЂРЅРёРµ СЌР»РµРјРµРЅС‚С‹
    const childrenHtml = node.children?.map(child => 
      this.renderNode(child, indent + '  ')
    ).join('') || ''
    
    // Р•СЃР»Рё РЅРµС‚ РєРѕРЅС‚РµРЅС‚Р° Рё РґРµС‚РµР№ - РєРѕСЂРѕС‚РєР°СЏ Р·Р°РїРёСЃСЊ
    if (!textContent && !childrenHtml) {
      return `${indent}<${tagName}${styles}${dataAttr}${attributes}></${tagName}>\n`
    }
    
    // РџРѕР»РЅР°СЏ Р·Р°РїРёСЃСЊ СЃ РєРѕРЅС‚РµРЅС‚РѕРј
    if (textContent && !childrenHtml) {
      return `${indent}<${tagName}${styles}${dataAttr}${attributes}>${textContent}</${tagName}>\n`
    }
    
    return `${indent}<${tagName}${styles}${dataAttr}${attributes}>\n${textContent ? indent + '  ' + textContent + '\n' : ''}${childrenHtml}${indent}</${tagName}>\n`
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



