/**
 * Утилиты для экспорта блоков и страниц в различные форматы
 */

import type { BlockNode, CSSProperties } from '@/shared/types'

// =====================
// CSS Generation
// =====================

function cssPropertiesToString(props: CSSProperties, indent = 2): string {
  const spaces = ' '.repeat(indent)
  return Object.entries(props)
    .filter(([_, value]) => value !== undefined && value !== '')
    .map(([key, value]) => {
      // Convert camelCase to kebab-case
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
      return `${spaces}${cssKey}: ${value};`
    })
    .join('\n')
}

function generateClassName(node: BlockNode, prefix = ''): string {
  const name = node.metadata?.name || node.tagName || 'element'
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return prefix ? `${prefix}__${sanitized}` : sanitized
}

// =====================
// HTML Export
// =====================

interface HTMLExportOptions {
  includeComments?: boolean
  indentSize?: number
  classPrefix?: string
}

export function nodeToHTML(
  node: BlockNode,
  options: HTMLExportOptions = {},
  depth = 0
): string {
  const { includeComments = true, indentSize = 2, classPrefix = '' } = options
  const indent = ' '.repeat(depth * indentSize)
  const className = generateClassName(node, classPrefix)
  
  // Void elements (self-closing)
  const voidElements = ['img', 'input', 'br', 'hr', 'meta', 'link']
  const isVoid = voidElements.includes(node.tagName?.toLowerCase() || '')
  
  // Build attributes
  const attrs: string[] = [`class="${className}"`]
  
  if (node.attributes) {
    Object.entries(node.attributes).forEach(([key, value]) => {
      if (value) attrs.push(`${key}="${value}"`)
    })
  }
  
  // Special attributes for inputs
  if (node.tagName === 'input' && node.attributes?.placeholder) {
    attrs.push(`placeholder="${node.attributes.placeholder}"`)
  }
  if (node.tagName === 'img' && node.attributes?.src) {
    attrs.push(`src="${node.attributes.src}"`)
    attrs.push(`alt="${node.attributes.alt || ''}"`)
  }
  
  const attrString = attrs.join(' ')
  const comment = includeComments && node.metadata?.name 
    ? `${indent}<!-- ${node.metadata.name} -->\n` 
    : ''
  
  if (isVoid) {
    return `${comment}${indent}<${node.tagName} ${attrString} />`
  }
  
  // HTML code elements - output raw content
  if (node.elementType === 'html-code') {
    const rawContent = node.content || ''
    if (!rawContent) {
      return `${comment}${indent}<${node.tagName} ${attrString}></${node.tagName}>`
    }
    return `${comment}${indent}<${node.tagName} ${attrString}>\n${rawContent}\n${indent}</${node.tagName}>`
  }
  
  // Children
  const childrenHTML = (node.children || [])
    .map(child => nodeToHTML(child, options, depth + 1))
    .join('\n')
  
  // Content
  const content = node.content || ''
  const hasChildren = childrenHTML.length > 0
  
  if (!hasChildren && !content) {
    return `${comment}${indent}<${node.tagName} ${attrString}></${node.tagName}>`
  }
  
  if (!hasChildren && content) {
    return `${comment}${indent}<${node.tagName} ${attrString}>${content}</${node.tagName}>`
  }
  
  return `${comment}${indent}<${node.tagName} ${attrString}>\n${content ? `${indent}  ${content}\n` : ''}${childrenHTML}\n${indent}</${node.tagName}>`
}

export function nodeToCSS(
  node: BlockNode,
  options: { classPrefix?: string } = {},
  selectors: string[] = []
): string {
  const { classPrefix = '' } = options
  const className = generateClassName(node, classPrefix)
  const selector = `.${className}`
  
  let css = ''
  
  // Main styles
  if (node.styles?.properties && Object.keys(node.styles.properties).length > 0) {
    const propsCSS = cssPropertiesToString(node.styles.properties)
    if (propsCSS) {
      css += `${selector} {\n${propsCSS}\n}\n\n`
    }
  }
  
  // Custom CSS
  if (node.styles?.customCSS) {
    css += `/* Custom CSS for ${node.metadata?.name || className} */\n`
    css += `${selector} {\n  ${node.styles.customCSS}\n}\n\n`
  }
  
  // Responsive styles
  if (node.styles?.responsive) {
    Object.entries(node.styles.responsive).forEach(([breakpoint, props]) => {
      const breakpointCSS = cssPropertiesToString(props)
      if (breakpointCSS) {
        // Assume breakpoint is a width value or name
        const mediaQuery = breakpoint.includes('px') 
          ? `@media (max-width: ${breakpoint})`
          : `@media (max-width: ${breakpoint})`
        css += `${mediaQuery} {\n  ${selector} {\n${breakpointCSS.split('\n').map(l => '  ' + l).join('\n')}\n  }\n}\n\n`
      }
    })
  }
  
  // Recursively process children
  (node.children || []).forEach(child => {
    css += nodeToCSS(child, options, [...selectors, selector])
  })
  
  return css
}

