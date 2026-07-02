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
  // Общий CSS страницы (root.metadata.globalCss) дописываем к сгенерированному —
  // экспорт минимальный (без дедупа блоков); канонический рендер — на деплое.
  const globalCss = node.metadata?.globalCss
  const css = nodeToCSS(node, { classPrefix }) + (globalCss ? `\n/* Page CSS */\n${globalCss}\n` : '')

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
    const globalJs = node.metadata?.globalJs
    files.push({
      path: `${safeName}/script.js`,
      content:
        `// ${name} Scripts\ndocument.addEventListener('DOMContentLoaded', () => {\n  console.log('${name} loaded')\n})\n` +
        (globalJs ? `\n// Page JS\n${globalJs}\n` : ''),
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

/**
 * Делит набор деклараций по `;`, игнорируя `;` внутри url()/кавычек/скобок.
 * Иначе data-URI (`url(data:image/svg+xml;base64,...)`) рвётся на части.
 */
function splitDeclarations(css: string): string[] {
  const out: string[] = []
  let depth = 0
  let quote: string | null = null
  let cur = ''
  for (let i = 0; i < css.length; i++) {
    const ch = css[i]
    if (quote) {
      if (ch === quote && css[i - 1] !== '\\') quote = null
      cur += ch
    } else if (ch === '"' || ch === "'") {
      quote = ch
      cur += ch
    } else if (ch === '(') {
      depth++
      cur += ch
    } else if (ch === ')') {
      depth = Math.max(0, depth - 1)
      cur += ch
    } else if (ch === ';' && depth === 0) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur.trim()) out.push(cur)
  return out
}

/** Имя CSS-свойства для объекта стилей: kebab→camel, но `--custom-props` оставляем как есть. */
function toStyleKey(property: string): string {
  if (property.startsWith('--')) return property // CSS-переменные нельзя camelCase'ить
  return property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
}

function parseInlineStyles(styleString: string): Record<string, string> {
  const styles: Record<string, string> = {}
  if (!styleString) return styles

  splitDeclarations(styleString).forEach(rule => {
    // Разделяем только по ПЕРВОМУ двоеточию — значение может содержать `:` (url(https://…)).
    const colonIdx = rule.indexOf(':')
    if (colonIdx === -1) return
    const property = rule.slice(0, colonIdx).trim()
    const value = rule.slice(colonIdx + 1).trim()
    if (!property || !value) return
    styles[toStyleKey(property)] = value
  })

  return styles
}

function htmlElementToBlockNode(
  element: Element,
  base: Map<string, Record<string, string>>,
  statesRules: Map<string, Partial<Record<StateType, Record<string, string>>>>,
): BlockNode | null {
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
  // Состояния (:hover/:active/:focus/:disabled) из правил классов — в правую панель.
  const collectedStates: Partial<Record<StateType, Record<string, string>>> = {}

  // Стили из классов
  const classList = element.classList
  classList.forEach(className => {
    const classStyles = base.get(className)
    if (classStyles) {
      stylesObj = { ...stylesObj, ...classStyles }
    }
    const classStates = statesRules.get(className)
    if (classStates) {
      for (const st of Object.keys(classStates) as StateType[]) {
        collectedStates[st] = { ...(collectedStates[st] || {}), ...classStates[st] }
      }
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
      const childNode = htmlElementToBlockNode(child as Element, base, statesRules)
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
  
  // Собираем attributes — все, кроме style (он разобран отдельно в properties).
  // Важно сохранять class/id: на них держатся сложные правила из globalCss
  // (`.commerce-form input` и т.п.) — без классов вёрстка ломается.
  const attributes: Record<string, string> = {}
  for (let a = 0; a < element.attributes.length; a++) {
    const attr = element.attributes[a]
    if (attr.name === 'style') continue
    attributes[attr.name] = attr.value
  }

  // Определяем layoutMode на основе display стиля
  let layoutMode: BlockNode['layoutMode'] = undefined
  if (stylesObj.display === 'flex') {
    layoutMode = 'flex'
  } else if (stylesObj.display === 'grid') {
    layoutMode = 'grid'
  }
  
  const hasStates = Object.keys(collectedStates).length > 0

  return {
    id: generateUniqueId(),
    elementType,
    tagName,
    styles: {
      properties: stylesObj as CSSProperties,
      ...(hasStates ? { states: collectedStates as BlockNode['styles']['states'] } : {}),
    },
    layoutMode,
    children,
    attributes,
    content: textContent || undefined,
    metadata: {}
  }
}

type StateType = 'hover' | 'active' | 'focus' | 'disabled'

/** Результат разбора таблицы стилей при импорте. */
interface ParsedStylesheet {
  /**
   * className → базовые свойства (инлайнятся в styles.properties).
   * ИСКЛЮЧЕНИЕ: класс, у которого есть ещё и «сырые» правила в leftover
   * (@media/псевдо/комбинаторы), сюда НЕ попадает — его базовое правило уходит
   * в leftover (globalCss), иначе инлайн перебивал бы эти правила.
   */
  base: Map<string, Record<string, string>>
  /** className → состояния (:hover/:active/:focus/:disabled → styles.states). */
  states: Map<string, Partial<Record<StateType, Record<string, string>>>>
  /**
   * Нераспознанное (вложенные селекторы, @media, @keyframes, id/тег, группы) →
   * globalCss. Плюс базовые правила классов, участвующих в этих правилах (см. base).
   */
  leftover: string
}

/**
 * Разбирает CSS, раскладывая то, что умеет показать правая панель, по структурным
 * полям (простой `.class` → properties; `.class:hover|:active|:focus|:disabled` →
 * states), а всё остальное оставляя как сырой CSS (→ globalCss).
 *
 * Сканер сопоставляет фигурные скобки (чтобы корректно пропускать вложенные блоки
 * @media/@keyframes целиком в leftover). Это не полноценный CSS-парсер: фигурные
 * скобки внутри строк/комментариев — редкий кейс и не поддерживаются осознанно.
 */
function parseStylesheet(cssText: string): ParsedStylesheet {
  const base = new Map<string, Record<string, string>>()
  // Сырой текст базового правила класса (нужен, чтобы при необходимости вернуть
  // правило в globalCss как есть, без пересборки из распарсенных свойств).
  const baseRaw = new Map<string, string>()
  const states = new Map<string, Partial<Record<StateType, Record<string, string>>>>()
  const leftover: string[] = []

  let i = 0
  const n = cssText.length
  while (i < n) {
    const braceIdx = cssText.indexOf('{', i)
    if (braceIdx === -1) break

    const prelude = cssText.slice(i, braceIdx).trim()

    // Читаем блок с учётом вложенности скобок (для @media и т.п.)
    let depth = 1
    let j = braceIdx + 1
    for (; j < n; j++) {
      const ch = cssText[j]
      if (ch === '{') depth++
      else if (ch === '}' && --depth === 0) break
    }
    const block = cssText.slice(braceIdx + 1, j)
    i = j + 1

    if (!prelude) continue

    // At-rule (@media/@keyframes/@supports/@font-face) — целиком в leftover.
    if (prelude.startsWith('@')) {
      leftover.push(`${prelude} {${block}}`)
      continue
    }

    // Поддерживаем только одиночный простой селектор класса (опц. с одним состоянием).
    const selectors = prelude.split(',').map(s => s.trim()).filter(Boolean)
    if (selectors.length !== 1) {
      leftover.push(`${prelude} {${block}}`)
      continue
    }

    const sel = selectors[0]
    const baseMatch = sel.match(/^\.([A-Za-z0-9_-]+)$/)
    const stateMatch = sel.match(/^\.([A-Za-z0-9_-]+):(hover|active|focus|disabled)$/)

    if (baseMatch) {
      const cls = baseMatch[1]
      base.set(cls, { ...(base.get(cls) || {}), ...parseInlineStyles(block) })
      baseRaw.set(cls, (baseRaw.has(cls) ? `${baseRaw.get(cls)}\n` : '') + block.trim())
    } else if (stateMatch) {
      const cls = stateMatch[1]
      const st = stateMatch[2] as StateType
      const entry = states.get(cls) || {}
      entry[st] = { ...(entry[st] || {}), ...parseInlineStyles(block) }
      states.set(cls, entry)
    } else {
      leftover.push(`${sel} {${block}}`)
    }
  }

  // Класс, у которого КРОМЕ базового правила есть ещё «сырые» правила в leftover
  // (@media / :pseudo-элементы / комбинаторы / группы), нельзя инлайнить: инлайн-
  // стиль элемента (style="…") перебивает правила из globalCss без !important, и
  // тогда `@media .cls{…}` и `.parent .cls{…}` не срабатывают (адаптив/темизация
  // ломаются — ровно этот баг с бургер-меню). Поэтому базовое правило таких классов
  // тоже оставляем сырым в globalCss — ПЕРЕД остальным leftover, чтобы @media и
  // сложные селекторы могли его переопределять — и убираем из base (не инлайним).
  const leftoverStr = leftover.join('\n\n')
  const referenced = new Set<string>()
  for (const m of leftoverStr.matchAll(/\.([A-Za-z0-9_-]+)/g)) referenced.add(m[1])

  const movedRules: string[] = []
  for (const cls of Array.from(base.keys())) {
    if (referenced.has(cls)) {
      movedRules.push(`.${cls} {${baseRaw.get(cls) ?? ''}}`)
      base.delete(cls)
    }
  }

  return { base, states, leftover: [...movedRules, ...leftover].join('\n\n').trim() }
}

/**
 * Ассеты документа, извлечённые при импорте/слиянии HTML.
 * - css / js — содержимое инлайновых <style>/<script> (→ globalCss/globalJs);
 * - rawHead / rawBodyEnd — внешние/прочие теги (<link rel=stylesheet>, <script src>),
 *   которые нельзя заинлайнить → сохраняются как сырой HTML (customHeadHtml/customBodyEndHtml).
 */
export interface DocumentAssets {
  css: string
  js: string
  rawHead: string
  rawBodyEnd: string
}

const ASSET_TAGS = new Set(['STYLE', 'SCRIPT', 'LINK'])

function isAssetTag(el: Element): boolean {
  const tag = el.tagName.toUpperCase()
  if (tag === 'LINK') return el.getAttribute('rel') === 'stylesheet'
  return ASSET_TAGS.has(tag)
}

/** Классифицирует ассет-элемент: инлайновый CSS/JS либо «сырой» (внешний/прочий). */
function classifyAsset(el: Element): { kind: 'css' | 'js' | 'raw'; value: string } {
  const tag = el.tagName.toUpperCase()
  if (tag === 'STYLE') {
    const content = el.textContent?.trim() || ''
    return content ? { kind: 'css', value: content } : { kind: 'raw', value: '' }
  }
  if (tag === 'SCRIPT') {
    if (el.getAttribute('src')) return { kind: 'raw', value: el.outerHTML }
    const content = el.textContent?.trim() || ''
    return content ? { kind: 'js', value: content } : { kind: 'raw', value: '' }
  }
  // <link rel="stylesheet"> и прочее
  return { kind: 'raw', value: el.outerHTML }
}

/**
 * Извлекает CSS/JS/сырой HTML из документа.
 * - topLevelOnly=false (импорт «с нуля»): берём все <style>/<script>/<link> документа —
 *   дерево их всё равно отбрасывает, иначе код был бы потерян;
 * - topLevelOnly=true (слияние из редактора исходника): только прямые дети <head>/<body>,
 *   чтобы не задвоить <script>, лежащий внутри html-code блока (он остаётся в его контенте).
 */
export function extractDocumentAssets(
  doc: Document,
  options: { topLevelOnly?: boolean } = {},
): DocumentAssets {
  const css: string[] = []
  const js: string[] = []
  const rawHead: string[] = []
  const rawBodyEnd: string[] = []

  const collect = (el: Element, rawBucket: string[]): void => {
    const { kind, value } = classifyAsset(el)
    if (!value) return
    if (kind === 'css') css.push(value)
    else if (kind === 'js') js.push(value)
    else rawBucket.push(value)
  }

  if (options.topLevelOnly) {
    Array.from(doc.head?.children || []).forEach(el => {
      if (isAssetTag(el)) collect(el, rawHead)
    })
    Array.from(doc.body?.children || []).forEach(el => {
      if (isAssetTag(el)) collect(el, rawBodyEnd)
    })
  } else {
    doc.querySelectorAll('style, script, link[rel="stylesheet"]').forEach(el => {
      collect(el, rawHead)
    })
  }

  return {
    css: css.join('\n\n'),
    js: js.join('\n\n'),
    rawHead: rawHead.join('\n'),
    rawBodyEnd: rawBodyEnd.join('\n'),
  }
}

export function importFromHTML(htmlString: string): BlockNode {
  const parser = new DOMParser()
  const doc = parser.parseFromString(htmlString, 'text/html')

  // Разбираем CSS: простые .class → properties, .class:hover/:active/:focus/:disabled
  // → states (правая панель), остальное (@media, вложенные селекторы, keyframes) → leftover.
  const combinedCss = Array.from(doc.querySelectorAll('style'))
    .map(s => s.textContent || '')
    .join('\n')
  const sheet = parseStylesheet(combinedCss)

  // Ассеты документа: инлайн <script>→globalJs, внешние <link>/<script src>→customHeadHtml.
  // CSS из extractDocumentAssets игнорируем — globalCss берём из leftover (без дублей со states).
  const assets = extractDocumentAssets(doc)

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
  const result = htmlElementToBlockNode(rootElement, sheet.base, sheet.states) ?? {
    // Если не удалось спарсить, возвращаем пустой контейнер
    id: generateUniqueId(),
    elementType: 'container' as BlockNode['elementType'],
    tagName: 'div',
    styles: { properties: {} },
    children: [],
    attributes: {},
    metadata: {},
  }

  // Прикрепляем общие стили/скрипты документа к корню (страница/блок).
  // globalCss — только нераспознанный остаток (recognized → properties/states).
  return {
    ...result,
    metadata: {
      ...result.metadata,
      globalCss: sheet.leftover || undefined,
      globalJs: assets.js || undefined,
      customHeadHtml: assets.rawHead || undefined,
    },
  }
}

/**
 * Собирает общий CSS всего дерева (страница + блоки) для живого превью в канвасе.
 * Дедуп по контенту — как на деплое. Site-уровень редактор не знает (он в Site.settings),
 * поэтому в канвасе не отображается.
 */
export function collectTreeGlobalCss(root: BlockNode | null | undefined): string {
  if (!root) return ''
  const set = new Set<string>()
  const visit = (node: BlockNode): void => {
    const css = node.metadata?.globalCss?.trim()
    if (css) set.add(css)
    for (const child of node.children || []) visit(child)
    if (node.variations) {
      for (const v of Object.values(node.variations)) {
        for (const sc of v.specificChildren || []) visit(sc)
      }
    }
  }
  visit(root)
  return Array.from(set).join('\n\n')
}

/**
 * Собирает общий JS всего дерева (страница + блоки) с дедупом по контенту.
 * Используется для опционального выполнения скриптов в холсте редактора.
 */
export function collectTreeGlobalJs(root: BlockNode | null | undefined): string {
  if (!root) return ''
  const set = new Set<string>()
  const visit = (node: BlockNode): void => {
    const js = node.metadata?.globalJs?.trim()
    if (js) set.add(js)
    for (const child of node.children || []) visit(child)
    if (node.variations) {
      for (const v of Object.values(node.variations)) {
        for (const sc of v.specificChildren || []) visit(sc)
      }
    }
  }
  visit(root)
  return Array.from(set).join('\n\n')
}

/**
 * Импорт страницы/блока из набора файлов (html + css + js).
 * CSS/JS подмешиваются в документ и проходят тот же конвейер importFromHTML:
 * CSS → properties/states/globalCss, инлайн JS → globalJs, тело → дерево.
 */
export function importFromFiles(files: { html?: string; css?: string; js?: string }): BlockNode {
  const parser = new DOMParser()
  const doc = parser.parseFromString(files.html || '<body></body>', 'text/html')
  if (files.css?.trim()) {
    const styleEl = doc.createElement('style')
    styleEl.textContent = files.css
    doc.head.appendChild(styleEl)
  }
  if (files.js?.trim()) {
    const scriptEl = doc.createElement('script')
    scriptEl.textContent = files.js
    doc.body.appendChild(scriptEl)
  }
  return importFromHTML('<!DOCTYPE html>' + doc.documentElement.outerHTML)
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
  // Общие стили/скрипты страницы — рендерим как <style>/<script>, чтобы редактор
  // исходника их показывал и round-trip через mergeHtmlIntoTree был стабилен.
  const globalCss = node.metadata?.globalCss || ''
  const globalJs = node.metadata?.globalJs || ''
  const headStyle = globalCss ? `  <style>\n${globalCss}\n  </style>\n` : ''
  const bodyScript = globalJs ? `  <script>\n${globalJs}\n  </script>\n` : ''

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
${headStyle}${customHead ? '  ' + customHead.split('\n').join('\n  ') + '\n' : ''}</head>
<body>
${bodyHTML}
${bodyScript}${customBodyEnd ? '\n' + customBodyEnd + '\n' : ''}</body>
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
 * Parse inline style string into a style object.
 * Делегирует общему parseInlineStyles (устойчивый сплит + сохранение --custom-props).
 */
function parseInlineStyleToCamelCase(style: string): Record<string, string> {
  return parseInlineStyles(style)
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

  // --- Извлекаем ассеты только верхнеуровневых тегов <head>/<body> ---
  // Инлайновые <style>/<script> → globalCss/globalJs; внешние <link>/<script src>
  // остаются сырыми (customHeadHtml/customBodyEndHtml). topLevelOnly не даёт
  // задвоить <script> внутри html-code блока (он остаётся в его контенте).
  const assets = extractDocumentAssets(doc, { topLevelOnly: true })
  const globalCss = assets.css || undefined
  const globalJs = assets.js || undefined
  const customHeadHtml = assets.rawHead || undefined
  const customBodyEndHtml = assets.rawBodyEnd || undefined

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

  // Сохраняем извлечённые ассеты на metadata корня
  return {
    ...merged,
    metadata: {
      ...merged.metadata,
      globalCss,
      globalJs,
      customHeadHtml,
      customBodyEndHtml,
    },
  }
}
