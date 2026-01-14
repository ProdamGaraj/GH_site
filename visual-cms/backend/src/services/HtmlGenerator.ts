/**
 * Сервис генерации HTML из структуры страницы
 */

interface BlockNode {
  id: string
  elementType: string
  tagName: string
  content?: string
  attributes?: Record<string, string>
  styles: {
    properties: Record<string, string>
  }
  children: BlockNode[]
  metadata: {
    name?: string
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
   * Генерирует полный HTML документ из структуры страницы
   */
  generatePage(structure: BlockNode, metadata: PageMetadata, slug: string): string {
    const bodyContent = this.renderNode(structure)
    
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
  </style>
</head>
<body>
${bodyContent}
</body>
</html>`
  }

  /**
   * Рекурсивно рендерит узел в HTML
   */
  private renderNode(node: BlockNode, indent: string = '  '): string {
    if (!node) return ''
    
    const tagName = node.tagName || 'div'
    const styles = this.renderStyles(node.styles?.properties || {})
    const attributes = this.renderAttributes(node.attributes || {})
    
    // Void elements (самозакрывающиеся)
    const voidElements = ['input', 'img', 'br', 'hr', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr']
    
    if (voidElements.includes(tagName.toLowerCase())) {
      return `${indent}<${tagName}${styles}${attributes} />\n`
    }
    
    // Текстовый контент
    const textContent = node.content ? this.escapeHtml(node.content) : ''
    
    // Дочерние элементы
    const childrenHtml = node.children?.map(child => 
      this.renderNode(child, indent + '  ')
    ).join('') || ''
    
    // Если нет контента и детей - короткая запись
    if (!textContent && !childrenHtml) {
      return `${indent}<${tagName}${styles}${attributes}></${tagName}>\n`
    }
    
    // Полная запись с контентом
    if (textContent && !childrenHtml) {
      return `${indent}<${tagName}${styles}${attributes}>${textContent}</${tagName}>\n`
    }
    
    return `${indent}<${tagName}${styles}${attributes}>\n${textContent ? indent + '  ' + textContent + '\n' : ''}${childrenHtml}${indent}</${tagName}>\n`
  }

  /**
   * Конвертирует объект стилей в inline style атрибут
   */
  private renderStyles(properties: Record<string, string>): string {
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
    
    return cssString ? ` style="${cssString}"` : ''
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
      .map(([key, value]) => ` ${key}="${this.escapeHtml(value)}"`)
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
}

export const htmlGenerator = new HtmlGenerator()