export function generateHTMLDocument(
  node: BlockNode,
  options: { title?: string; classPrefix?: string } = {}
): { html: string; css: string } {
  const { title = 'Exported Page', classPrefix = '' } = options
  
  const bodyHTML = nodeToHTML(node, { classPrefix, includeComments: true })
  const css = nodeToCSS(node, { classPrefix })
  
  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
${bodyHTML}
  <script src="script.js"></script>
</body>
</html>`

  return { html, css }
}

// =====================
// React/TSX Export
// =====================

interface ReactExportOptions {
  componentName?: string
  useTypeScript?: boolean
  cssModules?: boolean
}

function sanitizeComponentName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

function nodeToJSX(node: BlockNode, depth = 1): string {
  const indent = '  '.repeat(depth)
  const className = generateClassName(node)
  
  // Void elements
  const voidElements = ['img', 'input', 'br', 'hr']
  const isVoid = voidElements.includes(node.tagName?.toLowerCase() || '')
  
  // Build props
  const props: string[] = [`className={styles['${className}']}`]
  
  if (node.attributes) {
    Object.entries(node.attributes).forEach(([key, value]) => {
      if (value && key !== 'class') {
        props.push(`${key}="${value}"`)
      }
    })
  }
  
  const propsString = props.join(' ')
  
  if (isVoid) {
    return `${indent}<${node.tagName} ${propsString} />`
  }
  
  // HTML code elements - output raw HTML via dangerouslySetInnerHTML
  if (node.elementType === 'html-code') {
    const rawContent = node.content || ''
    if (!rawContent) {
      return `${indent}<${node.tagName} ${propsString} />`
    }
    return `${indent}<${node.tagName} ${propsString} dangerouslySetInnerHTML={{ __html: \`${rawContent.replace(/`/g, '\\`')}\` }} />`
  }
  
  // Children
  const childrenJSX = (node.children || [])
    .map(child => nodeToJSX(child, depth + 1))
    .join('\n')
  
  const content = node.content ? `{/* ${node.metadata?.name || ''} */}\n${indent}  ${node.content}` : ''
  const hasChildren = childrenJSX.length > 0 || content.length > 0
  
  if (!hasChildren) {
    return `${indent}<${node.tagName} ${propsString} />`
  }
  
  return `${indent}<${node.tagName} ${propsString}>
${content}${childrenJSX ? '\n' + childrenJSX : ''}
${indent}</${node.tagName}>`
}

function nodeToCSSModule(node: BlockNode): string {
  const className = generateClassName(node)
  let css = ''
  
  if (node.styles?.properties && Object.keys(node.styles.properties).length > 0) {
    const propsCSS = cssPropertiesToString(node.styles.properties)
    if (propsCSS) {
      css += `.${className} {\n${propsCSS}\n}\n\n`
    }
  }
  
  // Custom CSS
  if (node.styles?.customCSS) {
    css += `.${className} {\n  ${node.styles.customCSS}\n}\n\n`
  }
  
  // Recursively process children
  (node.children || []).forEach(child => {
    css += nodeToCSSModule(child)
  })
  
  return css
}

export function generateReactComponent(
  node: BlockNode,
  options: ReactExportOptions = {}
): { component: string; styles: string } {
  const { 
    componentName = sanitizeComponentName(node.metadata?.name || 'Component'),
    useTypeScript = true,
    cssModules = true 
  } = options
  
  const styleImport = cssModules 
    ? `import styles from './${componentName}.module.css'`
    : `import './${componentName}.css'`
  
  const jsx = nodeToJSX(node, 1)
  const css = nodeToCSSModule(node)
  
  const typeAnnotation = useTypeScript ? ': React.FC' : ''
  
  const component = `import React from 'react'
${styleImport}

${useTypeScript ? `interface ${componentName}Props {\n  // Add props here\n}\n\n` : ''}const ${componentName}${typeAnnotation}${useTypeScript ? `<${componentName}Props>` : ''} = (${useTypeScript ? 'props' : ''}) => {
  return (
${jsx}
  )
}

export default ${componentName}
`

  return { component, styles: css }
}

// =====================
// Vue Export
// =====================

export function generateVueComponent(
  node: BlockNode,
  options: { componentName?: string } = {}
): string {
  const componentName = sanitizeComponentName(
    options.componentName || node.metadata?.name || 'Component'
  )
  
  const html = nodeToHTML(node, { includeComments: false, classPrefix: '' })
    .replace(/class="/g, 'class="')
  const css = nodeToCSS(node, {})
  
  return `<template>
${html}
</template>

<script setup lang="ts">
// ${componentName} component
// Add your logic here
</script>

<style scoped>
${css}
</style>
`
}

// =====================
// JSON Export (for import)
// =====================

export function exportToJSON(node: BlockNode): string {
  return JSON.stringify(node, null, 2)
}

export function importFromJSON(json: string): BlockNode {
  return JSON.parse(json)
}

// =====================
// Archive Generation
// =====================

export interface ExportFile {
  path: string
  content: string
}

export interface ExportResult {
  files: ExportFile[]
  structure: {
    name: string
    type: 'page' | 'block'
    components: string[]
  }
}

export function generateFullExport(
  node: BlockNode,
  options: {
    name: string
    type: 'page' | 'block'
    format: 'html' | 'react' | 'vue'
    includeBlocks?: BlockNode[]
  }
): ExportResult {
  const { name, type, format, includeBlocks = [] } = options
  const files: ExportFile[] = []
  const componentNames: string[] = []
  
  const safeName = name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
  
  if (format === 'html') {
    // Main HTML/CSS/JS
    const { html, css } = generateHTMLDocument(node, { title: name })
    files.push({ path: `${safeName}/index.html`, content: html })
    files.push({ path: `${safeName}/styles.css`, content: css })
    files.push({ 
      path: `${safeName}/script.js`, 
      content: `// ${name} Scripts\ndocument.addEventListener('DOMContentLoaded', () => {\n  console.log('${name} loaded')\n})\n` 
    })
    
    // Export blocks as separate HTML partials
    includeBlocks.forEach(block => {
      const blockName = block.metadata?.name || 'block'
      const blockSafe = blockName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
      componentNames.push(blockName)
      
      const blockHTML = nodeToHTML(block, { includeComments: true })
      const blockCSS = nodeToCSS(block)
      
      files.push({ path: `${safeName}/components/${blockSafe}/${blockSafe}.html`, content: blockHTML })
      files.push({ path: `${safeName}/components/${blockSafe}/${blockSafe}.css`, content: blockCSS })
    })
  } 
  else if (format === 'react') {
    const componentName = sanitizeComponentName(name)
    const { component, styles } = generateReactComponent(node, { componentName, useTypeScript: true })
    
    files.push({ path: `${safeName}/${componentName}.tsx`, content: component })
    files.push({ path: `${safeName}/${componentName}.module.css`, content: styles })
    
    // Index file
    files.push({ 
      path: `${safeName}/index.ts`, 
      content: `export { default as ${componentName} } from './${componentName}'\n` 
    })
    
    // Export blocks as separate components
    includeBlocks.forEach(block => {
      const blockName = sanitizeComponentName(block.metadata?.name || 'Block')
      componentNames.push(blockName)
      
      const { component: blockComp, styles: blockStyles } = generateReactComponent(block, { 
        componentName: blockName,
        useTypeScript: true 
      })
      
      files.push({ path: `${safeName}/components/${blockName}/${blockName}.tsx`, content: blockComp })
      files.push({ path: `${safeName}/components/${blockName}/${blockName}.module.css`, content: blockStyles })
      files.push({ 
        path: `${safeName}/components/${blockName}/index.ts`, 
        content: `export { default as ${blockName} } from './${blockName}'\n` 
      })
    })
    
    // Components index
    if (componentNames.length > 0) {
      const componentsIndex = componentNames
        .map(n => `export { ${n} } from './${n}'`)
        .join('\n')
      files.push({ path: `${safeName}/components/index.ts`, content: componentsIndex + '\n' })
    }
  }
  else if (format === 'vue') {
    const componentName = sanitizeComponentName(name)
    const vue = generateVueComponent(node, { componentName })
    
    files.push({ path: `${safeName}/${componentName}.vue`, content: vue })
    
    // Export blocks
    includeBlocks.forEach(block => {
      const blockName = sanitizeComponentName(block.metadata?.name || 'Block')
      componentNames.push(blockName)
      
      const blockVue = generateVueComponent(block, { componentName: blockName })
      files.push({ path: `${safeName}/components/${blockName}.vue`, content: blockVue })
    })
  }
  
  return {
    files,
    structure: {
      name,
      type,
      components: componentNames
    }
  }
}

// =====================
// Download Helpers
// =====================

export function downloadFile(content: string, filename: string, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function downloadAsZip(files: ExportFile[], zipName: string) {
  // Dynamic import JSZip
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  
  files.forEach(file => {
    zip.file(file.path, file.content)
  })
  
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${zipName}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// =====================
// HTML IMPORT - Парсинг HTML в BlockNode
// =====================

function generateUniqueId(): string {
  return `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function parseInlineStyles(styleString: string): Record<string, string> {
  const styles: Record<string, string> = {}
  if (!styleString) return styles
  
  styleString.split(';').forEach(rule => {
    const [property, value] = rule.split(':').map(s => s.trim())
    if (property && value) {
      // Конвертируем kebab-case в camelCase
      const camelProperty = property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
      styles[camelProperty] = value
    }
  })
  
  return styles
}

function htmlElementToBlockNode(element: Element, cssRules: Map<string, Record<string, string>>): BlockNode | null {
  const tagName = element.tagName.toLowerCase()
  
  // Пропускаем script, style, meta и другие служебные теги
  if (['script', 'style', 'meta', 'link', 'head', 'title', 'noscript'].includes(tagName)) {
    return null
  }
  
  // Определяем тип элемента
  let elementType: BlockNode['elementType'] = 'container'
  
  switch (tagName) {
    case 'div':
    case 'section':
    case 'article':
    case 'header':
    case 'footer':
    case 'nav':
    case 'main':
    case 'aside':
    case 'ul':
    case 'ol':
    case 'li':
    case 'form':
    case 'textarea':
    case 'select':
      elementType = 'container'
      break
    case 'span':
    case 'p':
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
    case 'label':
    case 'a':
      elementType = 'text'
      break
    case 'img':
      elementType = 'image'
      break
    case 'button':
      elementType = 'button'
      break
    case 'input':
      elementType = 'input'
      break
    case 'video':
      elementType = 'video'
      break
    default:
      elementType = 'container'
  }
  
  // Собираем стили из классов и inline
  let stylesObj: Record<string, string> = {}
  
  // Стили из классов
  const classList = element.classList
  classList.forEach(className => {
    const classStyles = cssRules.get(`.${className}`)
    if (classStyles) {
      stylesObj = { ...stylesObj, ...classStyles }
    }
  })
  
  // Inline стили (переопределяют классовые)
  const inlineStyle = element.getAttribute('style')
  if (inlineStyle) {
    stylesObj = { ...stylesObj, ...parseInlineStyles(inlineStyle) }
  }
  
  // Собираем текстовое содержимое только для текстовых элементов
  let textContent = ''
  if (['text', 'button'].includes(elementType)) {
    // Берём только непосредственный текст, без вложенных элементов
    element.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        textContent += child.textContent?.trim() || ''
      }
    })
  }
  
  // Рекурсивно обрабатываем детей
  const children: BlockNode[] = []
  element.childNodes.forEach(child => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const childNode = htmlElementToBlockNode(child as Element, cssRules)
      if (childNode) {
        children.push(childNode)
      }
    } else if (child.nodeType === Node.TEXT_NODE && elementType === 'container') {
      // Текстовые ноды внутри контейнеров превращаем в text элементы
      const text = child.textContent?.trim()
      if (text) {
        children.push({
          id: generateUniqueId(),
          elementType: 'text',
          tagName: 'span',
          styles: { properties: {} },
          children: [],
          attributes: {},
          content: text,
          metadata: {}
        })
      }
    }
  })
  
  // Собираем attributes
  const attributes: Record<string, string> = {}
  
  // Специфичные атрибуты
  const src = element.getAttribute('src')
  if (src) attributes.src = src
  
  const href = element.getAttribute('href')
  if (href) attributes.href = href
  
  const alt = element.getAttribute('alt')
  if (alt) attributes.alt = alt
  
  const placeholder = element.getAttribute('placeholder')
  if (placeholder) attributes.placeholder = placeholder
  
  const type = element.getAttribute('type')
  if (type) attributes.type = type
  
  const value = element.getAttribute('value')
  if (value) attributes.value = value
  
  const name = element.getAttribute('name')
  if (name) attributes.name = name
  
  // Определяем layoutMode на основе display стиля
  let layoutMode: BlockNode['layoutMode'] = undefined
  if (stylesObj.display === 'flex') {
    layoutMode = 'flex'
  } else if (stylesObj.display === 'grid') {
    layoutMode = 'grid'
  }
  
  return {
    id: generateUniqueId(),
    elementType,
    tagName,
    styles: { properties: stylesObj as CSSProperties },
    layoutMode,
    children,
    attributes,
    content: textContent || undefined,
    metadata: {}
  }
}

function parseCSSFromStyle(styleContent: string): Map<string, Record<string, string>> {
  const cssRules = new Map<string, Record<string, string>>()
  
  // Простой парсер CSS правил
  const ruleRegex = /([^{]+)\{([^}]+)\}/g
  let match
  
  while ((match = ruleRegex.exec(styleContent)) !== null) {
    const selector = match[1].trim()
    const declarations = match[2].trim()
    
    // Парсим только простые селекторы классов
    if (selector.startsWith('.') && !selector.includes(' ') && !selector.includes(':')) {
      cssRules.set(selector, parseInlineStyles(declarations))
    }
  }
  
  return cssRules
}

export function importFromHTML(htmlString: string): BlockNode {
  const parser = new DOMParser()
  const doc = parser.parseFromString(htmlString, 'text/html')
  
  // Собираем CSS правила из всех style тегов
  const cssRules = new Map<string, Record<string, string>>()
  doc.querySelectorAll('style').forEach(styleEl => {
    const parsed = parseCSSFromStyle(styleEl.textContent || '')
    parsed.forEach((value, key) => cssRules.set(key, value))
  })
  
  // Ищем основной контент
  let rootElement: Element | null = doc.body
  
  // Если есть main, section или конкретный контейнер - используем его
  const mainContent = doc.querySelector('main') || 
                      doc.querySelector('[data-cms-root]') ||
                      doc.querySelector('section') ||
                      doc.querySelector('article')
  
  if (mainContent) {
    rootElement = mainContent
  }
  
  // Если в body только один элемент - используем его
  const bodyChildren = Array.from(doc.body.children).filter(
    el => !['SCRIPT', 'STYLE', 'META', 'LINK'].includes(el.tagName)
  )
  if (bodyChildren.length === 1) {
    rootElement = bodyChildren[0]
  }
  
  // Парсим в BlockNode
  const result = htmlElementToBlockNode(rootElement, cssRules)
  
  if (!result) {
    // Если не удалось спарсить, возвращаем пустой контейнер
    return {
      id: generateUniqueId(),
      elementType: 'container',
      tagName: 'div',
      styles: { properties: {} },
      children: [],
      attributes: {},
      metadata: {}
    }
  }
  
  return result
}

export type ImportFormat = 'json' | 'html'

export function detectImportFormat(content: string): ImportFormat {
  const trimmed = content.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json'
  }
  return 'html'
}

export function importContent(content: string, format?: ImportFormat): BlockNode {
  const detectedFormat = format || detectImportFormat(content)
  
  if (detectedFormat === 'json') {
    return importFromJSON(content)
  }
  
  return importFromHTML(content)
}

// =====================
// Full Page Inline HTML (for Source Code editor)
// =====================

/**
 * Генерирует HTML узла с inline-стилями (без классов)
 * Используется для редактора исходного кода страницы
 */
function nodeToInlineHTML(node: BlockNode, depth = 1): string {
  const indentSize = 2
  const indent = ' '.repeat(depth * indentSize)

  const tagName = node.tagName || 'div'

  // Build inline style string
  const styleProps = node.styles?.properties || {}
  const styleString = Object.entries(styleProps)
    .filter(([_, value]) => value !== undefined && value !== '')
    .map(([key, value]) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
      return `${cssKey}: ${value}`
    })
    .join('; ')

  // Build attributes
  const attrs: string[] = []
  // Always include data-element-id for merging back
  attrs.push(`data-element-id="${node.id}"`)
  if (node.elementType === 'html-code') {
    attrs.push(`data-element-type="html-code"`)
  }
  if (styleString) {
    attrs.push(`style="${styleString}"`)
  }
  if (node.attributes) {
    Object.entries(node.attributes).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        attrs.push(`${key}="${value}"`)
      }
    })
  }

  // Comment with element name
  const comment = node.metadata?.name
    ? `${indent}<!-- ${node.metadata.name} -->\n`
    : ''

  const attrString = attrs.length > 0 ? ' ' + attrs.join(' ') : ''

  // Void elements
  const voidElements = ['img', 'input', 'br', 'hr', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr']
  if (voidElements.includes(tagName.toLowerCase())) {
    return `${comment}${indent}<${tagName}${attrString} />`
  }

  // HTML code elements — output raw content
  if (node.elementType === 'html-code') {
    const rawContent = node.content || ''
    if (!rawContent) {
      return `${comment}${indent}<${tagName}${attrString}></${tagName}>`
    }
    return `${comment}${indent}<${tagName}${attrString}>\n${rawContent}\n${indent}</${tagName}>`
  }

  // Children
  const childrenHTML = (node.children || [])
    .map(child => nodeToInlineHTML(child, depth + 1))
    .join('\n')

  const content = node.content || ''
  const hasChildren = childrenHTML.length > 0

  if (!hasChildren && !content) {
    return `${comment}${indent}<${tagName}${attrString}></${tagName}>`
  }

  if (!hasChildren && content) {
    return `${comment}${indent}<${tagName}${attrString}>${content}</${tagName}>`
  }

  return `${comment}${indent}<${tagName}${attrString}>\n${content ? `${indent}  ${content}\n` : ''}${childrenHTML}\n${indent}</${tagName}>`
}

/**
 * Генерирует полный HTML-документ страницы с inline-стилями
 * для редактора исходного кода
 */
export function generateFullPageHTML(
  node: BlockNode,
  title = 'Страница'
): string {
  const bodyHTML = nodeToInlineHTML(node, 1)

  // Include custom head/body HTML stored in root node metadata
  const customHead = node.metadata?.customHeadHtml || ''
  const customBodyEnd = node.metadata?.customBodyEndHtml || ''

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
${customHead ? '  ' + customHead.split('\n').join('\n  ') + '\n' : ''}</head>
<body>
${bodyHTML}
${customBodyEnd ? '\n' + customBodyEnd + '\n' : ''}</body>
</html>`
}

// =====================
// Merge HTML back into existing BlockNode tree
// Preserves metadata, scripts, animations, data bindings, etc.
// Only updates: styles.properties, content, attributes, tagName, children structure
// =====================

/**
 * Collect a flat map of all BlockNodes in the tree by their id
 */
function collectNodeMap(node: BlockNode): Map<string, BlockNode> {
  const map = new Map<string, BlockNode>()
  map.set(node.id, node)
  for (const child of node.children || []) {
    const childMap = collectNodeMap(child)
    childMap.forEach((v, k) => map.set(k, v))
  }
  return map
}

/**
 * Parse inline style string into camelCase CSSProperties object
 */
function parseInlineStyleToCamelCase(style: string): Record<string, string> {
  const result: Record<string, string> = {}
  if (!style) return result
  
  style.split(';').forEach(decl => {
    const colonIdx = decl.indexOf(':')
    if (colonIdx === -1) return
    const prop = decl.substring(0, colonIdx).trim()
    const val = decl.substring(colonIdx + 1).trim()
    if (!prop || !val) return
    // Convert kebab-case to camelCase
    const camelProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    result[camelProp] = val
  })
  return result
}

/**
 * Determine element type from tag name (same logic as htmlElementToBlockNode)
 */
function tagToElementType(tagName: string): BlockNode['elementType'] {
  switch (tagName.toLowerCase()) {
    case 'div': case 'section': case 'article': case 'header': case 'footer':
    case 'nav': case 'main': case 'aside': case 'ul': case 'ol': case 'li':
    case 'form': case 'textarea': case 'select':
      return 'container'
    case 'span': case 'p': case 'h1': case 'h2': case 'h3':
    case 'h4': case 'h5': case 'h6': case 'label': case 'a':
      return 'text'
    case 'img': return 'image'
    case 'button': return 'button'
    case 'input': return 'input'
    case 'video': return 'video'
    default: return 'container'
  }
}

/**
 * Convert a DOM Element to a fresh BlockNode (for newly added elements)
 */
function domElementToNewBlockNode(el: Element): BlockNode | null {
  const tagName = el.tagName.toLowerCase()
  if (['script', 'style', 'meta', 'link', 'head', 'title', 'noscript'].includes(tagName)) {
    return null
  }
  
  const elementType = el.getAttribute('data-element-type') === 'html-code'
    ? 'html-code' as const
    : tagToElementType(tagName)

  const inlineStyle = el.getAttribute('style') || ''
  const stylesObj = parseInlineStyleToCamelCase(inlineStyle)

  // Collect attributes (excluding data-element-id, data-element-type, style)
  const attributes: Record<string, string> = {}
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i]
    if (['style', 'data-element-id', 'data-element-type'].includes(attr.name)) continue
    if (attr.value) attributes[attr.name] = attr.value
  }

  // Text content for text/button elements
  let textContent = ''
  if (['text', 'button'].includes(elementType)) {
    el.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        textContent += child.textContent?.trim() || ''
      }
    })
  }

  // For html-code: collect innerHTML as content
  if (elementType === 'html-code') {
    textContent = el.innerHTML
  }

  // Children
  const children: BlockNode[] = []
  if (elementType !== 'html-code') {
    el.childNodes.forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const childNode = domElementToNewBlockNode(child as Element)
        if (childNode) children.push(childNode)
      }
    })
  }

  let layoutMode: BlockNode['layoutMode'] = undefined
  if (stylesObj.display === 'flex') layoutMode = 'flex'
  else if (stylesObj.display === 'grid') layoutMode = 'grid'

  return {
    id: generateUniqueId(),
    elementType,
    tagName,
    styles: { properties: stylesObj as CSSProperties },
    layoutMode,
    children,
    attributes,
    content: textContent || undefined,
    metadata: {},
  }
}

/**
 * Merge a DOM Element tree back into an existing BlockNode tree.
 * - If an element has data-element-id matching an existing node, preserve all metadata/scripts/animations/bindings.
 * - Only update: styles.properties, attributes, content, tagName, children structure.
 * - New elements (no matching id) get created as fresh BlockNodes.
 * - Removed elements (not in new HTML) are dropped.
 */
function mergeElement(
  el: Element,
  oldNodeMap: Map<string, BlockNode>
): BlockNode | null {
  const tagName = el.tagName.toLowerCase()
  if (['script', 'style', 'meta', 'link', 'head', 'title', 'noscript'].includes(tagName)) {
    return null
  }

  const existingId = el.getAttribute('data-element-id')
  const oldNode = existingId ? oldNodeMap.get(existingId) : null

  // Parse new styles from HTML
  const inlineStyle = el.getAttribute('style') || ''
  const newStyles = parseInlineStyleToCamelCase(inlineStyle)

  // Collect new attributes (excluding data-element-id, data-element-type, style)
  const newAttributes: Record<string, string> = {}
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i]
    if (['style', 'data-element-id', 'data-element-type'].includes(attr.name)) continue
    if (attr.value !== undefined) newAttributes[attr.name] = attr.value
  }

  const isHtmlCode = el.getAttribute('data-element-type') === 'html-code' ||
    (oldNode?.elementType === 'html-code')

  // Determine elementType
  const elementType = isHtmlCode
    ? 'html-code' as BlockNode['elementType']
    : (oldNode?.elementType || tagToElementType(tagName))

  // Text content
  let textContent = ''
  if (isHtmlCode) {
    textContent = el.innerHTML
  } else if (['text', 'button'].includes(elementType)) {
    el.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        textContent += child.textContent?.trim() || ''
      }
    })
  }

  // Recursively merge children
  const mergedChildren: BlockNode[] = []
  if (!isHtmlCode) {
    el.childNodes.forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const merged = mergeElement(child as Element, oldNodeMap)
        if (merged) mergedChildren.push(merged)
      }
    })
  }

  if (oldNode) {
    // MATCHED NODE — preserve all metadata, only update visual HTML properties
    let layoutMode = oldNode.layoutMode
    if (newStyles.display === 'flex') layoutMode = 'flex'
    else if (newStyles.display === 'grid') layoutMode = 'grid'

    return {
      ...oldNode,
      tagName,
      elementType,
      styles: {
        ...oldNode.styles,
        properties: newStyles as CSSProperties,
        // Keep: customCSS, responsive, states, stateTransition
      },
      attributes: newAttributes,
      content: textContent || undefined,
      children: mergedChildren,
      layoutMode,
      // Preserved automatically via ...oldNode spread:
      // metadata, scripts, animations, blockReference, variations
    }
  } else {
    // NEW NODE — create fresh
    let layoutMode: BlockNode['layoutMode'] = undefined
    if (newStyles.display === 'flex') layoutMode = 'flex'
    else if (newStyles.display === 'grid') layoutMode = 'grid'

    return {
      id: generateUniqueId(),
      elementType,
      tagName,
      styles: { properties: newStyles as CSSProperties },
      layoutMode,
      children: mergedChildren,
      attributes: newAttributes,
      content: textContent || undefined,
      metadata: {},
    }
  }
}

/**
 * Merge edited HTML back into the existing BlockNode tree.
 * This is the main entry point for the Source Code editor.
 * Preserves: metadata, scripts, animations, data bindings, states, responsive styles, variations.
 * Updates: styles.properties, content, attributes, tagName, children structure.
 * Also extracts <script> and <style> tags and stores them in root metadata.
 */
export function mergeHtmlIntoTree(htmlString: string, existingRoot: BlockNode): BlockNode {
  const parser = new DOMParser()
  const doc = parser.parseFromString(htmlString, 'text/html')

  // Build map of all existing nodes by id
  const oldNodeMap = collectNodeMap(existingRoot)

  // --- Extract custom <script>/<style>/<link> tags from <head> and <body> ---
  const headHtmlParts: string[] = []
  const bodyEndHtmlParts: string[] = []

  // Collect custom tags from <head> (skip meta charset, viewport, title — those are generated)
  doc.head.childNodes.forEach(child => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element
      const tag = el.tagName.toUpperCase()
      // Keep user-added script, style, link tags
      if (['SCRIPT', 'STYLE', 'LINK'].includes(tag)) {
        headHtmlParts.push(el.outerHTML)
      }
    }
  })

  // Collect <script>/<style> tags from <body>
  doc.body.childNodes.forEach(child => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element
      const tag = el.tagName.toUpperCase()
      if (['SCRIPT', 'STYLE'].includes(tag)) {
        bodyEndHtmlParts.push(el.outerHTML)
      }
    }
  })

  const customHeadHtml = headHtmlParts.join('\n') || undefined
  const customBodyEndHtml = bodyEndHtmlParts.join('\n') || undefined

  // Find root content element in new HTML (excluding script/style)
  let rootElement: Element | null = doc.body
  const bodyChildren = Array.from(doc.body.children).filter(
    el => !['SCRIPT', 'STYLE', 'META', 'LINK'].includes(el.tagName)
  )
  if (bodyChildren.length === 1) {
    rootElement = bodyChildren[0]
  }

  if (!rootElement) {
    return existingRoot // fallback: keep old tree
  }

  const merged = mergeElement(rootElement, oldNodeMap)
  if (!merged) return existingRoot

  // Store extracted custom HTML on root node metadata
  return {
    ...merged,
    metadata: {
      ...merged.metadata,
      customHeadHtml,
      customBodyEndHtml,
    },
  }
}
